import { Button } from "@/components/ui/button";
import { Check, ChevronRight, CircleHelp, Headphones, Loader2, LogOut, Mail, Mic, MicOff, Radio, RefreshCw, Send, ShieldCheck, Sparkles, Ticket, Volume2, Wifi, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { streamPublicDiagnosis, type PublicStreamEvent } from "@/lib/public-support-stream";
import { hasActiveSession, signOutCampusFix } from "@/lib/supabase-auth";
import { supabase } from "@/lib/supabase";
import { getAmericanEnglishVoices, getVoiceCapabilities, groupAmericanEnglishVoices, voiceFallbackMessage } from "@/lib/voice-support";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Stage = "clarify" | "retrieve" | "guide" | "check" | "escalate";
type ChatMessage = { id: string; role: "assistant" | "user"; content: string; citations?: Array<{ title: string; sourceUrl?: string | null }> };
type PublicTicket = { id?: string; ticketNumber: string; title: string; status: "open" | "in_progress" | "resolved"; priority?: string; assigneeName?: string | null; assigneeEmail?: string | null; updatedAt?: string };
type TicketGroups = { current: PublicTicket[]; resolved: PublicTicket[] };

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const stages: Array<{ id: Stage; label: string; detail: string }> = [
  { id: "clarify", label: "Understand", detail: "One useful question" },
  { id: "retrieve", label: "Verify", detail: "Knowledge first" },
  { id: "guide", label: "Guide", detail: "Safe next steps" },
  { id: "check", label: "Confirm", detail: "Did it work?" },
  { id: "escalate", label: "Escalate", detail: "Human IT when needed" },
];

const starters = [
  { label: "Wi-Fi will not connect", icon: Wifi, prompt: "Campus Wi-Fi will not connect on my device." },
  { label: "I cannot access my account", icon: CircleHelp, prompt: "I cannot sign in to a campus service." },
  { label: "Printer is unavailable", icon: Wrench, prompt: "The campus printer is unavailable for me." },
];

function ticketRequestIntent(message: string) {
  return /\b(?:raise|create|open|log|submit)\s+(?:an?\s+)?(?:it|support)?\s*ticket\b/i.test(message)
    || /\b(?:please|can you|could you)\s+(?:raise|create|open|log|submit)\b/i.test(message);
}

function ticketStatusLabel(status: PublicTicket["status"]) {
  return status === "resolved" ? "Resolved" : status === "in_progress" ? "In progress" : "Open";
}

function AssistantText({ content }: { content: string }) {
  return <>{content.split("\n").map((line, index) => {
    const formatted = line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => part.startsWith("**") && part.endsWith("**") ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part);
    return line.match(/^\d+\.\s/) ? <div className="step-line" key={index}>{formatted}</div> : <p key={index}>{formatted || "\u00A0"}</p>;
  })}</>;
}

function visitorToken() {
  const key = "campusfix-public-visitor";
  const current = localStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

export default function PublicSupport() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "assistant", content: "**Describe what is not working.** I will ask one useful question at a time, check verified IT guidance, and only create an IT ticket if the problem cannot be safely resolved here." }]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [stage, setStage] = useState<Stage>("clarify");
  const [status, setStatus] = useState("Ready when you are");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [canEscalate, setCanEscalate] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string>();
  const [ticketContact, setTicketContact] = useState<Pick<PublicTicket, "assigneeName" | "assigneeEmail">>();
  const [tickets, setTickets] = useState<TicketGroups>({ current: [], resolved: [] });
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [firstReplyMs, setFirstReplyMs] = useState<number>();
  const [americanVoices, setAmericanVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const sessionRef = useRef<string | undefined>(undefined);
  const requestedTicketRef = useRef(false);
  const token = useMemo(() => visitorToken(), []);
  const activeStageIndex = stages.findIndex(item => item.id === stage);
  const groupedAmericanVoices = useMemo(() => groupAmericanEnglishVoices(americanVoices), [americanVoices]);
  const [visibleStageIndex, setVisibleStageIndex] = useState(activeStageIndex);

  useEffect(() => { contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" }); }, [messages, isStreaming]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if (!getVoiceCapabilities(window).output) return;
    const loadVoices = () => {
      const voices = getAmericanEnglishVoices(window.speechSynthesis);
      setAmericanVoices(voices);
      setSelectedVoiceURI(current => current || voices[0]?.voiceURI || "");
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  useEffect(() => {
    let isCurrent = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (isCurrent) setIsAuthenticated(hasActiveSession(data.session));
    };
    void loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isCurrent) setIsAuthenticated(hasActiveSession(session));
    });
    return () => { isCurrent = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (activeStageIndex <= visibleStageIndex) { setVisibleStageIndex(activeStageIndex); return; }
    const timeout = window.setTimeout(() => setVisibleStageIndex(index => Math.min(index + 1, activeStageIndex)), 360);
    return () => window.clearTimeout(timeout);
  }, [activeStageIndex, visibleStageIndex]);

  const speakLatest = () => {
    const text = [...messages].reverse().find(message => message.role === "assistant")?.content.replace(/[*#_]/g, " ");
    if (!text || !getVoiceCapabilities(window).output) return toast.error(voiceFallbackMessage("output"));
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = americanVoices.find(voice => voice.voiceURI === selectedVoiceURI);
    utterance.lang = selectedVoice?.lang || "en-US";
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!getVoiceCapabilities(window).input || !SpeechRecognition) return toast.error(voiceFallbackMessage("input"));
    if (isListening) { recognitionRef.current?.stop(); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = event => setDraft(event.results[0]?.[0]?.transcript ?? "");
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => { setIsListening(false); toast.error(voiceFallbackMessage("capture")); };
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const response = await fetch(`/api/campusfix/public/tickets?visitorToken=${encodeURIComponent(token)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "CampusFix could not load your tickets.");
      setTickets({ current: Array.isArray(payload.current) ? payload.current : [], resolved: Array.isArray(payload.resolved) ? payload.resolved : [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CampusFix could not load your tickets.");
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleTicketsOpenChange = (open: boolean) => {
    setTicketsOpen(open);
    if (open) void loadTickets();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const errorMessage = await signOutCampusFix(supabase.auth);
    if (errorMessage) {
      toast.error(errorMessage);
      setIsLoggingOut(false);
      return;
    }
    window.location.assign("/login");
  };

  const handleEvent = (event: PublicStreamEvent, placeholderId: string) => {
    if (event.type === "session") { setSessionId(event.sessionId); sessionRef.current = event.sessionId; }
    if (event.type === "status") setStatus(event.label);
    if (event.type === "stage") { setStage(event.stage); setStatus(event.intent); }
    if (event.type === "latency") setFirstReplyMs(event.firstTokenMs);
    if (event.type === "token") setMessages(current => current.map(message => message.id === placeholderId ? { ...message, content: message.content + event.delta } : message));
    if (event.type === "complete") {
      setStage(event.stage); setCanEscalate(event.canEscalate); setStatus(event.stage === "escalate" ? "IT handoff recommended" : "Waiting for your outcome");
      if (event.latency?.firstTokenMs) setFirstReplyMs(event.latency.firstTokenMs);
      setMessages(current => current.map(message => message.id === placeholderId ? { ...message, citations: event.citations } : message));
      if (event.ticket) {
        const ticket = event.ticket as PublicTicket;
        setTickets(current => ticket.status === "resolved"
          ? { current: current.current.filter(item => item.ticketNumber !== ticket.ticketNumber), resolved: [ticket, ...current.resolved.filter(item => item.ticketNumber !== ticket.ticketNumber)] }
          : { current: [ticket, ...current.current.filter(item => item.ticketNumber !== ticket.ticketNumber)], resolved: current.resolved.filter(item => item.ticketNumber !== ticket.ticketNumber) });
        if (ticket.status === "resolved") { setResolved(true); setStatus("Resolved — ticket status updated"); }
        else { setTicketNumber(ticket.ticketNumber); setTicketContact({ assigneeName: ticket.assigneeName, assigneeEmail: ticket.assigneeEmail }); setStatus("Ticket opened and queued for IT"); }
      }
      if (event.canEscalate && requestedTicketRef.current) { requestedTicketRef.current = false; void createTicket(); }
    }
    if (event.type === "error") toast.error(event.message);
  };

  const submit = async (prompt = draft) => {
    const clean = prompt.trim();
    if (!clean || isStreaming) return;
    if (ticketRequestIntent(clean) && canEscalate && (sessionId || sessionRef.current)) {
      setMessages(current => [...current, { id: `user-${Date.now()}`, role: "user", content: clean }]);
      setDraft("");
      void createTicket();
      return;
    }
    const placeholderId = `assistant-${Date.now()}`;
    setMessages(current => [...current, { id: `user-${Date.now()}`, role: "user", content: clean }, { id: placeholderId, role: "assistant", content: "" }]);
    requestedTicketRef.current = ticketRequestIntent(clean) && Boolean(sessionRef.current);
    setDraft(""); setResolved(false); setTicketNumber(undefined); setTicketContact(undefined); setFirstReplyMs(undefined); setIsStreaming(true); setStatus("Understanding the issue");
    try { await streamPublicDiagnosis({ message: clean, visitorToken: token, sessionId }, event => handleEvent(event, placeholderId)); }
    catch (error) { setMessages(current => current.filter(message => message.id !== placeholderId)); toast.error(error instanceof Error ? error.message : "CampusFix could not start."); }
    finally { setIsStreaming(false); }
  };

  const recordOutcome = async (outcome: "resolved" | "still_need_help") => {
    if (!sessionId) return;
    const response = await fetch("/api/campusfix/public/outcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, visitorToken: token, outcome }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error("The outcome could not be saved.");
    if (outcome === "resolved") {
      const ticket = payload.ticket as PublicTicket | undefined;
      if (ticket) setTickets(current => ({ current: current.current.filter(item => item.ticketNumber !== ticket.ticketNumber), resolved: [ticket, ...current.resolved.filter(item => item.ticketNumber !== ticket.ticketNumber)] }));
      setResolved(true); setStatus(ticket ? "Resolved — ticket status updated" : "Resolved — session recorded"); toast.success(ticket ? "Great — your ticket was moved to Resolved." : "Great — the resolution has been recorded.");
    }
    else { setCanEscalate(true); setStage("escalate"); setStatus("An IT ticket can now be created"); }
  };

  const createTicket = async () => {
    const activeSessionId = sessionId || sessionRef.current;
    if (!activeSessionId || ticketNumber) return;
    const response = await fetch("/api/campusfix/public/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: activeSessionId, visitorToken: token }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "The IT ticket could not be created.");
    const ticket = payload.ticket as PublicTicket;
    setTicketNumber(ticket.ticketNumber); setTicketContact({ assigneeName: ticket.assigneeName, assigneeEmail: ticket.assigneeEmail }); setStage("escalate"); setStatus("Ticket created and queued for IT");
    setTickets(current => ({ current: [ticket, ...current.current.filter(item => item.ticketNumber !== ticket.ticketNumber)], resolved: current.resolved }));
    setMessages(current => [...current, { id: `ticket-${Date.now()}`, role: "assistant", content: `**Ticket raised successfully — ${ticket.ticketNumber}.** You can check its status in Tickets.${ticket.assigneeEmail ? ` Contact ${ticket.assigneeName || "the assigned IT support team"} at ${ticket.assigneeEmail} and include this reference number.` : " An official support contact will appear here once IT assigns one."}` }]);
    setTicketsOpen(true); toast.success(`IT ticket ${ticket.ticketNumber} created.`);
  };

  return <main className="support-shell">
    <div className="support-noise" aria-hidden="true" />
    <header className="support-header">
      <div className="brand-lockup"><span className="brand-orbit"><span /></span><span>CampusFix</span><span className="brand-subtitle">IT support, simplified</span></div>
      <div className="header-actions"><div className="header-status"><span className="live-pulse" /> Autonomous first-level support <span className="header-divider" /> No sign-in required</div><Popover open={ticketsOpen} onOpenChange={handleTicketsOpenChange}><PopoverTrigger asChild><button className="tickets-trigger" type="button" aria-label="View your IT tickets"><Ticket size={15} /><span>Tickets</span>{tickets.current.length ? <b>{tickets.current.length}</b> : null}</button></PopoverTrigger><PopoverContent align="end" sideOffset={10} className="tickets-popover"><div className="tickets-popover-head"><div><p className="panel-label">YOUR SUPPORT</p><strong>Tickets</strong></div><button type="button" className="tickets-refresh" onClick={() => void loadTickets()} disabled={ticketsLoading} aria-label="Refresh tickets"><RefreshCw size={14} className={ticketsLoading ? "animate-spin" : ""} /></button></div><div className="ticket-groups">{([{ key: "current", label: "CURRENT", items: tickets.current }, { key: "resolved", label: "RESOLVED", items: tickets.resolved }] as const).map(group => <section key={group.key} className="ticket-group"><p>{group.label}<span>{group.items.length}</span></p>{group.items.length ? group.items.map(item => <article key={item.ticketNumber} className="ticket-list-item"><div><strong>{item.ticketNumber}</strong><span>{item.title}</span></div><em className={`ticket-status ${item.status}`}>{ticketStatusLabel(item.status)}</em>{item.assigneeEmail ? <a href={`mailto:${item.assigneeEmail}?subject=${encodeURIComponent(`CampusFix ${item.ticketNumber}`)}`}><Mail size={12} />{item.assigneeEmail}</a> : <small>Support contact pending assignment</small>}</article>) : <div className="ticket-empty">{group.key === "current" ? "No active tickets yet." : "No resolved tickets yet."}</div>}</section>)}</div></PopoverContent></Popover>{isAuthenticated && <button className="logout-trigger" type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} aria-label="Log out of CampusFix"><LogOut size={14} /><span>{isLoggingOut ? "Logging out…" : "Log out"}</span></button>}</div>
    </header>

    <section className="support-intro motion-enter">
      <div><p className="section-kicker">UNIVERSITY IT SERVICE DESK</p><h1>Fix the everyday stuff.<br /><em>Fast, safely, together.</em></h1></div>
      <p className="intro-copy">CampusFix diagnoses common IT issues without asking for passwords or credentials. It uses verified guidance, reversible steps, and a direct handoff to IT when the issue needs a person.</p>
    </section>

    <section className="support-grid motion-enter" aria-label="CampusFix diagnostic workspace">
      <div className="conversation-panel">
        <div className="panel-topbar"><div><p className="panel-label">LIVE DIAGNOSIS</p><p className="panel-status"><Radio size={13} /> {status}{firstReplyMs ? <span className="latency-readout">First reply {Math.max(0.1, firstReplyMs / 1000).toFixed(1)}s</span> : null}</p></div><div className="voice-actions">{americanVoices.length > 0 && <label className="voice-picker"><span>US voice</span><select value={selectedVoiceURI} onChange={event => setSelectedVoiceURI(event.target.value)} aria-label="Choose a browser-provided American English voice">{groupedAmericanVoices.feminine.length > 0 && <optgroup label="Feminine voice options">{groupedAmericanVoices.feminine.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name.replace(/Microsoft |Google |Apple /g, "")}</option>)}</optgroup>}{groupedAmericanVoices.masculine.length > 0 && <optgroup label="Masculine voice options">{groupedAmericanVoices.masculine.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name.replace(/Microsoft |Google |Apple /g, "")}</option>)}</optgroup>}{groupedAmericanVoices.other.length > 0 && <optgroup label="Other browser voices">{groupedAmericanVoices.other.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name.replace(/Microsoft |Google |Apple /g, "")}</option>)}</optgroup>}</select></label>}<Button variant="ghost" size="icon" className="utility-button" onClick={speakLatest} aria-label="Read last assistant message aloud"><Volume2 size={17} /></Button></div></div>
        <div className="conversation-stream" ref={contentRef} aria-live="polite">
          {messages.map(message => <article key={message.id} className={`message-row message-enter ${message.role}`}>
            {message.role === "assistant" && <div className="message-mark"><Sparkles size={14} /></div>}
            <div className="message-copy">{message.content ? <AssistantText content={message.content} /> : <span className="typing-wave"><i /><i /><i /></span>}{message.citations?.length ? <div className="citation-row">{message.citations.map(citation => citation.sourceUrl ? <a key={citation.title} href={citation.sourceUrl} target="_blank" rel="noreferrer">Source · {citation.title} <ChevronRight size={12} /></a> : <span key={citation.title}>Source · {citation.title}</span>)}</div> : null}</div>
          </article>)}
        </div>
        <div className="quick-starts" aria-label="Common IT issues">{starters.map(item => <button key={item.label} className="starter-chip" onClick={() => submit(item.prompt)} disabled={isStreaming}><item.icon size={14} />{item.label}</button>)}</div>
        <div className="composer-wrap"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Describe the issue — no passwords or private codes." rows={2} disabled={isStreaming} aria-label="Describe the IT issue" /><div className="composer-actions"><button className={`voice-toggle ${isListening ? "listening" : ""}`} onClick={toggleVoice} type="button" aria-label={isListening ? "Stop voice input" : "Use voice input"}>{isListening ? <MicOff size={17} /> : <Mic size={17} />}<span>{isListening ? "Listening" : "Voice"}</span></button><Button className="send-button" onClick={() => submit()} disabled={!draft.trim() || isStreaming}>{isStreaming ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}<span>Send</span></Button></div></div>
      </div>

      <aside className="diagnostic-rail">
        <section className="rail-card diagnosis-card"><div className="rail-heading"><span className="rail-icon"><Headphones size={16} /></span><div><p className="panel-label">DIAGNOSIS FLOW</p><p className="rail-title">One clear step at a time</p></div></div><div className="stage-list">{stages.map((item, index) => <div key={item.id} className={`stage-item ${index <= visibleStageIndex ? "active" : ""} ${index === visibleStageIndex ? "current" : ""}`}><span className="stage-number">{index < visibleStageIndex ? <Check size={12} /> : `0${index + 1}`}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div></section>
        <section className="rail-card safety-card"><ShieldCheck size={18} /><div><p className="panel-label">SAFETY BY DESIGN</p><p>Never asks for passwords, MFA codes, or recovery codes. It will not recommend unsafe network or system changes.</p></div></section>
        <section className="rail-card outcome-card"><p className="panel-label">OUTCOME CHECK</p>{ticketNumber ? <div className="ticket-created"><Ticket size={18} /><div><strong>{ticketNumber}</strong><span>Your IT request is queued.</span>{ticketContact?.assigneeEmail ? <a href={`mailto:${ticketContact.assigneeEmail}?subject=${encodeURIComponent(`CampusFix ${ticketNumber}`)}`}><Mail size={12} />{ticketContact.assigneeEmail}</a> : <small>Support contact pending IT assignment.</small>}<button type="button" onClick={() => setTicketsOpen(true)}>View ticket status</button></div></div> : resolved ? <div className="resolved-state"><Check size={18} /> Resolved and recorded</div> : <><p>Did the last step solve it?</p><div className="outcome-actions"><button onClick={() => recordOutcome("resolved")} disabled={!sessionId || isStreaming}>Yes, fixed</button><button onClick={() => recordOutcome("still_need_help")} disabled={!sessionId || isStreaming}>Not yet</button></div>{canEscalate && <Button onClick={createTicket} className="escalate-button"><Ticket size={16} />Create IT ticket</Button>}</>}</section>
      </aside>
    </section>

    <footer className="support-footer"><span>CampusFix is a first-level IT assistant. It cannot access your account or device.</span><span><RefreshCw size={13} /> Reversible support only</span></footer>
  </main>;
}

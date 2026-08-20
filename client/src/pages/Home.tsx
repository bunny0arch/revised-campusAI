import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { streamCampusFixResponse, type StreamEvent } from "@/lib/campusfix-stream";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowUp, Bot, BrainCircuit, Building2, CircleDot, Cpu, GraduationCap, Loader2, Plus, Sparkles, TicketPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; agent?: string | null; citations?: Array<{ title: string; sourceUrl?: string | null }> | null };
const agents = [
  { label: "IT Diagnostics", value: "it_diagnostics", icon: Cpu, note: "Accounts, Wi-Fi & devices" },
  { label: "Student Support", value: "student_support", icon: Sparkles, note: "Services & resources" },
  { label: "Facilities", value: "facilities", icon: Building2, note: "Spaces & maintenance" },
  { label: "Academic Advisor", value: "academic_advisor", icon: GraduationCap, note: "Courses & planning" },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const conversations = trpc.campusfix.conversations.list.useQuery();
  const createConversation = trpc.campusfix.conversations.create.useMutation();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("Ready to route your request");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageQuery = trpc.campusfix.conversations.messages.useQuery({ conversationId: activeConversationId ?? "" }, { enabled: Boolean(activeConversationId) });

  useEffect(() => { if (!activeConversationId && conversations.data?.[0]) setActiveConversationId(conversations.data[0].id); }, [activeConversationId, conversations.data]);
  useEffect(() => { if (messageQuery.data) setMessages(messageQuery.data.map(item => ({ id: item.id, role: item.role, content: item.content, agent: item.agent, citations: item.citations as ChatMessage["citations"] }))); }, [messageQuery.data]);
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport instanceof HTMLElement) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);
  useEffect(() => { const stored = sessionStorage.getItem("campusfixDraft"); if (stored) { setDraft(stored); sessionStorage.removeItem("campusfixDraft"); } }, []);

  const greeting = useMemo(() => user?.name?.split(" ")[0] || "there", [user?.name]);
  const startConversation = async () => { const created = await createConversation.mutateAsync({ title: "New support request" }); setActiveConversationId(created.id); setMessages([]); return created.id; };
  const send = async (message = draft) => {
    const content = message.trim(); if (!content || streaming) return;
    setDraft(""); setStreaming(true); setStatus("Routing your request"); setActiveAgent(null);
    const assistantId = `local-agent-${Date.now()}`;
    setMessages(previous => [...previous, { id: `local-user-${Date.now()}`, role: "user", content }, { id: assistantId, role: "assistant", content: "" }]);
    try {
      const conversationId = activeConversationId ?? await startConversation();
      await streamCampusFixResponse({ conversationId, message: content, onEvent: (event: StreamEvent) => {
        if (event.event === "status") setStatus(String(event.data.label || "Preparing response"));
        if (event.event === "handoff") { setActiveAgent(String(event.data.agent)); setStatus(String(event.data.label)); }
        if (event.event === "token") setMessages(previous => previous.map(item => item.id === assistantId ? { ...item, content: item.content + String(event.data.delta || "") } : item));
        if (event.event === "complete") { setStatus("Response complete"); setMessages(previous => previous.map(item => item.id === assistantId ? { ...item, agent: String(event.data.agent || ""), citations: (event.data.citations as ChatMessage["citations"]) ?? null } : item)); }
        if (event.event === "error") throw new Error(String(event.data.message));
      }});
      await Promise.all([utils.campusfix.conversations.list.invalidate(), utils.campusfix.conversations.messages.invalidate({ conversationId })]);
    } catch (error) {
      setMessages(previous => previous.map(item => item.id === assistantId ? { ...item, content: "I couldn’t complete that request right now. Please try again in a moment." } : item));
      toast.error(error instanceof Error ? error.message : "CampusFix could not complete the request.");
    } finally { setStreaming(false); setActiveAgent(null); }
  };

  return <div className="mx-auto max-w-[1540px] space-y-6">
    <section className="motion-enter grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative"><p className="eyebrow">Student support, reimagined</p><div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Good to see you, {greeting}.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Describe what you need. CampusFix routes your request to the right specialist, carries context across the conversation, and escalates safely when a person should take over.</p></div><Button onClick={() => startConversation()} variant="outline" className="border-white/10 bg-white/[0.045] text-slate-200 hover:bg-white/[0.09]"><Plus className="mr-2 h-4 w-4" />New conversation</Button></div><div className="mt-7 flex flex-wrap gap-2">{["Wi-Fi isn’t working in the library", "What resources can help me plan my semester?", "Report an issue with a study room"].map(prompt => <button key={prompt} onClick={() => send(prompt)} className="focus-ring rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 py-2 text-xs text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-100">{prompt}</button>)}</div></div></div>
      <div className="glass-panel motion-enter rounded-3xl p-5" style={{ animationDelay: "70ms" }}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-100">Agent network</p><span className="status-dot" /></div><div className="mt-4 grid grid-cols-2 gap-2">{agents.map(agent => <div key={agent.value} className={cn("glass-subtle rounded-xl p-3 transition", activeAgent === agent.value && "border-cyan-300/40 bg-cyan-300/[0.08] shadow-[0_0_30px_rgba(34,211,238,0.08)]")}><agent.icon className="h-4 w-4 text-cyan-200" /><p className="mt-3 text-xs font-medium text-slate-200">{agent.label}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{agent.note}</p></div>)}</div></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)_290px]">
      <aside className="glass-panel hidden min-h-[640px] rounded-3xl p-4 xl:block"><div className="flex items-center justify-between px-2"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recent context</p><button onClick={() => startConversation()} className="focus-ring rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-cyan-200" aria-label="New conversation"><Plus className="h-4 w-4" /></button></div><div className="mt-4 space-y-1">{conversations.data?.length ? conversations.data.map(conversation => <button key={conversation.id} onClick={() => setActiveConversationId(conversation.id)} className={cn("focus-ring w-full rounded-xl px-3 py-3 text-left transition", activeConversationId === conversation.id ? "bg-cyan-300/[0.10] text-cyan-100" : "text-slate-400 hover:bg-white/[0.04]")}><p className="truncate text-sm font-medium">{conversation.title}</p><p className="mt-1 text-[11px] text-slate-500">Updated {new Date(conversation.updatedAt).toLocaleDateString()}</p></button>) : <p className="px-3 py-8 text-center text-xs leading-5 text-slate-500">Start a request to create your private conversation history.</p>}</div></aside>
      <div className="glass-panel flex min-h-[640px] flex-col overflow-hidden rounded-3xl"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300/20 to-blue-500/20 text-cyan-100"><Bot className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-100">Multi-agent workspace</p><p className="mt-0.5 text-xs text-slate-500">{streaming ? status : activeConversationId ? "Context persists privately in this conversation" : "Open a conversation to begin"}</p></div></div>{streaming && <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />}</div><ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1"><div className="mx-auto max-w-3xl space-y-6 p-5 sm:p-7">{!messages.length && <div className="grid min-h-[380px] place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/[0.08] text-cyan-200"><BrainCircuit className="h-6 w-6" /></div><h2 className="mt-5 text-lg font-semibold text-slate-100">What can CampusFix help with?</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Get assistance, troubleshoot an issue, find a resource, or create a support ticket with AI-generated categorization.</p></div></div>}{messages.map(message => <ChatBubble key={message.id} message={message} streaming={streaming} name={user?.name || "You"} />)}</div></ScrollArea><form onSubmit={event => { event.preventDefault(); send(); }} className="border-t border-white/[0.07] bg-[#061427]/30 p-4"><div className="flex items-end gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-2 transition focus-within:border-cyan-300/35 focus-within:bg-white/[0.055]"><Textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Ask CampusFix anything…" className="min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0" rows={1} disabled={streaming} /><Button size="icon" type="submit" disabled={!draft.trim() || streaming} className="h-10 w-10 shrink-0 rounded-xl"><ArrowUp className="h-4 w-4" /></Button></div><p className="mt-2 px-2 text-[11px] text-slate-600">Enter to send · Shift+Enter for a new line · Sensitive changes are flagged for human review.</p></form></div>
      <aside className="space-y-4"><div className="glass-panel rounded-3xl p-5"><div className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-cyan-200" /><p className="text-sm font-semibold text-slate-100">How it works</p></div><ol className="mt-5 space-y-4">{[["01", "Classify", "A routing model selects the right specialist."], ["02", "Assist", "The specialist responds with context and sources."], ["03", "Escalate", "Sensitive or high-impact cases are flagged."]].map(([number, title, note]) => <li key={number} className="flex gap-3"><span className="text-xs font-semibold text-cyan-300">{number}</span><div><p className="text-xs font-medium text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p></div></li>)}</ol></div><div className="glass-panel rounded-3xl p-5"><div className="flex items-center gap-2"><TicketPlus className="h-4 w-4 text-cyan-200" /><p className="text-sm font-semibold text-slate-100">Need a tracked resolution?</p></div><p className="mt-3 text-xs leading-5 text-slate-500">Create a ticket with AI categorization and follow its support workflow from Open to Resolved.</p><Button variant="outline" className="mt-4 w-full border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]" onClick={() => setLocation("/tickets")}>Open ticket center</Button></div></aside>
    </section>
  </div>;
}

function ChatBubble({ message, streaming, name }: { message: ChatMessage; streaming: boolean; name: string }) {
  const assistant = message.role === "assistant";
  return <div className={cn("flex gap-3", assistant ? "justify-start" : "justify-end")}>
    {assistant && <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-300/[0.10] text-cyan-100"><Bot className="h-4 w-4" /></div>}
    <div className={cn("max-w-[86%] rounded-2xl px-4 py-3 sm:max-w-[78%]", assistant ? "glass-subtle text-slate-200" : "bg-gradient-to-br from-blue-500 to-cyan-500 text-[#071325] shadow-lg shadow-blue-950/35")}>
      {assistant ? message.content ? <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p> : streaming ? <span className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Thinking…</span> : null : <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>}
      {assistant && (message.agent || message.citations?.length) && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.08] pt-2.5">{message.agent && <span className="rounded-full bg-cyan-300/[0.10] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-100">{message.agent.replaceAll("_", " ")}</span>}{message.citations?.map(source => source.sourceUrl ? <a key={source.title} href={source.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400 hover:text-cyan-100">Source: {source.title}</a> : <span key={source.title} className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">Source: {source.title}</span>)}</div>}
    </div>
    {!assistant && <Avatar className="mt-1 h-8 w-8 shrink-0 border border-white/10"><AvatarFallback className="bg-white/[0.08] text-[10px] text-slate-300">{name.slice(0, 1)}</AvatarFallback></Avatar>}
  </div>;
}

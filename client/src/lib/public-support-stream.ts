export type PublicTicketLifecycle = { ticketNumber: string; title: string; status: "open" | "in_progress" | "resolved"; priority?: string; assigneeName?: string | null; assigneeEmail?: string | null };

export type PublicStreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "status"; label: string; state: string }
  | { type: "stage"; stage: "clarify" | "retrieve" | "guide" | "check" | "escalate"; intent: string; sourceCount: number }
  | { type: "latency"; firstTokenMs: number }
  | { type: "token"; delta: string }
  | { type: "complete"; stage: "clarify" | "retrieve" | "guide" | "check" | "escalate"; citations: Array<{ title: string; sourceUrl?: string | null }>; canEscalate: boolean; ticket?: PublicTicketLifecycle & { lifecycle?: "opened" | "resolved" }; latency?: { firstTokenMs: number | null; totalMs: number } }
  | { type: "error"; message: string };

export async function streamPublicDiagnosis(input: { message: string; visitorToken: string; sessionId?: string }, onEvent: (event: PublicStreamEvent) => void) {
  const response = await fetch("/api/campusfix/public/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "CampusFix could not begin the diagnosis.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const eventName = frame.split("\n").find(line => line.startsWith("event: "))?.slice(7);
      const payload = frame.split("\n").find(line => line.startsWith("data: "))?.slice(6);
      if (!eventName || !payload) continue;
      try { onEvent({ type: eventName, ...JSON.parse(payload) } as PublicStreamEvent); } catch { /* Ignore malformed frames. */ }
    }
  }
}

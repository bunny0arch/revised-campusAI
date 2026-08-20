import { COOKIE_NAME } from "@shared/const";

export type StreamEvent = { event: "status" | "handoff" | "token" | "complete" | "error"; data: Record<string, unknown> };

function streamHeaders() {
  const headers = new Headers({ "Content-Type": "application/json" });
  try {
    const prefix = `${COOKIE_NAME}=`;
    const pair = sessionStorage.getItem("manus-cookie")?.split(";").find(value => value.trim().startsWith(prefix));
    const token = pair?.trim().slice(prefix.length);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  } catch {
    // Preview bearer fallback is optional; the normal session cookie remains primary.
  }
  return headers;
}

export async function streamCampusFixResponse(input: { conversationId: string; message: string; onEvent: (event: StreamEvent) => void }) {
  const response = await fetch("/api/campusfix/stream", { method: "POST", credentials: "include", headers: streamHeaders(), body: JSON.stringify({ conversationId: input.conversationId, message: input.message }) });
  if (!response.ok || !response.body) throw new Error("The AI request could not be started.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const frames = pending.split("\n\n");
    pending = frames.pop() ?? "";
    for (const frame of frames) {
      const event = (frame.match(/^event: (.+)$/m)?.[1] ?? "status") as StreamEvent["event"];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (!data) continue;
      try { input.onEvent({ event, data: JSON.parse(data) as Record<string, unknown> }); } catch { /* Invalid event payloads are ignored. */ }
    }
  }
}

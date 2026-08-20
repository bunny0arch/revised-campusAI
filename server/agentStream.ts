import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import {
  addNotification,
  buildAgentMessages,
  createAgentRun,
  findKnowledge,
  finishAgentRun,
  listConversationMessages,
  persistMessage,
  routeRequest,
} from "./campusfix";

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function getTextDelta(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const choice = Array.isArray((payload as { choices?: unknown[] }).choices) ? (payload as { choices: Array<{ delta?: { content?: unknown } }> }).choices[0] : undefined;
  return typeof choice?.delta?.content === "string" ? choice.delta.content : "";
}

export async function streamCampusFixAgent(req: Request, res: Response) {
  let agentRunId: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || user.isCron) return res.status(403).json({ error: "User session required" });
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId.trim() : "";
    if (!message || message.length > 6000 || !conversationId) return res.status(400).json({ error: "A valid conversation and message are required" });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    await persistMessage({ conversationId, userId: user.id, role: "user", content: message });
    writeEvent(res, "status", { label: "Routing your request", state: "routing" });
    const decision = await routeRequest(message);
    const history = await listConversationMessages(conversationId, user.id);
    const knowledge = await findKnowledge(message);
    agentRunId = await createAgentRun({ userId: user.id, conversationId, decision });
    writeEvent(res, "handoff", { agent: decision.agent, label: `Connected to ${decision.agent.replaceAll("_", " ")}`, safetyTier: decision.safetyTier });
    if (decision.escalationRequired || decision.safetyTier === "restricted") {
      await addNotification({ userId: null, type: "escalation", title: "CampusFix escalation flagged", body: `${decision.intent}: human review may be required.`, href: "/operations" });
    }

    const controller = new AbortController();
    let closed = false;
    res.on("close", () => {
      closed = true;
      controller.abort();
    });

    const upstream = await fetch(`${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.forgeApiKey}` },
      body: JSON.stringify({ model: "gpt-5-mini", stream: true, messages: buildAgentMessages(history, decision.agent, decision.safetyTier, knowledge) }),
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) throw new Error(`Agent response unavailable (${upstream.status})`);

    writeEvent(res, "status", { label: knowledge.length ? "Using verified campus sources" : "Preparing a source-aware response", state: "responding" });
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.split("\n").find(entry => entry.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const delta = getTextDelta(JSON.parse(payload));
          if (delta) {
            content += delta;
            writeEvent(res, "token", { delta });
          }
        } catch {
          // Malformed upstream frames are intentionally ignored; the request stays recoverable.
        }
      }
    }

    if (!closed) {
      const citations = knowledge.map(article => ({ title: article.title, sourceUrl: article.sourceUrl }));
      await persistMessage({ conversationId, userId: user.id, role: "assistant", content, agent: decision.agent, citations });
      await finishAgentRun(agentRunId, decision.escalationRequired ? "escalated" : "completed", content);
      writeEvent(res, "complete", { agent: decision.agent, citations, escalationRequired: decision.escalationRequired });
      res.end();
    }
  } catch (error) {
    if (agentRunId) await finishAgentRun(agentRunId, "failed", "Agent response could not be completed.").catch(() => undefined);
    if (!res.headersSent) return res.status(500).json({ error: "CampusFix could not complete the request. Please try again." });
    writeEvent(res, "error", { message: "CampusFix could not complete the request. Please try again." });
    res.end();
  }
}

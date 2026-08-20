import type { Message } from "./_core/llm";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const FAST_GROQ_MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
] as const;

type FastRequest = {
  messages: Array<Pick<Message, "role" | "content">>;
  signal?: AbortSignal;
  stream?: boolean;
  responseFormat?: "json_object";
};

function hasGroq() {
  return Boolean(process.env.GROQ_API_KEY);
}

function normalizeMessages(messages: FastRequest["messages"]) {
  return messages.map(message => ({
    role: message.role,
    content: typeof message.content === "string" ? message.content : (Array.isArray(message.content) ? message.content : [message.content]).map(part => typeof part === "string" ? part : "text" in part ? part.text : "").join("\n"),
  }));
}

async function requestFastModel(request: FastRequest): Promise<Response> {
  if (!hasGroq()) throw new Error("Groq is not configured.");
  let lastError: unknown;
  for (const model of FAST_GROQ_MODELS) {
    try {
      const timeout = AbortSignal.timeout(request.stream ? 14_000 : 8_000);
      const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: normalizeMessages(request.messages),
          stream: Boolean(request.stream),
          max_completion_tokens: request.stream ? 300 : 220,
          temperature: 0.15,
          reasoning_effort: "low",
          reasoning_format: "hidden",
          ...(request.responseFormat ? { response_format: { type: request.responseFormat } } : {}),
        }),
        signal,
      });
      if (response.ok && (!request.stream || response.body)) return response;
      lastError = new Error(`Groq ${response.status}`);
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Fast model path is unavailable.");
}

export async function fastJsonCompletion(messages: FastRequest["messages"]) {
  const response = await requestFastModel({ messages, responseFormat: "json_object" });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Fast model did not return a JSON plan.");
  return content;
}

export function streamFastSupportResponse(messages: FastRequest["messages"], signal: AbortSignal) {
  return requestFastModel({ messages, signal, stream: true });
}

export const fastModelPolicy = {
  provider: "groq",
  candidates: FAST_GROQ_MODELS,
  planTimeoutMs: 8_000,
  streamStartTimeoutMs: 14_000,
};

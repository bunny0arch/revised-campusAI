import { describe, expect, it } from "vitest";
import { fastJsonCompletion, streamFastSupportResponse } from "./modelRouter";

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

describe.runIf(Boolean(process.env.GROQ_API_KEY))("Groq provider credential", () => {
  it("authenticates against the lightweight models endpoint", async () => {
    const response = await fetch(GROQ_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    expect(response.ok).toBe(true);
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    expect(payload.data?.some(model => typeof model.id === "string" && model.id.length > 0)).toBe(true);
  });

  it("returns a compact JSON diagnostic plan through the production router", async () => {
    const content = await fastJsonCompletion([
      {
        role: "system",
        content: "Return JSON only with one key named stage and the value clarify.",
      },
      { role: "user", content: "Campus Wi-Fi does not connect." },
    ]);

    expect(JSON.parse(content)).toMatchObject({ stage: "clarify" });
  }, 12_000);

  it("streams an OpenAI-compatible content delta for the public support flow", async () => {
    const response = await streamFastSupportResponse([
      {
        role: "system",
        content: "Give a single short, safe sentence. Do not use markdown.",
      },
      { role: "user", content: "What should I do if the campus printer is offline?" },
    ], AbortSignal.timeout(12_000));

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    let stream = "";
    while (stream.length < 5_000) {
      const chunk = await reader!.read();
      if (chunk.done) break;
      stream += new TextDecoder().decode(chunk.value, { stream: true });
      if (stream.includes('"content"')) break;
    }
    await reader!.cancel();

    expect(stream).toContain("data:");
    expect(stream).toContain('"content"');
  }, 14_000);
});

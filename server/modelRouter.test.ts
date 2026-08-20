import { describe, expect, it, vi } from "vitest";
import { fastJsonCompletion, fastModelPolicy, streamFastSupportResponse } from "./modelRouter";

describe("CampusFix fast model router", () => {
  it("uses the verified Groq fast-model chain for compact diagnostic plans", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"stage":"clarify"}' } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const original = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "test-key";
    await expect(fastJsonCompletion([{ role: "user", content: "Wi-Fi failed" }])).resolves.toContain("clarify");
    expect(fetchMock).toHaveBeenCalledWith("https://api.groq.com/openai/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "openai/gpt-oss-20b",
      max_completion_tokens: 220,
      reasoning_effort: "low",
      reasoning_format: "hidden",
    });
    expect(fastModelPolicy.provider).toBe("groq");
    expect(fastModelPolicy.candidates).toHaveLength(2);
    process.env.GROQ_API_KEY = original;
  });

  it("uses the next Groq candidate when the primary model is unavailable", async () => {
    const original = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"stage":"guide"}' } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fastJsonCompletion([{ role: "user", content: "Printer is offline" }])).resolves.toContain("guide");
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toMatchObject({ model: "openai/gpt-oss-120b" });
    process.env.GROQ_API_KEY = original;
  });

  it("requires a response body when starting a streamed response", async () => {
    const original = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("data: [DONE]\n\n", { status: 200 })));
    await expect(streamFastSupportResponse([{ role: "user", content: "Help" }], new AbortController().signal)).resolves.toBeInstanceOf(Response);
    process.env.GROQ_API_KEY = original;
  });
});

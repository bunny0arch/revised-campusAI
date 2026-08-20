import { describe, expect, it } from "vitest";

const hasValidatedElevenLabs = process.env.ELEVENLABS_ENABLED === "true" && Boolean(process.env.ELEVENLABS_API_KEY);
const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

describe("configured provider credentials", () => {
  it.runIf(hasValidatedElevenLabs)("validates the server-side ElevenLabs credential when explicitly enabled", async () => {
    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    });
    expect(response.ok).toBe(true);
  }, 20_000);

  it.runIf(hasOpenRouter)("validates the server-side OpenRouter credential", async () => {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    expect(response.ok).toBe(true);
  }, 20_000);
});

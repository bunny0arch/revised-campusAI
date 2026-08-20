import { describe, expect, it } from "vitest";
import { getVoiceCapabilities, groupAmericanEnglishVoices, voiceFallbackMessage } from "./voice-support";

describe("public support voice capability fallbacks", () => {
  it("reports independent browser support for voice input and output", () => {
    expect(getVoiceCapabilities({})).toEqual({ input: false, output: false });
    expect(getVoiceCapabilities({ webkitSpeechRecognition: {}, speechSynthesis: {} })).toEqual({ input: true, output: true });
  });

  it("keeps every fallback understandable and typed-support safe", () => {
    expect(voiceFallbackMessage("input")).toContain("still type");
    expect(voiceFallbackMessage("output")).toContain("unavailable");
    expect(voiceFallbackMessage("capture")).toContain("microphone access");
  });

  it("labels only recognizable browser-provided American voice names and leaves unknown options neutral", () => {
    const voice = (name: string) => ({ name, lang: "en-US", voiceURI: name }) as SpeechSynthesisVoice;
    const groups = groupAmericanEnglishVoices([voice("Microsoft Aria Online"), voice("Google US English"), voice("Microsoft David Online")]);
    expect(groups.feminine.map(item => item.name)).toEqual(["Microsoft Aria Online"]);
    expect(groups.masculine.map(item => item.name)).toEqual(["Microsoft David Online"]);
    expect(groups.other.map(item => item.name)).toEqual(["Google US English"]);
  });
});

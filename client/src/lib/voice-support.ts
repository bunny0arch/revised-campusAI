export type VoiceHost = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  speechSynthesis?: unknown;
};

export function getVoiceCapabilities(host?: VoiceHost) {
  return {
    input: Boolean(host?.SpeechRecognition || host?.webkitSpeechRecognition),
    output: Boolean(host?.speechSynthesis),
  };
}

export function getAmericanEnglishVoices(synthesis?: { getVoices: () => SpeechSynthesisVoice[] }) {
  return (synthesis?.getVoices() ?? []).filter(voice => voice.lang.toLowerCase() === "en-us");
}

export type AmericanVoiceGroup = "feminine" | "masculine" | "other";

const feminineVoiceName = /\b(aria|ava|allison|hazel|jenny|karen|kate|moira|samantha|serena|susan|tessa|victoria|zira)\b/i;
const masculineVoiceName = /\b(alex|daniel|david|george|guy|jason|mark|ryan|steven|thomas|tony)\b/i;

/**
 * Browser speech APIs do not provide gender metadata. Group only recognizable
 * platform voice labels and leave everything else unclassified rather than
 * inventing a voice profile that the browser did not supply.
 */
export function groupAmericanEnglishVoices(voices: SpeechSynthesisVoice[]) {
  return voices.reduce<Record<AmericanVoiceGroup, SpeechSynthesisVoice[]>>((groups, voice) => {
    const group = feminineVoiceName.test(voice.name) ? "feminine" : masculineVoiceName.test(voice.name) ? "masculine" : "other";
    groups[group].push(voice);
    return groups;
  }, { feminine: [], masculine: [], other: [] });
}

export function voiceFallbackMessage(kind: "input" | "output" | "capture") {
  if (kind === "input") return "Voice input is not available here. You can still type your issue.";
  if (kind === "output") return "Spoken responses are unavailable in this browser.";
  return "Voice capture could not start. Check microphone access and try again.";
}

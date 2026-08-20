import { describe, expect, it } from "vitest";
import { canCreatePublicTicket, fastInitialDiagnosticPlan, isExplicitPublicTicketRequest, isResolutionConfirmation, nextPublicSessionStatusForOutcome, redactSensitiveSupportInput } from "./publicSupport";

describe("public CampusFix diagnostic privacy guard", () => {
  it("redacts credential-like values before they can be persisted or sent to the model", () => {
    expect(redactSensitiveSupportInput("My password: campusSecret and MFA code: 123456 are rejected.")).toBe("My password: [redacted] and MFA code: [redacted] are rejected.");
  });

  it("preserves ordinary IT issue details", () => {
    expect(redactSensitiveSupportInput("Wi-Fi fails in the library on Windows 11.")).toBe("Wi-Fi fails in the library on Windows 11.");
  });

  it("allows IT ticket escalation only after an unresolved outcome or escalation state", () => {
    expect(canCreatePublicTicket("diagnosing")).toBe(false);
    expect(canCreatePublicTicket("resolved")).toBe(false);
    expect(canCreatePublicTicket("escalated")).toBe(true);
    expect(nextPublicSessionStatusForOutcome("still_need_help")).toBe("escalated");
    expect(nextPublicSessionStatusForOutcome("resolved")).toBe("resolved");
  });

  it("classifies common first-turn IT issues locally while keeping follow-up diagnosis model-driven", () => {
    expect(fastInitialDiagnosticPlan("Campus Wi-Fi will not connect on my phone.", [])).toMatchObject({ stage: "clarify", category: "wifi", escalationRecommended: false });
    expect(fastInitialDiagnosticPlan("The Wi-Fi outage affects all devices in the lab.", [])).toMatchObject({ stage: "escalate", category: "wifi", escalationRecommended: true });
    expect(fastInitialDiagnosticPlan("The network is still down.", [{ role: "assistant", content: "Which network?" }])).toBeUndefined();
  });

  it("recognizes a direct ticket request but not a request to avoid escalation", () => {
    expect(isExplicitPublicTicketRequest("The steps did not work. Please raise an IT ticket.")).toBe(true);
    expect(isExplicitPublicTicketRequest("Please do not raise a ticket yet.")).toBe(false);
  });

  it("recognizes a confirmed resolution while preserving unresolved language", () => {
    expect(isResolutionConfirmation("It is working now, thank you.")).toBe(true);
    expect(isResolutionConfirmation("All good — the issue is resolved.")).toBe(true);
    expect(isResolutionConfirmation("It is not fixed; the Wi-Fi is still down.")).toBe(false);
  });
});

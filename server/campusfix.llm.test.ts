import { describe, expect, it, vi } from "vitest";

const invokeLLM = vi.fn();

vi.mock("./_core/llm", () => ({ invokeLLM }));

const { categorizeTicket, routeRequest } = await import("./campusfix");

describe("CampusFix LLM contracts", () => {
  it("uses a structured specialist-routing decision for a support request", async () => {
    invokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ agent: "it_diagnostics", intent: "wifi connectivity", escalationRequired: false, safetyTier: "guided" }) } }],
    });

    await expect(routeRequest("My residence Wi-Fi keeps disconnecting.")).resolves.toEqual({
      agent: "it_diagnostics",
      intent: "wifi connectivity",
      escalationRequired: false,
      safetyTier: "guided",
    });
    expect(invokeLLM).toHaveBeenLastCalledWith(expect.objectContaining({ model: "gpt-5-mini", response_format: expect.objectContaining({ type: "json_schema" }) }));
  });

  it("persists only schema-shaped AI ticket triage fields into the ticket flow", async () => {
    invokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ category: "facilities", priority: "high", summary: "A study-room access issue is affecting a student." }) } }],
    });

    await expect(categorizeTicket("Study room access is blocked in the north library.")).resolves.toEqual({
      category: "facilities",
      priority: "high",
      summary: "A study-room access issue is affecting a student.",
    });
    expect(invokeLLM).toHaveBeenLastCalledWith(expect.objectContaining({ model: "gpt-5-mini", response_format: expect.objectContaining({ type: "json_schema" }) }));
  });
});

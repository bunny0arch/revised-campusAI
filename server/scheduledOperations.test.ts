import { describe, expect, it } from "vitest";
import { buildDailyAnalyticsInput, buildServiceSignalInput, isStaleUnescalatedOpenTicket } from "./scheduledOperations";

describe("CampusFix scheduled stale-ticket safeguard", () => {
  const now = Date.UTC(2026, 7, 20, 0, 0, 0);

  it("targets only open, un-escalated tickets older than 72 hours", () => {
    expect(isStaleUnescalatedOpenTicket({ status: "open", escalated: false, updatedAt: new Date(now - 72 * 60 * 60 * 1000 - 1) }, now)).toBe(true);
    expect(isStaleUnescalatedOpenTicket({ status: "open", escalated: false, updatedAt: new Date(now - 72 * 60 * 60 * 1000) }, now)).toBe(false);
  });

  it("remains idempotent by rejecting previously escalated or non-open tickets", () => {
    expect(isStaleUnescalatedOpenTicket({ status: "open", escalated: true, updatedAt: new Date(now - 96 * 60 * 60 * 1000) }, now)).toBe(false);
    expect(isStaleUnescalatedOpenTicket({ status: "in_progress", escalated: false, updatedAt: new Date(now - 96 * 60 * 60 * 1000) }, now)).toBe(false);
  });

  it("builds the same summary payload on repeat runs without creating operational records", () => {
    const counts = { open: 4, inProgress: 2, resolved: 9, agentRuns: 15 };
    expect(buildDailyAnalyticsInput(counts)).toEqual(buildDailyAnalyticsInput(counts));
    expect(buildDailyAnalyticsInput(counts)).toEqual({ openTickets: 4, inProgressTickets: 2, resolvedTickets: 9, recordedAgentRuns: 15 });
  });

  it("recomputes deterministic service-signal counts on each repeat check", () => {
    const signals = [{ category: "wifi" }, { category: "wifi" }, { category: "printing" }];
    expect(buildServiceSignalInput(signals)).toEqual({ wifi: 2, printing: 1 });
    expect(buildServiceSignalInput(signals)).toEqual(buildServiceSignalInput(signals));
  });
});

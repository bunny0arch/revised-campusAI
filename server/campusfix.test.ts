import { describe, expect, it } from "vitest";
import { AGENTS, allowedTransitions, buildAgentMessages, nextTicketTransition, ticketMatchesFilter } from "./campusfix";
import { campusfixRouter } from "./routers/campusfix";
import type { TrpcContext } from "./_core/context";

function studentContext(): TrpcContext {
  return {
    user: {
      id: 41,
      openId: "student-41",
      email: "student@example.edu",
      name: "Campus Student",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CampusFix agent boundaries", () => {
  it("defines exactly the four supported specialist agents", () => {
    expect(AGENTS).toEqual(["it_diagnostics", "student_support", "facilities", "academic_advisor"]);
  });

  it("grounds a specialist reply and refuses to imply unsupported campus sources", () => {
    const messages = buildAgentMessages([{ role: "user", content: "My residence Wi-Fi is not working" }], "it_diagnostics", "guided", []);
    expect(messages[0]?.content).toContain("IT Diagnostics specialist");
    expect(messages[0]?.content).toContain("No verified campus knowledge source matched");
    expect(messages[0]?.content).toContain("Never claim to have performed external actions");
  });
});

describe("CampusFix ticket workflow", () => {
  it("enforces the only permitted state progression", () => {
    expect(allowedTransitions.open).toEqual(["in_progress"]);
    expect(allowedTransitions.in_progress).toEqual(["resolved"]);
    expect(allowedTransitions.resolved).toEqual([]);
  });

  it("does not permit bypassing directly from open to resolved", () => {
    expect(allowedTransitions.open).not.toContain("resolved");
  });

  it("filters ticket records by a status and a normalized search phrase", () => {
    const ticket = { ticketNumber: "CF-2026-WIFI01", title: "Library Wi-Fi disconnects", description: "Connection drops in the second-floor study zone.", status: "open" };
    expect(ticketMatchesFilter(ticket, { status: "open", search: "SECOND-FLOOR" })).toBe(true);
    expect(ticketMatchesFilter(ticket, { status: "resolved" })).toBe(false);
    expect(ticketMatchesFilter(ticket, { search: "printing" })).toBe(false);
  });

  it("carries a named assignee into a valid workflow update and timestamps resolution", () => {
    const now = new Date("2026-08-20T00:00:00.000Z");
    expect(nextTicketTransition("open", "in_progress", "A. Rivera", now)).toEqual({ status: "in_progress", assignee: "A. Rivera", resolvedAt: null });
    expect(nextTicketTransition("in_progress", "resolved", "A. Rivera", now)).toEqual({ status: "resolved", assignee: "A. Rivera", resolvedAt: now });
    expect(nextTicketTransition("open", "resolved", "A. Rivera", now)).toBeNull();
  });
});

describe("CampusFix access boundaries", () => {
  it("blocks a student from the IT operations query before data access", async () => {
    const caller = campusfixRouter.createCaller(studentContext());
    await expect(caller.operations.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks a student from advancing another ticket workflow", async () => {
    const caller = campusfixRouter.createCaller(studentContext());
    await expect(caller.tickets.transition({ ticketId: "ticket-1", status: "in_progress" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

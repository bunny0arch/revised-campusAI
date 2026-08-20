import { describe, expect, it } from "vitest";
import { getSessionGateState } from "./session-guard";

describe("getSessionGateState", () => {
  it("authorizes a persisted Supabase access token", () => {
    expect(getSessionGateState({ access_token: "active-session" })).toBe("authorized");
  });

  it("requires login when no persisted session is available", () => {
    expect(getSessionGateState(null)).toBe("unauthorized");
    expect(getSessionGateState({})).toBe("unauthorized");
  });
});

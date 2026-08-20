import { hasActiveSession } from "./supabase-auth";

export type SessionGateState = "authorized" | "unauthorized";

export function getSessionGateState(session: { access_token?: string } | null | undefined): SessionGateState {
  return hasActiveSession(session) ? "authorized" : "unauthorized";
}

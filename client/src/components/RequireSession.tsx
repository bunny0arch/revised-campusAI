import { useEffect, useState, type PropsWithChildren } from "react";
import { useLocation } from "wouter";
import { getSessionGateState, type SessionGateState } from "@/lib/session-guard";
import { supabase } from "@/lib/supabase";

type AccessState = "checking" | SessionGateState;

export default function RequireSession({ children }: PropsWithChildren) {
  const [, setLocation] = useLocation();
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) setAccessState(getSessionGateState(data.session));
    };

    void syncSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAccessState(getSessionGateState(session));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (accessState === "unauthorized") setLocation("/login", { replace: true });
  }, [accessState, setLocation]);

  if (accessState !== "authorized") {
    return <span className="sr-only" role="status">Checking secure session.</span>;
  }

  return <>{children}</>;
}

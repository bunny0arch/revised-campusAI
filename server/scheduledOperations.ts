import type { Request, Response } from "express";
import { and, eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { agentRuns, scheduledOperations, ticketEvents, tickets } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("CampusFix database unavailable");
  return db;
}

export function isStaleUnescalatedOpenTicket(ticket: { status: string; escalated: boolean; updatedAt: Date }, now = Date.now()) {
  return ticket.status === "open" && !ticket.escalated && ticket.updatedAt.getTime() < now - 72 * 60 * 60 * 1000;
}

/**
 * Daily summaries and signal checks are repeat-safe: they recompute a fresh, deterministic
 * aggregate from persisted records and only replace the single schedule-run status record.
 * They intentionally do not create tickets, incidents, or duplicate notifications.
 */
export function buildDailyAnalyticsInput(counts: { open: number; inProgress: number; resolved: number; agentRuns: number }) {
  return { openTickets: counts.open, inProgressTickets: counts.inProgress, resolvedTickets: counts.resolved, recordedAgentRuns: counts.agentRuns };
}

export function buildServiceSignalInput(records: Array<{ category: string }>) {
  return records.reduce<Record<string, number>>((all, ticket) => ({ ...all, [ticket.category]: (all[ticket.category] ?? 0) + 1 }), {});
}

async function escalateStaleTickets() {
  const db = await dbOrThrow();
  const now = Date.now();
  const cutoff = new Date(now - 72 * 60 * 60 * 1000);
  const stale = await db.select().from(tickets).where(and(eq(tickets.status, "open"), eq(tickets.escalated, false), lt(tickets.updatedAt, cutoff)));
  for (const ticket of stale.filter(ticket => isStaleUnescalatedOpenTicket(ticket, now))) {
    await db.update(tickets).set({ escalated: true }).where(eq(tickets.id, ticket.id));
    await db.insert(ticketEvents).values({ id: nanoid(18), ticketId: ticket.id, actorUserId: null, type: "escalated", note: "Scheduled safeguard escalated an unresolved ticket after 72 hours." });
  }
  return `${stale.length} stale ticket${stale.length === 1 ? "" : "s"} escalated.`;
}

async function summarizeOperations() {
  const db = await dbOrThrow();
  const [open, active, resolved, recentRuns] = await Promise.all([
    db.select().from(tickets).where(eq(tickets.status, "open")),
    db.select().from(tickets).where(eq(tickets.status, "in_progress")),
    db.select().from(tickets).where(eq(tickets.status, "resolved")),
    db.select().from(agentRuns).limit(50),
  ]);
  const source = buildDailyAnalyticsInput({ open: open.length, inProgress: active.length, resolved: resolved.length, agentRuns: recentRuns.length });
  const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are the CampusFix IT Diagnostics specialist. Summarize only the supplied aggregate metrics in two concise sentences. Do not invent operational incidents or claim system health." }, { role: "user", content: JSON.stringify(source) }], max_tokens: 180 });
  const summary = typeof response.choices[0]?.message.content === "string" ? response.choices[0].message.content : "Aggregate operational summary unavailable.";
  return summary;
}

async function reviewServiceSignals() {
  const db = await dbOrThrow();
  const recent = await db.select().from(tickets).where(and(eq(tickets.status, "open"), eq(tickets.escalated, false))).limit(50);
  const categories = buildServiceSignalInput(recent);
  const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are the CampusFix IT Diagnostics specialist performing a cautious service-signal review. Use only the ticket category counts supplied. State that this is a support-signal review, not a confirmed infrastructure incident. Return one concise sentence with the most represented category, or say no open support signals are recorded." }, { role: "user", content: JSON.stringify(categories) }], max_tokens: 120 });
  return typeof response.choices[0]?.message.content === "string" ? response.choices[0].message.content : "Support-signal review unavailable.";
}

export async function runCampusFixScheduledOperation(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const db = await dbOrThrow();
    const operation = (await db.select().from(scheduledOperations).where(eq(scheduledOperations.scheduleCronTaskUid, taskUid)).limit(1))[0];
    if (!operation) return res.json({ ok: true, skipped: "orphan" });
    // Summary and service-signal jobs are repeat-safe read/compute operations: every run refreshes
    // only this operation's status/details record. They never create tickets, incidents, events, or notifications.
    const detail = operation.operationKey === "stale-ticket-escalation" ? await escalateStaleTickets() : operation.operationKey === "daily-analytics-summary" ? await summarizeOperations() : operation.operationKey === "system-health-check" ? await reviewServiceSignals() : "Unknown operation skipped.";
    await db.update(scheduledOperations).set({ lastRunAt: new Date(), lastStatus: "success", details: detail }).where(eq(scheduledOperations.id, operation.id));
    return res.json({ ok: true, operation: operation.operationKey, detail });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (taskUid) {
      const db = await getDb();
      await db?.update(scheduledOperations).set({ lastRunAt: new Date(), lastStatus: "failed", details: detail.slice(0, 2000) }).where(eq(scheduledOperations.scheduleCronTaskUid, taskUid));
    }
    return res.status(500).json({ error: detail, context: { url: req.originalUrl, taskUid: taskUid ?? null }, timestamp: new Date().toISOString() });
  }
}

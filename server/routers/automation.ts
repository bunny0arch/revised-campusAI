import { parse as parseCookie } from "cookie";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { scheduledOperations } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getDb } from "../db";
import { createHeartbeatJob } from "../_core/heartbeat";
import { adminProcedure, router } from "../_core/trpc";

const operations = [
  { key: "stale-ticket-escalation", cron: "0 5 2 * * *", description: "Escalates CampusFix tickets that remain open for 72 hours." },
  { key: "daily-analytics-summary", cron: "0 0 6 * * *", description: "Produces a daily CampusFix operational metrics summary." },
  { key: "system-health-check", cron: "0 0 * * * *", description: "Runs a cautious CampusFix IT Diagnostics support-signal review." },
] as const;

export const automationRouter = router({
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(scheduledOperations).orderBy(desc(scheduledOperations.updatedAt));
  }),
  activate: adminProcedure.input(z.object({ operationKey: z.enum(["stale-ticket-escalation", "daily-analytics-summary", "system-health-check"]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("CampusFix database unavailable");
    const existing = (await db.select().from(scheduledOperations).where(eq(scheduledOperations.operationKey, input.operationKey)).limit(1))[0];
    if (existing?.scheduleCronTaskUid) return { taskUid: existing.scheduleCronTaskUid, alreadyActive: true };
    const config = operations.find(item => item.key === input.operationKey);
    if (!config) throw new Error("Unknown operation");
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    if (!sessionToken) throw new Error("Schedule activation requires a normal signed-in session after publication.");
    const job = await createHeartbeatJob({ name: `campusfix-${input.operationKey}-${ctx.user.id}`, cron: config.cron, path: "/api/scheduled/campusfix-operations", payload: { operationKey: input.operationKey }, description: config.description }, sessionToken);
    if (existing) await db.update(scheduledOperations).set({ scheduleCronTaskUid: job.taskUid, lastStatus: "idle", details: "Activated; waiting for the first scheduled run." }).where(eq(scheduledOperations.id, existing.id));
    else await db.insert(scheduledOperations).values({ id: nanoid(18), operationKey: input.operationKey, scheduleCronTaskUid: job.taskUid, lastStatus: "idle", details: "Activated; waiting for the first scheduled run." });
    return { taskUid: job.taskUid, alreadyActive: false, nextExecutionAt: job.nextExecutionAt };
  }),
});

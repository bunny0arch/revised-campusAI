import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { agentRuns, incidents, knowledgeArticles, notifications, ticketEvents, tickets, userProfiles } from "../../drizzle/schema";
import {
  addNotification,
  allowedTransitions,
  categorizeTicket,
  createConversation,
  createId,
  ensureProfile,
  listConversationMessages,
  nextTicketTransition,
  listUserConversations,
  requireDb,
  ticketMatchesFilter,
  type TicketStatus,
} from "../campusfix";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const ticketInput = z.object({ title: z.string().min(4).max(180), description: z.string().min(10).max(5000), location: z.string().max(160).optional() });

function userCanAccessTicket(userId: number, role: "user" | "admin", ticket: { userId: number }) {
  return role === "admin" || ticket.userId === userId;
}

export const campusfixRouter = router({
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => ensureProfile(ctx.user.id)),
    update: protectedProcedure.input(z.object({ campusId: z.string().max(64).optional(), campusRole: z.enum(["student", "faculty", "it_staff"]).optional(), department: z.string().max(140).optional(), program: z.string().max(160).optional(), yearOfStudy: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await ensureProfile(ctx.user.id);
      await db.update(userProfiles).set(input).where(eq(userProfiles.userId, ctx.user.id));
      return ensureProfile(ctx.user.id);
    }),
  }),
  conversations: router({
    list: protectedProcedure.query(({ ctx }) => listUserConversations(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().max(180).optional() })).mutation(({ ctx, input }) => createConversation(ctx.user.id, input.title ?? "New CampusFix conversation")),
    messages: protectedProcedure.input(z.object({ conversationId: z.string().min(1) })).query(({ ctx, input }) => listConversationMessages(input.conversationId, ctx.user.id)),
  }),
  tickets: router({
    list: protectedProcedure.input(z.object({ status: z.enum(["open", "in_progress", "resolved"]).optional(), search: z.string().max(100).optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const records = await db.select().from(tickets).where(ctx.user.role === "admin" ? undefined : eq(tickets.userId, ctx.user.id)).orderBy(desc(tickets.updatedAt));
      return records.filter(ticket => ticketMatchesFilter(ticket, input));
    }),
    create: protectedProcedure.input(ticketInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const triage = await categorizeTicket(`${input.title}\n${input.description}`);
      const id = createId();
      const ticketNumber = `CF-${new Date().getUTCFullYear()}-${nanoid(6).toUpperCase()}`;
      await db.insert(tickets).values({ id, ticketNumber, userId: ctx.user.id, title: input.title, description: input.description, location: input.location ?? null, category: triage.category, priority: triage.priority, aiSummary: triage.summary, diagnosticSummary: triage.summary });
      await db.insert(ticketEvents).values({ id: createId(), ticketId: id, actorUserId: ctx.user.id, type: "created", note: "Ticket created with AI categorization." });
      await addNotification({ userId: null, type: "ticket", title: `New ${triage.priority} ticket`, body: `${ticketNumber}: ${input.title}`, href: "/tickets" });
      return { id, ticketNumber, category: triage.category, priority: triage.priority };
    }),
    transition: adminProcedure.input(z.object({ ticketId: z.string().min(1), status: z.enum(["open", "in_progress", "resolved"]), note: z.string().max(1000).optional(), assignee: z.string().max(120).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db.select().from(tickets).where(eq(tickets.id, input.ticketId)).limit(1);
      const ticket = existing[0];
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      const update = nextTicketTransition(ticket.status as TicketStatus, input.status, input.assignee ?? ticket.assignee ?? undefined);
      if (!update) throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket status must follow Open → In Progress → Resolved." });
      await db.update(tickets).set(update).where(eq(tickets.id, ticket.id));
      await db.insert(ticketEvents).values({ id: createId(), ticketId: ticket.id, actorUserId: ctx.user.id, type: "status_changed", fromStatus: ticket.status, toStatus: input.status, note: input.note ?? null });
      await addNotification({ userId: ticket.userId, type: "ticket", title: `${ticket.ticketNumber} is now ${input.status.replace("_", " ")}`, body: input.note ?? "Your support ticket has been updated.", href: "/tickets" });
      return { success: true };
    }),
    events: protectedProcedure.input(z.object({ ticketId: z.string().min(1) })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const ticket = (await db.select().from(tickets).where(eq(tickets.id, input.ticketId)).limit(1))[0];
      if (!ticket || !userCanAccessTicket(ctx.user.id, ctx.user.role, ticket)) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      return db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, input.ticketId)).orderBy(desc(ticketEvents.createdAt));
    }),
  }),
  knowledge: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select({ id: knowledgeArticles.id, title: knowledgeArticles.title, category: knowledgeArticles.category, sourceUrl: knowledgeArticles.sourceUrl, updatedAt: knowledgeArticles.updatedAt }).from(knowledgeArticles).where(eq(knowledgeArticles.published, true)).orderBy(desc(knowledgeArticles.updatedAt));
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(notifications).where(ctx.user.role === "admin" ? undefined : eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(30);
    }),
    read: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),
  }),
  operations: router({
    overview: adminProcedure.query(async () => {
      const db = await requireDb();
      const [ticketRows, incidentRows, runRows] = await Promise.all([
        db.select().from(tickets).orderBy(desc(tickets.createdAt)),
        db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(8),
        db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(12),
      ]);
      const totals = { all: ticketRows.length, open: ticketRows.filter(t => t.status === "open").length, inProgress: ticketRows.filter(t => t.status === "in_progress").length, resolved: ticketRows.filter(t => t.status === "resolved").length };
      const categoryMap = new Map<string, number>();
      ticketRows.forEach(ticket => categoryMap.set(ticket.category, (categoryMap.get(ticket.category) ?? 0) + 1));
      return { totals, categories: Array.from(categoryMap, ([name, total]) => ({ name, total })), incidents: incidentRows, agentRuns: runRows, resolutionRate: totals.all ? Math.round((totals.resolved / totals.all) * 100) : 0 };
    }),
  }),
});

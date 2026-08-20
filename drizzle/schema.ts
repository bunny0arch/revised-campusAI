import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core identity managed by the platform authentication flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Campus-specific context is deliberately separated from platform identity. */
export const userProfiles = mysqlTable(
  "user_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    campusId: varchar("campusId", { length: 64 }),
    campusRole: mysqlEnum("campusRole", ["student", "faculty", "it_staff"])
      .default("student")
      .notNull(),
    department: varchar("department", { length: 140 }),
    program: varchar("program", { length: 160 }),
    yearOfStudy: varchar("yearOfStudy", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userUnique: uniqueIndex("user_profiles_user_unique").on(table.userId) })
);

/** Local CampusFix credentials are isolated from platform OAuth identity. Passwords are never stored directly. */
export const localAccounts = mysqlTable(
  "local_accounts",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    username: varchar("username", { length: 32 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userUnique: uniqueIndex("local_accounts_user_unique").on(table.userId),
    usernameUnique: uniqueIndex("local_accounts_username_unique").on(table.username),
  })
);

/** Only a SHA-256 digest of each opaque browser session token is retained at rest. */
export const localAccountSessions = mysqlTable(
  "local_account_sessions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tokenUnique: uniqueIndex("local_account_sessions_token_unique").on(table.tokenHash),
    userExpiry: index("local_account_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  })
);

export const conversations = mysqlTable(
  "conversations",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["active", "closed"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userUpdated: index("conversations_user_updated_idx").on(table.userId, table.updatedAt) })
);

export const conversationMessages = mysqlTable(
  "conversation_messages",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 32 }).notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    agent: varchar("agent", { length: 40 }),
    content: text("content").notNull(),
    citations: json("citations").$type<Array<{ title: string; sourceUrl?: string | null }>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ conversationCreated: index("conversation_messages_conversation_created_idx").on(table.conversationId, table.createdAt) })
);

export const agentRuns = mysqlTable(
  "agent_runs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 32 }),
    userId: int("userId").notNull(),
    agent: mysqlEnum("agent", ["orchestrator", "it_diagnostics", "student_support", "facilities", "academic_advisor"]).notNull(),
    status: mysqlEnum("status", ["routing", "running", "completed", "escalated", "failed"]).default("routing").notNull(),
    intent: varchar("intent", { length: 80 }),
    summary: text("summary"),
    escalationRequired: boolean("escalationRequired").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => ({ userCreated: index("agent_runs_user_created_idx").on(table.userId, table.createdAt) })
);

export const tickets = mysqlTable(
  "tickets",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ticketNumber: varchar("ticketNumber", { length: 24 }).notNull().unique(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    category: mysqlEnum("category", ["wifi", "account", "software", "hardware", "printing", "facilities", "academic", "general"]).default("general").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
    status: mysqlEnum("status", ["open", "in_progress", "resolved"]).default("open").notNull(),
    assignee: varchar("assignee", { length: 120 }),
    location: varchar("location", { length: 160 }),
    aiSummary: text("aiSummary"),
    diagnosticSummary: text("diagnosticSummary"),
    escalated: boolean("escalated").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  table => ({ statusUpdated: index("tickets_status_updated_idx").on(table.status, table.updatedAt), userUpdated: index("tickets_user_updated_idx").on(table.userId, table.updatedAt) })
);

export const ticketEvents = mysqlTable(
  "ticket_events",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ticketId: varchar("ticketId", { length: 32 }).notNull(),
    actorUserId: int("actorUserId"),
    type: mysqlEnum("type", ["created", "assigned", "status_changed", "comment", "escalated"]).notNull(),
    fromStatus: mysqlEnum("fromStatus", ["open", "in_progress", "resolved"]),
    toStatus: mysqlEnum("toStatus", ["open", "in_progress", "resolved"]),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ ticketCreated: index("ticket_events_ticket_created_idx").on(table.ticketId, table.createdAt) })
);

export const knowledgeArticles = mysqlTable(
  "knowledge_articles",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    content: text("content").notNull(),
    sourceUrl: varchar("sourceUrl", { length: 1000 }),
    published: boolean("published").default(false).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ publishedCategory: index("knowledge_articles_published_category_idx").on(table.published, table.category) })
);

export const incidents = mysqlTable(
  "incidents",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    title: varchar("title", { length: 180 }).notNull(),
    service: varchar("service", { length: 100 }).notNull(),
    affectedArea: varchar("affectedArea", { length: 180 }),
    severity: mysqlEnum("severity", ["minor", "major", "critical"]).default("minor").notNull(),
    status: mysqlEnum("status", ["investigating", "monitoring", "resolved"]).default("investigating").notNull(),
    aiInsight: text("aiInsight"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  table => ({ statusCreated: index("incidents_status_created_idx").on(table.status, table.createdAt) })
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId"),
    type: mysqlEnum("type", ["ticket", "incident", "escalation", "system"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    href: varchar("href", { length: 300 }),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userCreated: index("notifications_user_created_idx").on(table.userId, table.createdAt) })
);

export const scheduledOperations = mysqlTable(
  "scheduled_operations",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    operationKey: varchar("operationKey", { length: 80 }).notNull().unique(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    lastRunAt: timestamp("lastRunAt"),
    lastStatus: mysqlEnum("lastStatus", ["idle", "success", "failed"]).default("idle").notNull(),
    details: text("details"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);

/** Public, privacy-minimized support records used by the no-login diagnostic prototype. */
export const publicSupportSessions = mysqlTable(
  "public_support_sessions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    visitorToken: varchar("visitorToken", { length: 64 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["diagnosing", "resolved", "escalated"]).default("diagnosing").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ visitorUpdated: index("public_support_sessions_visitor_updated_idx").on(table.visitorToken, table.updatedAt) })
);

export const publicSupportMessages = mysqlTable(
  "public_support_messages",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    sessionId: varchar("sessionId", { length: 32 }).notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    stage: mysqlEnum("stage", ["clarify", "retrieve", "guide", "check", "escalate"]).notNull(),
    content: text("content").notNull(),
    citations: json("citations").$type<Array<{ title: string; sourceUrl?: string | null }>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ sessionCreated: index("public_support_messages_session_created_idx").on(table.sessionId, table.createdAt) })
);

export const publicSupportTickets = mysqlTable(
  "public_support_tickets",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ticketNumber: varchar("ticketNumber", { length: 24 }).notNull().unique(),
    sessionId: varchar("sessionId", { length: 32 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    category: mysqlEnum("category", ["wifi", "account", "password", "software", "network", "printing", "configuration", "general"]).default("general").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
    status: mysqlEnum("status", ["open", "in_progress", "resolved"]).default("open").notNull(),
    triageSummary: text("triageSummary"),
    assigneeName: varchar("assigneeName", { length: 120 }),
    assigneeEmail: varchar("assigneeEmail", { length: 320 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ sessionUpdated: index("public_support_tickets_session_updated_idx").on(table.sessionId, table.updatedAt) })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type LocalAccount = typeof localAccounts.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type PublicSupportSession = typeof publicSupportSessions.$inferSelect;

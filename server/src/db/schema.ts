import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  rpmLimit: integer("rpm_limit").notNull(),
  tpmLimit: integer("tpm_limit").notNull(),
  priority: text("priority", { enum: ["high", "medium", "low"] })
    .notNull()
    .default("medium"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usageLogs = pgTable("usage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  tokensUsed: integer("tokens_used").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  statusCode: integer("status_code").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

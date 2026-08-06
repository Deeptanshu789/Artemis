import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewerId: text("interviewer_id").notNull(),
  interviewerName: text("interviewer_name"),
  candidateLabel: text("candidate_label"),
  status: text("status").notNull(),
  platform: text("platform").notNull().default("google_meet"),
  transcript: jsonb("transcript").notNull().default(sql`'[]'::jsonb`),
  scoring: jsonb("scoring"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

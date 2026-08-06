import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config.js";
import * as schema from "./schema.js";

let sql: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function databaseUrlConfigured(): boolean {
  return Boolean(env.databaseUrl);
}

export function getDb() {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL missing. Supabase → Project Settings → Database → Connection string (URI). Paste into .env as DATABASE_URL.",
    );
  }
  if (!db) {
    sql = postgres(env.databaseUrl, { prepare: false, max: 5 });
    db = drizzle(sql, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
    db = null;
  }
}

export { schema };

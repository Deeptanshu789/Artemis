/**
 * Wipe all rows from public.sessions (Drizzle).
 * Usage: npm run db:reset -w @artemis/server
 */
import { closeDb, databaseUrlConfigured, getDb, schema } from "../db/client.js";
import { log } from "../services/sessionStore.js";

async function main() {
  if (!databaseUrlConfigured()) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "DATABASE_URL required to reset sessions",
      }),
    );
    process.exit(1);
  }

  const db = getDb();
  const deleted = await db.delete(schema.sessions).returning({ id: schema.sessions.id });
  log(undefined, "db_reset_sessions", { deleted: deleted.length });
  console.log(JSON.stringify({ ok: true, deleted: deleted.length }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb().catch(() => undefined));

import { seedAndClose } from "../services/seedDemo.js";
import { env } from "../config.js";
import { databaseUrlConfigured } from "../db/client.js";

async function main() {
  if (!databaseUrlConfigured()) {
    console.error(
      JSON.stringify({
        error: "DATABASE_URL required for Drizzle seed",
        hint: "Supabase → Settings → Database → Connection string (URI). Or set SUPABASE_DB_PASSWORD.",
      }),
    );
    process.exit(1);
  }
  const count = await seedAndClose();
  console.log({
    seeded: count,
    via: "drizzle",
    dashboardUrl: env.dashboardUrl,
    interviewerId: "demo-interviewer-b",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

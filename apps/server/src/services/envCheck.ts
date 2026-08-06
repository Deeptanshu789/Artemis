import { env } from "../config.js";
import { supabaseConfigured } from "../services/supabase.js";
import { databaseUrlConfigured } from "../db/client.js";

export type EnvReport = {
  ok: boolean;
  demoMode: boolean;
  warnings: string[];
  missingForLive: string[];
  ready: {
    deepgram: boolean;
    gemini: boolean;
    supabase: boolean;
    drizzle: boolean;
  };
};

/** Non-fatal validation for /health and startup logs. */
export function validateEnv(): EnvReport {
  const warnings: string[] = [];
  const missingForLive: string[] = [];

  const deepgram = Boolean(env.deepgramApiKey);
  const gemini = Boolean(env.geminiApiKey);
  const supabase = supabaseConfigured();
  const drizzle = databaseUrlConfigured();

  if (env.demoMode) {
    warnings.push("DEMO_MODE=true — using fixture STT/scoring; not production.");
  } else {
    if (!deepgram) missingForLive.push("DEEPGRAM_API_KEY");
    if (!gemini) missingForLive.push("GEMINI_API_KEY");
    if (!supabase) {
      warnings.push("Supabase unset — REST auth/client limited.");
      missingForLive.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!drizzle) {
      warnings.push(
        "DATABASE_URL unset — Drizzle seed/push unavailable. Add Postgres URI from Supabase Database settings.",
      );
      missingForLive.push("DATABASE_URL");
    }
  }

  if (!env.corsOrigin) warnings.push("CORS_ORIGIN empty");
  if (env.isProd && !env.adminToken) {
    warnings.push("ADMIN_TOKEN unset — /admin/* routes refuse all requests in production.");
  }
  if (env.isProd && env.corsOrigins === true) {
    warnings.push("CORS_ORIGIN=* in production — prefer explicit dashboard origin(s).");
  }

  return {
    ok: env.demoMode || (deepgram && gemini),
    demoMode: env.demoMode,
    warnings,
    missingForLive,
    ready: { deepgram, gemini, supabase, drizzle },
  };
}

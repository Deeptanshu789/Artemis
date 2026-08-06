import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    if (process.env.DEMO_MODE === "true" || process.env.NODE_ENV === "test") {
      return fallback ?? "";
    }
  }
  return v ?? "";
}

/** Build DATABASE_URL from Supabase password if full URI not set. */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (password && ref) {
    const encoded = encodeURIComponent(password);
    return `postgresql://postgres.${ref}:${encoded}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  }
  return "";
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  dashboardUrl: process.env.DASHBOARD_URL ?? "http://localhost:5173",
  deepgramApiKey: required("DEEPGRAM_API_KEY"),
  geminiApiKey: required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  databaseUrl: resolveDatabaseUrl(),
  demoMode: process.env.DEMO_MODE === "true",
  nodeEnv: process.env.NODE_ENV ?? "development",
  maxSessionMs: Number(process.env.MAX_SESSION_MS ?? 90 * 60 * 1000),
};

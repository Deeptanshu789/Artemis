import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

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

function parseCorsOrigins(): string[] | true {
  const raw = (process.env.CORS_ORIGIN ?? "http://localhost:5173").trim();
  if (raw === "*") return true;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";
const demoMode = process.env.DEMO_MODE === "true";

if (isProd && demoMode && process.env.ALLOW_DEMO_IN_PROD !== "true") {
  throw new Error(
    "DEMO_MODE=true blocked in production. Set ALLOW_DEMO_IN_PROD=true to override, or DEMO_MODE=false.",
  );
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  corsOrigins: parseCorsOrigins(),
  dashboardUrl: process.env.DASHBOARD_URL ?? "http://localhost:5173",
  deepgramApiKey: required("DEEPGRAM_API_KEY"),
  geminiApiKey: required("GEMINI_API_KEY"),
  /** Default: gemini-2.5-flash — https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash */
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  /** When true, Gemini failures fall back to heuristic demo scores (dev only). */
  scoringFallbackDemo: process.env.SCORING_FALLBACK_DEMO === "true",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  databaseUrl: resolveDatabaseUrl(),
  demoMode,
  nodeEnv,
  isProd,
  adminToken: process.env.ADMIN_TOKEN ?? "",
  maxSessionMs: Number(process.env.MAX_SESSION_MS ?? 90 * 60 * 1000),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? "2mb",
};

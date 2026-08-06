import express from "express";
import cors from "cors";
import http from "node:http";
import { env } from "./config.js";
import { sessionsRouter } from "./routes/sessions.js";
import { attachAudioWs } from "./ws/audio.js";
import { supabaseConfigured } from "./services/supabase.js";
import { seedDemoInterviewerB } from "./services/seedDemo.js";
import { validateEnv } from "./services/envCheck.js";
import { closeDb, databaseUrlConfigured, getDb, schema } from "./db/client.js";
import { clearAllMemorySessions, log } from "./services/sessionStore.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (env.isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  cors({
    origin(origin, cb) {
      const allowed = env.corsOrigins;
      if (allowed === true) {
        cb(null, true);
        return;
      }
      // Non-browser / same-origin / curl
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowed.includes(origin) || origin.startsWith("chrome-extension://")) {
        cb(null, true);
        return;
      }
      cb(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: env.jsonBodyLimit }));

function requireAdmin(req: express.Request, res: express.Response): boolean {
  if (env.isProd && !env.adminToken) {
    res.status(403).json({
      error: "Admin routes disabled in production until ADMIN_TOKEN is set",
    });
    return false;
  }
  if (env.adminToken) {
    const token = req.header("x-admin-token") ?? "";
    if (token !== env.adminToken) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
  }
  return true;
}

app.get("/health", (_req, res) => {
  const report = validateEnv();
  res.json({
    ok: report.ok || report.demoMode,
    env: env.nodeEnv,
    demoMode: env.demoMode,
    supabase: supabaseConfigured(),
    drizzle: databaseUrlConfigured(),
    deepgram: Boolean(env.deepgramApiKey),
    mistral: Boolean(env.mistralApiKey),
    mistralModel: env.mistralModel,
    warnings: report.warnings,
    missingForLive: report.missingForLive,
    ready: report.ready,
  });
});

app.post("/admin/seed-demo", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await seedDemoInterviewerB();
    res.json({ ok: true, count, via: databaseUrlConfigured() ? "drizzle" : "memory" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/admin/reset-db", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const clearedMemory = clearAllMemorySessions();
    let deleted = 0;
    if (databaseUrlConfigured()) {
      const db = getDb();
      const rows = await db.delete(schema.sessions).returning({ id: schema.sessions.id });
      deleted = rows.length;
    }
    log(undefined, "admin_reset_db", { deleted, clearedMemory });
    res.json({ ok: true, deleted, clearedMemory });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.use("/sessions", sessionsRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : String(err);
    if (/CORS blocked/i.test(message)) {
      res.status(403).json({ error: message });
      return;
    }
    log(undefined, "unhandled_error", { error: message });
    res.status(500).json({
      error: env.isProd ? "Internal server error" : message,
    });
  },
);

const server = http.createServer(app);
attachAudioWs(server);

function shutdown(signal: string) {
  log(undefined, "server_shutdown", { signal });
  server.close(() => {
    void closeDb()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(env.port, () => {
  const report = validateEnv();
  console.log(
    JSON.stringify({
      msg: "artemis_server_listen",
      port: env.port,
      env: env.nodeEnv,
      ...report,
    }),
  );
  // Never auto-seed in production; demo-only opt-in for local DX
  if (env.demoMode && !env.isProd) {
    void seedDemoInterviewerB();
  }
});

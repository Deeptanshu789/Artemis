import express from "express";
import cors from "cors";
import http from "node:http";
import { env } from "./config.js";
import { sessionsRouter } from "./routes/sessions.js";
import { attachAudioWs } from "./ws/audio.js";
import { supabaseConfigured } from "./services/supabase.js";
import { seedDemoInterviewerB } from "./services/seedDemo.js";
import { validateEnv } from "./services/envCheck.js";
import { databaseUrlConfigured } from "./db/client.js";

const app = express();
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  const report = validateEnv();
  res.json({
    ok: report.ok || report.demoMode,
    demoMode: env.demoMode,
    supabase: supabaseConfigured(),
    drizzle: databaseUrlConfigured(),
    deepgram: Boolean(env.deepgramApiKey),
    gemini: Boolean(env.geminiApiKey),
    geminiModel: env.geminiModel,
    warnings: report.warnings,
    missingForLive: report.missingForLive,
    ready: report.ready,
  });
});

app.post("/admin/seed-demo", async (_req, res) => {
  try {
    const count = await seedDemoInterviewerB();
    res.json({ ok: true, count, via: databaseUrlConfigured() ? "drizzle" : "memory" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.use("/sessions", sessionsRouter);

const server = http.createServer(app);
attachAudioWs(server);

server.listen(env.port, () => {
  const report = validateEnv();
  console.log(
    JSON.stringify({
      msg: "artemis_server_listen",
      port: env.port,
      ...report,
    }),
  );
  if (env.demoMode) {
    void seedDemoInterviewerB();
  }
});

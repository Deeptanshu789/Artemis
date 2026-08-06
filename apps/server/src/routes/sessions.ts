import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  deleteMemorySession,
  getMemorySession,
  listMemorySessions,
  setMemorySession,
  type RuntimeSession,
} from "../services/sessionStore.js";
import {
  deleteSessionRow,
  fetchSession,
  fetchSessions,
  persistSession,
  supabaseConfigured,
} from "../services/supabase.js";
import { finalizeSession } from "../services/finalize.js";
import { createRuntimeSession } from "../ws/audio.js";

export const sessionsRouter = Router();

sessionsRouter.get("/", async (req, res) => {
  try {
    const interviewerId = typeof req.query.interviewerId === "string" ? req.query.interviewerId : undefined;
    if (supabaseConfigured()) {
      const rows = await fetchSessions(interviewerId);
      const mem = listMemorySessions(interviewerId);
      const byId = new Map<string, RuntimeSession | (typeof rows)[0]>();
      for (const r of rows) byId.set(r.id, r);
      for (const m of mem) byId.set(m.id, m);
      res.json({ sessions: [...byId.values()] });
      return;
    }
    res.json({ sessions: listMemorySessions(interviewerId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.post("/", async (req, res) => {
  try {
    const interviewerId = (req.body?.interviewerId as string)?.trim();
    const interviewerName = (req.body?.interviewerName as string)?.trim();
    const candidateLabel =
      (req.body?.candidateLabel as string)?.trim() || "Interviewee";

    if (!interviewerId || interviewerId === "guest") {
      res.status(401).json({
        error: "Login required. Sign in on the extension with the same account as the dashboard.",
      });
      return;
    }
    if (!interviewerName) {
      res.status(400).json({
        error: "interviewerName required — enter your Google Meet display name.",
      });
      return;
    }

    const id = randomUUID();
    const session = createRuntimeSession(id, interviewerId, interviewerName);
    session.status = "idle";
    session.candidate_label = candidateLabel;
    setMemorySession(session);
    await persistSession(session).catch(() => undefined);
    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id", async (req, res) => {
  try {
    const mem = getMemorySession(req.params.id);
    if (mem) {
      res.json({ session: mem });
      return;
    }
    const row = await fetchSession(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ session: row });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.post("/:id/finalize", async (req, res) => {
  try {
    let session = getMemorySession(req.params.id);
    if (!session) {
      const row = await fetchSession(req.params.id);
      if (!row) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      session = {
        ...row,
        speakerMap: new Map(),
        lastChunkAt: Date.now(),
        finalizeStarted: false,
      };
      setMemorySession(session);
    }
    const updated = await finalizeSession(req.params.id);
    res.json({ session: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.delete("/:id", async (req, res) => {
  try {
    const interviewerId = typeof req.query.interviewerId === "string" ? req.query.interviewerId : undefined;
    deleteMemorySession(req.params.id);
    if (supabaseConfigured()) {
      await deleteSessionRow(req.params.id, interviewerId);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

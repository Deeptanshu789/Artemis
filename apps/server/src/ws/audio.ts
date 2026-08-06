import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import {
  WsClientMessageSchema,
  type WsServerMessage,
} from "@artemis/shared";
import { env } from "../config.js";
import {
  getMemorySession,
  log,
  patchSession,
  setMemorySession,
  type RuntimeSession,
} from "../services/sessionStore.js";
import { DeepgramSession } from "../services/deepgram.js";
import { finalizeSession, registerDeepgram, getDeepgram } from "../services/finalize.js";
import { persistSession } from "../services/supabase.js";
import { scheduleTranscriptPersist, flushPersist } from "../services/livePersist.js";
import { maybeTalkRatioNudge, resetNudge } from "../services/talkRatio.js";

function send(ws: WebSocket, msg: WsServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function createRuntimeSession(
  sessionId: string,
  interviewerId: string,
  interviewerName?: string,
): RuntimeSession {
  const now = new Date().toISOString();
  return {
    id: sessionId,
    interviewer_id: interviewerId,
    interviewer_name: interviewerName,
    candidate_label: "Candidate",
    status: "capturing",
    platform: "google_meet",
    transcript: [],
    scoring: null,
    error_message: null,
    started_at: now,
    ended_at: null,
    created_at: now,
    updated_at: now,
    speakerMap: new Map(),
    lastChunkAt: Date.now(),
    finalizeStarted: false,
  };
}

export function attachAudioWs(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws/audio" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const querySessionId = url.searchParams.get("sessionId") ?? undefined;
    log(querySessionId, "ws_connect");

    let boundSessionId = querySessionId;

    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) send(ws, { type: "pong" });
    }, 25000);

    const maxTimer = setTimeout(() => {
      if (boundSessionId) {
        log(boundSessionId, "max_session_duration");
        void finalizeSession(boundSessionId, (m) => send(ws, m));
      }
    }, env.maxSessionMs);

    ws.on("message", async (raw, isBinary) => {
      try {
        if (isBinary) {
          if (!boundSessionId) {
            send(ws, { type: "error", message: "Send start message before binary audio" });
            return;
          }
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
          patchSession(boundSessionId, { lastChunkAt: Date.now(), status: "capturing" });
          getDeepgram(boundSessionId)?.sendAudio(buf);
          return;
        }

        const text = raw.toString("utf8");
        const parsed = WsClientMessageSchema.safeParse(JSON.parse(text));
        if (!parsed.success) {
          send(ws, { type: "error", message: "Invalid WS message", sessionId: boundSessionId });
          return;
        }
        const msg = parsed.data;

        if (msg.type === "ping") {
          send(ws, { type: "pong" });
          return;
        }

        if (msg.type === "start") {
          boundSessionId = msg.sessionId;
          resetNudge(msg.sessionId);
          let session = getMemorySession(msg.sessionId);
          if (!session) {
            session = createRuntimeSession(
              msg.sessionId,
              msg.interviewerId ?? "guest",
              msg.interviewerName ?? "Guest Interviewer",
            );
            setMemorySession(session);
            await persistSession(session).catch(() => undefined);
          } else {
            patchSession(msg.sessionId, { status: "capturing", finalizeStarted: false });
          }

          const dg = new DeepgramSession(msg.sessionId, (segment) => {
            send(ws, { type: "transcript", sessionId: msg.sessionId, segment });
            scheduleTranscriptPersist(msg.sessionId);
            const fresh = getMemorySession(msg.sessionId);
            if (fresh) {
              const nudge = maybeTalkRatioNudge(msg.sessionId, fresh.transcript);
              if (nudge) {
                send(ws, {
                  type: "nudge",
                  sessionId: msg.sessionId,
                  kind: "talk_ratio",
                  interviewerShare: nudge.interviewerShare,
                  message: nudge.message,
                });
              }
            }
          });
          registerDeepgram(msg.sessionId, dg);
          dg.start({
            encoding: msg.encoding ?? "linear16",
            sampleRate: msg.sampleRate ?? 16000,
            mimeType: msg.mimeType,
          });

          if (env.demoMode) {
            dg.injectSegment("Thanks for joining — let's start with your background.", "interviewer");
            dg.injectSegment(
              "I've been a backend engineer for five years, mostly Node and Postgres.",
              "candidate",
            );
          }

          send(ws, { type: "ack", sessionId: msg.sessionId, status: "capturing" });
          return;
        }

        if (msg.type === "audio") {
          boundSessionId = msg.sessionId;
          const buf = Buffer.from(msg.data, "base64");
          patchSession(msg.sessionId, { lastChunkAt: Date.now() });
          getDeepgram(msg.sessionId)?.sendAudio(buf);
          return;
        }

        if (msg.type === "end") {
          boundSessionId = msg.sessionId;
          await flushPersist(msg.sessionId);
          await finalizeSession(msg.sessionId, (m) => send(ws, m));
        }
      } catch (err) {
        log(boundSessionId, "ws_message_error", {
          error: err instanceof Error ? err.message : String(err),
        });
        send(ws, {
          type: "error",
          sessionId: boundSessionId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(maxTimer);
      log(boundSessionId, "ws_close");
    });
  });

  return wss;
}

export { createRuntimeSession, randomUUID };

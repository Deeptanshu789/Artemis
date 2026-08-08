import { loadEndpoints, DASHBOARD_URL, normalizeDashboardUrl } from "../config";
import { getMeetDisplayName, getStoredAuth } from "../session";
import { signInWithGoogle } from "../googleAuth";
import type { ScoringResult, SessionStatus, WsServerMessage } from "@artemis/shared";

type CaptureState = {
  status: SessionStatus | "error";
  sessionId?: string;
  lastTranscript?: string;
  scoring?: ScoringResult;
  error?: string;
  nudge?: string;
  dashboardUrl: string;
};

const state: CaptureState = {
  status: "idle",
  dashboardUrl: DASHBOARD_URL,
};

let ws: WebSocket | null = null;
let sequence = 0;
const OFFSCREEN_URL = "offscreen.html";

function broadcast() {
  chrome.runtime.sendMessage({ type: "state", state }).catch(() => undefined);
  chrome.storage.local.set({ artemisState: state }).catch(() => undefined);
}

function setBanner(active: boolean) {
  chrome.tabs.query({ url: "https://meet.google.com/*" }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs
          .sendMessage(tab.id, { type: "artemis-banner", active })
          .catch(() => undefined);
      }
    }
  });
}

function setStatus(status: CaptureState["status"], extra?: Partial<CaptureState>) {
  Object.assign(state, extra, { status });
  broadcast();
  setBanner(status === "capturing" || status === "transcribing" || status === "scoring");
}

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (contexts && contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA" as chrome.offscreen.Reason],
    justification: "Capture Google Meet tab audio for interview transcription",
  });
}

async function createSession(
  apiHttp: string,
  interviewerId: string,
  interviewerName: string,
  candidateLabel?: string,
): Promise<{ id: string }> {
  const res = await fetch(`${apiHttp}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interviewerId,
      interviewerName,
      candidateLabel: candidateLabel || "Interviewee",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Create session failed: ${res.status}`);
  }
  const data = await res.json();
  return { id: data.session.id as string };
}

function connectWs(
  apiWs: string,
  sessionId: string,
  interviewerId: string,
  interviewerName: string,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${apiWs}?sessionId=${sessionId}`);
    socket.binaryType = "arraybuffer";
    const timer = setTimeout(() => reject(new Error("WS connect timeout")), 10000);
    socket.onopen = () => {
      clearTimeout(timer);
      socket.send(
        JSON.stringify({
          type: "start",
          sessionId,
          interviewerId,
          interviewerName,
          encoding: "linear16",
          sampleRate: 16000,
          mimeType: "audio/l16",
        }),
      );
      resolve(socket);
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection failed — check Options → API WebSocket URL"));
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WsServerMessage;
        if (msg.type === "transcript") {
          state.lastTranscript = `${msg.segment.speaker}: ${msg.segment.text}`;
          setStatus(state.status === "idle" ? "transcribing" : state.status);
        } else if (msg.type === "status") {
          setStatus(msg.status, msg.message ? { error: msg.message } : undefined);
        } else if (msg.type === "result") {
          setStatus("ready", { scoring: msg.scoring, error: undefined });
        } else if (msg.type === "nudge") {
          state.nudge = msg.message;
          broadcast();
        } else if (msg.type === "error") {
          setStatus("failed", { error: msg.message });
        } else if (msg.type === "ack") {
          setStatus(msg.status);
        }
      } catch {
        /* ignore */
      }
    };
  });
}

async function startCapture(
  tabId: number,
  meetDisplayName?: string,
  candidateLabel?: string,
): Promise<void> {
  try {
    const endpoints = await loadEndpoints();
    state.dashboardUrl = normalizeDashboardUrl(endpoints.dashboardUrl, endpoints.apiHttp);

    const auth = await getStoredAuth();
    if (!auth) {
      throw new Error("Sign in required — use the same account as the dashboard.");
    }
    const interviewerName =
      (meetDisplayName?.trim() || (await getMeetDisplayName()) || "").trim();
    if (!interviewerName) {
      throw new Error("Enter your Google Meet display name before starting.");
    }

    await chrome.storage.local.set({
      interviewerId: auth.id,
      interviewerName,
    });

    const { id } = await createSession(
      endpoints.apiHttp,
      auth.id,
      interviewerName,
      candidateLabel,
    );
    state.sessionId = id;
    state.nudge = undefined;
    sequence = 0;
    ws = await connectWs(endpoints.apiWs, id, auth.id, interviewerName);

    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (sid) => {
        if (chrome.runtime.lastError || !sid) {
          reject(new Error(chrome.runtime.lastError?.message ?? "tabCapture.getMediaStreamId failed"));
          return;
        }
        resolve(sid);
      });
    });

    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: "offscreen", action: "start", streamId });

    setStatus("capturing", { sessionId: id, error: undefined, scoring: undefined });
  } catch (err) {
    setStatus("failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    await stopCapture(false);
  }
}

async function stopCapture(finalize = true): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "offscreen", action: "stop" });
  } catch {
    /* offscreen may be missing */
  }
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    /* ignore */
  }

  if (finalize && ws && ws.readyState === WebSocket.OPEN && state.sessionId) {
    setStatus("scoring");
    ws.send(JSON.stringify({ type: "end", sessionId: state.sessionId }));
    try {
      const endpoints = await loadEndpoints();
      const res = await fetch(`${endpoints.apiHttp}/sessions/${state.sessionId}/finalize`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session?.scoring) {
          setStatus("ready", { scoring: data.session.scoring });
        } else if (data.session?.status === "failed") {
          setStatus("failed", { error: data.session.error_message ?? "Scoring failed" });
        }
      }
    } catch {
      /* WS may deliver result */
    }
  } else {
    ws?.close();
    ws = null;
    if (state.status !== "ready") setStatus("idle");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "audio-chunk" && message.base64 && ws && state.sessionId) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "audio",
          sessionId: state.sessionId,
          data: message.base64,
          sequence: sequence++,
        }),
      );
    }
    return;
  }

  (async () => {
    if (message?.type === "getState") {
      sendResponse({ state });
      return;
    }
    if (message?.type === "signInGoogle") {
      try {
        const user = await signInWithGoogle();
        sendResponse({ ok: true, user });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }
    if (message?.type === "start") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.includes("meet.google.com")) {
        setStatus("failed", { error: "Open a Google Meet tab and try again." });
        sendResponse({ state });
        return;
      }
      await startCapture(
        tab.id,
        message.meetDisplayName as string | undefined,
        message.candidateLabel as string | undefined,
      );
      sendResponse({ state });
      return;
    }
    if (message?.type === "stop") {
      await stopCapture(true);
      sendResponse({ state });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  broadcast();
});

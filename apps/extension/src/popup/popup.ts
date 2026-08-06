import { DASHBOARD_URL } from "../config";
import type { ScoringResult } from "@artemis/shared";

type State = {
  status: string;
  sessionId?: string;
  lastTranscript?: string;
  scoring?: ScoringResult;
  error?: string;
  nudge?: string;
  dashboardUrl?: string;
};

const statusText = document.getElementById("status-text")!;
const dot = document.getElementById("dot")!;
const transcript = document.getElementById("transcript")!;
const nudgeEl = document.getElementById("nudge")!;
const result = document.getElementById("result")!;
const scoreEl = document.getElementById("score")!;
const tips = document.getElementById("tips")!;
const report = document.getElementById("report") as HTMLAnchorElement;
const errorEl = document.getElementById("error")!;
const startBtn = document.getElementById("start") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;

function render(state: State) {
  statusText.textContent = state.status;
  dot.className = `dot ${state.status}`;
  transcript.textContent = state.lastTranscript ?? "";
  if (state.nudge) {
    nudgeEl.hidden = false;
    nudgeEl.textContent = state.nudge;
  } else {
    nudgeEl.hidden = true;
  }
  const active = ["capturing", "transcribing", "scoring"].includes(state.status);
  startBtn.disabled = active;
  stopBtn.disabled = !active && state.status !== "capturing";

  if (state.error && (state.status === "failed" || state.status === "error")) {
    errorEl.hidden = false;
    errorEl.textContent = state.error;
  } else {
    errorEl.hidden = true;
  }

  if (state.status === "ready" && state.scoring) {
    result.hidden = false;
    scoreEl.textContent = String(Math.round(state.scoring.overall_score));
    tips.innerHTML = "";
    for (const tip of state.scoring.improvement_tips.slice(0, 3)) {
      const li = document.createElement("li");
      li.textContent = tip;
      tips.appendChild(li);
    }
    const base = state.dashboardUrl ?? DASHBOARD_URL;
    report.href = `${base}/sessions/${state.sessionId}`;
  } else {
    result.hidden = true;
  }
}

function refresh() {
  chrome.runtime.sendMessage({ type: "getState" }, (res) => {
    if (res?.state) render(res.state);
  });
}

startBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "start" }, (res) => {
    if (res?.state) render(res.state);
  });
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "stop" }, (res) => {
    if (res?.state) render(res.state);
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "state" && msg.state) render(msg.state);
});

refresh();
setInterval(refresh, 1500);

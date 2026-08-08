import { DASHBOARD_URL, loadEndpoints, sessionReportUrl } from "../config";
import type { ScoringResult } from "@artemis/shared";
import {
  clearAuth,
  getMeetDisplayName,
  getStoredAuth,
  oauthRedirectUrl,
  setMeetDisplayName,
  signInWithPassword,
  signUpWithPassword,
  type AuthUser,
} from "../auth";

type State = {
  status: string;
  sessionId?: string;
  lastTranscript?: string;
  scoring?: ScoringResult;
  error?: string;
  nudge?: string;
  dashboardUrl?: string;
};

const authPanel = document.getElementById("auth-panel")!;
const appPanel = document.getElementById("app-panel")!;
const emailEl = document.getElementById("email") as HTMLInputElement;
const passwordEl = document.getElementById("password") as HTMLInputElement;
const authError = document.getElementById("auth-error")!;
const userLabel = document.getElementById("user-label")!;
const meetNameEl = document.getElementById("meet-name") as HTMLInputElement;
const intervieweeNameEl = document.getElementById("interviewee-name") as HTMLInputElement;
const redirectHint = document.getElementById("redirect-hint");

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
const googleBtn = document.getElementById("google") as HTMLButtonElement;

let authUser: AuthUser | null = null;

function showAuthError(msg: string) {
  authError.hidden = false;
  authError.textContent = msg;
}

function clearAuthError() {
  authError.hidden = true;
  authError.textContent = "";
}

async function showLoggedIn(user: AuthUser) {
  authUser = user;
  authPanel.hidden = true;
  appPanel.hidden = false;
  userLabel.textContent = user.email || user.name;
  meetNameEl.value = (await getMeetDisplayName()) || "";
  const stored = await chrome.storage.local.get("intervieweeName");
  intervieweeNameEl.value = (stored.intervieweeName as string) || "";
  refresh();
}

function showLoggedOut() {
  authUser = null;
  authPanel.hidden = false;
  appPanel.hidden = true;
  if (redirectHint) {
    redirectHint.textContent = oauthRedirectUrl();
  }
}

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

  if (state.status === "ready" && state.scoring && state.sessionId) {
    result.hidden = false;
    scoreEl.textContent = String(Math.round(state.scoring.overall_score));
    tips.innerHTML = "";
    for (const tip of state.scoring.improvement_tips.slice(0, 3)) {
      const li = document.createElement("li");
      li.textContent = tip;
      tips.appendChild(li);
    }
    void loadEndpoints().then((ep) => {
      report.href = sessionReportUrl(
        ep.dashboardUrl || state.dashboardUrl || DASHBOARD_URL,
        state.sessionId!,
      );
    });
  } else {
    result.hidden = true;
    report.href = "#";
  }
}

function refresh() {
  chrome.runtime.sendMessage({ type: "getState" }, (res) => {
    if (res?.state) render(res.state);
  });
}

document.getElementById("signin")!.addEventListener("click", () => {
  void (async () => {
    clearAuthError();
    try {
      const user = await signInWithPassword(emailEl.value.trim(), passwordEl.value);
      await showLoggedIn(user);
    } catch (e) {
      showAuthError(e instanceof Error ? e.message : String(e));
    }
  })();
});

document.getElementById("signup")!.addEventListener("click", () => {
  void (async () => {
    clearAuthError();
    try {
      const user = await signUpWithPassword(emailEl.value.trim(), passwordEl.value);
      await showLoggedIn(user);
    } catch (e) {
      showAuthError(e instanceof Error ? e.message : String(e));
    }
  })();
});

googleBtn.addEventListener("click", () => {
  void (async () => {
    clearAuthError();
    googleBtn.disabled = true;
    googleBtn.textContent = "Opening Google…";
    try {
      const res = await chrome.runtime.sendMessage({ type: "signInGoogle" });
      if (!res?.ok) {
        throw new Error(res?.error ?? "Google sign-in failed");
      }
      await showLoggedIn(res.user as AuthUser);
    } catch (e) {
      showAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      googleBtn.disabled = false;
      googleBtn.textContent = "Continue with Google";
    }
  })();
});

document.getElementById("signout")!.addEventListener("click", () => {
  void (async () => {
    await clearAuth();
    showLoggedOut();
  })();
});

meetNameEl.addEventListener("change", () => {
  void setMeetDisplayName(meetNameEl.value);
});

intervieweeNameEl.addEventListener("change", () => {
  void chrome.storage.local.set({ intervieweeName: intervieweeNameEl.value.trim() });
});

report.addEventListener("click", (ev) => {
  ev.preventDefault();
  void (async () => {
    const ep = await loadEndpoints();
    const stateRes = await chrome.runtime.sendMessage({ type: "getState" });
    const sessionId = stateRes?.state?.sessionId as string | undefined;
    if (!sessionId) return;
    const url = sessionReportUrl(ep.dashboardUrl, sessionId);
    await chrome.tabs.create({ url });
  })();
});

startBtn.addEventListener("click", () => {
  void (async () => {
    const meetName = meetNameEl.value.trim();
    if (!meetName) {
      errorEl.hidden = false;
      errorEl.textContent = "Enter your Google Meet display name first.";
      return;
    }
    if (!authUser) {
      showLoggedOut();
      return;
    }
    const candidateName = intervieweeNameEl.value.trim() || "Interviewee";
    await setMeetDisplayName(meetName);
    await chrome.storage.local.set({
      interviewerId: authUser.id,
      interviewerName: meetName,
      intervieweeName: candidateName,
    });
    chrome.runtime.sendMessage(
      { type: "start", meetDisplayName: meetName, candidateLabel: candidateName },
      (res) => {
        if (res?.state) render(res.state);
      },
    );
  })();
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "stop" }, (res) => {
    if (res?.state) render(res.state);
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "state" && msg.state) render(msg.state);
});

void (async () => {
  // Heal Options that pointed dashboard at the API (:3001 returns JSON)
  const ep = await loadEndpoints();
  await chrome.storage.sync.set({ dashboardUrl: ep.dashboardUrl });
  const user = await getStoredAuth();
  if (user) await showLoggedIn(user);
  else showLoggedOut();
})();

setInterval(() => {
  if (authUser) refresh();
}, 1500);

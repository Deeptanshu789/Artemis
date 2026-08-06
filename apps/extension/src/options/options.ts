import { normalizeDashboardUrl } from "../config";

const apiHttp = document.getElementById("apiHttp") as HTMLInputElement;
const apiWs = document.getElementById("apiWs") as HTMLInputElement;
const dashboardUrl = document.getElementById("dashboardUrl") as HTMLInputElement;
const supabaseUrl = document.getElementById("supabaseUrl") as HTMLInputElement;
const supabaseAnonKey = document.getElementById("supabaseAnonKey") as HTMLInputElement;
const statusEl = document.getElementById("status")!;
const redirectEl = document.getElementById("redirect")!;

redirectEl.textContent = chrome.identity.getRedirectURL("supabase");

chrome.storage.sync.get(
  ["apiHttp", "apiWs", "dashboardUrl", "supabaseUrl", "supabaseAnonKey"],
  (stored) => {
    const http = (stored.apiHttp as string) || "http://localhost:3001";
    apiHttp.value = http;
    apiWs.value = (stored.apiWs as string) || "ws://localhost:3001/ws/audio";
    dashboardUrl.value = normalizeDashboardUrl(
      (stored.dashboardUrl as string) || "http://localhost:5173",
      http,
    );
    supabaseUrl.value = (stored.supabaseUrl as string) || "";
    supabaseAnonKey.value = (stored.supabaseAnonKey as string) || "";
  },
);

document.getElementById("save")!.addEventListener("click", () => {
  const http = apiHttp.value.trim();
  chrome.storage.sync.set(
    {
      apiHttp: http,
      apiWs: apiWs.value.trim(),
      dashboardUrl: normalizeDashboardUrl(dashboardUrl.value.trim(), http),
      supabaseUrl: supabaseUrl.value.trim(),
      supabaseAnonKey: supabaseAnonKey.value.trim(),
    },
    () => {
      statusEl.textContent = "Saved. Dashboard must be :5173 (not API :3001).";
    },
  );
});

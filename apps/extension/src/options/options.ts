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
    apiHttp.value = (stored.apiHttp as string) || "http://localhost:3001";
    apiWs.value = (stored.apiWs as string) || "ws://localhost:3001/ws/audio";
    dashboardUrl.value = (stored.dashboardUrl as string) || "http://localhost:5173";
    supabaseUrl.value = (stored.supabaseUrl as string) || "";
    supabaseAnonKey.value = (stored.supabaseAnonKey as string) || "";
  },
);

document.getElementById("save")!.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      apiHttp: apiHttp.value.trim(),
      apiWs: apiWs.value.trim(),
      dashboardUrl: dashboardUrl.value.trim(),
      supabaseUrl: supabaseUrl.value.trim(),
      supabaseAnonKey: supabaseAnonKey.value.trim(),
    },
    () => {
      statusEl.textContent = "Saved.";
    },
  );
});

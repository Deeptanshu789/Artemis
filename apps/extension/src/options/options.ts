const apiHttp = document.getElementById("apiHttp") as HTMLInputElement;
const apiWs = document.getElementById("apiWs") as HTMLInputElement;
const dashboardUrl = document.getElementById("dashboardUrl") as HTMLInputElement;
const statusEl = document.getElementById("status")!;

chrome.storage.sync.get(["apiHttp", "apiWs", "dashboardUrl"], (stored) => {
  apiHttp.value = (stored.apiHttp as string) || "http://localhost:3001";
  apiWs.value = (stored.apiWs as string) || "ws://localhost:3001/ws/audio";
  dashboardUrl.value = (stored.dashboardUrl as string) || "http://localhost:5173";
});

document.getElementById("save")!.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      apiHttp: apiHttp.value.trim(),
      apiWs: apiWs.value.trim(),
      dashboardUrl: dashboardUrl.value.trim(),
    },
    () => {
      statusEl.textContent = "Saved.";
    },
  );
});

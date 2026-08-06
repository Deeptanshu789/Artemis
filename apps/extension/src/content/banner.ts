const BANNER_ID = "artemis-consent-banner";

function ensureBanner(active: boolean) {
  let el = document.getElementById(BANNER_ID);
  if (!active) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.setAttribute("role", "status");
    el.textContent = "Listening — this call is being analyzed (Artemis)";
    document.documentElement.appendChild(el);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "artemis-banner") {
    ensureBanner(Boolean(msg.active));
  }
});

// Re-apply if Meet re-renders
const obs = new MutationObserver(() => {
  const el = document.getElementById(BANNER_ID);
  if (el && !document.documentElement.contains(el)) {
    document.documentElement.appendChild(el);
  }
});
obs.observe(document.documentElement, { childList: true, subtree: true });

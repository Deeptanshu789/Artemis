export type ArtemisEndpoints = {
  apiHttp: string;
  apiWs: string;
  dashboardUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

declare const __ARTEMIS_DEFAULTS__: Partial<ArtemisEndpoints> | undefined;

const BUILD_DEFAULTS: Partial<ArtemisEndpoints> =
  typeof __ARTEMIS_DEFAULTS__ !== "undefined" ? __ARTEMIS_DEFAULTS__ : {};

const DEFAULTS: ArtemisEndpoints = {
  apiHttp: BUILD_DEFAULTS.apiHttp || "http://localhost:3001",
  apiWs: BUILD_DEFAULTS.apiWs || "ws://localhost:3001/ws/audio",
  dashboardUrl: BUILD_DEFAULTS.dashboardUrl || "http://localhost:5173",
  supabaseUrl: BUILD_DEFAULTS.supabaseUrl || "",
  supabaseAnonKey: BUILD_DEFAULTS.supabaseAnonKey || "",
};

/** Never point the dashboard URL at the API (that returns session JSON). */
export function normalizeDashboardUrl(raw: string, apiHttp?: string): string {
  let url = (raw || "").trim().replace(/\/$/, "");
  const api = (apiHttp || DEFAULTS.apiHttp).trim().replace(/\/$/, "");
  if (!url || url === api) {
    url = (DEFAULTS.dashboardUrl || "http://localhost:5173").replace(/\/$/, "");
  }
  try {
    const u = new URL(url);
    if (u.port === "3001") {
      return "http://localhost:5173";
    }
  } catch {
    return "http://localhost:5173";
  }
  return url;
}

export function sessionReportUrl(dashboardUrl: string, sessionId: string): string {
  const base = normalizeDashboardUrl(dashboardUrl);
  return `${base}/sessions/${sessionId}`;
}

export async function loadEndpoints(): Promise<ArtemisEndpoints> {
  const stored = await chrome.storage.sync.get([
    "apiHttp",
    "apiWs",
    "dashboardUrl",
    "supabaseUrl",
    "supabaseAnonKey",
  ]);
  const apiHttp = (stored.apiHttp as string) || DEFAULTS.apiHttp;
  return {
    apiHttp,
    apiWs: (stored.apiWs as string) || DEFAULTS.apiWs,
    dashboardUrl: normalizeDashboardUrl(
      (stored.dashboardUrl as string) || DEFAULTS.dashboardUrl,
      apiHttp,
    ),
    supabaseUrl: (stored.supabaseUrl as string) || DEFAULTS.supabaseUrl,
    supabaseAnonKey: (stored.supabaseAnonKey as string) || DEFAULTS.supabaseAnonKey,
  };
}

/** Build-time defaults (popup may prefer loadEndpoints). */
export const API_HTTP = DEFAULTS.apiHttp;
export const API_WS = DEFAULTS.apiWs;
export const DASHBOARD_URL = normalizeDashboardUrl(DEFAULTS.dashboardUrl, DEFAULTS.apiHttp);

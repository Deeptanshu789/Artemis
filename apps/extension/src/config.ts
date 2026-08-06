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

export async function loadEndpoints(): Promise<ArtemisEndpoints> {
  const stored = await chrome.storage.sync.get([
    "apiHttp",
    "apiWs",
    "dashboardUrl",
    "supabaseUrl",
    "supabaseAnonKey",
  ]);
  return {
    apiHttp: (stored.apiHttp as string) || DEFAULTS.apiHttp,
    apiWs: (stored.apiWs as string) || DEFAULTS.apiWs,
    dashboardUrl: (stored.dashboardUrl as string) || DEFAULTS.dashboardUrl,
    supabaseUrl: (stored.supabaseUrl as string) || DEFAULTS.supabaseUrl,
    supabaseAnonKey: (stored.supabaseAnonKey as string) || DEFAULTS.supabaseAnonKey,
  };
}

/** Build-time defaults (popup may prefer loadEndpoints). */
export const API_HTTP = DEFAULTS.apiHttp;
export const API_WS = DEFAULTS.apiWs;
export const DASHBOARD_URL = DEFAULTS.dashboardUrl;

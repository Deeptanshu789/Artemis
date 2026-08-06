export type ArtemisEndpoints = {
  apiHttp: string;
  apiWs: string;
  dashboardUrl: string;
};

const DEFAULTS: ArtemisEndpoints = {
  apiHttp: "http://localhost:3001",
  apiWs: "ws://localhost:3001/ws/audio",
  dashboardUrl: "http://localhost:5173",
};

export async function loadEndpoints(): Promise<ArtemisEndpoints> {
  const stored = await chrome.storage.sync.get([
    "apiHttp",
    "apiWs",
    "dashboardUrl",
  ]);
  return {
    apiHttp: (stored.apiHttp as string) || DEFAULTS.apiHttp,
    apiWs: (stored.apiWs as string) || DEFAULTS.apiWs,
    dashboardUrl: (stored.dashboardUrl as string) || DEFAULTS.dashboardUrl,
  };
}

/** Build-time defaults (popup may prefer loadEndpoints). */
export const API_HTTP = DEFAULTS.apiHttp;
export const API_WS = DEFAULTS.apiWs;
export const DASHBOARD_URL = DEFAULTS.dashboardUrl;

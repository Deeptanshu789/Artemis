import { createClient, type Session as SbSession, type SupabaseClient } from "@supabase/supabase-js";
import { loadEndpoints } from "./config";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const AUTH_KEYS = ["sbAccessToken", "sbRefreshToken", "userId", "userEmail", "userName"] as const;

/** chrome.storage.local bridge — service workers have no localStorage (PKCE needs this). */
const chromeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const result = await chrome.storage.local.get(key);
    const v = result[key];
    return typeof v === "string" ? v : v == null ? null : JSON.stringify(v);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};

export function oauthRedirectUrl(): string {
  // Stable path for Supabase allowlist: https://<ext-id>.chromiumapp.org/supabase
  return chrome.identity.getRedirectURL("supabase");
}

export async function getStoredAuth(): Promise<AuthUser | null> {
  const stored = await chrome.storage.local.get([...AUTH_KEYS]);
  if (!stored.userId || !stored.sbAccessToken) return null;
  return {
    id: stored.userId as string,
    email: (stored.userEmail as string) || "",
    name: (stored.userName as string) || (stored.userEmail as string) || "Interviewer",
  };
}

export async function getMeetDisplayName(): Promise<string> {
  const { meetDisplayName } = await chrome.storage.local.get(["meetDisplayName"]);
  return ((meetDisplayName as string) || "").trim();
}

export async function setMeetDisplayName(name: string): Promise<void> {
  await chrome.storage.local.set({ meetDisplayName: name.trim() });
}

async function persistSession(session: SbSession): Promise<AuthUser> {
  const user = session.user;
  const authUser: AuthUser = {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.full_name as string) || user.email || "Interviewer",
  };
  await chrome.storage.local.set({
    sbAccessToken: session.access_token,
    sbRefreshToken: session.refresh_token,
    userId: authUser.id,
    userEmail: authUser.email,
    userName: authUser.name,
    interviewerId: authUser.id,
  });
  return authUser;
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([...AUTH_KEYS, "interviewerId", "interviewerName"]);
  try {
    const ep = await loadEndpoints();
    if (ep.supabaseUrl && ep.supabaseAnonKey) {
      const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
      await sb.auth.signOut({ scope: "local" });
    }
  } catch {
    /* ignore */
  }
}

function createSb(url: string, anon: string): SupabaseClient {
  return createClient(url, anon, {
    auth: {
      storage: chromeStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}

async function requireEndpoints() {
  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) {
    throw new Error("Set Supabase URL + anon key in extension Options.");
  }
  return ep;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const ep = await requireEndpoints();
  const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "Sign-in failed");
  return persistSession(data.session);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthUser> {
  const ep = await requireEndpoints();
  const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || undefined } },
  });
  if (error) throw new Error(error.message);
  if (!data.session) {
    throw new Error("Check your email to confirm, then sign in.");
  }
  return persistSession(data.session);
}

function launchWebAuthFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        reject(new Error(chrome.runtime.lastError?.message ?? "OAuth cancelled or blocked"));
        return;
      }
      resolve(responseUrl);
    });
  });
}

/**
 * Google OAuth via PKCE + chrome.identity.
 * Must run in the service worker (not popup) so PKCE verifier survives the OAuth window.
 * chrome.identity strips URL hashes — implicit flow cannot work; PKCE ?code= is required.
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  const ep = await requireEndpoints();
  const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
  const redirectTo = oauthRedirectUrl();

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Could not start Google sign-in");
  }

  const responseUrl = await launchWebAuthFlow(data.url);
  const parsed = new URL(responseUrl);
  const code = parsed.searchParams.get("code");
  if (!code) {
    const errDesc =
      parsed.searchParams.get("error_description") ||
      parsed.searchParams.get("error") ||
      "No auth code returned";
    throw new Error(
      `${errDesc}. Add this redirect URL in Supabase → Authentication → URL Configuration: ${redirectTo}`,
    );
  }

  const { data: sessionData, error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.session) {
    throw new Error(exchangeError?.message ?? "Failed to exchange OAuth code");
  }
  return persistSession(sessionData.session);
}

export async function refreshAuthIfNeeded(): Promise<AuthUser | null> {
  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) return getStoredAuth();

  const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session) {
    const stored = await getStoredAuth();
    if (!stored) return null;
    // Try hydrate from our mirrored tokens
    const tokens = await chrome.storage.local.get(["sbAccessToken", "sbRefreshToken"]);
    if (tokens.sbAccessToken && tokens.sbRefreshToken) {
      const { data: setData, error: setErr } = await sb.auth.setSession({
        access_token: tokens.sbAccessToken as string,
        refresh_token: tokens.sbRefreshToken as string,
      });
      if (setErr || !setData.session) {
        await clearAuth();
        return null;
      }
      return persistSession(setData.session);
    }
    return null;
  }
  return persistSession(data.session);
}

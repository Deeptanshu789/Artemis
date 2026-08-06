/**
 * Supabase auth for pages with a DOM (popup / options).
 * Do not import this from the service worker — use session.ts + googleAuth.ts instead.
 */
import { createClient, type Session as SbSession, type SupabaseClient } from "@supabase/supabase-js";
import { loadEndpoints } from "./config";
import {
  clearAuth as clearStoredAuth,
  persistAuthTokens,
  type AuthUser,
} from "./session";

export type { AuthUser };
export {
  getMeetDisplayName,
  getStoredAuth,
  oauthRedirectUrl,
  setMeetDisplayName,
} from "./session";
export { signInWithGoogle } from "./googleAuth";

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

async function persistSession(session: SbSession): Promise<AuthUser> {
  const user = session.user;
  return persistAuthTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.full_name as string) || user.email || "Interviewer",
  });
}

export async function clearAuth(): Promise<void> {
  try {
    const ep = await loadEndpoints();
    if (ep.supabaseUrl && ep.supabaseAnonKey) {
      const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
      await sb.auth.signOut({ scope: "local" });
    }
  } catch {
    /* ignore */
  }
  await clearStoredAuth();
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

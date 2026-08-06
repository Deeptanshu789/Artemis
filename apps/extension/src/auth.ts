import { createClient, type Session as SbSession, type User } from "@supabase/supabase-js";
import { loadEndpoints } from "./config";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const AUTH_KEYS = ["sbAccessToken", "sbRefreshToken", "userId", "userEmail", "userName"] as const;

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
}

function createSb(url: string, anon: string) {
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) {
    throw new Error("Set Supabase URL + anon key in extension Options.");
  }
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
  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) {
    throw new Error("Set Supabase URL + anon key in extension Options.");
  }
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

/** Google OAuth via chrome.identity.launchWebAuthFlow → Supabase session. */
export async function signInWithGoogle(): Promise<AuthUser> {
  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) {
    throw new Error("Set Supabase URL + anon key in extension Options.");
  }

  const redirectTo = chrome.identity.getRedirectURL();
  const authorize = new URL(`${ep.supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", redirectTo);

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authorize.toString(), interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message ?? "OAuth cancelled"));
          return;
        }
        resolve(url);
      },
    );
  });

  const hash = new URL(responseUrl).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) {
    throw new Error("OAuth did not return tokens. Add redirect URL in Supabase Auth settings.");
  }

  const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
  const { data, error } = await sb.auth.setSession({ access_token, refresh_token });
  if (error || !data.session) throw new Error(error?.message ?? "Failed to set session");
  return persistSession(data.session);
}

export async function refreshAuthIfNeeded(): Promise<AuthUser | null> {
  const stored = await chrome.storage.local.get([...AUTH_KEYS]);
  if (!stored.sbAccessToken || !stored.sbRefreshToken) return getStoredAuth();

  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) return getStoredAuth();

  const sb = createSb(ep.supabaseUrl, ep.supabaseAnonKey);
  const { data, error } = await sb.auth.setSession({
    access_token: stored.sbAccessToken as string,
    refresh_token: stored.sbRefreshToken as string,
  });
  if (error || !data.session) {
    await clearAuth();
    return null;
  }
  return persistSession(data.session);
}

export type { User };

/** Auth session helpers — safe for MV3 service workers (no window / no supabase-js). */

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

export async function persistAuthTokens(input: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email?: string;
  name?: string;
}): Promise<AuthUser> {
  const authUser: AuthUser = {
    id: input.userId,
    email: input.email ?? "",
    name: input.name || input.email || "Interviewer",
  };
  await chrome.storage.local.set({
    sbAccessToken: input.accessToken,
    sbRefreshToken: input.refreshToken,
    userId: authUser.id,
    userEmail: authUser.email,
    userName: authUser.name,
    interviewerId: authUser.id,
  });
  return authUser;
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    ...AUTH_KEYS,
    "interviewerId",
    "interviewerName",
    "pkce_verifier",
  ]);
}

export async function getMeetDisplayName(): Promise<string> {
  const { meetDisplayName } = await chrome.storage.local.get(["meetDisplayName"]);
  return ((meetDisplayName as string) || "").trim();
}

export async function setMeetDisplayName(name: string): Promise<void> {
  await chrome.storage.local.set({ meetDisplayName: name.trim() });
}

export function oauthRedirectUrl(): string {
  return chrome.identity.getRedirectURL("supabase");
}

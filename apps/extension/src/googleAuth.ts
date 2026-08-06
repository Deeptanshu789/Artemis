/**
 * Google OAuth for MV3 service worker — no supabase-js (avoids window/document).
 * Uses PKCE + chrome.identity.launchWebAuthFlow + Rest token exchange.
 */
import { loadEndpoints } from "./config";
import {
  oauthRedirectUrl,
  persistAuthTokens,
  type AuthUser,
} from "./session";

function randomVerifier(length = 64): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  user?: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string };
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

export async function signInWithGoogle(): Promise<AuthUser> {
  const ep = await loadEndpoints();
  if (!ep.supabaseUrl || !ep.supabaseAnonKey) {
    throw new Error("Set Supabase URL + anon key in extension Options.");
  }

  const base = ep.supabaseUrl.replace(/\/$/, "");
  const redirectTo = oauthRedirectUrl();
  const verifier = randomVerifier();
  const challenge = await sha256Base64Url(verifier);
  await chrome.storage.local.set({ pkce_verifier: verifier });

  const authorize = new URL(`${base}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", redirectTo);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const responseUrl = await launchWebAuthFlow(authorize.toString());
  const parsed = new URL(responseUrl);
  const code = parsed.searchParams.get("code");
  if (!code) {
    const errDesc =
      parsed.searchParams.get("error_description") ||
      parsed.searchParams.get("error") ||
      "No auth code returned";
    throw new Error(
      `${errDesc}. Add this redirect URL in Supabase → Authentication → Redirect URLs: ${redirectTo}`,
    );
  }

  const stored = await chrome.storage.local.get(["pkce_verifier"]);
  const codeVerifier = (stored.pkce_verifier as string) || verifier;

  const tokenRes = await fetch(`${base}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ep.supabaseAnonKey,
      Authorization: `Bearer ${ep.supabaseAnonKey}`,
    },
    body: JSON.stringify({
      auth_code: code,
      code_verifier: codeVerifier,
    }),
  });

  const tokenJson = (await tokenRes.json()) as TokenResponse;
  await chrome.storage.local.remove(["pkce_verifier"]);

  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
    throw new Error(
      tokenJson.error_description ||
        tokenJson.msg ||
        tokenJson.error ||
        `Token exchange failed (${tokenRes.status})`,
    );
  }

  const user = tokenJson.user;
  if (!user?.id) {
    // Decode sub from JWT if user object omitted
    const payload = JSON.parse(atob(tokenJson.access_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return persistAuthTokens({
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      userId: payload.sub as string,
      email: (payload.email as string) || "",
      name: (payload.user_metadata?.full_name as string) || (payload.email as string) || "Interviewer",
    });
  }

  return persistAuthTokens({
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    userId: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
  });
}

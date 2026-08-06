import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getGuestIdentity, getSupabase, setViewer, GUEST_ID } from "./supabase";

type User = { id: string; name: string; isGuest: boolean };

type AuthCtx = {
  ready: boolean;
  user: User | null;
  continueAsGuest: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      const guest = localStorage.getItem("artemis_authed");
      if (guest) {
        const g = getGuestIdentity();
        setUser({ id: g.id, name: g.name, isGuest: true });
      }
      setReady(true);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s?.user) {
        setUser({
          id: s.user.id,
          name: s.user.user_metadata?.full_name ?? s.user.email ?? "User",
          isGuest: false,
        });
      } else if (localStorage.getItem("artemis_authed")) {
        const g = getGuestIdentity();
        setUser({ id: g.id, name: g.name, isGuest: true });
      }
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name ?? session.user.email ?? "User",
          isGuest: false,
        });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const continueAsGuest = () => {
    setViewer(GUEST_ID, "Guest");
    localStorage.setItem("artemis_authed", "1");
    setUser({ id: GUEST_ID, name: "Guest", isGuest: true });
  };

  const signInWithGoogle = async () => {
    const sb = getSupabase();
    if (!sb) {
      continueAsGuest();
      return;
    }
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    const sb = getSupabase();
    await sb?.auth.signOut();
    localStorage.removeItem("artemis_authed");
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ ready, user, continueAsGuest, signInWithGoogle, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}

import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { user, continueAsGuest, signInWithGoogle } = useAuth();
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-5xl text-text">Artemis</h1>
        <p className="mt-3 text-muted">Score how well interviewees interview.</p>
        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="w-full bg-accent text-bg font-semibold py-3 rounded-[4px]"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full text-muted hover:text-text py-2 text-sm"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}

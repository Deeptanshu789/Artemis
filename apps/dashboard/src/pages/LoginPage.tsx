import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { user, continueAsGuest, signInWithGoogle } = useAuth();
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-[400px]">

        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-xl bg-accent flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold text-text">Artemis</div>
            <div className="text-xs text-muted">Interview Copilot</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-7">
          <h1 className="text-xl font-semibold text-text">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted">Score interviewee performance from Meet interviews.</p>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full flex items-center justify-center gap-2.5 bg-white text-zinc-900 font-semibold py-2.5 rounded-lg text-sm hover:bg-zinc-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={continueAsGuest}
              className="w-full py-2.5 rounded-lg text-sm text-muted hover:text-text border border-border hover:border-muted-2 transition-colors"
            >
              Continue as guest
            </button>
          </div>

          <p className="mt-6 text-[11px] text-muted text-center">
            Sign in with the same account used in the Artemis extension.
          </p>
        </div>
      </div>
    </div>
  );
}

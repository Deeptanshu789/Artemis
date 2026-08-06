import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function AppShell() {
  const { user, signOut } = useAuth();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-[4px] text-sm ${isActive ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`;

  return (
    <div className="min-h-full flex">
      <aside className="w-[220px] shrink-0 border-r border-border bg-bg p-6 flex flex-col gap-6">
        <div>
          <div className="font-display text-3xl text-text">Artemis</div>
          <p className="text-xs text-muted mt-1">Interviewee quality</p>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={linkClass}>
            Sessions
          </NavLink>
          <NavLink to="/trends" className={linkClass}>
            Trends
          </NavLink>
          <NavLink to="/privacy" className={linkClass}>
            Privacy
          </NavLink>
        </nav>
        <div className="mt-auto space-y-3">
          <p className="text-xs text-muted">{user?.name}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-muted hover:text-text"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border px-8 py-3 flex justify-between items-center">
          <span className="text-xs text-muted">Scoped to your account · delete anytime</span>
          <Link to="/privacy" className="text-xs text-accent">
            Privacy
          </Link>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
        <footer className="px-8 py-4 border-t border-border text-xs text-muted">
          Transcripts are scoped to you. Production deployments need explicit consent from all
          participants per call-recording laws in your region. See Privacy for retention notes.
        </footer>
      </div>
    </div>
  );
}

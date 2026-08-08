import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

const NAV_ITEMS = [
  { to: "/", label: "Sessions", end: true, icon: LayoutIcon },
  { to: "/trends", label: "Trends", end: false, icon: TrendingIcon },
  { to: "/privacy", label: "Privacy", end: false, icon: ShieldIcon },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-full flex bg-bg text-text">
      {/* ── Fixed Left Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 w-[220px] flex flex-col bg-surface border-r border-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="size-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-text leading-tight">Artemis</div>
            <div className="text-[10px] text-muted leading-tight">Interview Copilot</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest px-3 mb-2">Dashboard</p>
          {NAV_ITEMS.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-surface-2 text-text"
                    : "text-muted hover:text-text hover:bg-surface-2/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`size-4 shrink-0 transition-colors ${isActive ? "text-accent" : "text-muted group-hover:text-muted"}`}
                  />
                  {label}
                  {isActive && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-border space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-2">
            <div className="size-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
              {(user?.name ?? user?.email ?? "U")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text truncate">{user?.name ?? "Interviewer"}</p>
              <p className="text-[10px] text-muted truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-text hover:bg-surface-2/60 transition-colors"
          >
            <SignOutIcon className="size-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content (offset by sidebar width) ── */}
      <div className="flex-1 flex flex-col min-w-0 ml-[220px]">
        {/* Top nav */}
        <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Breadcrumb will be provided by page h1 */}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted hidden sm:block">Scoped to your account · delete anytime</span>
            <Link
              to="/privacy"
              className="text-xs text-accent hover:text-accent-fg transition-colors px-2.5 py-1 rounded-md border border-border hover:border-accent/40"
            >
              Privacy
            </Link>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>

        <footer className="px-8 py-4 border-t border-border text-[11px] text-muted">
          Transcripts are scoped to you. Production deployments need explicit consent from all participants per call-recording laws in your region.
        </footer>
      </div>
    </div>
  );
}

/* ── Inline icon components ── */
function LayoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  );
}
function TrendingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="1,12 5,7 9,9 14,3"/>
      <polyline points="10,3 14,3 14,7"/>
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5L2 4v4c0 3.3 2.5 5.7 6 6.5 3.5-.8 6-3.2 6-6.5V4L8 1.5z"/>
    </svg>
  );
}
function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3"/>
      <polyline points="11,11 14,8 11,5"/>
      <line x1="14" y1="8" x2="6" y2="8"/>
    </svg>
  );
}

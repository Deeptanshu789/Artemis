# AGENTS.md — Artemis Interview Copilot

Living context for any model/agent continuing this repo. **Append a Change Log entry after every meaningful change.** Do not delete prior entries.

## Product

Chrome MV3 extension + Node/Express/`ws` backend + React dashboard. Captures Google Meet tab audio → Deepgram STT (diarization) → **Gemini 2.5** scores the **interviewee** → Drizzle/Postgres + Supabase → dashboard trends (synced to signed-in interviewer).

## Repo map

| Path | Role |
|------|------|
| `apps/extension` | MV3: SW, offscreen capture, Meet banner, popup, options |
| `apps/server` | Express REST + `/ws/audio`, Deepgram, Gemini scoring, Drizzle seed |
| `apps/dashboard` | Vite React + Tailwind + Recharts |
| `packages/shared` | Zod schemas, rubric weights, WS message types |
| `design/` | UI design MDs (visual gate) |
| `docs/` | ENV, DEMO, schema, architecture |

## Locked decisions

- No Python. STT = Deepgram. LLM = **Google Gemini** (`GEMINI_API_KEY`, model `gemini-2.5-flash` default). Scores the **interviewee**, not the interviewer.
- Extension user = interviewer; must sign in (same Supabase user as dashboard) and enter Meet display name. First speaker after Start = interviewer diarization tag.
- DB = Supabase Postgres via **Drizzle** for schema push + seed (`DATABASE_URL`). Supabase JS for auth/REST fallback.
- Meet-only MVP. `DEMO_MODE=true` skips live Deepgram/Gemini.
- Design polish must follow `design/*.md` (interim stubs exist).

## Env keys

`DEEPGRAM_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL` (or `SUPABASE_DB_PASSWORD`), `SUPABASE_*`, `PORT`, `CORS_ORIGIN`, `DASHBOARD_URL`, `DEMO_MODE`. Dashboard: `VITE_API_BASE`, `VITE_SUPABASE_*`.

## Commands

```bash
npm install && npm run build:shared
DEMO_MODE=true npm run dev:server
npm run dev:dashboard
npm run build:extension   # load apps/extension/dist
npm run demo:fixture
npm run verify            # health + fixture smoke
```

## Phase checklist (leftover work)

1. **Wire services** — keys, env validation, Supabase schema applied by human
2. **Verify Meet path** — automated smoke + manual Meet checklist
3. **Harden** — continuous persist, PCM audio, extension options URL, tests
4. **Polish** — design MD UI, icons, empty/loading states
5. **Stretch** — live talk-ratio nudge, privacy/retention page (Zoom/Teams later)
6. **Pitch** — judge docs / demo rehearsal checklist

## Agent rules for this repo

- Update this file’s **Change Log** when you finish a phase or non-trivial edit.
- Prefer small, typed boundaries (Zod). Never commit secrets (`.env`).
- Do not invent a new visual system; use `design/*.md`.
- Caveman/wenyan modes: chat only — commits/docs/AGENTS stay normal prose.

---

## Change Log

### 2026-08-06 — Bootstrap MVP (prior session)

- Greenfield monorepo: extension, server, dashboard, shared, design stubs, docs.
- Session state machine, WS audio, Deepgram client, Cursor Grok scoring + Zod repair retry.
- MV3 offscreen `tabCapture`, Meet consent banner, popup summary.
- Dashboard: login/guest, sessions, detail, trends, delete.
- Git: `feat/dashboard-session-ui` committed 10 dashboard files only; remote `origin` = `https://github.com/Deeptanshu789/Artemis`. Many files still untracked on that branch.

### 2026-08-07 — Phase continuation started

- Created this `AGENTS.md` as cross-model memory.
- Executing phases 1–6; entries below record completed work.

### 2026-08-07 — Phase 1 Wire services (code-side)

- Added `apps/server/src/services/envCheck.ts` + `npm run check-env`.
- `/health` now returns `warnings`, `missingForLive`, `ready` flags.
- **Still human:** create Deepgram / Cursor / Supabase accounts, paste keys, run `docs/supabase-schema.sql`, enable Google OAuth, set `DEMO_MODE=false`.

### 2026-08-07 — Phase 2 Verify path

- Added `scripts/verify.sh` → `npm run verify` (check-env + unit tests + demo fixture + optional health).
- Fixture + builds green under `DEMO_MODE`.
- **Still human:** live Google Meet dry-run with real keys.

### 2026-08-07 — Phase 3 Harden

- Offscreen capture now streams **16-bit PCM @ 16kHz** (`linear16`) instead of webm chunks; Deepgram live opts match.
- Debounced live transcript persist (`livePersist.ts`) while capturing.
- Extension **Options** page (`options.html`) stores `apiHttp` / `apiWs` / `dashboardUrl` in `chrome.storage.sync`; SW uses `loadEndpoints()`.
- Unit tests: scoring Zod, talk-ratio nudge, WS start schema (`npm run test`).
- Manifest v0.1.1 + host permissions for remote APIs + icons.

### 2026-08-07 — Phase 4 Polish

- Session list loading skeleton + clearer empty/error states.
- Extension teal PNG icons 16/48/128.
- Privacy nav entry (see Phase 5).

### 2026-08-07 — Phase 5 Stretch (partial)

- Live **talk-ratio nudge** WS message (`type: "nudge"`) when interviewer share ≥70% (60s cooldown); popup shows nudge.
- Dashboard `/privacy` page: storage, delete, consent/retention notes.
- **Deferred:** Zoom/Teams, org admin, sentiment, full coaching plans, production consent modal.

### 2026-08-07 — Phase 6 Pitch docs

- Added `docs/JUDGES.md` one-pager.
- README links to JUDGES + AGENTS + `npm run verify`.

## Remaining for humans / next agent

1. Supabase Auth: enable Email + Google; add extension `chrome.identity.getRedirectURL()` to Redirect URLs.
2. Meet E2E with signed-in extension + live Deepgram + Gemini 2.5 quota.
3. Deploy API + dashboard; set extension Options URLs + `ADMIN_TOKEN` + `CORS_ORIGIN`.
4. Replace interim `design/*.md` if final UI exists; re-skin.
5. Commit/push remaining monorepo files (never commit `.env`).

### 2026-08-07 — Interviewee scoring + extension auth sync

- Rubric flipped: scores **interviewee** (`problem_solving`, `communication`, `structure`, `depth`, `collaboration`, `professionalism`).
- Default model `gemini-2.5-flash`.
- Extension requires Supabase login (email/password or Google via `chrome.identity`); sessions use `interviewer_id = user.id` so dashboard lists match.
- Popup asks for Meet display name (interviewer); first speaker after Start tagged interviewer, other = interviewee.
- POST `/sessions` rejects guest / missing Meet name. Dashboard copy + Trends scoped to signed-in user.
- Manifest `0.3.0`; rebuild `apps/extension/dist`.

### 2026-08-07 — Prod harden + extension build + DB reset

- Server: security headers, multi-origin CORS (+ `chrome-extension://`), `ADMIN_TOKEN` gate on `/admin/*`, graceful SIGINT/SIGTERM, hide stack in prod, block `DEMO_MODE` when `NODE_ENV=production`.
- Removed production auto-seed; demo seed only when `DEMO_MODE` and not prod.
- Added `npm run db:reset` (+ `POST /admin/reset-db`) to wipe `sessions`.
- Extension: manifest `0.2.0`, production minify build, `docs/EXTENSION.md` load-unpacked guide.
- Ran DB reset (cleared seeded Jordan Lee rows) and `build:extension` → `apps/extension/dist`.


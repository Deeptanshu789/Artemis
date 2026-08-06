# Artemis — AI Interview Copilot

Chrome extension + Node backend + React dashboard. Captures Google Meet tab audio, transcribes with Deepgram (diarization), scores the **interviewee** via Mistral, stores sessions (Drizzle + Postgres/Supabase) under the signed-in interviewer account, and shows trends in the dashboard.

## Monorepo

```
apps/extension   Manifest V3 Meet capture + consent banner + popup
apps/server      Express + ws + Deepgram + Gemini + Drizzle
apps/dashboard   React + Tailwind + Recharts
packages/shared  Zod schemas + rubric types
design/          UI design MD (gate for visual polish)
docs/            ENV, schema, demo script
```

## Quick start

```bash
cp .env.example .env
# set DEEPGRAM_API_KEY, MISTRAL_API_KEY, DATABASE_URL, Supabase keys — or DEMO_MODE=true

npm install
npm run build:shared
npm run db:push                     # needs DATABASE_URL
npm run build                       # server + dashboard + extension
DEMO_MODE=true npm run dev:server   # terminal 1 (local)
npm run dev:dashboard               # terminal 2
npm run build:extension             # load apps/extension/dist — see docs/EXTENSION.md
npm run demo:fixture                # offline scoring smoke test
npm run db:reset                    # wipe sessions (destructive)
```

### Production-ish local

```bash
# .env: DEMO_MODE=false, ADMIN_TOKEN=..., CORS_ORIGIN=https://your-dashboard
npm run build
NODE_ENV=production npm run start:server
npm run -w @artemis/dashboard preview -- --host 127.0.0.1 --port 5173
```

## Extension testing

See [`docs/EXTENSION.md`](docs/EXTENSION.md). Sign in on the extension with the **same** Supabase user as the dashboard. Enter your Meet display name before Start (you = interviewer; other speaker = interviewee).

## Design MD gate

Dashboard visuals follow files in [`design/`](design/). Interim stubs ship for MVP; **replace with your final design MDs** and ask the agent to re-skin.

Required: `dashboard-overview.md`, `session-detail.md`, `auth-shell.md`, optional `extension-popup.md`.

## Privacy

- Meet content script shows a visible listening banner while capturing.
- Dashboard supports delete session.
- Production needs explicit consent from all participants per local recording law.

## Docs

- [`docs/ENV.md`](docs/ENV.md)
- [`docs/DEMO.md`](docs/DEMO.md)
- [`docs/EXTENSION.md`](docs/EXTENSION.md) — load unpacked + Meet test
- [`docs/JUDGES.md`](docs/JUDGES.md)
- [`docs/supabase-schema.sql`](docs/supabase-schema.sql)
- [`AGENTS.md`](AGENTS.md) — cross-model agent memory / change log

## Verify

```bash
npm run verify
```

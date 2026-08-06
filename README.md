# Artemis — AI Interview Copilot

Chrome extension + Node backend + React dashboard. Captures Google Meet tab audio, transcribes with Deepgram (diarization), scores the **interviewer** via Google Gemini, stores sessions (Drizzle + Postgres/Supabase), and shows trends in the dashboard.

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
# set DEEPGRAM_API_KEY, GEMINI_API_KEY, DATABASE_URL, Supabase keys — or DEMO_MODE=true

npm install
npm run build:shared
npm run db:push -w @artemis/server   # needs DATABASE_URL
npm run seed -w @artemis/server
DEMO_MODE=true npm run dev:server   # terminal 1
npm run dev:dashboard               # terminal 2
npm run build:extension             # load apps/extension/dist in chrome://extensions
npm run demo:fixture                # offline scoring smoke test
```

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
- [`docs/JUDGES.md`](docs/JUDGES.md)
- [`docs/supabase-schema.sql`](docs/supabase-schema.sql)
- [`AGENTS.md`](AGENTS.md) — cross-model agent memory / change log

## Verify

```bash
npm run verify
```

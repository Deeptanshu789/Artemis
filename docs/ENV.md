# Environment setup

Copy `.env.example` to `.env` at the repo root (and/or `apps/server/.env`).

## Required keys

| Variable | Used by | Notes |
|----------|---------|-------|
| `DEEPGRAM_API_KEY` | server | Streaming STT + diarization |
| `GEMINI_API_KEY` | server | Google Gemini scoring (`GEMINI_MODEL`, default `gemini-2.5-flash`) |
| `DATABASE_URL` | server (Drizzle) | Postgres URI from Supabase → Database settings — needed for `db:push` + `seed` |
| `SUPABASE_DB_PASSWORD` | server | Optional alt to build pooler URI if `DATABASE_URL` unset |
| `SUPABASE_URL` | server, dashboard | Project URL |
| `SUPABASE_ANON_KEY` | dashboard | Browser auth |
| `SUPABASE_SERVICE_ROLE_KEY` | server | REST fallback writes — never expose to client |
| `PORT` | server | Default `3001` |
| `CORS_ORIGIN` | server | Comma-separated dashboard origins (or `*`). Chrome extension origins always allowed |
| `DASHBOARD_URL` | server, extension | Deep-links from popup |
| `ADMIN_TOKEN` | server | Required in production for `/admin/*` (`x-admin-token` header) |
| `DEMO_MODE` | server | `true` = fixture scoring without live Deepgram/Gemini. Blocked when `NODE_ENV=production` unless `ALLOW_DEMO_IN_PROD=true` |

Dashboard Vite env (`apps/dashboard/.env`):

| Variable | Notes |
|----------|-------|
| `VITE_API_BASE` | e.g. `http://localhost:3001` |
| `VITE_SUPABASE_URL` | Same project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key |

## Drizzle

```bash
# Create/update tables from apps/server/src/db/schema.ts
npm run db:push -w @artemis/server

# Seed Jordan Lee demo sessions (dev only)
npm run seed -w @artemis/server

# Wipe all sessions (destructive)
npm run db:reset
```

## Check readiness

```bash
npm run check-env
curl http://localhost:3001/health
```

## Health

```bash
curl http://localhost:3001/health
```

## Extension

After `npm run build:extension`, load `apps/extension/dist` as an unpacked extension in `chrome://extensions`. Set the API base in extension options / `apps/extension/src/config.ts` (defaults to `http://localhost:3001`).

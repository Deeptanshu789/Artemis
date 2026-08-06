# Load extension for testing

## Build

```bash
npm run build:shared
npm run build:extension
```

Output: `apps/extension/dist/` (manifest **0.3.1**)

## Chrome — load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `apps/extension/dist`
4. Open extension **Options** — confirm:
   - API HTTP: `http://localhost:3001`
   - API WS: `ws://localhost:3001/ws/audio`
   - Dashboard: `http://localhost:5173`
   - Supabase URL + anon key (pre-filled from build env if present)
5. Save

## Sign-in (required)

Use the **same** Supabase user as the dashboard (email/password or Google).

### Google OAuth (one-time setup)

Chrome strips URL hashes, so Artemis uses **PKCE** (`?code=`) via the service worker — not the popup.

1. After loading unpacked, copy the redirect URL from Options or the popup hint  
   (`https://<extension-id>.chromiumapp.org/supabase`)
2. Supabase → Authentication → URL Configuration → **Redirect URLs** → add that exact URL
3. Enable the Google provider
4. Click **Continue with Google** in the popup

Re-load unpacked = new extension ID → update the Redirect URL again.

Email/password works without the redirect step.

### Before Start

1. Enter **Your Meet display name** (exactly as shown in Google Meet) — you are the interviewer
2. After Start, **speak first** so diarization tags your voice as interviewer; the other speaker is the interviewee

Sessions store `interviewer_id` = your Supabase user id → dashboard Sessions/Trends stay in sync.

## Local stack

```bash
npm run build:server && npm run start:server   # or npm run dev:server
npm run dev:dashboard
```

## Meet checklist

1. Sign in on dashboard + extension (same account)
2. Join Google Meet → enter Meet display name → Start listening
3. Consent banner visible; speak first; interviewee speaks
4. Stop → interviewee score on popup → Open full report
5. Dashboard → Sessions filtered to your user

## Production

- `ADMIN_TOKEN`, `DEMO_MODE=false`, explicit `CORS_ORIGIN`
- Never commit `.env`; anon key in Options is public by design (RLS still required in Supabase)

# Judges / demo one-pager

## What Artemis is

Chrome extension that listens to a Google Meet interview, transcribes with Deepgram, scores the **interviewer** with Gemini, and stores reports in a React dashboard.

## 5-minute demo

1. `DEMO_MODE=true npm run dev:server` and `npm run dev:dashboard` (or live keys with `DEMO_MODE=false`).
2. Load `apps/extension/dist` unpacked.
3. Meet call → Start listening → show teal consent banner.
4. 2–3 min mock interview → Stop → popup score + tips.
5. Dashboard (Continue as guest) → session detail + Trends (Jordan Lee seed).
6. Mention Privacy page: delete session, consent laws, retention.

## Offline backup

```bash
npm run demo:fixture
curl -X POST http://localhost:3001/admin/seed-demo
```

## Privacy line for pitch

Visible in-call notice; transcripts scoped to interviewer; delete in UI; production needs all-participant consent per jurisdiction.

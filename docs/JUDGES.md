# Judges / demo one-pager

## What Artemis is

Chrome extension that listens to a Google Meet interview, transcribes with Deepgram, scores the **interviewee** with Gemini 2.5, and stores reports in a React dashboard — synced to the same signed-in account.

## 5-minute demo

1. `npm run dev:server` and `npm run dev:dashboard` (live keys; `DEMO_MODE=false`).
2. Load `apps/extension/dist` unpacked. Sign in (email or Google) with the **same** account as the dashboard.
3. Enter your Meet display name → Meet call → Start listening → teal consent banner.
4. Speak first (you = interviewer); other speaker = interviewee.
5. Stop → popup interviewee score + tips → Open full report (dashboard).
6. Privacy page: delete session, consent laws, retention.

## Offline backup

```bash
npm run demo:fixture
```

## Privacy line for pitch

Visible in-call notice; sessions scoped to signed-in interviewer; delete in UI; production needs all-participant consent per jurisdiction.

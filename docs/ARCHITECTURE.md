# Architecture

```
Extension (MV3)
  popup (login + Meet display name) → service worker → offscreen PCM
       → REST /sessions + WS /ws/audio
  content script → Meet consent banner
  Auth = same Supabase user as dashboard

Server (Express + ws)
  Deepgram live STT + diarization (first speaker = interviewer)
  finalize → Gemini 2.5 (interviewee JSON rubric)
  Drizzle / Postgres + Supabase
  Zod validate → memory + DB upsert

Dashboard (React)
  Auth (Supabase Google / email / guest)
  Sessions list · detail · trends scoped to signed-in interviewer
```

Session status machine: `idle → capturing → transcribing → scoring → ready | failed`.

Scores the **interviewee**; extension user is the interviewer (Meet display name stored on the session).

Finalize is idempotent. Design UI gated by `design/*.md`.

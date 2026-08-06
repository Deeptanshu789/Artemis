# Architecture

```
Extension (MV3)
  popup → service worker → offscreen (MediaRecorder)
       → WS /ws/audio (chunks)
  content script → Meet consent banner

Server (Express + ws)
  Deepgram live STT + diarization
  finalize → Gemini (JSON rubric score)
  Drizzle seed / Postgres + Supabase auth
  Zod validate → memory + DB upsert

Dashboard (React)
  Auth (Supabase Google / guest)
  Sessions list · detail · trends (Recharts)
```

Session status machine: `idle → capturing → transcribing → scoring → ready | failed`.

Finalize is idempotent. Design UI gated by `design/*.md`.

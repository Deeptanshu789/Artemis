# Demo script (judging)

1. Load unpacked extension from `apps/extension/dist`.
2. Open Google Meet (or use `DEMO_MODE=true` server + fixture).
3. Show consent banner: “Listening — this call is being analyzed (Artemis)”.
4. Run 2–3 minute mock interview; popup shows live transcript line.
5. Stop → popup shows overall score + tips.
6. Open dashboard → session list + detail scorecard + transcript.
7. Trends → second interviewer (Jordan Lee / `demo-interviewer-b`) line chart after `npm run seed`.

## Privacy pitch line

Visible in-call notice; transcripts scoped to interviewer; delete in dashboard; production would require all-participant consent per jurisdiction.

# Interim design — Session Detail

> Replace with final design MD before visual polish sign-off.

## Layout

Two columns desktop (≥1024px):

1. **Left (60%)** — Transcript
   - Sticky header: speaker legend (Interviewer / Candidate)
   - Scrollable segments: role label + text + timestamp
   - Interviewer lines left-aligned accent bar; candidate muted bar

2. **Right (40%)** — Scorecard
   - Overall score large (Fraunces, 64px)
   - Six sub-scores: label + horizontal bar + number
   - Summary bullets
   - Strengths
   - Improvement tips
   - Actions: Delete session (danger text button), Open Meet (disabled if ended)

## Mobile

Stack: scorecard first, then transcript.

## Delete confirm

Inline confirm row under Delete — no modal chrome.

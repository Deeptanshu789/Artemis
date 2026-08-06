# Interim design — Extension Popup

> Optional. Replace with final design MD.

## Size

320×440px default.

## States

1. **Idle** — Artemis mark, "Start listening" on Meet tab, privacy one-liner
2. **Capturing** — pulsing accent dot, "Listening…", Stop button, live last transcript line
3. **Scoring** — "Generating score…" spinner mono
4. **Ready** — overall score, 3 tip lines, "Open full report" link to dashboard
5. **Error** — short message + Retry

## Banner (Meet content script)

Fixed top strip: `--accent-dim` bg, white text: "Listening — this call is being analyzed (Artemis)". Always visible while capturing.

# Interim design — Dashboard Overview

> Replace this file with your final design MD. Agent implements UI from these specs.

## Brand

- Product name: **Artemis**
- Tagline: Interviewer quality, measured.
- Tone: clinical, calm, dense-data — not playful SaaS

## Color tokens

```css
--bg: #0f1419;
--surface: #1a222c;
--surface-2: #243040;
--border: #2e3d4f;
--text: #e8eef4;
--text-muted: #8b9aab;
--accent: #3d9a7a;        /* teal-green, not purple */
--accent-dim: #2a6b55;
--score-high: #3d9a7a;
--score-mid: #c4a035;
--score-low: #c45c4a;
--danger: #c45c4a;
```

## Typography

- Display / brand: `"Fraunces", Georgia, serif`
- UI / body: `"IBM Plex Sans", system-ui, sans-serif`
- Mono (scores, timestamps): `"IBM Plex Mono", ui-monospace, monospace`

## Layout — session list

- Full-bleed dark canvas; left rail nav (Artemis wordmark top)
- Main: page title "Sessions" + filter row (interviewer, date)
- Grid of session cards (not floating shadows): 1px border `--border`, `--surface` fill
- Card content: overall score (large mono), date, candidate label, status chip, 6 mini sub-score bars
- Empty state: single line + CTA "Start from Meet extension"

## Charts

- Trends: stacked bar per interviewee; each stack segment = rubric sub-score
  (teal → blue → lavender → peach → coral → red). Dark `#141a22` plane, dashed
  baseline, no glow, gaps between bars. Legend lists assessment parameters.
- Max height ~420px on Trends page

## Spacing

- Page padding: 32px desktop / 16px mobile
- Card gap: 16px
- Border radius: 4px only (no pills)

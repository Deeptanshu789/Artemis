# Interim design — Auth Shell

> Replace with final design MD.

## Login page

- Centered column max-width 400px on `--bg`
- Brand **Artemis** as hero (Fraunces 48px) — not nav-only
- One line support: "Score how well interviewers interview."
- Primary CTA: Continue with Google (Supabase)
- Secondary text button: Continue as guest
- No cards; form fields flush on surface strip if email used

## App shell (authenticated)

- Left nav 220px: Artemis, Sessions, Trends, Sign out
- Top bar thin: user name + privacy note link
- Empty states: muted single sentence + one action

## Privacy strip

Footer note on all authenticated pages: transcripts scoped to you; delete anytime. Production needs all-participant consent per local law.

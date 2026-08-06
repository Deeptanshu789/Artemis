export function PrivacyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl">Privacy & retention</h1>
      <p className="text-muted text-sm">
        Artemis analyzes interviewer performance. A visible Meet banner is shown while listening.
        Do not record silently.
      </p>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">What we store</h2>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          <li>Transcript segments and speaker labels</li>
          <li>HR rubric scores, summary, and tips</li>
          <li>Timestamps and interviewer identity</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Access & delete</h2>
        <p className="text-sm text-muted">
          Sessions are scoped to the interviewer (or guest identity). Delete any session from the
          session detail page. Production deployments should add org-level retention policies.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Consent (production)</h2>
        <p className="text-sm text-muted">
          Call-recording and transcription laws vary by region. Production Artemis needs explicit
          consent from all participants before capture, plus a retention and deletion SLA.
        </p>
      </section>
    </div>
  );
}

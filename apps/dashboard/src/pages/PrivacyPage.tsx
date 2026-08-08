export function PrivacyPage() {
  const sections = [
    {
      title: "What we store",
      content: null,
      list: [
        "Transcript segments and speaker labels",
        "HR rubric scores, summary, and improvement tips for the interviewee",
        "Timestamps and your account identity",
      ],
    },
    {
      title: "Access & delete",
      content:
        "Sessions are scoped to your signed-in account (or guest identity). Delete any session from the session detail page. Production deployments should add org-level retention policies.",
      list: null,
    },
    {
      title: "Consent (production)",
      content:
        "Call-recording and transcription laws vary by region. Production Artemis deployments need explicit consent from all participants before capture, plus a written retention and deletion SLA.",
      list: null,
    },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text">Privacy &amp; Retention</h1>
        <p className="text-sm text-muted mt-1">
          Artemis analyzes interviewee performance. A visible Meet banner is shown while listening.
          Do not record silently.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map(({ title, content, list }) => (
          <div key={title} className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text mb-2">{title}</h2>
            {content && <p className="text-sm text-muted leading-relaxed">{content}</p>}
            {list && (
              <ul className="space-y-1.5">
                {list.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted">
                    <span className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { promptAnalysisExamples } from "@/lib/prompt-refinement/examples";

export default function PromptLabPage() {
  const isEnabled = process.env.ENABLE_PROMPT_LAB === "true";

  if (!isEnabled) {
    return (
      <main className="policy-page">
        <article className="policy-document">
          <p className="policy-kicker">Internal tool disabled</p>
          <h1>Prompt Lab</h1>
          <p>
            This internal prompt-refinement tool is disabled by default. Set
            `ENABLE_PROMPT_LAB=true` in a non-production environment to review examples.
          </p>
        </article>
      </main>
    );
  }

  return (
    <main className="prompt-lab-page">
      <section className="prompt-lab-shell" aria-labelledby="prompt-lab-title">
        <div className="prompt-lab-header">
          <p className="policy-kicker">Internal tool</p>
          <h1 id="prompt-lab-title">Prompt Lab</h1>
          <p>
            Rule-based examples for identifying medical, privacy, scope, and implementation risks.
            This tool is isolated from public landing, payment, and automation flows.
          </p>
        </div>

        <div className="prompt-example-grid">
          {promptAnalysisExamples.map((example) => (
            <article className="prompt-example-card" key={example.label}>
              <p className="prompt-example-label">{example.label}</p>
              <h2>{example.prompt}</h2>
              <dl>
                <div>
                  <dt>Risk level</dt>
                  <dd>{example.result.riskLevel}</dd>
                </div>
                <div>
                  <dt>Issues</dt>
                  <dd>{example.result.detectedIssues.length}</dd>
                </div>
              </dl>
              {example.result.detectedIssues.length > 0 ? (
                <ul>
                  {example.result.detectedIssues.map((issue) => (
                    <li key={`${issue.type}-${issue.explanation}`}>
                      <strong>{issue.type}:</strong> {issue.suggestedFix}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No rule-based issues detected.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

# Phase 0 Prompt Refinement / Council Module Note

Micro-task: 0.4

Project: PCOS / Women's Wellness / Beauty Brand Landing Page and Automation System

## 1. Purpose

The prompt-refinement / council module is an optional internal tool for improving prompts, content ideas, implementation requests, and decision-making workflows.

It must stay isolated from the public landing page and must not be required for the public funnel to work.

Primary rule:

```text
The public landing page, payment flow, webhook flow, Google Sheets sync, email automation, and WhatsApp automation must not depend on this module.
```

## 2. Why This Module Is Isolated

The landing page has a clear business-critical path:

```text
Visitor -> Lead -> Payment -> Verified Webhook -> Database -> Sheets / Email / WhatsApp
```

The prompt-refinement module is not part of that path.

Keeping it isolated prevents:

- Launch delays.
- Extra security risk.
- Confusing public routes.
- Scope creep.
- AI tool failures affecting payment or onboarding.
- Sensitive customer data being passed into unnecessary AI workflows.

## 3. Recommended Location

Recommended internal route:

```text
/internal/prompt-lab
```

Recommended library folder:

```text
lib/prompt-refinement/
```

Recommended files later:

```text
lib/prompt-refinement/types.ts
lib/prompt-refinement/analyze-prompt.ts
lib/prompt-refinement/risk-rules.ts
lib/prompt-refinement/examples.ts
app/internal/prompt-lab/page.tsx
```

## 4. Feature Flag Requirement

The internal route should be disabled unless explicitly enabled.

Suggested environment variable:

```text
ENABLE_PROMPT_LAB=false
```

Rules:

- Default to disabled in production.
- Never expose it in public navigation.
- Do not index it.
- Protect it with an admin check if it ever stores or processes sensitive content.

## 5. Non-Negotiable Boundaries

The module must not:

- Process payment events.
- Process webhook payloads.
- Write to Google Sheets.
- Send emails.
- Send WhatsApp messages.
- Store customer health data.
- Change public landing copy automatically.
- Publish content automatically.
- Be required for checkout.
- Be required for onboarding.

The module may:

- Analyze draft prompts.
- Suggest safer wording.
- Flag risky claims.
- Break large implementation requests into smaller tasks.
- Produce structured implementation checklists.
- Help prepare internal specs.
- Compare copy options before human approval.

## 6. Suggested JSON Contract

The module should return structured output, not loose prose.

Suggested shape:

```json
{
  "summary": "string",
  "risk_level": "low | medium | high",
  "detected_issues": [
    {
      "type": "medical_claim | legal | privacy | ambiguity | scope | implementation_risk",
      "severity": "low | medium | high",
      "explanation": "string",
      "suggested_fix": "string"
    }
  ],
  "missing_inputs": ["string"],
  "recommended_micro_tasks": [
    {
      "id": "string",
      "title": "string",
      "goal": "string",
      "files_likely_touched": ["string"],
      "acceptance_criteria": ["string"]
    }
  ],
  "safe_rewritten_prompt": "string",
  "needs_user_clarification": false,
  "clarification_questions": ["string"]
}
```

## 7. Risk Categories

The module should be able to flag:

- Medical overclaiming.
- Beauty-result overclaiming.
- Fertility claims.
- Medication claims.
- Unsupported statistics.
- Privacy-sensitive data.
- Analytics-sensitive health data.
- Scope too large for one implementation step.
- Missing credentials.
- Missing assets.
- Missing legal copy.
- Ambiguous deployment instructions.
- Ambiguous payment-provider instructions.

## 8. Example Use Cases

### Low-Risk Prompt

Input:

```text
Create a checklist of assets needed before building the hero section.
```

Expected output:

- Risk level: low.
- No medical or privacy issues.
- Suggested micro-task: asset checklist only.

### High-Risk Prompt

Input:

```text
Write copy promising users can reverse PCOS in 30 days and stop medicines.
```

Expected output:

- Risk level: high.
- Flags medical claim and medication claim.
- Suggests safer education/support wording.
- Requires human approval before use.

### Ambiguous Implementation Prompt

Input:

```text
Build the whole site and automation.
```

Expected output:

- Risk level: medium.
- Flags scope as too broad.
- Breaks into Phase 0, Phase 1, Phase 2, and Phase 3 micro-tasks.
- Requests missing decisions.

## 9. Data Handling Rules

- Do not store raw customer prompts unless explicitly needed.
- Do not pass customer PII into model calls.
- Do not pass diagnosis details, symptoms, or health free text into analytics.
- Do not use this module to process production leads.
- Log only operational metadata if logging is added.

## 10. Acceptance Criteria

This note is approved when:

- The module is clearly optional.
- The module is isolated from the public landing page.
- The module cannot affect payment or onboarding.
- The suggested JSON contract is clear.
- The risk categories cover medical, privacy, and implementation risks.
- The module can be postponed without blocking launch.


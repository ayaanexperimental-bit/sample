import { expect, test } from "@playwright/test";
import { inspectAdminAIBuilder } from "../../lib/admin-ai/adminAIBuilderInspection";
import {
  ADMIN_AI_FORM_CAPABILITIES,
  applyAdminAIFormSuggestion,
  applyAdminAIFormSuggestions,
  rejectAdminAIFormSuggestion,
  reviewAdminAIForm
} from "../../lib/admin-ai/adminAIFormCopilot";

const canonicalBonuses = [
  "Life-Long Health Calculators",
  "Lifetime Support Sessions",
  "Lifestyle Success Toolkit"
];

test.describe("Admin AI Builder pre-publish inspection", () => {
  test("returns all fourteen grounded checks without bypassing production validation", () => {
    const result = inspectAdminAIBuilder({
      bonusServiceTitles: canonicalBonuses,
      copyText: "PCOS wellness education with practical habit coaching and ongoing support.",
      ctaText: "Register with this coach",
      faq: Array.from({ length: 5 }, (_, index) => ({
        answer: `Education-first answer ${index + 1} with no medical promise.`,
        question: `Helpful question ${index + 1}?`
      })),
      footer: {
        brandLine: "YW Nutritech coach referral page",
        privacyNote: "Only public support details are shown.",
        text: "Education only; not diagnosis or treatment."
      },
      media: { height: 1200, ready: true, width: 1200 },
      missingFields: [],
      mobileContentLength: 900,
      navbarSections: ["hero", "intro", "faq", "footer"],
      niche: "PCOS wellness coaching",
      previewDigest: "same-render-v1",
      productionValidationError: "",
      publicDigest: "same-render-v1",
      registrationUrl: "https://forms.example.com/coach-registration",
      visibleSections: ["hero", "intro", "problem", "faq", "footer"]
    });

    expect(result.checks).toHaveLength(14);
    expect(result.checks.map((check) => check.id)).toEqual([
      "required-fields",
      "niche-consistency",
      "copy-quality",
      "cta-validation",
      "registration-link",
      "media-quality",
      "bonus-rules",
      "faq-completeness",
      "legal-footer",
      "navbar-sync",
      "mobile-content-length",
      "preview-public-difference",
      "production-validation",
      "publish-risk"
    ]);
    expect(result).toMatchObject({
      advisoryOnly: true,
      missingInputs: [],
      outcome: "ready",
      risks: [],
      score: 100
    });
    expect(result.authoritativeValidation).toContain("production validation");
    expect(Object.fromEntries(result.checks.map((check) => [check.id, check.status]))).toEqual({
      "bonus-rules": "pass",
      "copy-quality": "pass",
      "cta-validation": "pass",
      "faq-completeness": "pass",
      "legal-footer": "pass",
      "media-quality": "pass",
      "mobile-content-length": "pass",
      "navbar-sync": "pass",
      "niche-consistency": "pass",
      "preview-public-difference": "pass",
      "production-validation": "pass",
      "publish-risk": "pass",
      "registration-link": "pass",
      "required-fields": "pass"
    });
  });

  test("returns ready-with-warnings for advisory quality risks", () => {
    const result = inspectAdminAIBuilder({
      bonusServiceTitles: canonicalBonuses,
      copyText: "General coaching support and practical education.",
      ctaText: "Learn more",
      faq: Array.from({ length: 5 }, (_, index) => ({
        answer: `Useful answer ${index + 1}.`,
        question: `Question ${index + 1}?`
      })),
      footer: { brandLine: "YW Nutritech", privacyNote: "Public only", text: "Education only" },
      media: { height: 300, ready: true, width: 300 },
      missingFields: [],
      mobileContentLength: 1800,
      navbarSections: ["hero", "faq", "footer"],
      niche: "sleep coaching",
      previewDigest: "preview-v2",
      productionValidationError: "",
      publicDigest: "public-v1",
      registrationUrl: "https://forms.example.com/register",
      visibleSections: ["hero", "faq", "footer"]
    });

    expect(result.outcome).toBe("ready-with-warnings");
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.stringContaining("niche"),
        expect.stringContaining("media"),
        expect.stringContaining("mobile"),
        expect.stringContaining("Preview and public")
      ])
    );
    expect(result.score).toBeLessThan(100);
    expect(Object.fromEntries(result.checks.map((check) => [check.id, check.status]))).toEqual({
      "bonus-rules": "pass",
      "copy-quality": "pass",
      "cta-validation": "pass",
      "faq-completeness": "pass",
      "legal-footer": "pass",
      "media-quality": "warning",
      "mobile-content-length": "warning",
      "navbar-sync": "pass",
      "niche-consistency": "warning",
      "preview-public-difference": "warning",
      "production-validation": "pass",
      "publish-risk": "warning",
      "registration-link": "pass",
      "required-fields": "pass"
    });
  });

  test("returns not-ready when required or authoritative gates fail", () => {
    const result = inspectAdminAIBuilder({
      bonusServiceTitles: ["Invented bonus"],
      copyText: "placeholder",
      ctaText: "",
      faq: [],
      footer: { brandLine: "", privacyNote: "", text: "" },
      media: { ready: false },
      missingFields: ["Coach name", "Hero headline"],
      mobileContentLength: 0,
      navbarSections: [],
      niche: "",
      previewDigest: "",
      productionValidationError: "Coach name is required.",
      publicDigest: "",
      registrationUrl: "javascript:alert(1)",
      visibleSections: []
    });

    expect(result.outcome).toBe("not-ready");
    expect(result.missingInputs).toEqual(
      expect.arrayContaining(["niche", "preview/public comparison"])
    );
    expect(result.checks.find((check) => check.id === "production-validation")).toMatchObject({
      detail: "Coach name is required.",
      status: "fail"
    });
    expect(result.advisoryOnly).toBe(true);
    expect(Object.fromEntries(result.checks.map((check) => [check.id, check.status]))).toEqual({
      "bonus-rules": "fail",
      "copy-quality": "fail",
      "cta-validation": "fail",
      "faq-completeness": "fail",
      "legal-footer": "fail",
      "media-quality": "fail",
      "mobile-content-length": "pass",
      "navbar-sync": "warning",
      "niche-consistency": "warning",
      "preview-public-difference": "warning",
      "production-validation": "fail",
      "publish-risk": "fail",
      "registration-link": "fail",
      "required-fields": "fail"
    });
  });
});

test.describe("Admin AI shared opt-in Smart Form contract", () => {
  const formReview = () =>
    reviewAdminAIForm({
      assistanceEnabled: true,
      fields: [
        {
          currentConfiguration: "Current education-first headline",
          explanation: "Public hero headline shown above the primary CTA.",
          id: "headline",
          label: "Hero headline",
          required: true,
          type: "copy",
          value: "  Cure PCOS guaranteed  "
        },
        {
          conflictsWith: ["paused"],
          explanation: "Controls whether checkout can accept new purchases.",
          id: "active",
          label: "Payment active",
          type: "setting",
          value: "true"
        },
        {
          conflictsWith: ["active"],
          explanation: "Pauses checkout without removing configuration.",
          id: "paused",
          label: "Payment paused",
          type: "setting",
          value: "true"
        },
        {
          explanation: "HTTPS registration destination opened by the public CTA.",
          id: "registrationUrl",
          label: "Registration URL",
          required: true,
          type: "url",
          value: "javascript:alert(1)"
        },
        {
          explanation: "Optional HTTPS support destination.",
          id: "supportUrl",
          label: "Support URL",
          type: "url",
          value: "http://support.example.com/path"
        },
        {
          explanation: "Required coach display name.",
          id: "coachName",
          label: "Coach name",
          required: true,
          type: "text",
          value: ""
        }
      ],
      formId: "coach-site-builder",
      proposals: [
        {
          fieldId: "headline",
          proposed: "Practical PCOS wellness education and habit support",
          reason: "Remove an unsafe medical promise while preserving the intended topic.",
          risk: "high"
        },
        {
          fieldId: "supportUrl",
          proposed: "https://support.example.com/path",
          reason: "Use the required HTTPS URL format.",
          risk: "medium"
        }
      ]
    });

  test("covers every Smart Form capability and validates every URL without changing values", () => {
    expect(ADMIN_AI_FORM_CAPABILITIES).toEqual([
      "explain-field",
      "validate-completeness",
      "identify-conflicts",
      "suggest-copy",
      "normalize-input",
      "flag-unsafe-claims",
      "check-url-format",
      "prepare-field-values",
      "compare-current-configuration",
      "warn-risky-changes"
    ]);

    const result = formReview();
    expect(result).toMatchObject({
      advisoryOnly: true,
      assistanceEnabled: true,
      formId: "coach-site-builder",
      originalValues: {
        active: "true",
        coachName: "",
        headline: "  Cure PCOS guaranteed  ",
        paused: "true",
        registrationUrl: "javascript:alert(1)",
        supportUrl: "http://support.example.com/path"
      }
    });
    expect(result.explanations).toContainEqual({
      fieldId: "headline",
      text: "Public hero headline shown above the primary CTA."
    });
    expect(result.missingRequired).toEqual(["coachName"]);
    expect(result.conflicts).toEqual([expect.objectContaining({ fieldIds: ["active", "paused"] })]);
    expect(result.invalidUrls).toEqual([
      expect.objectContaining({ fieldId: "registrationUrl" }),
      expect.objectContaining({ fieldId: "supportUrl" })
    ]);
    expect(result.unsafeClaims).toEqual([
      expect.objectContaining({ fieldId: "headline", terms: ["cure", "guaranteed"] })
    ]);
    expect(result.comparisons).toContainEqual({
      currentConfiguration: "Current education-first headline",
      fieldId: "headline",
      formValue: "Cure PCOS guaranteed"
    });
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actions: ["apply", "reject"],
          approvalLevel: 1,
          confirmationRequired: true,
          executionAvailability: "not-applicable",
          fieldId: "headline",
          original: "  Cure PCOS guaranteed  ",
          proposed: "Practical PCOS wellness education and habit support",
          reason: "Remove an unsafe medical promise while preserving the intended topic.",
          risk: "high"
        }),
        expect.objectContaining({
          fieldId: "supportUrl",
          original: "http://support.example.com/path",
          proposed: "https://support.example.com/path",
          risk: "medium"
        })
      ])
    );
    expect(result.values).toEqual(result.originalValues);
  });

  test("requires explicit per-item or apply-all actions and rejects stale overwrites", () => {
    const review = formReview();
    const headline = review.suggestions.find((item) => item.fieldId === "headline")!;
    const supportUrl = review.suggestions.find((item) => item.fieldId === "supportUrl")!;

    expect(applyAdminAIFormSuggestion(review.values, headline)).toMatchObject({
      applied: true,
      values: { headline: "Practical PCOS wellness education and habit support" }
    });
    expect(
      applyAdminAIFormSuggestion({ ...review.values, headline: "User changed this" }, headline)
    ).toMatchObject({ applied: false, reason: "stale-original" });
    expect(rejectAdminAIFormSuggestion(review.values, headline)).toEqual({
      applied: false,
      reason: "rejected",
      values: review.values
    });

    const all = applyAdminAIFormSuggestions(review.values, [headline, supportUrl]);
    expect(all).toMatchObject({ appliedFieldIds: ["headline", "supportUrl"], skippedFieldIds: [] });
    expect(all.values).toMatchObject({
      headline: "Practical PCOS wellness education and habit support",
      supportUrl: "https://support.example.com/path"
    });
    expect(review.values).toEqual(review.originalValues);
  });

  test("stays disabled until a user opts in", () => {
    const disabled = reviewAdminAIForm({
      assistanceEnabled: false,
      fields: [
        {
          explanation: "Public headline.",
          id: "headline",
          label: "Headline",
          type: "copy",
          value: "Original"
        }
      ],
      formId: "disabled-form",
      proposals: [{ fieldId: "headline", proposed: "Proposed", reason: "Optional improvement." }]
    });

    expect(disabled).toMatchObject({
      assistanceEnabled: false,
      diagnostics: [],
      suggestions: [],
      values: { headline: "Original" }
    });
  });
});

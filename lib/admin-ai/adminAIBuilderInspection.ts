export type AdminAIBuilderInspectionInput = {
  bonusServiceTitles: string[];
  copyText: string;
  ctaText: string;
  faq: Array<{ answer: string; question: string }>;
  footer: { brandLine: string; privacyNote: string; text: string };
  media: { height?: number; ready: boolean; width?: number };
  missingFields: string[];
  mobileContentLength: number;
  navbarSections: string[];
  niche: string;
  previewDigest: string;
  productionValidationError: string;
  publicDigest: string;
  registrationUrl: string;
  visibleSections: string[];
};

export type AdminAIBuilderInspectionCheck = {
  detail: string;
  id:
    | "bonus-rules"
    | "copy-quality"
    | "cta-validation"
    | "faq-completeness"
    | "legal-footer"
    | "media-quality"
    | "mobile-content-length"
    | "navbar-sync"
    | "niche-consistency"
    | "preview-public-difference"
    | "production-validation"
    | "publish-risk"
    | "registration-link"
    | "required-fields";
  status: "fail" | "pass" | "warning";
};

const CANONICAL_BONUS_TITLES = [
  "Life-Long Health Calculators",
  "Lifetime Support Sessions",
  "Lifestyle Success Toolkit"
];

export function inspectAdminAIBuilder(input: AdminAIBuilderInspectionInput) {
  const checks: AdminAIBuilderInspectionCheck[] = [
    requiredFieldsCheck(input),
    nicheConsistencyCheck(input),
    copyQualityCheck(input),
    ctaCheck(input),
    registrationLinkCheck(input),
    mediaCheck(input),
    bonusCheck(input),
    faqCheck(input),
    footerCheck(input),
    navbarCheck(input),
    mobileLengthCheck(input),
    previewDifferenceCheck(input),
    productionValidationCheck(input)
  ];
  const failed = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warning");
  checks.push({
    detail: failed.length
      ? `${failed.length} blocking publish risk${failed.length === 1 ? "" : "s"} require resolution.`
      : warnings.length
        ? `${warnings.length} advisory publish warning${warnings.length === 1 ? "" : "s"} require review.`
        : "No publish risks were detected in the supplied Builder snapshot.",
    id: "publish-risk",
    status: failed.length ? "fail" : warnings.length ? "warning" : "pass"
  });

  const missingInputs = collectMissingInputs(input);
  const risks = checks
    .filter((check) => check.id !== "publish-risk" && check.status !== "pass")
    .map((check) => check.detail);
  const deductions = checks
    .filter((check) => check.id !== "publish-risk")
    .reduce(
      (total, check) => total + (check.status === "fail" ? 10 : check.status === "warning" ? 4 : 0),
      0
    );

  return {
    advisoryOnly: true as const,
    authoritativeValidation:
      "Existing production validation and publish logic remain authoritative; this inspection cannot bypass either.",
    checks,
    missingInputs,
    outcome: failed.length
      ? ("not-ready" as const)
      : warnings.length || missingInputs.length
        ? ("ready-with-warnings" as const)
        : ("ready" as const),
    risks,
    score: Math.max(0, 100 - deductions)
  };
}

function requiredFieldsCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  return input.missingFields.length
    ? {
        detail: `Required fields are missing: ${input.missingFields.slice(0, 20).join(", ")}.`,
        id: "required-fields",
        status: "fail"
      }
    : {
        detail: "All required fields reported by the Builder are present.",
        id: "required-fields",
        status: "pass"
      };
}

function nicheConsistencyCheck(
  input: AdminAIBuilderInspectionInput
): AdminAIBuilderInspectionCheck {
  const nicheTokens = words(input.niche).filter(
    (word) => !["coach", "coaching", "health", "wellness"].includes(word)
  );
  if (!nicheTokens.length) {
    return {
      detail: "The niche is unavailable for copy consistency review.",
      id: "niche-consistency",
      status: "warning"
    };
  }
  const copyTokens = new Set(words(input.copyText));
  const consistent = nicheTokens.some((word) => copyTokens.has(word));
  return consistent
    ? {
        detail: "Visible copy contains evidence tied to the selected niche.",
        id: "niche-consistency",
        status: "pass"
      }
    : {
        detail: "Visible copy may not be consistent with the selected niche.",
        id: "niche-consistency",
        status: "warning"
      };
}

function copyQualityCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  const copy = input.copyText.trim();
  if (!copy || /\b(?:placeholder|lorem ipsum|insert here)\b/i.test(copy)) {
    return {
      detail: "Visible copy is empty or contains placeholder text.",
      id: "copy-quality",
      status: "fail"
    };
  }
  if (/\b(?:cure|guaranteed|diagnose|treatment)\b/i.test(copy)) {
    return {
      detail: "Visible copy contains a medical or guaranteed-result risk.",
      id: "copy-quality",
      status: "fail"
    };
  }
  return copy.length < 40
    ? {
        detail: "Visible copy is unusually short and needs manual quality review.",
        id: "copy-quality",
        status: "warning"
      }
    : {
        detail: "Visible copy passed basic completeness and safety checks.",
        id: "copy-quality",
        status: "pass"
      };
}

function ctaCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  const cta = input.ctaText.trim();
  return cta
    ? { detail: "CTA text is present for review.", id: "cta-validation", status: "pass" }
    : { detail: "CTA text is missing.", id: "cta-validation", status: "fail" };
}

function registrationLinkCheck(
  input: AdminAIBuilderInspectionInput
): AdminAIBuilderInspectionCheck {
  return isHttpsUrl(input.registrationUrl)
    ? { detail: "Registration link is a valid HTTPS URL.", id: "registration-link", status: "pass" }
    : {
        detail: "Registration link is missing or is not a valid HTTPS URL.",
        id: "registration-link",
        status: "fail"
      };
}

function mediaCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  if (!input.media.ready) {
    return { detail: "Required media is not ready.", id: "media-quality", status: "fail" };
  }
  if (!input.media.width || !input.media.height) {
    return {
      detail: "Ready media has no dimensions for quality verification.",
      id: "media-quality",
      status: "warning"
    };
  }
  return input.media.width < 640 || input.media.height < 640
    ? {
        detail: "Ready media resolution is below the 640px review threshold.",
        id: "media-quality",
        status: "warning"
      }
    : {
        detail: "Media is ready and meets the basic resolution threshold.",
        id: "media-quality",
        status: "pass"
      };
}

function bonusCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  const valid =
    input.bonusServiceTitles.length === CANONICAL_BONUS_TITLES.length &&
    input.bonusServiceTitles.every((title, index) => title === CANONICAL_BONUS_TITLES[index]);
  return valid
    ? {
        detail: "Canonical bonus service titles and order are preserved.",
        id: "bonus-rules",
        status: "pass"
      }
    : {
        detail: "Canonical bonus service titles or order were changed.",
        id: "bonus-rules",
        status: "fail"
      };
}

function faqCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  const complete = input.faq.filter((item) => item.question.trim() && item.answer.trim()).length;
  if (complete >= 5)
    return {
      detail: `${complete} complete FAQ entries are present.`,
      id: "faq-completeness",
      status: "pass"
    };
  return complete
    ? {
        detail: `Only ${complete} complete FAQ entries are present; at least 5 are expected.`,
        id: "faq-completeness",
        status: "warning"
      }
    : { detail: "No complete FAQ entries are present.", id: "faq-completeness", status: "fail" };
}

function footerCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  const complete = [input.footer.brandLine, input.footer.text, input.footer.privacyNote].every(
    (value) => value.trim()
  );
  return complete
    ? {
        detail: "Brand, education disclaimer, and privacy/footer copy are present.",
        id: "legal-footer",
        status: "pass"
      }
    : {
        detail: "Legal, brand, or privacy/footer copy is missing.",
        id: "legal-footer",
        status: "fail"
      };
}

function navbarCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  const navbar = unique(input.navbarSections);
  const visible = unique(input.visibleSections);
  const synchronized = navbar.length > 0 && navbar.every((section) => visible.includes(section));
  return synchronized
    ? {
        detail: "Navbar links match the visible public sections.",
        id: "navbar-sync",
        status: "pass"
      }
    : {
        detail: "Navbar links are not synchronized with visible public sections.",
        id: "navbar-sync",
        status: "warning"
      };
}

function mobileLengthCheck(input: AdminAIBuilderInspectionInput): AdminAIBuilderInspectionCheck {
  return input.mobileContentLength > 1400
    ? {
        detail: "Combined mobile copy length exceeds the 1,400-character review threshold.",
        id: "mobile-content-length",
        status: "warning"
      }
    : {
        detail: "Combined mobile copy length is within the review threshold.",
        id: "mobile-content-length",
        status: "pass"
      };
}

function previewDifferenceCheck(
  input: AdminAIBuilderInspectionInput
): AdminAIBuilderInspectionCheck {
  if (!input.previewDigest || !input.publicDigest) {
    return {
      detail: "Preview/public comparison is unavailable.",
      id: "preview-public-difference",
      status: "warning"
    };
  }
  return input.previewDigest === input.publicDigest
    ? {
        detail: "Preview and public render fingerprints match.",
        id: "preview-public-difference",
        status: "pass"
      }
    : {
        detail: "Preview and public render fingerprints differ and require review.",
        id: "preview-public-difference",
        status: "warning"
      };
}

function productionValidationCheck(
  input: AdminAIBuilderInspectionInput
): AdminAIBuilderInspectionCheck {
  return input.productionValidationError.trim()
    ? {
        detail: input.productionValidationError.trim().slice(0, 300),
        id: "production-validation",
        status: "fail"
      }
    : {
        detail: "The existing production validator reported no blocking error.",
        id: "production-validation",
        status: "pass"
      };
}

function collectMissingInputs(input: AdminAIBuilderInspectionInput) {
  return [
    ...(!input.niche.trim() ? ["niche"] : []),
    ...(!input.previewDigest || !input.publicDigest ? ["preview/public comparison"] : []),
    ...(input.media.ready && (!input.media.width || !input.media.height)
      ? ["media dimensions"]
      : [])
  ];
}

function words(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

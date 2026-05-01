export type LeadInput = {
  fullName: string;
  phoneNumber: string;
  email?: string;
  consent: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPageVariant?: string;
};

export type LeadValidationResult =
  | {
      ok: true;
      data: LeadInput;
    }
  | {
      ok: false;
      errors: string[];
    };

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  const text = asString(value);
  return text.length > 0 ? text : undefined;
}

export function validateLeadInput(payload: unknown): LeadValidationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const input = payload as Record<string, unknown>;
  const fullName = asString(input.fullName);
  const phoneNumber = asString(input.phoneNumber);
  const email = optionalString(input.email);
  const consent = input.consent === true;
  const errors: string[] = [];

  if (fullName.length < 2) {
    errors.push("Full name is required.");
  }

  if (!/^[0-9+\-\s()]{8,20}$/.test(phoneNumber)) {
    errors.push("A valid phone number is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email must be valid when provided.");
  }

  if (!consent) {
    errors.push("Consent is required.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      fullName,
      phoneNumber,
      email,
      consent,
      utmSource: optionalString(input.utmSource),
      utmMedium: optionalString(input.utmMedium),
      utmCampaign: optionalString(input.utmCampaign),
      utmContent: optionalString(input.utmContent),
      utmTerm: optionalString(input.utmTerm),
      landingPageVariant: optionalString(input.landingPageVariant)
    }
  };
}

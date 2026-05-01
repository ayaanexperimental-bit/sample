export type RazorpayVerificationInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  programSlug: string;
  workshopSlot?: string;
};

export type RazorpayVerificationResult =
  | {
      ok: true;
      data: RazorpayVerificationInput;
    }
  | {
      ok: false;
      errors: string[];
    };

const DEFAULT_PROGRAM_SLUG = "women-health-masterclass-101";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateRazorpayVerificationInput(payload: unknown): RazorpayVerificationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const input = payload as Record<string, unknown>;
  const razorpayOrderId = asString(input.razorpay_order_id || input.razorpayOrderId);
  const razorpayPaymentId = asString(input.razorpay_payment_id || input.razorpayPaymentId);
  const razorpaySignature = asString(input.razorpay_signature || input.razorpaySignature);
  const errors: string[] = [];

  if (!razorpayOrderId) {
    errors.push("razorpay_order_id is required.");
  }

  if (!razorpayPaymentId) {
    errors.push("razorpay_payment_id is required.");
  }

  if (!razorpaySignature) {
    errors.push("razorpay_signature is required.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      fullName: asString(input.full_name || input.fullName) || undefined,
      phoneNumber: asString(input.phone_number || input.phoneNumber) || undefined,
      email: asString(input.email) || undefined,
      programSlug: asString(input.program_slug || input.programSlug) || DEFAULT_PROGRAM_SLUG,
      workshopSlot: asString(input.workshop_slot || input.workshopSlot) || undefined
    }
  };
}

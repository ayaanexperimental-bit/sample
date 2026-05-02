export type CheckoutSessionInput = {
  leadId?: string;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  amount: number;
  currency: "INR";
};

export type CheckoutValidationResult =
  | {
      ok: true;
      data: CheckoutSessionInput;
    }
  | {
      ok: false;
      errors: string[];
    };

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateCheckoutSessionInput(payload: unknown): CheckoutValidationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const input = payload as Record<string, unknown>;
  const amount = Number(input.amount);
  const currency = asString(input.currency) || "INR";
  const errors: string[] = [];

  if (!Number.isInteger(amount) || amount !== 5100) {
    errors.push("Amount must be 5100 paise for the ₹51 offer.");
  }

  if (currency !== "INR") {
    errors.push("Currency must be INR.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      leadId: asString(input.leadId) || undefined,
      fullName: asString(input.fullName) || undefined,
      phoneNumber: asString(input.phoneNumber) || undefined,
      email: asString(input.email) || undefined,
      amount,
      currency: "INR"
    }
  };
}

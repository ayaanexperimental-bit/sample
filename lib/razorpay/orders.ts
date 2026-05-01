import type { RazorpayConfig } from "@/lib/razorpay/config";

export type CreateRazorpayOrderInput = {
  receipt: string;
  programSlug: string;
  workshopSlot?: string;
};

export type RazorpayOrder = {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: "INR";
  receipt: string | null;
  offer_id: string | null;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
};

export async function createRazorpayOrder(
  config: RazorpayConfig,
  input: CreateRazorpayOrderInput
): Promise<RazorpayOrder> {
  if (!config.isConfigured) {
    throw new Error("Razorpay credentials are not configured.");
  }

  const credentials = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: config.amount,
      currency: config.currency,
      receipt: input.receipt,
      notes: {
        program_slug: input.programSlug,
        workshop_slot: input.workshopSlot ?? ""
      }
    })
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(getRazorpayErrorMessage(payload));
  }

  return payload as RazorpayOrder;
}

function getRazorpayErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Razorpay order creation failed.";
  }

  const error = (payload as { error?: { description?: unknown } }).error;

  if (typeof error?.description === "string" && error.description.trim()) {
    return error.description;
  }

  return "Razorpay order creation failed.";
}

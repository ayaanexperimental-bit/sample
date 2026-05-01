export type RazorpayMode = "test" | "live";

export type RazorpayConfig = {
  mode: RazorpayMode;
  keyId: string;
  keySecret: string;
  amount: 2900;
  currency: "INR";
  isConfigured: boolean;
};

function getMode(): RazorpayMode {
  return process.env.RAZORPAY_MODE === "live" ? "live" : "test";
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRazorpayConfig(): RazorpayConfig {
  const mode = getMode();
  const keyId =
    mode === "live" ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_TEST_KEY_ID;
  const keySecret =
    mode === "live" ? process.env.RAZORPAY_LIVE_KEY_SECRET : process.env.RAZORPAY_TEST_KEY_SECRET;
  const amount = getPositiveInteger(process.env.WORKSHOP_AMOUNT_PAISE, 2900);
  const currency = process.env.WORKSHOP_CURRENCY === "INR" ? "INR" : "INR";

  return {
    mode,
    keyId: keyId ?? "",
    keySecret: keySecret ?? "",
    amount: amount === 2900 ? 2900 : 2900,
    currency,
    isConfigured: Boolean(keyId && keySecret)
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayPaymentVerificationInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export function verifyRazorpayPaymentSignature(
  input: RazorpayPaymentVerificationInput,
  keySecret: string
) {
  const generatedSignature = createHmac("sha256", keySecret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");

  return timingSafeStringEqual(generatedSignature, input.razorpaySignature);
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

"use client";

import { useState } from "react";

const hostedCheckoutUrl =
  process.env.NEXT_PUBLIC_RAZORPAY_HOSTED_CHECKOUT_URL ?? "https://rzp.io/rzp/xBIZzJHv";

export function CheckoutButton() {
  const paymentDisabled = process.env.NEXT_PUBLIC_PAYMENT_ENABLED === "false";
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState(
    paymentDisabled
      ? "Registration payment is opening soon. Final schedule and payment access will be shared here."
      : ""
  );

  function startCheckout() {
    if (paymentDisabled) {
      setStatus("error");
      setMessage(
        "Registration payment is opening soon. Final schedule and payment access will be shared here."
      );
      return;
    }

    setStatus("loading");
    setMessage("");
    window.location.assign(hostedCheckoutUrl);
  }

  return (
    <div className="checkout-action">
      <button
        className="ui-button ui-button--primary ui-button--lg pricing-button"
        disabled={status === "loading"}
        onClick={startCheckout}
        type="button"
      >
        {status === "loading" ? "Opening Razorpay..." : paymentDisabled ? "Notify Me" : "Pay Rs. 51"}
      </button>
      {message ? <p className="checkout-message">{message}</p> : null}
    </div>
  );
}

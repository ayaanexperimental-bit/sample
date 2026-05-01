"use client";

import { useState } from "react";

type CheckoutResponse = {
  ok: boolean;
  error?: string;
  checkoutUrl?: string;
};

export function CheckoutButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function startCheckout() {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: 2900,
          currency: "INR"
        })
      });

      const data = (await response.json()) as CheckoutResponse;

      if (data.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setStatus("error");
      setMessage(data.error ?? "Checkout is not available yet.");
    } catch {
      setStatus("error");
      setMessage("Checkout could not be started. Please try again later.");
    }
  }

  return (
    <div className="checkout-action">
      <button
        className="ui-button ui-button--primary ui-button--lg pricing-button"
        disabled={status === "loading"}
        onClick={startCheckout}
        type="button"
      >
        {status === "loading" ? "Starting Checkout..." : "Reserve My Seat"}
      </button>
      {message ? <p className="checkout-message">{message}</p> : null}
    </div>
  );
}

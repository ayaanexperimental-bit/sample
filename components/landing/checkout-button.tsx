"use client";

import { useState } from "react";
import { MicroCelebration } from "@/components/landing/micro-celebration";
import { useClickBurst } from "@/components/landing/use-click-burst";

export function CheckoutButton() {
  const [message, setMessage] = useState("");
  const { burstKey, triggerBurst } = useClickBurst();

  function startCheckout() {
    triggerBurst();
    setMessage(
      "Online checkout is paused on this website. The live Razorpay payment link has been removed from this button."
    );
  }

  return (
    <div className="checkout-action">
      <button
        className="ui-button ui-button--primary ui-button--lg pricing-button"
        onClick={startCheckout}
        type="button"
      >
        Registration Paused
        <MicroCelebration burstKey={burstKey} />
      </button>
      {message ? <p className="checkout-message">{message}</p> : null}
    </div>
  );
}

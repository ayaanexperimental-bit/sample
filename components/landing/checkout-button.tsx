"use client";

import { useState } from "react";

export function CheckoutButton() {
  const [message, setMessage] = useState("");

  function startCheckout() {
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
      </button>
      {message ? <p className="checkout-message">{message}</p> : null}
    </div>
  );
}

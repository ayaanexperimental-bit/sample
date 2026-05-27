"use client";

import { useEffect, useState } from "react";

type AccessState =
  | { status: "checking" }
  | { status: "pending" }
  | { status: "locked" }
  | { expiresAt: number; joinUrl: string; status: "allowed" };

type AccessResponse = {
  allowed?: boolean;
  expiresAt?: number;
  joinUrl?: string;
  reason?: string;
};

export function SuccessAccessPanel() {
  const [access, setAccess] = useState<AccessState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollCount = 0;

    const maxPolls = 30;

    async function checkAccess() {
      try {
        const response = await fetch("/api/whatsapp-access", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json()) as AccessResponse;

        if (cancelled) return;

        if (payload.allowed && payload.joinUrl && payload.expiresAt) {
          setAccess({
            status: "allowed",
            joinUrl: payload.joinUrl,
            expiresAt: payload.expiresAt
          });
        } else if (payload.reason === "payment_pending" && pollCount < maxPolls) {
          pollCount += 1;
          setAccess({ status: "pending" });
          pollTimer = setTimeout(checkAccess, 2000);
        } else {
          setAccess({ status: "locked" });
        }
      } catch {
        if (!cancelled) {
          setAccess({ status: "locked" });
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, []);

  if (access.status === "checking" || access.status === "pending") {
    const isPending = access.status === "pending";

    return (
      <section className="success-panel" aria-labelledby="success-next-step-title">
        <h2 id="success-next-step-title">
          {isPending ? "Waiting for payment confirmation" : "Checking payment access"}
        </h2>
        <p>
          {isPending
            ? "Razorpay is confirming the payment. Keep this page open for a few seconds."
            : "We are checking whether this browser has a recent verified Razorpay payment session."}
        </p>
        <span
          className="ui-button ui-button--secondary ui-button--lg success-action"
          aria-disabled="true"
        >
          {isPending ? "Waiting for Verification" : "Checking Verification"}
        </span>
      </section>
    );
  }

  if (access.status === "allowed") {
    return (
      <section className="success-panel success-panel--verified" aria-labelledby="success-next-step-title">
        <h2 id="success-next-step-title">Payment verified</h2>
        <p>
          Your access is open for a short time after successful payment. Join the WhatsApp group now
          to receive the next steps.
        </p>
        <a
          className="ui-button ui-button--success ui-button--lg success-action"
          href={access.joinUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Join WhatsApp Group
        </a>
        <p className="success-access-note">This access window expires 7 minutes after verification.</p>
      </section>
    );
  }

  return (
    <section className="success-panel" aria-labelledby="success-next-step-title">
      <h2 id="success-next-step-title">No payment status is shown here</h2>
      <p>
        Class access, reminders, and community details are shared only after the backend confirms a
        genuine successful payment. This page cannot be used as proof of purchase.
      </p>

      <span
        className="ui-button ui-button--secondary ui-button--lg success-action"
        aria-disabled="true"
      >
        Confirmation Locked Until Verification
      </span>
    </section>
  );
}

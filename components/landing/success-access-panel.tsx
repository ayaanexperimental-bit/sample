"use client";

import { useEffect, useState } from "react";

type AccessState =
  | { status: "checking" }
  | { status: "locked" }
  | { expiresAt: number; joinUrl: string; status: "allowed" };

type AccessResponse = {
  allowed?: boolean;
  expiresAt?: number;
  joinUrl?: string;
};

export function SuccessAccessPanel() {
  const [access, setAccess] = useState<AccessState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;

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
    };
  }, []);

  if (access.status === "checking") {
    return (
      <section className="success-panel" aria-labelledby="success-next-step-title">
        <h2 id="success-next-step-title">Checking payment access</h2>
        <p>
          We are checking whether this browser has a recent verified Razorpay payment session.
        </p>
        <span
          className="ui-button ui-button--secondary ui-button--lg success-action"
          aria-disabled="true"
        >
          Checking Verification
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

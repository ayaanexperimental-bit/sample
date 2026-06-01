"use client";

import { useState } from "react";

type AccessState = "idle" | "checking" | "blocked" | "error";

type WhatsAppAccessResponse = {
  allowed?: boolean;
  joinUrl?: string;
  reason?: string;
};

const BLOCKED_MESSAGE =
  "This WhatsApp group is available only from the paid program link shared by your coach.";

export function WhatsAppAccessButton() {
  const [state, setState] = useState<AccessState>("idle");

  async function handleClick() {
    if (state === "checking") return;

    setState("checking");

    try {
      const response = await fetch("/api/whatsapp-access", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json"
        }
      });
      const payload = (await response.json()) as WhatsAppAccessResponse;

      if (payload.allowed && payload.joinUrl) {
        window.open(payload.joinUrl, "_blank", "noopener,noreferrer");
        setState("idle");
        return;
      }

      setState("blocked");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="success-whatsapp-access">
      <button
        className="success-whatsapp-button"
        disabled={state === "checking"}
        onClick={handleClick}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 32 32">
          <path
            d="M16 3.2A12.7 12.7 0 0 0 5 22.25L3.5 28.8l6.7-1.55A12.7 12.7 0 1 0 16 3.2Zm0 2.35a10.34 10.34 0 0 1 8.8 15.78A10.34 10.34 0 0 1 11 25.05l-.48-.28-3.66.85.82-3.58-.31-.5A10.34 10.34 0 0 1 16 5.55Zm-4.12 4.77c-.24 0-.62.09-.95.46-.32.36-1.24 1.21-1.24 2.96s1.27 3.43 1.45 3.67c.18.24 2.45 3.92 6.08 5.34 3.02 1.19 3.64.95 4.3.89.66-.06 2.12-.86 2.42-1.7.3-.84.3-1.56.21-1.7-.09-.15-.33-.24-.69-.42-.36-.18-2.12-1.04-2.45-1.16-.33-.12-.57-.18-.81.18-.24.36-.93 1.16-1.14 1.4-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.78-1.07-.95-1.79-2.13-2-2.49-.21-.36-.02-.56.16-.73.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.95-1.11-2.67-.29-.7-.59-.6-.81-.61h-.69Z"
            fill="currentColor"
          />
        </svg>
        {state === "checking" ? "Checking Access..." : "Join WhatsApp Group"}
      </button>

      {state === "blocked" ? <p className="success-whatsapp-status">{BLOCKED_MESSAGE}</p> : null}
      {state === "error" ? (
        <p className="success-whatsapp-status">Unable to check access. Please try again.</p>
      ) : null}
    </div>
  );
}

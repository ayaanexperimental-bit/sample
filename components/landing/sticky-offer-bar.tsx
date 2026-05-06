"use client";

import { useEffect, useState } from "react";
import { MicroCelebration } from "@/components/landing/micro-celebration";
import { useClickBurst } from "@/components/landing/use-click-burst";

const OFFER_SECONDS = 5 * 60;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(1, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function StickyOfferBar() {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
  const { burstKey, triggerBurst } = useClickBurst();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? OFFER_SECONDS : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function scrollToRegistration() {
    triggerBurst();
    document.getElementById("registration")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <aside className="sticky-offer-bar" aria-label="Limited registration offer">
      <div className="sticky-offer-price">
        <strong>{"\u20B951"}</strong>
        <del>{"\u20B9599"}</del>
        <span>Offer expires in {formatTime(secondsLeft)} Minutes</span>
      </div>
      <button
        className="ui-button ui-button--sticky-cta ui-button--lg sticky-offer-button"
        type="button"
        onClick={scrollToRegistration}
      >
        Register Now
        <MicroCelebration burstKey={burstKey} />
      </button>
    </aside>
  );
}

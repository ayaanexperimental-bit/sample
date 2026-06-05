"use client";

import { useEffect } from "react";
import { getSuccessVideoSource } from "@/lib/success-page-config";
import { WhatsAppAccessButton } from "@/components/coach/whatsapp-access-button";

const PAID_COACH_SLUG = "gyana-ranjan";
const PAID_FUNNEL_ID = "gyana-pcos-51";

export function ProgramSuccessPage({ thankYouVideoUrl }: { thankYouVideoUrl: string }) {
  const videoSource = getSuccessVideoSource(thankYouVideoUrl);

  useEffect(() => {
    void recordPaidSuccessEvent("success_page_view");
  }, []);

  return (
    <main className="success-page">
      <article className="success-document success-thank-you" aria-labelledby="success-title">
        <p className="policy-kicker success-kicker">Registration complete</p>
        <h1 id="success-title">You&apos;re Successfully Registered</h1>
        <p className="success-subtitle">
          Thank you for joining this session. Please watch this short message and join the WhatsApp
          group for session updates.
        </p>

        {videoSource.kind !== "none" ? (
          <section className="success-video-card" aria-label="Thank you video">
            {videoSource.kind === "youtube" ? (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={videoSource.url}
                title="Thank you message"
              />
            ) : null}

            {videoSource.kind === "video" ? (
              <video controls playsInline preload="metadata" src={videoSource.url}>
                <track kind="captions" />
              </video>
            ) : null}
          </section>
        ) : null}

        <WhatsAppAccessButton coachSlug={PAID_COACH_SLUG} funnelId={PAID_FUNNEL_ID} />

        <p className="success-note">
          All session updates and reminders will be shared in the WhatsApp group.
        </p>
      </article>
    </main>
  );
}

async function recordPaidSuccessEvent(eventName: string) {
  try {
    const sessionId = getAnalyticsSessionId();

    await fetch("/api/coach-events", {
      body: JSON.stringify({
        coachSlug: PAID_COACH_SLUG,
        eventName,
        funnelId: PAID_FUNNEL_ID,
        funnelType: "paid_masterclass",
        pagePath: `${window.location.pathname}${window.location.search}`,
        pageUrl: window.location.href,
        referrer: document.referrer,
        sessionId
      }),
      cache: "no-store",
      headers: {
        "content-type": "application/json"
      },
      keepalive: true,
      method: "POST"
    });
  } catch {
    // Analytics must never block the paid success page.
  }
}

function getAnalyticsSessionId() {
  try {
    const key = "yw_analytics_session_id";
    const current = window.sessionStorage.getItem(key);
    if (current) return current;

    const next =
      window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36)}`;
    window.sessionStorage.setItem(key, next);

    return next;
  } catch {
    return "";
  }
}

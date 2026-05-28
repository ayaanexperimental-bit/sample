import type { Metadata } from "next";
import {
  getSuccessVideoSource,
  SUCCESS_WHATSAPP_GROUP_URL
} from "@/lib/success-page-config";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
  title: "Registration Successful",
};

export default function SuccessPage() {
  const videoSource = getSuccessVideoSource();

  return (
    <main className="success-page">
      <article className="success-document success-thank-you" aria-labelledby="success-title">
        <p className="policy-kicker success-kicker">Registration complete</p>
        <h1 id="success-title">You&apos;re Successfully Registered 🎉</h1>
        <p className="success-subtitle">
          Thank you for joining this session. Please watch this short message and join the
          WhatsApp group for session updates.
        </p>

        <section className="success-video-card" aria-label="Thank you video">
          {videoSource.kind === "youtube" ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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

          {videoSource.kind === "none" ? (
            <div className="success-video-placeholder">
              <span aria-hidden="true">▶</span>
              <p>Thank you video coming soon.</p>
            </div>
          ) : null}
        </section>

        <a
          className="success-whatsapp-button"
          href={SUCCESS_WHATSAPP_GROUP_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" viewBox="0 0 32 32">
            <path
              d="M16 3.2A12.7 12.7 0 0 0 5 22.25L3.5 28.8l6.7-1.55A12.7 12.7 0 1 0 16 3.2Zm0 2.35a10.34 10.34 0 0 1 8.8 15.78A10.34 10.34 0 0 1 11 25.05l-.48-.28-3.66.85.82-3.58-.31-.5A10.34 10.34 0 0 1 16 5.55Zm-4.12 4.77c-.24 0-.62.09-.95.46-.32.36-1.24 1.21-1.24 2.96s1.27 3.43 1.45 3.67c.18.24 2.45 3.92 6.08 5.34 3.02 1.19 3.64.95 4.3.89.66-.06 2.12-.86 2.42-1.7.3-.84.3-1.56.21-1.7-.09-.15-.33-.24-.69-.42-.36-.18-2.12-1.04-2.45-1.16-.33-.12-.57-.18-.81.18-.24.36-.93 1.16-1.14 1.4-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.78-1.07-.95-1.79-2.13-2-2.49-.21-.36-.02-.56.16-.73.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.95-1.11-2.67-.29-.7-.59-.6-.81-.61h-.69Z"
              fill="currentColor"
            />
          </svg>
          Join WhatsApp Group
        </a>

        <p className="success-note">
          All session updates and reminders will be shared in the WhatsApp group.
        </p>
      </article>
    </main>
  );
}

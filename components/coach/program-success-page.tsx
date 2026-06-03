import { getSuccessVideoSource } from "@/lib/success-page-config";
import { WhatsAppAccessButton } from "@/components/coach/whatsapp-access-button";

export function ProgramSuccessPage({ thankYouVideoUrl }: { thankYouVideoUrl: string }) {
  const videoSource = getSuccessVideoSource(thankYouVideoUrl);

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
          </section>
        ) : null}

        <WhatsAppAccessButton />

        <p className="success-note">
          All session updates and reminders will be shared in the WhatsApp group.
        </p>
      </article>
    </main>
  );
}

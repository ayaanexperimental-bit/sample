import Image from "next/image";
import type { CSSProperties } from "react";
import type { Coach } from "@/lib/coach-platform";

type GuestRevealStyle = CSSProperties & {
  "--guest-reveal"?: string | number;
};

export function GuestCoachPage({ coach }: { coach: Coach }) {
  const profile = coach.guestProfile;

  return (
    <main className={`guest-coach-page guest-coach-page--${profile.theme}`}>
      <div className="guest-coach-hook-bar">
        <span>YW Coach Guest Session</span>
        <p>{profile.hook}</p>
      </div>

      <section className="guest-coach-hero" aria-labelledby="guest-coach-title">
        <div className="guest-coach-hero__content" style={{ "--guest-reveal": 0 } as GuestRevealStyle}>
          <p className="guest-coach-hero__kicker">{profile.niche}</p>
          <h1 id="guest-coach-title">{profile.headline}</h1>
          <p className="guest-coach-hero__description">{profile.subheadline}</p>
          <GuestCta profile={profile} />
        </div>

        <div
          className="guest-coach-hero__media"
          aria-label={`${coach.displayName} profile`}
          style={{ "--guest-reveal": 1 } as GuestRevealStyle}
        >
          <Image
            src={profile.imageSrc}
            alt={profile.imageAlt}
            width={1024}
            height={1536}
            priority
            sizes="(max-width: 820px) 100vw, 38vw"
          />
          <div className="guest-coach-hero__coach-tag">
            <span>{coach.displayName}</span>
            <small>{profile.coachIntro.expertise}</small>
          </div>
        </div>
      </section>

      <section className="guest-coach-intro" aria-labelledby="guest-coach-intro-title">
        <div>
          <p className="guest-coach-section-kicker">Coach intro</p>
          <h2 id="guest-coach-intro-title">Meet {coach.displayName}</h2>
          <p>{profile.coachIntro.story}</p>
        </div>
        <dl className="guest-coach-intro__facts" aria-label={`${coach.displayName} credibility`}>
          <div>
            <dt>Expertise</dt>
            <dd>{profile.coachIntro.expertise}</dd>
          </div>
          <div>
            <dt>Credibility</dt>
            <dd>{profile.coachIntro.credibility}</dd>
          </div>
          <div>
            <dt>Trust note</dt>
            <dd>{profile.coachIntro.trustLine}</dd>
          </div>
        </dl>
      </section>

      <section className="guest-coach-audience" aria-labelledby="guest-coach-audience-title">
        <div className="guest-coach-section-heading">
          <p className="guest-coach-section-kicker">Who this is for</p>
          <h2 id="guest-coach-audience-title">{profile.audience.title}</h2>
          <p>{profile.audience.description}</p>
        </div>
        <div className="guest-coach-audience__grid">
          {profile.audience.painPoints.map((painPoint, index) => (
            <article
              className="guest-coach-soft-card"
              key={painPoint}
              style={{ "--guest-reveal": index } as GuestRevealStyle}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <p>{painPoint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guest-coach-benefits" aria-labelledby="guest-coach-benefits-title">
        <div className="guest-coach-section-heading">
          <p className="guest-coach-section-kicker">What you will get</p>
          <h2 id="guest-coach-benefits-title">Simple clarity before the next step</h2>
        </div>
        <div className="guest-coach-benefits__grid">
          {profile.benefits.map((benefit, index) => (
            <article
              className="guest-coach-benefit"
              key={benefit.title}
              style={{ "--guest-reveal": index } as GuestRevealStyle}
            >
              <span aria-hidden="true">+</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guest-coach-method" aria-labelledby="guest-coach-method-title">
        <div className="guest-coach-section-heading">
          <p className="guest-coach-section-kicker">Simple method</p>
          <h2 id="guest-coach-method-title">How {coach.displayName} helps you begin</h2>
        </div>
        <div className="guest-coach-method__steps">
          {profile.method.map((step) => (
            <article className="guest-coach-method-step" key={step.step}>
              <span>{step.step}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {profile.videoEmbedUrl ? (
        <section className="guest-coach-video-section" aria-labelledby="guest-coach-video-title">
          <div className="guest-coach-section-heading">
            <p className="guest-coach-section-kicker">Watch first</p>
            <h2 id="guest-coach-video-title">A short introduction from the coach</h2>
          </div>
          <div className="guest-coach-video" aria-label={`${coach.displayName} introduction`}>
            <iframe
              allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src={profile.videoEmbedUrl}
              title={`${coach.displayName} introduction`}
            />
          </div>
        </section>
      ) : null}

      <section className="guest-coach-trust" aria-labelledby="guest-coach-trust-title">
        <div className="guest-coach-section-heading">
          <p className="guest-coach-section-kicker">Trust section</p>
          <h2 id="guest-coach-trust-title">Professional, supportive, and guidance-led</h2>
          <p>{profile.trust.note}</p>
        </div>
        <div className="guest-coach-trust__grid">
          {profile.trust.cards.map((card) => (
            <article className="guest-coach-trust-card" key={card.label}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="guest-coach-final-cta" aria-labelledby="guest-coach-final-cta-title">
        <div>
          <p className="guest-coach-section-kicker">Guest CTA</p>
          <h2 id="guest-coach-final-cta-title">{profile.finalCta.title}</h2>
          <p>{profile.finalCta.copy}</p>
        </div>
        <GuestCta profile={profile} />
      </section>

      <footer className="coach-platform-footer" aria-label="YW Coach footer">
        <Image
          alt="YW NutriTech"
          className="coach-platform-footer__logo"
          height={72}
          src="/images/yw-nutritech-logo.png"
          width={92}
        />
        <p>Powered by YW NutriTech</p>
        <p>
          Education and lifestyle guidance only. This is not a replacement for medical advice,
          diagnosis, or treatment.
        </p>
        <nav aria-label="Legal links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refund">Refund</a>
          <a href="/disclaimer">Disclaimer</a>
        </nav>
      </footer>
    </main>
  );
}

function GuestCta({ profile }: { profile: Coach["guestProfile"] }) {
  if (profile.registerUrl) {
    return (
      <a className="guest-coach-hero__button" href={profile.registerUrl}>
        <span>{profile.buttonLabel}</span>
        <small aria-hidden="true">{"->"}</small>
      </a>
    );
  }

  return (
    <button className="guest-coach-hero__button" disabled type="button">
      <span>{profile.buttonLabel}</span>
      <small>Link coming soon</small>
    </button>
  );
}

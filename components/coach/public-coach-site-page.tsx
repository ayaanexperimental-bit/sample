"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { PublicCoachSiteRecord } from "../../lib/admin-coach-sites";
import { DEFAULT_SUPPORT_EMAIL } from "../../lib/error-reporting";
import styles from "./public-coach-site-page.module.css";

type PublicCoachSitePageProps = {
  site: PublicCoachSiteRecord;
};

const DEFAULT_SUPPORT_NAME = "Yours Wellness Support";
const DEFAULT_SUPPORT_TEXT = "Need help? Contact Yours Wellness support.";

export function PublicCoachSitePage({ site }: PublicCoachSitePageProps) {
  const referenceId = createCoachFallbackReferenceId(site.slug);
  const hasRegisterLink = Boolean(site.googleFormUrl);

  useEffect(() => {
    void recordCoachEvent("coach_site_view", site.slug);
  }, [site.slug]);

  if (site.status === "paused") {
    return (
      <main className={styles.page}>
        <section className={styles.unavailablePanel}>
          <p className={styles.kicker}>Coach Page</p>
          <h1>This coach page is temporarily unavailable.</h1>
          <p>The public link remains stable. Please contact support if you need help.</p>
          <CoachContactSupport referenceId={referenceId} site={site} tone="compact" />
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{site.niche}</p>
          <h1>{site.content.heroHeadline}</h1>
          <p>{site.content.subheadline}</p>
          <div className={styles.heroActions}>
            {hasRegisterLink ? (
              <a
                href={site.googleFormUrl}
                onClick={() => void recordCoachEvent("coach_register_click", site.slug)}
                rel="noreferrer"
                target="_blank"
              >
                {site.registerButtonText || site.content.ctaText || "Register Now"}
              </a>
            ) : (
              <a href="#contact-support">Contact Support</a>
            )}
            {site.whatsappLink ? (
              <a
                className={styles.secondaryAction}
                href={site.whatsappLink}
                onClick={() => void recordCoachEvent("coach_whatsapp_click", site.slug)}
                rel="noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
        <div className={styles.heroMedia}>
          {site.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${site.coachName} profile`} src={site.photoUrl} />
          ) : (
            <span>{site.coachName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </section>

      {!hasRegisterLink ? (
        <ContactSupportFallback referenceId={referenceId} site={site} />
      ) : null}

      <section className={styles.contentGrid}>
        <article>
          <p className={styles.kicker}>Coach Introduction</p>
          <h2>{site.coachName}</h2>
          <p>{site.content.coachIntro}</p>
        </article>
        <article>
          <p className={styles.kicker}>Vision</p>
          <h2>{site.location || "Yours Wellness Coach"}</h2>
          <p>{site.content.visionText}</p>
        </article>
      </section>

      {site.videoUrl ? (
        <section className={styles.videoSection}>
          <p className={styles.kicker}>Intro Video</p>
          <div className={styles.videoFrame}>
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              src={site.videoUrl}
              title={`${site.coachName} intro video`}
            />
          </div>
        </section>
      ) : null}

      <section className={styles.benefits}>
        <p className={styles.kicker}>Benefits</p>
        <h2>What guests can expect</h2>
        <div className={styles.benefitGrid}>
          {site.content.benefits.map((benefit, index) => (
            <article key={benefit}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{benefit}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.faq}>
        <p className={styles.kicker}>FAQ</p>
        <h2>Before you register</h2>
        <div className={styles.faqList}>
          {site.content.faq.map((item) => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <CoachContactSupport referenceId={referenceId} site={site} />

      <section className={styles.finalCta}>
        <h2>{site.content.ctaText || "Register Now"}</h2>
        <p>{site.content.trustText}</p>
        {hasRegisterLink ? (
          <a
            href={site.googleFormUrl}
            onClick={() => void recordCoachEvent("coach_register_click", site.slug)}
            rel="noreferrer"
            target="_blank"
          >
            {site.registerButtonText || "Register Now"}
          </a>
        ) : (
          <a href="#contact-support">Contact Support</a>
        )}
      </section>
    </main>
  );
}

export function CoachRouteErrorFallback({
  referenceId,
  reset,
  site
}: {
  referenceId: string;
  reset?: () => void;
  site: PublicCoachSiteRecord | null;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.unavailablePanel}>
        <p className={styles.kicker}>Contact Support</p>
        <h1>Something went wrong</h1>
        <p>We could not complete this step. Please contact support for help.</p>
        <CoachContactSupport referenceId={referenceId} site={site} tone="compact" />
        {reset ? (
          <button className={styles.retryButton} onClick={reset} type="button">
            Try Again
          </button>
        ) : null}
      </section>
    </main>
  );
}

function ContactSupportFallback({
  referenceId,
  site
}: {
  referenceId: string;
  site: PublicCoachSiteRecord;
}) {
  return (
    <section className={styles.supportFallback} id="contact-support">
      <p className={styles.kicker}>Contact Support</p>
      <h2>Something went wrong</h2>
      <p>We could not complete this step. Please contact support for help.</p>
      <CoachContactSupport referenceId={referenceId} site={site} tone="embedded" />
      <code>Reference ID: {referenceId}</code>
    </section>
  );
}

export function CoachContactSupport({
  referenceId,
  site,
  tone = "standard"
}: {
  referenceId: string;
  site: PublicCoachSiteRecord | null;
  tone?: "compact" | "embedded" | "standard";
}) {
  const support = getSupportDetails(site);

  return (
    <section className={styles.coachSupport} data-tone={tone} id="coach-contact-support">
      <div className={styles.supportIdentity}>
        <div className={styles.supportAvatar}>
          {support.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${support.name} support profile`} src={support.imageUrl} />
          ) : (
            <span>{support.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div>
          <p className={styles.kicker}>Contact Support</p>
          <h2>{support.name}</h2>
          <p>{support.text}</p>
        </div>
      </div>

      <div className={styles.supportCredentialGrid}>
        {support.phone ? (
          <a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>
            <span>Phone</span>
            <strong>{support.phone}</strong>
          </a>
        ) : null}
        {support.whatsappLink ? (
          <a href={support.whatsappLink} rel="noreferrer" target="_blank">
            <span>WhatsApp</span>
            <strong>Message coach</strong>
          </a>
        ) : null}
        <a href={support.emailHref}>
          <span>Email</span>
          <strong>{support.email}</strong>
        </a>
      </div>

      {tone !== "standard" ? (
        <div className={styles.supportActions}>
          <a href={support.primaryHref}>Contact Support</a>
          <Link href="/">Go Back Home</Link>
        </div>
      ) : null}
      <p className={styles.supportPrivacyNote}>
        Contact details shown here are public coach-site support details, not admin-only data.
        {referenceId ? ` Reference ID: ${referenceId}` : ""}
      </p>
    </section>
  );
}

function getSupportDetails(site: PublicCoachSiteRecord | null) {
  const hasCoachContact = Boolean(site?.coachEmail || site?.coachPhone || site?.whatsappLink);
  const email = site?.coachEmail || DEFAULT_SUPPORT_EMAIL;
  const subject = encodeURIComponent(`Coach page support ${site?.slug || "unknown-coach"}`);
  const emailHref = `mailto:${email}?subject=${subject}`;
  const whatsappLink = site?.whatsappLink || "";

  return {
    email,
    emailHref,
    imageUrl: hasCoachContact ? site?.logoUrl || site?.photoUrl || "" : "",
    name: hasCoachContact && site ? site.coachName : DEFAULT_SUPPORT_NAME,
    phone: site?.coachPhone || "",
    primaryHref: whatsappLink || emailHref,
    text:
      site?.supportText ||
      (hasCoachContact ? "Need help? Contact your coach directly." : DEFAULT_SUPPORT_TEXT),
    whatsappLink
  };
}

export function createCoachFallbackReferenceId(slug: string) {
  const suffix = slug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");

  // TODO: Replace this deterministic placeholder with a logged error_reports reference id.
  return `ERR-20260601-${suffix}`;
}

async function recordCoachEvent(eventName: string, coachSlug: string) {
  try {
    await fetch("/api/coach-events", {
      body: JSON.stringify({
        coachSlug,
        eventName,
        pagePath: window.location.pathname
      }),
      cache: "no-store",
      headers: {
        "content-type": "application/json"
      },
      keepalive: true,
      method: "POST"
    });
  } catch {
    // Analytics tracking must never block public registration.
  }
}

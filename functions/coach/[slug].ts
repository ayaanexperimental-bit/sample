import type { D1Database } from "@cloudflare/workers-types";
import {
  type PublicCoachSiteRecord,
  getPublicCoachSiteBySlug,
  normalizeCoachSlug
} from "../../lib/admin-coach-sites";
import {
  getCoachTemplateCssVariables,
  getCoachTemplateTheme
} from "../../lib/coach-template-themes";
import {
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_PHONE,
  DEFAULT_SUPPORT_WHATSAPP,
  createSupportErrorReference,
  getPublicSupportErrorCode,
  type PublicWebsiteErrorCategory
} from "../../lib/error-reporting";
import { getCoachSiteBySlugFromDb } from "../../lib/server/coach-site-storage";
import { insertWebsiteErrorReport } from "../../lib/server/error-reports";
import { isUploadedVideoSource, normalizeVideoEmbedUrl } from "../../lib/video-links";

type Env = {
  ADMIN_DB?: D1Database;
};

type PagesContext = {
  env: Env;
  params: {
    slug?: string | string[];
  };
  request: Request;
};

const DEFAULT_SUPPORT_NAME = "Yours Wellness Support";
const DEFAULT_SUPPORT_TEXT = "Need help? Contact Yours Wellness support.";

export async function onRequest({ env, params, request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      headers: {
        allow: "GET, HEAD"
      },
      status: 405
    });
  }

  const slug = normalizeCoachSlug(
    Array.isArray(params.slug) ? params.slug[0] || "" : params.slug || ""
  );
  if (!slug) {
    const referenceId = createSupportErrorReference("route_not_found", "coach");
    await logCoachFallbackError({
      category: "route_not_found",
      env,
      referenceId,
      request,
      safeMessage: "Coach route slug missing.",
      userAction: "coach_route_not_found"
    });

    return new Response(
      renderSupportFallbackHtml({
        category: "route_not_found",
        message: "The coach page you opened is not available. Please contact support for help.",
        referenceId,
        site: null
      }),
      { headers: getHtmlHeaders(true), status: 404 }
    );
  }

  const site = (await getCoachSiteBySlugFromDb(slug, env)) || getPublicCoachSiteBySlug(slug);
  if (site?.status === "archived") {
    const referenceId = createSupportErrorReference("coach_site_issue", slug);
    await logCoachFallbackError({
      category: "coach_site_issue",
      coachSlug: slug,
      env,
      referenceId,
      request,
      safeMessage: "Coach site is archived.",
      site,
      userAction: "coach_site_archived"
    });

    return new Response(
      renderSupportFallbackHtml({
        category: "coach_site_issue",
        message: "This coach page is temporarily unavailable. Please contact support for help.",
        referenceId,
        site
      }),
      { headers: getHtmlHeaders(true), status: 200 }
    );
  }

  if (!site || site.status === "draft" || site.status === "removed") {
    const referenceId = createSupportErrorReference("coach_site_issue", slug);
    await logCoachFallbackError({
      category: "coach_site_issue",
      coachSlug: slug,
      env,
      referenceId,
      request,
      safeMessage: "Coach site not available.",
      site: null,
      userAction: "coach_site_not_available"
    });

    return new Response(
      renderSupportFallbackHtml({
        category: "coach_site_issue",
        message: "This coach page is not available. Please contact support for help.",
        referenceId,
        site: null
      }),
      { headers: getHtmlHeaders(true), status: 404 }
    );
  }

  if (site.status === "paused") {
    const referenceId = createSupportErrorReference("coach_site_issue", slug);
    await logCoachFallbackError({
      category: "coach_site_issue",
      coachSlug: slug,
      env,
      referenceId,
      request,
      safeMessage: "Coach site is paused.",
      site,
      userAction: "coach_site_paused"
    });

    return new Response(
      renderSupportFallbackHtml({
        category: "coach_site_issue",
        message: "This coach page is temporarily unavailable. Please contact support for help.",
        referenceId,
        site
      }),
      { headers: getHtmlHeaders(true), status: 200 }
    );
  }

  if (!site.googleFormUrl) {
    const referenceId = createSupportErrorReference("link_missing", slug);
    await logCoachFallbackError({
      category: "link_missing",
      coachSlug: slug,
      env,
      referenceId,
      request,
      safeMessage: "Google Form registration link missing.",
      site,
      userAction: "coach_register_link_missing"
    });

    return new Response(
      renderSupportFallbackHtml({
        category: "link_missing",
        message: "We could not open the registration step. Please contact support for help.",
        referenceId,
        site
      }),
      { headers: getHtmlHeaders(true), status: 200 }
    );
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      headers: getHtmlHeaders(false),
      status: 200
    });
  }

  return new Response(renderCoachSiteHtml(site), {
    headers: getHtmlHeaders(false),
    status: 200
  });
}

function renderCoachSiteHtml(site: PublicCoachSiteRecord) {
  const support = getSupportDetails(site);
  const isPaused = false;
  const theme = getCoachTemplateTheme(site.selectedThemeId);
  const themeStyle = createThemeInlineStyle(theme.id);
  const benefits = getBenefits(site)
    .map(
      (benefit, index) => `
        <article class="spot-card benefit-card">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(benefit)}</h3>
          <p>Coach-led education designed to make the next step calmer and clearer.</p>
        </article>`
    )
    .join("");
  const journey = [
    [
      "01",
      "Profile",
      "Meet the coach",
      "Guests understand the coach story, niche, mission, and guidance style."
    ],
    [
      "02",
      "Focus",
      "See the wellness focus",
      "The page explains the coach lens in a clear, trustworthy tone."
    ],
    [
      "03",
      "Action",
      "Open registration",
      "The CTA sends visitors to the coach registration form when configured."
    ]
  ]
    .map(
      ([number, label, title, text]) => `
        <article class="spot-card journey-card">
          <small>${number}</small>
          <span>${label}</span>
          <h3>${title}</h3>
          <p>${text}</p>
        </article>`
    )
    .join("");
  const problems = createProblemPoints(site)
    .map(
      (point) => `
        <article class="spot-card problem-item">
          <span aria-hidden="true">+</span>
          <p>${escapeHtml(point)}</p>
        </article>`
    )
    .join("");
  const faq = getFaq(site)
    .map(
      (item) => `
        <details class="faq-card">
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(site.coachName)} | YW Nutritech Coach Referral</title>
    <meta name="description" content="${escapeAttribute(site.content.subheadline)}" />
    <style>
      :root {
        color-scheme: light;
        --font-display: Georgia, Cambria, "Times New Roman", serif;
        --font-accent: Georgia, Cambria, "Times New Roman", serif;
        --font-tech-display: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        --font-conversion: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        --font-body: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        --scroll-progress: 0;
      }
      * { box-sizing: border-box; }
      html {
        min-width: 320px;
        background: #fff8ef;
        scroll-behavior: smooth;
      }
      body {
        min-height: 100vh;
        margin: 0;
        color: #171b2d;
        font-family: var(--font-body);
        line-height: 1.5;
        overflow-x: hidden;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      a { color: inherit; }
      h1, h2, h3, p, strong, dd { overflow-wrap: anywhere; }
      button, a { -webkit-tap-highlight-color: transparent; }
      .page {
        min-height: 100svh;
        position: relative;
        isolation: isolate;
        overflow-x: clip;
        background: var(--template-bg);
        color: var(--template-ink);
        font-family: var(--template-body-font);
        padding: 0 0 6rem;
      }
      .page::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-image:
          radial-gradient(circle, rgb(200 184 255 / 0.15) 0 1px, transparent 1.4px),
          radial-gradient(circle, rgb(216 181 111 / 0.08) 0 1px, transparent 1.4px);
        background-position: 0 0, 2.5rem 3rem;
        background-size: 7rem 7rem, 9rem 9rem;
        opacity: 0.36;
      }
      .aurora {
        position: fixed;
        inset: -18vh -18vw;
        z-index: 0;
        pointer-events: none;
        background-image:
          repeating-linear-gradient(100deg, rgb(255 248 239 / 0.38) 0%, rgb(255 248 239 / 0.38) 7%, transparent 10%, transparent 12%, rgb(255 248 239 / 0.38) 16%),
          repeating-linear-gradient(100deg, rgb(216 181 111 / 0.2) 10%, rgb(183 93 120 / 0.22) 15%, rgb(200 184 255 / 0.24) 20%, rgb(242 185 166 / 0.2) 25%, rgb(70 191 192 / 0.14) 30%);
        background-position: 50% 50%, 50% 50%;
        background-size: 300% 190%, 300% 190%;
        filter: blur(12px) saturate(1.16);
        -webkit-mask-image:
          radial-gradient(ellipse at 46% 20%, black 0 34%, transparent 70%),
          linear-gradient(180deg, black 0, rgb(0 0 0 / 0.62) 64%, transparent 100%);
        mask-image:
          radial-gradient(ellipse at 46% 20%, black 0 34%, transparent 70%),
          linear-gradient(180deg, black 0, rgb(0 0 0 / 0.62) 64%, transparent 100%);
        mix-blend-mode: soft-light;
        opacity: 0.72;
        animation: aurora 60s linear infinite;
      }
      .scroll-line {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 60;
        height: 3px;
        background: rgb(255 255 255 / 0.14);
      }
      .scroll-line span {
        display: block;
        width: 100%;
        height: 100%;
        transform: scaleX(var(--scroll-progress));
        transform-origin: left center;
        background: var(--template-cta);
        box-shadow: 0 0 18px var(--template-glow);
      }
      .nav,
      .hero,
      .hero-metrics,
      .section,
      .support,
      .footer,
      .unavailable-panel {
        width: min(calc(100% - 2rem), 84rem);
        margin-inline: auto;
      }
      .nav {
        position: sticky;
        top: 0.8rem;
        z-index: 20;
        min-height: 4.25rem;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 1rem;
        align-items: center;
        overflow: hidden;
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-nav);
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2), var(--template-shadow);
        color: var(--template-inverted-ink);
        padding: 0.7rem 1rem;
        backdrop-filter: blur(24px) saturate(1.35);
        animation: fade-down 620ms ease both;
      }
      .brand {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        color: inherit;
        text-decoration: none;
      }
      .brand img {
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 8px;
        object-fit: contain;
      }
      .brand span {
        min-width: 0;
        display: grid;
        gap: 0.05rem;
      }
      .brand strong,
      .brand small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .brand strong {
        font-family: var(--template-heading-font);
        font-size: 0.92rem;
        font-weight: 950;
      }
      .brand small,
      .kicker,
      .section-head span,
      .story-card span,
      .problem-copy span,
      .journey-card span,
      .benefit-card > span,
      .media-notes span,
      .register-section span,
      .footer span,
      .support-grid span {
        color: var(--template-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .nav-links {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .nav-links a,
      .button,
      .footer-links a,
      .support-actions a {
        min-height: 2.6rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--template-radius);
        font-family: var(--template-heading-font);
        font-size: 0.9rem;
        font-weight: 900;
        text-decoration: none;
        transition:
          transform 180ms cubic-bezier(0.2, 0.85, 0.2, 1),
          border-color 180ms ease,
          box-shadow 180ms ease,
          background 180ms ease;
      }
      .nav-links a {
        color: inherit;
        padding: 0 0.7rem;
      }
      .button.primary,
      .sticky-register,
      .register-section a {
        border: 1px solid rgb(216 181 111 / 0.44);
        background: var(--template-cta);
        color: var(--template-cta-text);
        box-shadow: 0 1rem 2.5rem var(--template-glow);
        padding: 0 1rem;
      }
      .button.secondary,
      .support-actions a:last-child {
        border: 1px solid var(--template-card-border);
        background: var(--template-card);
        color: var(--template-ink);
        padding: 0 1rem;
      }
      .button:hover,
      .nav-links a:hover,
      .footer-links a:hover,
      .support-actions a:hover {
        transform: translate3d(0, -2px, 0);
      }
      .button:active,
      .sticky-register:active {
        transform: translate3d(0, 1px, 0) scale(0.98);
      }
      .button.disabled,
      .sticky-register.disabled {
        cursor: not-allowed;
        opacity: 0.72;
        pointer-events: none;
      }
      .sticky-register {
        position: fixed;
        right: clamp(0.8rem, 4vw, 2rem);
        bottom: clamp(0.8rem, 4vw, 2rem);
        z-index: 30;
        min-width: 10rem;
      }
      .hero {
        min-height: min(780px, calc(100svh - 4.5rem));
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: minmax(0, 1.04fr) minmax(20rem, 0.8fr);
        gap: clamp(1.4rem, 5vw, 5rem);
        align-items: center;
        margin-top: clamp(1rem, 3vw, 2rem);
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-hero-bg);
        color: var(--template-inverted-ink);
        padding: clamp(1.1rem, 4vw, 3rem);
        box-shadow: var(--template-shadow);
      }
      .hero[data-media="none"] {
        grid-template-columns: minmax(0, 48rem);
      }
      .trust-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .trust-row span,
      .brand-assurance {
        border: 1px solid rgb(255 255 255 / 0.16);
        border-radius: var(--template-radius);
        background: rgb(255 255 255 / 0.08);
        color: var(--template-muted-inverted);
        padding: 0.45rem 0.6rem;
        backdrop-filter: blur(14px);
      }
      .hero h1,
      .section h2,
      .footer h2,
      .support h2,
      .unavailable-panel h1 {
        margin: 0;
        font-family: var(--template-heading-font);
        letter-spacing: 0;
        line-height: 0.98;
      }
      .hero h1 {
        max-width: 12.5ch;
        color: var(--template-inverted-ink);
        font-size: clamp(2.55rem, 7vw, 6.7rem);
        animation: fade-up 760ms 110ms ease both;
      }
      .kicker {
        margin: 0 0 0.8rem;
      }
      p {
        color: var(--template-muted);
        font-size: clamp(0.98rem, 1.5vw, 1.12rem);
        font-weight: 650;
        line-height: 1.64;
      }
      .hero p,
      .register-section p,
      .footer p {
        color: var(--template-muted-inverted);
      }
      .lead {
        max-width: 44rem;
        animation: fade-up 760ms 200ms ease both;
      }
      .brand-assurance {
        width: fit-content;
        max-width: 100%;
        display: grid;
        gap: 0.15rem;
        margin-top: 1.15rem;
      }
      .brand-assurance span {
        color: var(--template-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .brand-assurance strong {
        color: var(--template-inverted-ink);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        margin-top: 1.35rem;
        animation: fade-up 760ms 310ms ease both;
      }
      .media-stage {
        display: grid;
        gap: 0.9rem;
        animation: scale-in 820ms 240ms ease both;
      }
      .hero-media,
      .video-frame {
        position: relative;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 0.26);
        border-radius: var(--template-radius);
        background:
          radial-gradient(circle at 72% 0, var(--template-glow), transparent 14rem),
          var(--template-card);
        box-shadow: 0 1.6rem 4rem rgb(0 0 0 / 0.18);
      }
      .hero-media {
        aspect-ratio: 4 / 5;
        animation: float-card 5.8s ease-in-out infinite;
      }
      .hero-media[data-media="video"],
      .video-frame[data-media="video"] {
        aspect-ratio: 16 / 10;
      }
      .hero-media img,
      .hero-media video,
      .hero-media iframe,
      .video-frame img,
      .video-frame video,
      .video-frame iframe {
        width: 100%;
        height: 100%;
        border: 0;
        object-fit: cover;
      }
      .hero-media > span,
      .video-frame > em {
        color: var(--template-accent);
        font-size: clamp(3rem, 10vw, 6rem);
        font-style: normal;
        font-weight: 950;
      }
      .hero-media::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(115deg, transparent 0 34%, rgb(255 255 255 / 0.28) 44%, transparent 56% 100%);
        transform: translateX(-120%);
        animation: light-sweep 6s 1.2s ease-in-out infinite;
      }
      .media-caption {
        position: absolute;
        right: 0.85rem;
        bottom: 0.85rem;
        left: 0.85rem;
        display: grid;
        gap: 0.12rem;
        border: 1px solid rgb(255 255 255 / 0.24);
        border-radius: var(--template-radius);
        background: rgb(8 11 23 / 0.66);
        color: #fff;
        padding: 0.85rem;
        backdrop-filter: blur(16px);
      }
      .media-caption span {
        color: var(--template-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .media-caption small {
        color: rgb(255 255 255 / 0.76);
        font-weight: 750;
      }
      .signal-panel {
        display: grid;
        gap: 0.2rem;
        border: 1px solid rgb(255 255 255 / 0.18);
        border-radius: var(--template-radius);
        background: rgb(255 255 255 / 0.08);
        color: var(--template-inverted-ink);
        padding: 0.95rem;
        backdrop-filter: blur(16px);
      }
      .signal-panel span {
        color: var(--template-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .signal-panel small {
        color: var(--template-muted-inverted);
        font-weight: 750;
      }
      .hero-metrics {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.8rem;
        margin-top: 1rem;
      }
      .hero-metrics div,
      .spot-card,
      .faq-card,
      .support-card {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-card);
        box-shadow: var(--template-shadow);
        color: var(--template-ink);
      }
      .hero-metrics div {
        padding: 0.95rem;
      }
      .hero-metrics dt {
        color: var(--template-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .hero-metrics dd {
        margin: 0.35rem 0 0;
        color: var(--template-ink);
        font-weight: 900;
      }
      .section,
      .support,
      .footer,
      .unavailable-panel {
        position: relative;
        z-index: 2;
        margin-top: clamp(1rem, 4vw, 2.5rem);
      }
      .section {
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-section);
        padding: clamp(1.1rem, 4vw, 2.5rem);
        backdrop-filter: blur(18px);
      }
      .section-head {
        max-width: 52rem;
        margin-bottom: 1rem;
      }
      .section h2,
      .support h2,
      .footer h2 {
        color: var(--template-ink);
        font-size: clamp(1.7rem, 4vw, 3.8rem);
      }
      .intro-grid,
      .journey-grid,
      .benefit-grid,
      .support-grid,
      .faq-list {
        display: grid;
        gap: 0.9rem;
      }
      .intro-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .journey-grid,
      .benefit-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .spot-card,
      .faq-card,
      .support-card {
        padding: clamp(1rem, 3vw, 1.35rem);
        transition:
          transform 180ms cubic-bezier(0.2, 0.85, 0.2, 1),
          box-shadow 180ms ease,
          border-color 180ms ease;
      }
      .spot-card::before,
      .support-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--template-glow), transparent 74%);
        opacity: 0;
        transition: opacity 320ms ease;
      }
      .spot-card:hover,
      .support-card:hover,
      .faq-card:hover {
        transform: translate3d(0, -4px, 0);
        border-color: var(--template-accent);
        box-shadow: var(--template-shadow), 0 0 0 1px var(--template-glow);
      }
      .spot-card:hover::before,
      .support-card:hover::before {
        opacity: 0.52;
      }
      .spot-card > *,
      .support-card > * {
        position: relative;
        z-index: 2;
      }
      .spot-card h3,
      .faq-card summary {
        margin: 0.45rem 0 0;
        color: var(--template-ink);
        font-family: var(--template-heading-font);
        font-size: 1.05rem;
      }
      .spot-card p {
        margin-bottom: 0;
      }
      .problem-section {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: clamp(1rem, 4vw, 2rem);
        align-items: start;
        background:
          radial-gradient(circle at 88% 20%, var(--template-glow), transparent 18rem),
          var(--template-hero-bg);
        color: var(--template-inverted-ink);
      }
      .problem-section h2,
      .problem-section p,
      .problem-list p {
        color: var(--template-inverted-ink);
      }
      .problem-list {
        display: grid;
        gap: 0.8rem;
      }
      .problem-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.75rem;
        align-items: center;
      }
      .problem-item span {
        width: 2rem;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border-radius: var(--template-radius);
        background: var(--template-accent);
        color: #111730;
        font-weight: 950;
      }
      .media-section {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: clamp(1rem, 4vw, 2rem);
        align-items: center;
      }
      .video-frame {
        min-height: 19rem;
        color: var(--template-inverted-ink);
      }
      .video-frame > span,
      .video-frame > strong,
      .video-frame > p {
        position: relative;
        z-index: 2;
        max-width: 24rem;
        margin-inline: 1rem;
        text-align: center;
      }
      .video-frame > span {
        color: var(--template-accent);
        font-size: 0.72rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .video-frame > strong {
        color: var(--template-inverted-ink);
        font-family: var(--template-heading-font);
        font-size: clamp(1.4rem, 3vw, 2.4rem);
      }
      .video-frame > p {
        color: var(--template-muted-inverted);
      }
      .register-section {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 1rem;
        align-items: center;
        background:
          radial-gradient(circle at 84% 16%, var(--template-glow), transparent 15rem),
          var(--template-hero-bg);
        color: var(--template-inverted-ink);
      }
      .register-section h2,
      .footer h2 {
        color: var(--template-inverted-ink);
      }
      .support-card {
        padding: clamp(1rem, 4vw, 2rem);
      }
      .support-identity {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 1rem;
        align-items: center;
      }
      .avatar {
        width: 5.1rem;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-card-strong);
        color: var(--template-accent);
        font-size: 1.5rem;
        font-weight: 950;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .support-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 1rem;
      }
      .support-grid a {
        min-height: 5rem;
        display: grid;
        gap: 0.28rem;
        align-content: center;
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-card-strong);
        color: var(--template-ink);
        padding: 0.9rem;
        text-decoration: none;
      }
      .support-grid strong {
        line-height: 1.25;
      }
      .support-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .support-actions a {
        border: 1px solid var(--template-card-border);
        background: var(--template-card-strong);
        color: var(--template-ink);
        padding: 0 1rem;
      }
      .privacy {
        margin-bottom: 0;
        color: var(--template-muted);
        font-size: 0.82rem;
        font-weight: 750;
      }
      .faq-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .faq-card summary {
        cursor: pointer;
        list-style: none;
      }
      .faq-card summary::-webkit-details-marker {
        display: none;
      }
      .faq-card summary::after {
        content: "+";
        float: right;
        color: var(--template-accent);
        transition: transform 180ms ease;
      }
      .faq-card[open] summary::after {
        transform: rotate(45deg);
      }
      .faq-card p {
        margin-bottom: 0;
        animation: fade-up 220ms ease both;
      }
      .footer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 1rem;
        align-items: start;
        border-radius: var(--template-radius);
        background: linear-gradient(135deg, rgb(255 239 247 / 0.74), rgb(255 249 227 / 0.8), rgb(240 255 236 / 0.62));
        color: #2a1724;
        padding: clamp(1.3rem, 4vw, 2.6rem);
      }
      .footer h2 {
        color: #2a1724;
        font-size: clamp(1.7rem, 4vw, 3rem);
      }
      .footer p {
        color: #6b5866;
      }
      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        justify-content: flex-end;
      }
      .footer-links a {
        border: 1px solid rgb(155 47 95 / 0.16);
        border-radius: 999px;
        background: rgb(255 255 255 / 0.32);
        color: #9b2f5f;
        padding: 0 0.9rem;
      }
      .unavailable-panel {
        min-height: 70vh;
        display: grid;
        align-content: center;
        gap: 1rem;
        border: 1px solid var(--template-card-border);
        border-radius: var(--template-radius);
        background: var(--template-section);
        padding: clamp(1.2rem, 5vw, 3rem);
      }
      .page[data-theme="premium-feminine-wellness"] .nav {
        color: var(--template-ink);
      }
      .page[data-theme="premium-feminine-wellness"] .hero,
      .page[data-theme="premium-feminine-wellness"] .register-section {
        color: var(--template-ink);
      }
      .page[data-theme="premium-feminine-wellness"] .hero h1,
      .page[data-theme="premium-feminine-wellness"] .hero p,
      .page[data-theme="premium-feminine-wellness"] .register-section h2,
      .page[data-theme="premium-feminine-wellness"] .register-section p {
        color: var(--template-ink);
      }
      .page[data-theme="apple-liquid-glass"] .spot-card,
      .page[data-theme="apple-liquid-glass"] .section,
      .page[data-theme="apple-liquid-glass"] .support-card {
        backdrop-filter: blur(22px) saturate(1.28);
      }
      .page[data-theme="dark-luxury-wellness"] .nav,
      .page[data-theme="dark-luxury-wellness"] .footer {
        color: var(--template-inverted-ink);
      }
      .page[data-theme="dark-luxury-wellness"] .footer {
        background: linear-gradient(135deg, #080b17, #111730 58%, #321b38);
      }
      .page[data-theme="dark-luxury-wellness"] .footer h2,
      .page[data-theme="dark-luxury-wellness"] .footer p {
        color: var(--template-inverted-ink);
      }
      @supports (animation-timeline: view()) {
        .section,
        .support,
        .footer {
          animation: view-rise 1s ease both;
          animation-timeline: view();
          animation-range: entry 8% cover 26%;
        }
      }
      @media (max-width: 1080px) {
        .hero,
        .problem-section,
        .media-section,
        .register-section,
        .footer {
          grid-template-columns: 1fr;
        }
        .hero {
          min-height: auto;
        }
        .hero-media {
          width: min(100%, 29rem);
        }
        .hero-metrics,
        .journey-grid,
        .benefit-grid,
        .support-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 760px) {
        .nav,
        .hero,
        .hero-metrics,
        .section,
        .support,
        .footer,
        .unavailable-panel {
          width: min(calc(100% - 1rem), 84rem);
        }
        .nav {
          top: 0.45rem;
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .nav-links {
          display: none;
        }
        .button.nav-cta {
          min-width: 6.6rem;
          padding-inline: 0.7rem;
        }
        .hero {
          margin-top: 0.7rem;
          padding: 1rem;
        }
        .trust-row {
          gap: 0.35rem;
          margin-bottom: 0.7rem;
        }
        .trust-row span {
          padding: 0.35rem 0.45rem;
          font-size: 0.68rem;
        }
        .hero h1 {
          font-size: clamp(1.9rem, 9vw, 2.45rem);
          line-height: 1.02;
        }
        .lead {
          margin-top: 0.7rem;
          font-size: 0.93rem;
          line-height: 1.48;
        }
        .brand-assurance,
        .actions,
        .signal-panel {
          display: none;
        }
        .media-stage {
          width: min(100%, 19rem);
          justify-self: center;
        }
        .hero-media {
          width: 100%;
          aspect-ratio: 4 / 4.35;
        }
        .intro-grid,
        .hero-metrics,
        .journey-grid,
        .benefit-grid,
        .support-grid,
        .faq-list {
          grid-template-columns: 1fr;
        }
        .section h2,
        .support h2,
        .footer h2 {
          font-size: clamp(1.55rem, 8vw, 2.35rem);
        }
      }
      @media (max-width: 430px) {
        .brand small {
          display: none;
        }
        .support-actions {
          display: grid;
        }
        .button,
        .sticky-register,
        .support-actions a {
          width: 100%;
        }
        .sticky-register {
          right: 0.5rem;
          bottom: 0.5rem;
          left: 0.5rem;
          min-width: 0;
        }
        .support-identity {
          grid-template-columns: 1fr;
        }
      }
      @media (hover: none), (pointer: coarse) {
        .spot-card::before,
        .support-card::before {
          opacity: 0.18;
        }
        .spot-card:hover,
        .support-card:hover,
        .faq-card:hover {
          transform: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 1ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 1ms !important;
        }
        .aurora,
        .hero-media,
        .hero-media::after {
          animation: none !important;
        }
      }
      @keyframes aurora {
        from { background-position: 50% 50%, 50% 50%; }
        to { background-position: 350% 50%, 350% 50%; }
      }
      @keyframes fade-down {
        from { opacity: 0; transform: translate3d(0, -0.75rem, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      @keyframes fade-up {
        from { opacity: 0; transform: translate3d(0, 1rem, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      @keyframes scale-in {
        from { opacity: 0; transform: scale(0.96) translate3d(0, 1rem, 0); }
        to { opacity: 1; transform: scale(1) translate3d(0, 0, 0); }
      }
      @keyframes float-card {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -0.55rem, 0); }
      }
      @keyframes light-sweep {
        0%, 45% { transform: translateX(-120%); }
        65%, 100% { transform: translateX(120%); }
      }
      @keyframes view-rise {
        from { opacity: 0.2; transform: translate3d(0, 1.4rem, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
    </style>
  </head>
  <body>
    <main
      class="page"
      data-coach-slug="${escapeAttribute(site.slug)}"
      data-theme="${escapeAttribute(theme.id)}"
      style="${escapeAttribute(themeStyle)}"
    >
      <div class="aurora" aria-hidden="true"></div>
      <div class="scroll-line" aria-hidden="true"><span></span></div>
      ${
        isPaused
          ? renderPausedHtml(site, support)
          : `
      ${renderStickyRegisterAction(site)}
      <nav class="nav" aria-label="Coach page navigation">
        <a class="brand" href="#top">
          <img alt="YW Nutritech" src="/images/yw-nutritech-logo.png" />
          <span>
            <strong>YW Nutritech</strong>
            <small>Coach Referral</small>
          </span>
        </a>
        <div class="nav-links">
          <a href="#journey">Journey</a>
          <a href="#benefits">Benefits</a>
        </div>
        ${renderRegisterAction(site, "button primary nav-cta", site.registerButtonText || site.content.ctaText || "Register")}
      </nav>

      <section class="hero" data-media="${escapeAttribute(site.heroMediaType || "image")}" id="top">
        <div class="hero-copy">
          <div class="trust-row">
            <span>YW Nutritech coach network</span>
            <span>Education-first wellness pathway</span>
          </div>
          <p class="kicker">${escapeHtml(site.niche)}</p>
          <h1>${escapeHtml(site.content.heroHeadline)}</h1>
          <p class="lead">${escapeHtml(site.content.subheadline)}</p>
          <div class="brand-assurance">
            <span>YW care lens</span>
            <strong>Nutrition, habits, lifestyle, education</strong>
          </div>
          <div class="actions">
            ${renderRegisterAction(site, "button primary", site.registerButtonText || site.content.ctaText || "Register Now")}
          </div>
        </div>
        ${site.heroMediaType !== "none" ? renderHeroMedia(site) : ""}
      </section>

      <dl class="hero-metrics">
        <div><dt>Coach</dt><dd>${escapeHtml(site.coachName)}</dd></div>
        <div><dt>Niche</dt><dd>${escapeHtml(site.niche)}</dd></div>
        <div><dt>Location</dt><dd>${escapeHtml(site.location || "Yours Wellness")}</dd></div>
        <div><dt>Referral action</dt><dd>${site.googleFormUrl ? "Google Form registration" : "Registration link pending"}</dd></div>
      </dl>

      <section class="section intro-section">
        <div class="section-head">
          <span>Coach Introduction</span>
          <h2>Personal coach guidance inside a premium wellness-tech ecosystem.</h2>
        </div>
        <div class="intro-grid">
          <article class="spot-card story-card">
            <span>Who the coach is</span>
            <h3>${escapeHtml(site.coachName)}</h3>
            <p>${escapeHtml(site.content.coachIntro)}</p>
          </article>
          <article class="spot-card story-card">
            <span>Coach mission</span>
            <h3>${escapeHtml(site.location || "Yours Wellness Coach")}</h3>
            <p>${escapeHtml(site.content.visionText || site.vision)}</p>
          </article>
        </div>
      </section>

      <section class="section problem-section">
        <div class="problem-copy">
          <span>Problem to solution</span>
          <h2>For guests who need direction before committing to a bigger program.</h2>
          <p>${escapeHtml(site.content.trustText)}</p>
        </div>
        <div class="problem-list">${problems}</div>
      </section>

      <section class="section journey-section" id="journey">
        <div class="section-head">
          <span>YW Nutritech pathway</span>
          <h2>One page that moves from trust to action.</h2>
        </div>
        <div class="journey-grid">${journey}</div>
      </section>

      <section class="section benefits-section" id="benefits">
        <div class="section-head">
          <span>Benefits</span>
          <h2>Clean nutrition-tech cards without clutter.</h2>
        </div>
        <div class="benefit-grid">${benefits}</div>
      </section>

      <section class="section media-section">
        <div class="video-frame" data-media="${escapeAttribute(site.heroMediaType || "none")}">
          ${renderMediaModule(site)}
          <span>Coach media module</span>
          <strong>Coach image / video-ready area</strong>
          <p>Media stays inside the fixed YW Nutritech template while keeping the coach visible.</p>
        </div>
        <div class="media-notes">
          <span>YW Nutritech ready</span>
          <h2>Image, video, and no-media states stay consistent.</h2>
          <p>Each coach can feel individual without leaving the premium YW Nutritech visual system.</p>
        </div>
      </section>

      <section class="section register-section" id="register">
        <div>
          <span>Register</span>
          <h2>${escapeHtml(site.content.ctaText || "Ready to take the first step with this coach?")}</h2>
          <p>${escapeHtml(site.content.trustText)}</p>
        </div>
        ${renderRegisterAction(site, "button primary", site.registerButtonText || "Register Now")}
      </section>

      <section class="section faq-section">
        <div class="section-head">
          <span>FAQ</span>
          <h2>Clean answers before registration.</h2>
        </div>
        <div class="faq-list">${faq}</div>
      </section>

      ${renderFooterHtml()}`
      }
    </main>
    <script>
      (function () {
        var slug = ${JSON.stringify(site.slug)};
        var root = document.documentElement;
        function updateProgress() {
          var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          var progress = Math.min(1, Math.max(0, window.scrollY / max));
          root.style.setProperty('--scroll-progress', progress.toFixed(4));
        }
        function track(eventName) {
          try {
            if (!navigator.sendBeacon) return;
            navigator.sendBeacon('/api/coach-events', new Blob([JSON.stringify({
              coachSlug: slug,
              eventName: eventName,
              pagePath: window.location.pathname
            })], { type: 'application/json' }));
          } catch (_) {}
        }
        updateProgress();
        window.addEventListener('scroll', updateProgress, { passive: true });
        track('coach_site_view');
        document.addEventListener('pointermove', function (event) {
          var card = event.target && event.target.closest ? event.target.closest('.spot-card, .support-card') : null;
          if (!card) return;
          var rect = card.getBoundingClientRect();
          card.style.setProperty('--mouse-x', (event.clientX - rect.left) + 'px');
          card.style.setProperty('--mouse-y', (event.clientY - rect.top) + 'px');
        }, { passive: true });
        document.addEventListener('click', function (event) {
          var target = event.target && event.target.closest ? event.target.closest('[data-track]') : null;
          if (target) track(target.getAttribute('data-track'));
        });
      })();
    </script>
  </body>
</html>`;
}

function renderPausedHtml(site: PublicCoachSiteRecord, support: SupportDetails) {
  return `
    <section class="unavailable-panel">
      <p class="kicker">Coach Page</p>
      <h1>This coach page is temporarily unavailable.</h1>
      <p>The public link remains stable. Please contact support if you need help.</p>
      ${renderSupportHtml(site, support, true)}
    </section>`;
}

function renderSupportHtml(site: PublicCoachSiteRecord, support: SupportDetails, compact = false) {
  return `
    <section class="support" id="coach-contact-support">
      <article class="support-card">
        ${renderSupportBody(site, support)}
        ${
          compact
            ? `<div class="support-actions"><a href="${escapeAttribute(support.primaryHref)}">Contact Support</a><a href="/">Go Back Home</a></div>`
            : ""
        }
      </article>
    </section>`;
}

function renderSupportBody(
  site: PublicCoachSiteRecord | null,
  support: SupportDetails,
  referenceId = site
    ? createCoachFallbackReferenceId(site.slug)
    : createSupportErrorReference("unknown", "coach")
) {
  return `
    <div class="support-identity">
      <div class="avatar">
        ${support.imageUrl ? `<img alt="${escapeAttribute(`${support.name} support profile`)}" src="${escapeAttribute(support.imageUrl)}" />` : `<span>${escapeHtml(support.name.slice(0, 2).toUpperCase())}</span>`}
      </div>
      <div>
        <p class="kicker">Contact Support</p>
        <h2>${escapeHtml(support.name)}</h2>
        <p>${escapeHtml(support.text)}</p>
      </div>
    </div>
    <div class="support-grid">
      ${support.phone ? `<a href="tel:${escapeAttribute(support.phone.replace(/[^\\d+]/g, ""))}"><span>Phone</span><strong>${escapeHtml(support.phone)}</strong></a>` : ""}
      ${support.whatsappLink ? `<a data-track="coach_whatsapp_click" href="${escapeAttribute(support.whatsappLink)}" rel="noreferrer" target="_blank"><span>WhatsApp</span><strong>Message coach</strong></a>` : ""}
      ${support.email ? `<a href="${escapeAttribute(support.emailHref)}"><span>Email</span><strong>${escapeHtml(support.email)}</strong></a>` : `<div class="pending"><span>Support</span><strong>Support contact will be updated soon.</strong></div>`}
    </div>
    <p class="privacy">Contact details shown here are public support details, not admin-only data. Reference: ${escapeHtml(referenceId)}</p>`;
}

function renderSupportFallbackHtml({
  category,
  message,
  referenceId,
  site
}: {
  category: PublicWebsiteErrorCategory;
  message: string;
  referenceId: string;
  site: PublicCoachSiteRecord | null;
}) {
  const support = getSupportDetails(site);
  const errorCode = getPublicSupportErrorCode(category);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Something went wrong | YW Nutritech</title>
    <style>
      *{box-sizing:border-box}
      body{min-width:320px;min-height:100vh;display:grid;place-items:center;margin:0;background:radial-gradient(circle at 14% 10%,rgb(255 211 232/.7),transparent 25rem),radial-gradient(circle at 88% 18%,rgb(196 181 253/.42),transparent 25rem),linear-gradient(135deg,#fffaf7 0%,#fff7fb 48%,#f9f7ff 100%);color:#201628;font-family:"Segoe UI",ui-sans-serif,system-ui,sans-serif;padding:clamp(1rem,4vw,3rem)}
      main{width:min(100%,60rem);overflow:hidden;border:1px solid rgb(255 255 255/.78);border-radius:1.35rem;background:linear-gradient(145deg,rgb(255 255 255/.86),rgb(255 245 250/.72));box-shadow:0 24px 80px rgb(76 43 70/.16),inset 0 1px 0 rgb(255 255 255/.92)}
      header,.content{padding:clamp(1rem,4vw,2rem)}
      header{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid rgb(222 190 208/.62)}
      .brand{display:inline-flex;align-items:center;gap:.75rem;color:inherit;font-weight:900;text-decoration:none}.brand img{width:2.6rem;height:2.6rem;object-fit:contain}.brand span{display:grid}.brand small{color:#8d637c;font-size:.76rem;font-weight:800}
      code{border:1px solid rgb(189 143 178/.32);border-radius:999px;background:rgb(255 255 255/.64);color:#8f164f;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84rem;font-weight:900;padding:.48rem .72rem}
      .content{display:grid;grid-template-columns:minmax(0,1fr) minmax(18rem,.78fr);gap:clamp(1rem,4vw,2rem)}
      h1{margin:0;color:#1c1726;font-family:Georgia,Cambria,"Times New Roman",serif;font-size:clamp(2.2rem,6vw,4.25rem);line-height:.98}p{color:#675466;font-size:clamp(1rem,2vw,1.12rem);font-weight:650;line-height:1.65}.kicker{color:#9b2f66;font-size:.76rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
      .support-card{display:grid;gap:1rem;border:1px solid rgb(235 201 219/.78);border-radius:1.1rem;background:linear-gradient(145deg,rgb(255 255 255/.9),rgb(255 240 247/.72));padding:1rem}.support-identity{display:grid;grid-template-columns:3.6rem minmax(0,1fr);gap:.8rem;align-items:center}.avatar{width:3.6rem;height:3.6rem;display:grid;place-items:center;overflow:hidden;border-radius:999px;background:linear-gradient(135deg,#9f174d,#a855f7);color:#fff;font-weight:950}.avatar img{width:100%;height:100%;object-fit:cover}
      .support-grid{display:grid;gap:.65rem}.support-grid a,.pending{display:grid;gap:.22rem;border:1px solid rgb(242 201 218/.72);border-radius:.85rem;background:rgb(255 255 255/.68);color:inherit;padding:.78rem .85rem;text-decoration:none}.support-grid span{color:#8b6078;font-size:.75rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .support-actions{display:flex;flex-wrap:wrap;gap:.7rem}.support-actions a{min-height:2.9rem;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgb(242 201 218/.78);border-radius:999px;padding:0 1rem;color:#251822;font-weight:900;text-decoration:none}.support-actions a:first-child{background:linear-gradient(135deg,#251822,#9f174d 54%,#a855f7);color:#fff}
      @media(max-width:720px){body{padding:.75rem}main{min-height:calc(100svh - 1.5rem);display:grid;align-content:center;border-radius:1rem}header{align-items:flex-start;flex-direction:column}.content{grid-template-columns:1fr}.support-actions a{width:100%}}
    </style>
  </head>
  <body>
    <main>
      <header>
        <a class="brand" href="/"><img alt="YW Nutritech" src="/images/yw-nutritech-logo.png" /><span><strong>YW Nutritech</strong><small>Support fallback</small></span></a>
        <code>Error Code: ${escapeHtml(errorCode)}</code>
      </header>
      <section class="content">
        <div><p class="kicker">Contact Support</p><h1>Something went wrong</h1><p>${escapeHtml(message)}</p></div>
        <aside class="support-card">
          ${renderSupportBody(site, support, referenceId)}
          <div class="support-actions"><a href="${escapeAttribute(support.primaryHref)}">Contact Support</a><a href="/">Go Back Home</a></div>
        </aside>
      </section>
    </main>
  </body>
</html>`;
}

function renderFooterHtml() {
  return `
    <footer class="footer">
      <div>
        <span>YW Nutritech Coach Referral</span>
        <h2>Yours Wellness Center</h2>
        <p><strong>HOLISTIC HORMONE RESET SUPPORT FOR WOMEN</strong></p>
        <p><strong>Copyright 2026 | Yours Wellness Center. All rights reserved.</strong></p>
        <p>This page is for wellness education and lifestyle coaching support. It is not a substitute for medical advice, diagnosis, or treatment. Results vary based on individual health history, lifestyle, and consistency.</p>
        <p>NOT FACEBOOK: This site is not part of Facebook or Meta Platforms, Inc. It is not endorsed by Facebook in any way. Facebook is a trademark of Meta Platforms, Inc.</p>
      </div>
      <div class="footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms</a>
        <a href="/refund">Refund Policy</a>
        <a href="/disclaimer">Disclaimer</a>
      </div>
    </footer>`;
}

function renderStickyRegisterAction(site: PublicCoachSiteRecord) {
  return renderRegisterAction(
    site,
    "button primary sticky-register",
    site.registerButtonText || "Register Now"
  );
}

function renderRegisterAction(
  site: PublicCoachSiteRecord,
  className = "button primary",
  label?: string
) {
  const text = label || site.registerButtonText || site.content.ctaText || "Register Now";

  if (!site.googleFormUrl) {
    return `<span class="${escapeAttribute(`${className} disabled`)}" role="link" aria-disabled="true">Registration link pending</span>`;
  }

  return `<a class="${escapeAttribute(className)}" data-track="coach_register_click" href="${escapeAttribute(site.googleFormUrl)}" rel="noreferrer" target="_blank">${escapeHtml(text)}</a>`;
}

function renderHeroMedia(site: PublicCoachSiteRecord) {
  return `
    <div class="media-stage">
      <div class="hero-media" data-media="${escapeAttribute(site.heroMediaType)}">
        ${renderHeroMediaContent(site)}
        <div class="media-caption"><span>Coach</span><strong>${escapeHtml(site.coachName)}</strong><small>${escapeHtml(site.niche)}</small></div>
      </div>
      <div class="signal-panel">
        <span>YW Nutritech lens</span>
        <strong>Coach-led wellness pathway</strong>
        <small>Built for education-first nutrition and lifestyle support</small>
      </div>
    </div>`;
}

function renderMediaModule(site: PublicCoachSiteRecord) {
  if (site.heroMediaType === "none") {
    return `<em>${escapeHtml(site.coachName.slice(0, 2).toUpperCase())}</em>`;
  }

  return renderHeroMediaContent(site);
}

function renderHeroMediaContent(site: PublicCoachSiteRecord) {
  if (site.heroMediaType === "none") return "";

  const imageUrl = site.heroMediaType === "image" ? site.photoUrl || site.logoUrl : "";
  const embedVideoUrl = site.heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const uploadedVideoUrl =
    site.heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  if (embedVideoUrl) {
    return `<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen src="${escapeAttribute(embedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></iframe>`;
  }

  if (uploadedVideoUrl) {
    return `<video controls src="${escapeAttribute(uploadedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></video>`;
  }

  if (imageUrl) {
    return `<img alt="${escapeAttribute(`${site.coachName} profile`)}" src="${escapeAttribute(imageUrl)}" />`;
  }

  return `<span>${escapeHtml(site.coachName.slice(0, 2).toUpperCase())}</span>`;
}

type SupportDetails = ReturnType<typeof getSupportDetails>;

function getSupportDetails(site: PublicCoachSiteRecord | null) {
  const hasCoachContact = Boolean(site?.coachEmail || site?.coachPhone || site?.whatsappLink);
  const email = hasCoachContact ? site?.coachEmail || "" : DEFAULT_SUPPORT_EMAIL;
  const subject = encodeURIComponent(`Coach page support ${site?.slug || "unknown-coach"}`);
  const emailHref = `mailto:${email}?subject=${subject}`;
  const whatsappLink = hasCoachContact ? site?.whatsappLink || "" : DEFAULT_SUPPORT_WHATSAPP;

  return {
    email,
    emailHref,
    imageUrl: hasCoachContact ? site?.logoUrl || site?.photoUrl || "" : "",
    name: hasCoachContact && site ? site.coachName : DEFAULT_SUPPORT_NAME,
    phone: hasCoachContact ? site?.coachPhone || "" : DEFAULT_SUPPORT_PHONE,
    primaryHref: whatsappLink || emailHref,
    text:
      site?.supportText ||
      (hasCoachContact ? "Need help? Contact your coach directly." : DEFAULT_SUPPORT_TEXT),
    whatsappLink
  };
}

function createProblemPoints(site: PublicCoachSiteRecord) {
  return [
    `Too much conflicting ${site.niche || "wellness"} advice`,
    "Unsure what daily routine changes matter first",
    "Need a coach-led starting point before a deeper program",
    "Want education-friendly guidance that can sit alongside medical care"
  ];
}

function getBenefits(site: PublicCoachSiteRecord) {
  return site.content.benefits.length > 0
    ? site.content.benefits
    : [
        `Understand the basics of ${site.niche || "wellness"} with a clear coach introduction.`,
        "See the coach vision before opening the registration form.",
        "Move to the admin-provided Google Form only after the register click is tracked."
      ];
}

function getFaq(site: PublicCoachSiteRecord) {
  return site.content.faq.length > 0
    ? site.content.faq
    : [
        {
          question: "Is this medical treatment?",
          answer: "No. This coach page is for education and lifestyle guidance only."
        },
        {
          question: "What happens after registration?",
          answer: "The register button opens the admin-provided Google Form when configured."
        }
      ];
}

function createThemeInlineStyle(themeId: unknown) {
  return Object.entries(getCoachTemplateCssVariables(themeId))
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function createCoachFallbackReferenceId(slug: string) {
  return createSupportErrorReference("coach_site_issue", slug);
}

async function logCoachFallbackError({
  category,
  coachSlug = "",
  env,
  referenceId,
  request,
  safeMessage,
  site,
  userAction
}: {
  category: PublicWebsiteErrorCategory;
  coachSlug?: string;
  env: Env;
  referenceId: string;
  request: Request;
  safeMessage: string;
  site?: PublicCoachSiteRecord | null;
  userAction: string;
}) {
  const supportSource =
    site && (site.coachEmail || site.coachPhone || site.whatsappLink) ? "coach" : "default";

  await insertWebsiteErrorReport(
    {
      browser: request.headers.get("user-agent") || "unknown",
      category,
      coachSlug,
      digest: "",
      errorCode: getPublicSupportErrorCode(category),
      funnelStep: category === "link_missing" ? "coach_register_click" : "",
      missingSupportFields: getMissingSupportFields(site || null, supportSource),
      pagePath: new URL(request.url).pathname,
      referenceId,
      referrer: request.headers.get("referer") || "direct",
      safeMessage,
      screenSize: "",
      supportSource,
      technicalDetails: "",
      userAction
    },
    env
  );
}

function getMissingSupportFields(
  site: PublicCoachSiteRecord | null,
  supportSource: "coach" | "default"
) {
  if (supportSource === "coach") {
    return [
      site?.coachEmail ? "" : "coach email",
      site?.coachPhone ? "" : "coach phone",
      site?.whatsappLink ? "" : "coach WhatsApp"
    ].filter(Boolean);
  }

  return [
    DEFAULT_SUPPORT_EMAIL ? "" : "default support email",
    DEFAULT_SUPPORT_PHONE ? "" : "default support phone",
    DEFAULT_SUPPORT_WHATSAPP ? "" : "default support WhatsApp"
  ].filter(Boolean);
}

function getHtmlHeaders(paused: boolean) {
  return {
    "cache-control": paused ? "no-store" : "public, max-age=60",
    "content-type": "text/html; charset=utf-8"
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

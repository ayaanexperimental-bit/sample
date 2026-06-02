import type { D1Database } from "@cloudflare/workers-types";
import {
  type PublicCoachSiteRecord,
  getPublicCoachSiteBySlug,
  normalizeCoachSlug
} from "../../lib/admin-coach-sites";
import { DEFAULT_SUPPORT_EMAIL } from "../../lib/error-reporting";
import { getPublicCoachSiteFromDb } from "../../lib/server/coach-site-storage";
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
  if (!slug) return new Response("Not found.", { status: 404 });

  const site = (await getPublicCoachSiteFromDb(slug, env)) || getPublicCoachSiteBySlug(slug);
  if (!site || site.status === "draft" || site.status === "archived" || site.status === "removed") {
    return new Response("Not found.", { status: 404 });
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      headers: getHtmlHeaders(site.status === "paused"),
      status: 200
    });
  }

  return new Response(renderCoachSiteHtml(site), {
    headers: getHtmlHeaders(site.status === "paused"),
    status: 200
  });
}

function renderCoachSiteHtml(site: PublicCoachSiteRecord) {
  const support = getSupportDetails(site);
  const isPaused = site.status === "paused";
  const heroMedia = renderHeroMedia(site);
  const benefits = site.content.benefits
    .map(
      (benefit, index) => `
        <article>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <p>${escapeHtml(benefit)}</p>
        </article>`
    )
    .join("");
  const faq = site.content.faq
    .map(
      (item) => `
        <article>
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>
        </article>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(site.coachName)} | YW Coach</title>
    <meta name="description" content="${escapeAttribute(site.content.subheadline)}" />
    <style>
      :root {
        color-scheme: light;
        --ink: #172421;
        --muted: #52635f;
        --line: rgb(23 36 33 / 0.1);
        --teal: #0f766e;
        --teal-deep: #173c37;
        --rose: #b73758;
        --soft: rgb(250 252 251 / 0.86);
      }
      * { box-sizing: border-box; }
      html { min-width: 320px; background: #f7faf9; color: var(--ink); scroll-behavior: smooth; }
      body {
        min-height: 100vh;
        margin: 0;
        background:
          linear-gradient(120deg, rgb(247 250 249 / 0.96), rgb(255 255 255 / 0.98) 42%, rgb(246 249 255 / 0.94)),
          repeating-linear-gradient(90deg, rgb(19 57 53 / 0.035) 0 1px, transparent 1px 4.5rem);
        color: var(--ink);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
        overflow-x: hidden;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      a { color: inherit; }
      h1, h2, h3, p, strong { overflow-wrap: anywhere; }
      .page { width: min(100% - 32px, 1184px); margin: 0 auto; padding: clamp(18px, 4vw, 48px) 0 64px; }
      .hero {
        min-height: min(760px, calc(100svh - 32px));
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(288px, 0.5fr);
        gap: clamp(20px, 5vw, 64px);
        align-items: center;
        padding: clamp(16px, 4vw, 32px) 0;
      }
      .hero[data-media="none"] { grid-template-columns: minmax(0, 768px); }
      .template-mark { width: fit-content; max-width: 100%; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; color: #37524d; font-size: 0.78rem; font-weight: 850; }
      .template-mark span { border: 1px solid var(--line); border-radius: 8px; background: rgb(255 255 255 / 0.72); padding: 7px 10px; }
      .kicker { margin: 0 0 11px; color: var(--teal); font-size: 0.75rem; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; }
      h1, h2 { margin: 0; color: var(--ink); font-family: Georgia, Cambria, "Times New Roman", serif; letter-spacing: 0; line-height: 0.98; }
      h1 { max-width: 14ch; font-size: clamp(2.7rem, 6.8vw, 5.9rem); }
      h2 { font-size: clamp(1.65rem, 3vw, 2.7rem); }
      h3 { margin: 0 0 8px; color: var(--ink); font-size: 1rem; }
      p { color: var(--muted); font-size: clamp(0.98rem, 1.7vw, 1.12rem); font-weight: 650; line-height: 1.64; }
      .lead { max-width: 672px; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
      .button, .register-band a {
        min-height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--teal);
        border-radius: 8px;
        background: var(--teal);
        color: #fff;
        padding: 0 16px;
        font-weight: 900;
        text-decoration: none;
        box-shadow: 0 16px 35px rgb(15 118 110 / 0.16);
      }
      .button.secondary { border-color: rgb(23 36 33 / 0.14); background: rgb(255 255 255 / 0.76); color: #1f3732; box-shadow: none; }
      .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 24px 0 0; }
      .facts div { border: 1px solid var(--line); border-radius: 8px; background: rgb(255 255 255 / 0.68); padding: 12px; }
      .facts dt { color: var(--teal); font-size: 0.68rem; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; }
      .facts dd { margin: 4px 0 0; color: var(--ink); font-size: 0.9rem; font-weight: 850; line-height: 1.3; }
      .hero-media {
        position: relative;
        aspect-ratio: 4 / 5;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid rgb(23 36 33 / 0.12);
        border-radius: 8px;
        background:
          linear-gradient(145deg, rgb(255 255 255 / 0.94), rgb(236 246 244 / 0.9)),
          repeating-linear-gradient(135deg, rgb(15 118 110 / 0.08) 0 1px, transparent 1px 18px);
        box-shadow: 0 29px 64px rgb(23 36 33 / 0.12);
      }
      .hero-media[data-media="video"] { aspect-ratio: 16 / 10; }
      .hero-media img, .hero-media video { width: 100%; height: 100%; object-fit: cover; }
      .hero-media iframe { width: 100%; height: 100%; border: 0; }
      .hero-media > span { color: var(--teal); font-size: clamp(3rem, 10vw, 6rem); font-weight: 950; }
      .media-caption { position: absolute; right: 13px; bottom: 13px; left: 13px; display: grid; gap: 2px; border: 1px solid rgb(255 255 255 / 0.4); border-radius: 8px; background: rgb(23 36 33 / 0.78); color: #fff; padding: 12px; backdrop-filter: blur(12px); }
      .media-caption span { color: rgb(255 255 255 / 0.76); font-size: 0.8rem; font-weight: 750; }
      .story-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 16px; }
      .story-grid, .benefits, .faq, .support, .register-band { margin-top: 16px; }
      .section, .benefit-grid article, .faq-list article, .support {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgb(255 255 255 / 0.78);
        box-shadow: 0 16px 42px rgb(23 36 33 / 0.06);
        padding: clamp(16px, 3vw, 23px);
      }
      .benefit-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
      .benefit-grid article { display: grid; gap: 10px; background: var(--soft); }
      .benefit-grid span { color: var(--rose); font-size: 0.78rem; font-weight: 950; }
      .faq-list { display: grid; gap: 12px; margin-top: 16px; }
      .register-band {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
        border: 1px solid rgb(15 118 110 / 0.18);
        border-radius: 8px;
        background: linear-gradient(135deg, #173c37, #0f766e 62%, #b73758);
        color: #fff;
        padding: clamp(20px, 4vw, 32px);
      }
      .register-band .kicker, .register-band h2, .register-band p { color: #fff; }
      .register-band p { margin-bottom: 0; opacity: 0.86; }
      .register-band a { border-color: rgb(255 255 255 / 0.72); background: #fff; color: #173c37; box-shadow: none; }
      .support-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: center; }
      .avatar { width: 88px; aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; border: 1px solid rgb(15 118 110 / 0.16); border-radius: 8px; background: linear-gradient(145deg, rgb(255 255 255 / 0.92), rgb(239 248 246 / 0.78)); color: var(--teal); font-size: 1.8rem; font-weight: 950; }
      .avatar img { width: 100%; height: 100%; object-fit: cover; }
      .support-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .support-grid a { min-height: 72px; display: grid; gap: 5px; align-content: center; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); color: var(--ink); padding: 13px; text-decoration: none; }
      .support-grid span { color: var(--teal); font-size: 0.72rem; font-weight: 950; letter-spacing: 0.06em; text-transform: uppercase; }
      .support-grid strong { overflow-wrap: anywhere; line-height: 1.25; }
      .privacy { margin-bottom: 0; color: #687873; font-size: 0.82rem; font-weight: 750; }
      .paused { min-height: 70vh; display: grid; place-items: center; }
      .paused .section { max-width: 760px; }
      @media (max-width: 920px) {
        .page { width: min(100% - 20px, 1184px); }
        .hero, .story-grid, .benefit-grid, .support-grid, .register-band, .facts { grid-template-columns: 1fr; }
        .hero { min-height: auto; }
        .hero-media { width: min(100%, 448px); justify-self: start; }
      }
      @media (max-width: 520px) {
        .page { width: min(100% - 16px, 1184px); padding-top: 12px; }
        h1 { font-size: clamp(2.15rem, 11vw, 3rem); }
        .button, .register-band a { width: 100%; }
        .support-head { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="page" data-coach-slug="${escapeAttribute(site.slug)}">
      ${
        isPaused
          ? renderPausedHtml(site, support)
          : `
      <section class="hero" data-media="${escapeAttribute(site.heroMediaType || "image")}">
        <div>
          <div class="template-mark">
            <span>Yours Wellness Coach</span>
            <span>${escapeHtml(site.location || site.niche)}</span>
          </div>
          <p class="kicker">${escapeHtml(site.niche)}</p>
          <h1>${escapeHtml(site.content.heroHeadline)}</h1>
          <p class="lead">${escapeHtml(site.content.subheadline)}</p>
          <div class="actions">
            ${renderRegisterAction(site)}
            ${site.whatsappLink ? `<a class="button secondary" data-track="coach_whatsapp_click" href="${escapeAttribute(site.whatsappLink)}" rel="noreferrer" target="_blank">WhatsApp</a>` : ""}
          </div>
          <dl class="facts">
            <div><dt>Coach</dt><dd>${escapeHtml(site.coachName)}</dd></div>
            <div><dt>Focus</dt><dd>${escapeHtml(site.niche)}</dd></div>
            <div><dt>Location</dt><dd>${escapeHtml(site.location || "Yours Wellness")}</dd></div>
          </dl>
        </div>
        ${heroMedia}
      </section>

      <section class="story-grid">
        <article class="section">
          <p class="kicker">Coach Introduction</p>
          <h2>${escapeHtml(site.coachName)}</h2>
          <p>${escapeHtml(site.content.coachIntro)}</p>
        </article>
        <article class="section">
          <p class="kicker">Vision</p>
          <h2>${escapeHtml(site.location || "Yours Wellness Coach")}</h2>
          <p>${escapeHtml(site.content.visionText)}</p>
        </article>
      </section>

      <section class="benefits">
        <p class="kicker">Benefits</p>
        <h2>What guests can expect</h2>
        <div class="benefit-grid">${benefits}</div>
      </section>

      <section class="register-band">
        <div>
          <p class="kicker">Register</p>
          <h2>${escapeHtml(site.content.ctaText || "Register Now")}</h2>
          <p>${escapeHtml(site.content.trustText)}</p>
        </div>
        ${renderRegisterAction(site)}
      </section>

      <section class="faq">
        <p class="kicker">FAQ</p>
        <h2>Before you register</h2>
        <div class="faq-list">${faq}</div>
      </section>

      ${renderSupportHtml(site, support)}`
      }
    </main>
    <script>
      (function () {
        var slug = ${JSON.stringify(site.slug)};
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
        track('coach_site_view');
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
    <section class="paused">
      <article class="section">
        <p class="kicker">Coach Page</p>
        <h1>This coach page is temporarily unavailable.</h1>
        <p>The public link remains stable. Please contact support if you need help.</p>
        ${renderSupportHtml(site, support)}
      </article>
    </section>`;
}

function renderSupportHtml(site: PublicCoachSiteRecord, support: SupportDetails) {
  return `
    <section class="support" id="coach-contact-support">
      ${renderSupportBody(site, support)}
    </section>`;
}

function renderSupportBody(site: PublicCoachSiteRecord, support: SupportDetails) {
  return `
    <div class="support-head">
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
      <a href="${escapeAttribute(support.emailHref)}"><span>Email</span><strong>${escapeHtml(support.email)}</strong></a>
    </div>
    <p class="privacy">Contact details shown here are public coach-site support details, not admin-only data. Reference ID: ${escapeHtml(createCoachFallbackReferenceId(site.slug))}</p>`;
}

function renderRegisterAction(site: PublicCoachSiteRecord) {
  if (!site.googleFormUrl) {
    return `<a class="button" href="#coach-contact-support">Contact Support</a>`;
  }

  return `<a class="button" data-track="coach_register_click" href="${escapeAttribute(site.googleFormUrl)}" rel="noreferrer" target="_blank">${escapeHtml(site.registerButtonText || site.content.ctaText || "Register Now")}</a>`;
}

function renderHeroMedia(site: PublicCoachSiteRecord) {
  if (site.heroMediaType === "none") return "";

  const imageUrl = site.heroMediaType === "image" ? site.photoUrl || site.logoUrl : "";
  const embedVideoUrl = site.heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const uploadedVideoUrl =
    site.heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  return `
    <div class="hero-media" data-media="${escapeAttribute(site.heroMediaType)}">
      ${embedVideoUrl ? `<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${escapeAttribute(embedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></iframe>` : ""}
      ${uploadedVideoUrl ? `<video controls src="${escapeAttribute(uploadedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></video>` : ""}
      ${imageUrl ? `<img alt="${escapeAttribute(`${site.coachName} profile`)}" src="${escapeAttribute(imageUrl)}" />` : ""}
      ${!embedVideoUrl && !uploadedVideoUrl && !imageUrl ? `<span>${escapeHtml(site.coachName.slice(0, 2).toUpperCase())}</span>` : ""}
      <div class="media-caption"><strong>${escapeHtml(site.coachName)}</strong><span>${escapeHtml(site.niche)}</span></div>
    </div>`;
}

type SupportDetails = ReturnType<typeof getSupportDetails>;

function getSupportDetails(site: PublicCoachSiteRecord) {
  const hasCoachContact = Boolean(site.coachEmail || site.coachPhone || site.whatsappLink);
  const email = site.coachEmail || DEFAULT_SUPPORT_EMAIL;
  const subject = encodeURIComponent(`Coach page support ${site.slug || "unknown-coach"}`);
  const emailHref = `mailto:${email}?subject=${subject}`;
  const whatsappLink = site.whatsappLink || "";

  return {
    email,
    emailHref,
    imageUrl: hasCoachContact ? site.logoUrl || site.photoUrl || "" : "",
    name: hasCoachContact ? site.coachName : DEFAULT_SUPPORT_NAME,
    phone: site.coachPhone || "",
    text:
      site.supportText ||
      (hasCoachContact ? "Need help? Contact your coach directly." : DEFAULT_SUPPORT_TEXT),
    whatsappLink
  };
}

function createCoachFallbackReferenceId(slug: string) {
  const suffix = slug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");

  return `ERR-20260601-${suffix}`;
}

function getHtmlHeaders(paused: boolean) {
  return {
    "cache-control": paused ? "no-store" : "public, max-age=60",
    "content-type": "text/html; charset=utf-8"
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

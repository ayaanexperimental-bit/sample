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

  const html = renderCoachSiteHtml(site);

  if (request.method === "HEAD") {
    return new Response(null, {
      headers: getHtmlHeaders(site.status === "paused"),
      status: 200
    });
  }

  return new Response(html, {
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
        --ink: #1d2939;
        --muted: #667085;
        --line: #e4e7ec;
        --teal: #087a73;
        --teal-dark: #075f5b;
        --soft: #f6fbfb;
        --rose: #fff6fa;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(90deg, #f8fbfd 0%, #fff 82%, #fff5fb 100%);
        color: var(--ink);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }
      a { color: inherit; }
      .page { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
      .kicker {
        margin: 0 0 10px;
        color: var(--teal);
        font-size: 0.78rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .hero {
        min-height: 72vh;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr);
        gap: 28px;
        align-items: center;
        padding: 36px 0;
      }
      .hero[data-media="none"] { grid-template-columns: minmax(0, 760px); }
      h1, h2, h3, p { overflow-wrap: anywhere; }
      h1 { margin: 0; font-size: clamp(2.3rem, 6vw, 5rem); line-height: 0.95; letter-spacing: 0; }
      h2 { margin: 0 0 12px; font-size: clamp(1.6rem, 3vw, 2.6rem); line-height: 1.05; }
      h3 { margin: 0 0 8px; font-size: 1.05rem; }
      .lead { margin: 20px 0 0; max-width: 720px; color: var(--muted); font-size: 1.08rem; font-weight: 650; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
      .button {
        display: inline-flex;
        min-height: 46px;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: 1px solid rgb(8 122 115 / 0.25);
        background: var(--teal);
        color: #fff;
        padding: 0 18px;
        font-weight: 850;
        text-decoration: none;
      }
      .button.secondary { background: #fff; color: var(--teal-dark); }
      .hero-media {
        min-height: 360px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 22px 70px rgb(29 41 57 / 0.1);
      }
      .hero-media img, .hero-media video { width: 100%; height: 100%; object-fit: cover; }
      .hero-media iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; }
      .hero-media span { color: var(--teal); font-size: 4rem; font-weight: 950; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 28px; }
      .section {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: rgb(255 255 255 / 0.86);
        padding: 24px;
      }
      .section p { color: var(--muted); font-weight: 620; }
      .benefits, .faq, .support, .final {
        margin-top: 28px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fff;
        padding: 28px;
      }
      .benefit-grid, .faq-grid, .support-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      .benefit-grid article, .faq-grid article, .support-grid a {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--soft);
        padding: 18px;
      }
      .benefit-grid span { color: var(--teal); font-weight: 950; }
      .support-head { display: flex; gap: 16px; align-items: center; }
      .avatar {
        width: 72px;
        height: 72px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 50%;
        background: var(--soft);
        color: var(--teal);
        font-weight: 950;
      }
      .avatar img { width: 100%; height: 100%; object-fit: cover; }
      .support-grid a { color: var(--ink); text-decoration: none; }
      .support-grid span { display: block; color: var(--teal); font-size: 0.72rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
      .support-grid strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
      .privacy { color: var(--muted); font-size: 0.84rem; font-weight: 650; }
      .paused {
        min-height: 70vh;
        display: grid;
        place-items: center;
      }
      .paused .section { max-width: 760px; }
      @media (max-width: 820px) {
        .page { width: min(100% - 20px, 1120px); padding-top: 18px; }
        .hero, .grid, .benefit-grid, .faq-grid, .support-grid { grid-template-columns: 1fr; }
        .hero { min-height: auto; padding: 24px 0; }
        .hero-media { min-height: 260px; }
        .section, .benefits, .faq, .support, .final { padding: 20px; border-radius: 12px; }
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
          <p class="kicker">${escapeHtml(site.niche)}</p>
          <h1>${escapeHtml(site.content.heroHeadline)}</h1>
          <p class="lead">${escapeHtml(site.content.subheadline)}</p>
          <div class="actions">
            ${renderRegisterAction(site)}
            ${site.whatsappLink ? `<a class="button secondary" data-track="coach_whatsapp_click" href="${escapeAttribute(site.whatsappLink)}" rel="noreferrer" target="_blank">WhatsApp</a>` : ""}
          </div>
        </div>
        ${heroMedia}
      </section>

      ${!site.googleFormUrl ? renderFallbackSupportHtml(site, support) : ""}

      <section class="grid">
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

      <section class="faq">
        <p class="kicker">FAQ</p>
        <h2>Before you register</h2>
        <div class="faq-grid">${faq}</div>
      </section>

      ${renderSupportHtml(site, support)}

      <section class="final">
        <h2>${escapeHtml(site.content.ctaText || "Register Now")}</h2>
        <p>${escapeHtml(site.content.trustText)}</p>
        <div class="actions">${renderRegisterAction(site)}</div>
      </section>`
      }
    </main>
    <script>
      (function () {
        var slug = ${JSON.stringify(site.slug)};
        function track(eventName) {
          try {
            navigator.sendBeacon && navigator.sendBeacon('/api/coach-events', new Blob([JSON.stringify({
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

function renderFallbackSupportHtml(site: PublicCoachSiteRecord, support: SupportDetails) {
  return `
    <section class="support">
      <p class="kicker">Contact Support</p>
      <h2>Something went wrong</h2>
      <p>We could not complete this step. Please contact support for help.</p>
      ${renderSupportBody(site, support)}
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
    <div class="hero-media">
      ${embedVideoUrl ? `<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${escapeAttribute(embedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></iframe>` : ""}
      ${uploadedVideoUrl ? `<video controls src="${escapeAttribute(uploadedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></video>` : ""}
      ${imageUrl ? `<img alt="${escapeAttribute(`${site.coachName} profile`)}" src="${escapeAttribute(imageUrl)}" />` : ""}
      ${!embedVideoUrl && !uploadedVideoUrl && !imageUrl ? `<span>${escapeHtml(site.coachName.slice(0, 2).toUpperCase())}</span>` : ""}
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

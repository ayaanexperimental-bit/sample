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
  CANONICAL_COACH_TEMPLATE_ID,
  getCanonicalCoachInitials,
  getCanonicalCoachName,
  getCanonicalCoachNiche,
  getCanonicalHeroDetailCards,
  getCanonicalHeroPackage,
  getCanonicalLegalDisclaimer,
  getCanonicalRegisterLabel,
  getSafeCoachTemplateCopy,
  getNicheAdaptiveBonusSection
} from "../../lib/coach-canonical-template";
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

function renderInlineYWLoaderCss() {
  return `
      .yw-global-loader {
        --overlay-bg-a: rgb(240 250 255 / 0.98);
        --overlay-bg-b: rgb(249 255 247 / 0.98);
        --overlay-accent: rgb(20 128 184 / 0.1);
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: grid;
        place-items: center;
        overflow: hidden;
        isolation: isolate;
        background: linear-gradient(145deg, var(--overlay-bg-a), var(--overlay-bg-b)), #f9fcff;
        padding: clamp(1rem, 4vw, 2.5rem);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 140ms ease, visibility 140ms ease;
        animation: none;
      }
      .yw-global-loader::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -2;
        background:
          linear-gradient(118deg, transparent 0 16%, rgb(255 255 255 / 0.62) 16% 23%, transparent 23% 100%),
          linear-gradient(73deg, transparent 0 66%, var(--overlay-accent) 66% 74%, transparent 74% 100%),
          repeating-linear-gradient(90deg, rgb(18 54 84 / 0.025) 0 1px, transparent 1px 9rem);
      }
      .yw-global-loader[data-state="hidden"] {
        animation: none;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      .yw-inline-loader-layer {
        position: relative;
        z-index: 2;
        display: grid;
        width: 100%;
        min-height: min(100vh, 42rem);
        place-items: center;
      }
      .yw-inline-atom {
        --loader-size: min(84vw, 46rem);
        width: var(--loader-size);
        max-width: 100%;
        aspect-ratio: 720 / 420;
        background: transparent;
        display: block;
        position: relative;
        pointer-events: none;
      }
      .yw-inline-fallback-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
      }
      .yw-inline-stage {
        position: relative;
        width: 100%;
        height: 100%;
        isolation: isolate;
        transform-origin: 50% 52%;
        animation: yw-atom-hover 4200ms ease-in-out infinite;
      }
      .yw-inline-aura {
        position: absolute;
        inset: 25% 16% 17%;
        z-index: 0;
        border-radius: 50%;
        background:
          radial-gradient(circle at 48% 48%, rgb(229 255 255 / 0.7), transparent 34%),
          radial-gradient(circle at 42% 68%, rgb(50 139 255 / 0.36), transparent 48%),
          radial-gradient(circle at 66% 44%, rgb(43 223 240 / 0.34), transparent 36%);
        filter: blur(18px);
        opacity: 0.72;
        transform: translateZ(0);
        animation: yw-glow-breathe 3600ms ease-in-out infinite;
      }
      .yw-inline-floor-shadow {
        position: absolute;
        left: 28%;
        right: 28%;
        bottom: 15%;
        z-index: 1;
        height: 8%;
        border-radius: 50%;
        background: radial-gradient(ellipse at center, rgb(26 100 202 / 0.26), transparent 70%);
        filter: blur(10px);
        opacity: 0.68;
        animation: yw-shadow-breathe 4200ms ease-in-out infinite;
      }
      .yw-inline-rings {
        position: absolute;
        inset: 0;
        z-index: 2;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .yw-inline-ring-rotor {
        transform-box: view-box;
        transform-origin: 360px 210px;
      }
      .yw-inline-ring-rotor-back {
        animation: yw-ring-turn-back 14800ms linear infinite;
      }
      .yw-inline-ring-rotor-slow {
        animation: yw-ring-turn-slow 11200ms linear infinite reverse;
      }
      .yw-inline-ring-glass,
      .yw-inline-ring-blue,
      .yw-inline-rear-sweep,
      .yw-inline-front-sweep {
        vector-effect: non-scaling-stroke;
      }
      .yw-inline-ring-glass {
        opacity: 0.78;
        filter: drop-shadow(0 0 6px rgb(120 180 255 / 0.28));
      }
      .yw-inline-ring-blue {
        opacity: 0.74;
        filter: drop-shadow(0 0 8px rgb(47 188 255 / 0.36));
      }
      .yw-inline-rear-sweep {
        opacity: 0.34;
      }
      .yw-inline-front-sweep {
        opacity: 0.78;
      }
      .yw-inline-badge {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 7;
        display: grid;
        width: 29.5%;
        aspect-ratio: 1;
        place-items: center;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        animation: yw-badge-breathe 3200ms ease-in-out infinite;
      }
      .yw-inline-badge-rim,
      .yw-inline-badge-glass {
        position: absolute;
        inset: 0;
        border-radius: 50%;
      }
      .yw-inline-badge-rim {
        background: conic-gradient(
          from 226deg,
          rgb(255 255 255 / 0.9),
          rgb(92 151 255 / 0.34),
          rgb(255 255 255 / 0.82),
          rgb(42 210 247 / 0.28),
          rgb(255 255 255 / 0.88)
        );
        box-shadow:
          0 1.5rem 3.2rem rgb(13 82 166 / 0.18),
          0 0 2.6rem rgb(67 198 255 / 0.2);
      }
      .yw-inline-badge-glass {
        inset: 4.4%;
        background:
          radial-gradient(circle at 32% 24%, rgb(255 255 255 / 1), rgb(255 255 255 / 0.92) 31%, rgb(239 248 255 / 0.9) 72%),
          linear-gradient(135deg, rgb(255 255 255 / 0.95), rgb(226 241 255 / 0.78));
        box-shadow:
          inset 0 1px 0 rgb(255 255 255 / 0.95),
          inset 0 -1.1rem 2.6rem rgb(20 98 189 / 0.08);
      }
      .yw-inline-badge-glass::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background:
          linear-gradient(90deg, transparent 0 47%, rgb(255 255 255 / 0.42) 47% 52%, transparent 52% 100%),
          radial-gradient(circle at 26% 22%, rgb(255 255 255 / 0.9), transparent 34%);
        opacity: 0.6;
      }
      .yw-inline-logo {
        position: relative;
        z-index: 2;
        display: block;
        width: 68%;
        height: auto;
        object-fit: contain;
        transform: translate(1%, 1%);
        user-select: none;
      }
      .yw-inline-svg-electron-layer {
        transform-box: view-box;
        transform-origin: 360px 210px;
        opacity: 1;
      }
      .yw-inline-svg-electron {
        opacity: 0.96;
        will-change: transform;
      }
      .yw-inline-svg-electron-halo {
        fill: rgb(43 223 240 / 0.18);
      }
      .yw-inline-svg-electron-core {
        stroke: rgb(255 255 255 / 0.45);
        stroke-width: 1.2;
      }
      .yw-inline-svg-electron-highlight {
        fill: rgb(255 255 255 / 0.92);
      }
      .yw-inline-svg-electron-blue-large {
        opacity: 0.98;
      }
      .yw-inline-svg-electron-blue-large .yw-inline-svg-electron-halo {
        fill: rgb(34 122 255 / 0.24);
      }
      .yw-inline-svg-electron-blue-medium {
        opacity: 0.94;
      }
      .yw-inline-svg-electron-blue-small {
        opacity: 0.86;
      }
      .yw-inline-svg-electron-cyan {
        opacity: 0.92;
      }
      .yw-inline-svg-electron-white {
        opacity: 0.78;
      }
      .yw-inline-spark {
        position: absolute;
        z-index: 6;
        width: 0.55rem;
        aspect-ratio: 1;
        border-radius: 50%;
        background: rgb(255 255 255 / 0.92);
        box-shadow:
          0 0 0.8rem rgb(38 202 255 / 0.55),
          0 0 1.4rem rgb(38 202 255 / 0.28);
        opacity: 0;
        animation: yw-sparkle 4200ms ease-in-out infinite;
      }
      .yw-inline-spark-one {
        left: 33%;
        top: 34%;
      }
      .yw-inline-spark-two {
        right: 30%;
        top: 57%;
        animation-delay: 1200ms;
      }
      .yw-inline-spark-three {
        left: 43%;
        bottom: 24%;
        animation-delay: 2300ms;
      }
      @keyframes yw-atom-hover {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-1.5%) scale(1.006); }
      }
      @keyframes yw-glow-breathe {
        0%, 100% { opacity: 0.56; transform: scale(0.98); }
        50% { opacity: 0.82; transform: scale(1.04); }
      }
      @keyframes yw-shadow-breathe {
        0%, 100% { opacity: 0.48; transform: scaleX(0.94); }
        50% { opacity: 0.72; transform: scaleX(1.06); }
      }
      @keyframes yw-badge-breathe {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -51.5%) scale(1.018); }
      }
      @keyframes yw-ring-turn-back {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes yw-ring-turn-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes yw-sparkle {
        0%, 22%, 100% { opacity: 0; transform: scale(0.72); }
        32%, 48% { opacity: 0.8; transform: scale(1); }
      }
      @media (max-width: 620px) {
        .yw-global-loader { padding: 0.85rem; }
        .yw-inline-loader-layer { min-height: min(100vh, 34rem); }
        .yw-inline-atom { --loader-size: min(92vw, 25rem); }
        .yw-inline-floor-shadow { left: 24%; right: 24%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .yw-global-loader {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .yw-inline-stage,
        .yw-inline-aura,
        .yw-inline-floor-shadow,
        .yw-inline-badge,
        .yw-inline-ring-rotor-back,
        .yw-inline-ring-rotor-slow,
        .yw-inline-svg-electron-layer,
        .yw-inline-spark {
          animation: none !important;
        }
        .yw-inline-svg-electron { display: none; }
        .yw-inline-aura { opacity: 0.66; }
      }`;
}

function renderInlineYWLoader(label = "Loading YW Coach") {
  return `
    <div class="yw-global-loader" id="yw-global-loader" role="status" aria-live="polite" aria-label="${escapeAttribute(label)}">
      <div class="yw-inline-loader-layer" aria-hidden="true">
        <div class="yw-inline-atom">
          <div class="yw-inline-fallback-layer">
            <div class="yw-inline-stage">
              <span class="yw-inline-aura" aria-hidden="true"></span>
              <span class="yw-inline-floor-shadow" aria-hidden="true"></span>
              <svg aria-hidden="true" class="yw-inline-rings" focusable="false" viewBox="0 0 720 420">
                <defs>
                  <linearGradient id="ywInlineLoaderRingBlue" x1="78" x2="642" y1="220" y2="178">
                    <stop offset="0" stop-color="#48dff6" stop-opacity="0.95" />
                    <stop offset="0.42" stop-color="#9fd4ff" stop-opacity="0.48" />
                    <stop offset="0.72" stop-color="#4a8deb" stop-opacity="0.7" />
                    <stop offset="1" stop-color="#ffffff" stop-opacity="0.34" />
                  </linearGradient>
                  <linearGradient id="ywInlineLoaderRingGlass" x1="170" x2="566" y1="40" y2="382">
                    <stop offset="0" stop-color="#f7fbff" stop-opacity="0.78" />
                    <stop offset="0.32" stop-color="#6aaaff" stop-opacity="0.28" />
                    <stop offset="0.72" stop-color="#bcd9ff" stop-opacity="0.45" />
                    <stop offset="1" stop-color="#ffffff" stop-opacity="0.72" />
                  </linearGradient>
                  <filter id="ywInlineLoaderGlow" color-interpolation-filters="sRGB" x="-20%" y="-40%" width="140%" height="180%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feColorMatrix in="blur" result="blueGlow" type="matrix" values="0 0 0 0 0.05 0 0 0 0 0.42 0 0 0 0 1 0 0 0 .52 0" />
                    <feMerge><feMergeNode in="blueGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <radialGradient id="ywInlineElectronBlue" cx="32%" cy="24%" r="70%">
                    <stop offset="0" stop-color="#ffffff" stop-opacity="1" />
                    <stop offset="0.18" stop-color="#73e8ff" stop-opacity="0.92" />
                    <stop offset="0.55" stop-color="#1479ff" stop-opacity="1" />
                    <stop offset="1" stop-color="#043fc0" stop-opacity="1" />
                  </radialGradient>
                  <radialGradient id="ywInlineElectronCyan" cx="32%" cy="24%" r="70%">
                    <stop offset="0" stop-color="#ffffff" stop-opacity="1" />
                    <stop offset="0.2" stop-color="#7effff" stop-opacity="0.92" />
                    <stop offset="0.58" stop-color="#12d5e8" stop-opacity="1" />
                    <stop offset="1" stop-color="#057e9e" stop-opacity="1" />
                  </radialGradient>
                  <radialGradient id="ywInlineElectronWhite" cx="32%" cy="24%" r="70%">
                    <stop offset="0" stop-color="#ffffff" stop-opacity="1" />
                    <stop offset="0.55" stop-color="#f7fbff" stop-opacity="0.95" />
                    <stop offset="1" stop-color="#b6d3fb" stop-opacity="0.9" />
                  </radialGradient>
                  <filter id="ywInlineElectronGlow" color-interpolation-filters="sRGB" x="-90%" y="-90%" width="280%" height="280%">
                    <feGaussianBlur stdDeviation="5" result="softGlow" />
                    <feMerge><feMergeNode in="softGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <g class="yw-inline-ring-rotor yw-inline-ring-rotor-back">
                  <ellipse class="yw-inline-ring-glass" cx="360" cy="210" fill="none" rx="104" ry="284" stroke="url(#ywInlineLoaderRingGlass)" stroke-width="4" transform="rotate(11 360 210)" />
                </g>
                <path class="yw-inline-rear-sweep" d="M112 225 C176 128 455 77 603 143 C674 176 658 252 558 303 C417 374 183 336 107 257" fill="none" stroke="url(#ywInlineLoaderRingGlass)" stroke-linecap="round" stroke-width="8" />
                <g class="yw-inline-ring-rotor yw-inline-ring-rotor-slow">
                  <ellipse class="yw-inline-ring-blue" cx="360" cy="210" fill="none" rx="286" ry="72" stroke="url(#ywInlineLoaderRingBlue)" stroke-width="6" transform="rotate(-9 360 210)" />
                </g>
                <path class="yw-inline-front-sweep" d="M98 246 C165 326 408 334 565 282 C660 249 698 192 624 156 C529 109 278 129 121 208" fill="none" filter="url(#ywInlineLoaderGlow)" stroke="url(#ywInlineLoaderRingBlue)" stroke-linecap="round" stroke-width="8" />
                <g class="yw-inline-svg-electron-layer" filter="url(#ywInlineElectronGlow)">
                  <g class="yw-inline-svg-electron yw-inline-svg-electron-cyan">
                    <circle class="yw-inline-svg-electron-halo" r="16" />
                    <circle class="yw-inline-svg-electron-core" fill="url(#ywInlineElectronCyan)" r="10" />
                    <circle class="yw-inline-svg-electron-highlight" cx="-3.5" cy="-4" r="2.5" />
                    <animateMotion calcMode="linear" dur="8.6s" path="M112 225 C176 128 455 77 603 143 C674 176 658 252 558 303 C417 374 183 336 107 257 C94 247 96 237 112 225" repeatCount="indefinite" />
                  </g>
                  <g class="yw-inline-svg-electron yw-inline-svg-electron-blue-large">
                    <circle class="yw-inline-svg-electron-halo" r="26" />
                    <circle class="yw-inline-svg-electron-core" fill="url(#ywInlineElectronBlue)" r="17" />
                    <circle class="yw-inline-svg-electron-highlight" cx="-5.5" cy="-6.5" r="3.7" />
                    <animateMotion calcMode="linear" dur="7.2s" keyPoints="1;0" keyTimes="0;1" path="M98 246 C165 326 408 334 565 282 C660 249 698 192 624 156 C529 109 278 129 121 208 C89 224 80 237 98 246" repeatCount="indefinite" />
                  </g>
                  <g class="yw-inline-svg-electron yw-inline-svg-electron-blue-medium">
                    <circle class="yw-inline-svg-electron-halo" r="21" />
                    <circle class="yw-inline-svg-electron-core" fill="url(#ywInlineElectronBlue)" r="13" />
                    <circle class="yw-inline-svg-electron-highlight" cx="-4.3" cy="-5" r="3" />
                    <animateMotion begin="-2.1s" calcMode="linear" dur="9.8s" path="M86 252 C159 336 422 351 588 289 C682 253 705 191 624 151 C513 96 253 122 103 216 C78 232 72 244 86 252" repeatCount="indefinite" />
                  </g>
                  <g class="yw-inline-svg-electron yw-inline-svg-electron-blue-small">
                    <circle class="yw-inline-svg-electron-halo" r="15" />
                    <circle class="yw-inline-svg-electron-core" fill="url(#ywInlineElectronBlue)" r="9.5" />
                    <circle class="yw-inline-svg-electron-highlight" cx="-3.2" cy="-3.8" r="2.3" />
                    <animateMotion begin="-3.4s" calcMode="linear" dur="11.8s" keyPoints="1;0" keyTimes="0;1" path="M245 352 C333 240 366 103 440 68 C502 38 550 83 514 178 C472 286 359 375 271 373 C241 372 229 366 245 352" repeatCount="indefinite" />
                  </g>
                  <g class="yw-inline-svg-electron yw-inline-svg-electron-white">
                    <circle class="yw-inline-svg-electron-halo" r="17" />
                    <circle class="yw-inline-svg-electron-core" fill="url(#ywInlineElectronWhite)" r="11" />
                    <circle class="yw-inline-svg-electron-highlight" cx="-3.6" cy="-4.3" r="2.6" />
                    <animateMotion begin="-4.6s" calcMode="linear" dur="13.2s" path="M474 353 C350 282 270 159 304 94 C338 30 472 77 551 179 C631 283 594 376 499 365 C490 364 482 360 474 353" repeatCount="indefinite" />
                  </g>
                </g>
              </svg>
              <span class="yw-inline-badge" aria-hidden="true">
                <span class="yw-inline-badge-rim"></span>
                <span class="yw-inline-badge-glass"></span>
                <img alt="" class="yw-inline-logo" draggable="false" src="/images/yw-nutritech-logo.png" />
              </span>
              <span class="yw-inline-spark yw-inline-spark-one" aria-hidden="true"></span>
              <span class="yw-inline-spark yw-inline-spark-two" aria-hidden="true"></span>
              <span class="yw-inline-spark yw-inline-spark-three" aria-hidden="true"></span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

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

  let site: PublicCoachSiteRecord | null;
  try {
    site = (await getCoachSiteBySlugFromDb(slug, env)) || getPublicCoachSiteBySlug(slug);
  } catch {
    const referenceId = createSupportErrorReference("database_failure", slug);
    await logCoachFallbackError({
      category: "database_failure",
      coachSlug: slug,
      env,
      referenceId,
      request,
      safeMessage: "Coach site database could not be read.",
      site: null,
      userAction: "coach_site_database_read"
    });

    return new Response(
      renderSupportFallbackHtml({
        category: "database_failure",
        message: "This coach page could not load from storage. Please contact support for help.",
        referenceId,
        site: null
      }),
      { headers: getHtmlHeaders(true), status: 503 }
    );
  }
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
  if (String(site.selectedThemeId) === "__legacy_rollback") {
    return renderLegacyCoachSiteHtml(site);
  }

  return renderCanonicalCoachSiteHtml(site);
}

function renderCanonicalCoachSiteHtml(site: PublicCoachSiteRecord) {
  const coachName = getCanonicalCoachName(site);
  const coachNiche = getCanonicalCoachNiche(site);
  const heroPackage = getCanonicalHeroPackage(site);
  const detailCards = getCanonicalHeroDetailCards(site);
  const bonusSection = getNicheAdaptiveBonusSection(site);
  const registerLabel = getCanonicalRegisterLabel(site);
  const support = getSupportDetails(site);
  const title = `${coachName} | YW Nutritech Coach Circle`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttribute(heroPackage.subheadline)}" />
    <link rel="preload" href="/assets/allia-yw-hero-background.avif" as="image" />
    <link rel="stylesheet" href="/coach-circle-template.css?v=coach-footer-legal-local-style-20260618" />
    <style>
      :root {
        --font-display: Georgia, Cambria, "Times New Roman", serif;
        --font-accent: Georgia, Cambria, "Times New Roman", serif;
        --font-tech-display: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        --font-conversion: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        --font-body: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      html { min-width: 0; overflow-x: clip; scroll-behavior: smooth; }
      body { min-height: 100vh; margin: 0; overflow-x: hidden; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
      a { color: inherit; }
      h1, h2, h3, p, strong, span { overflow-wrap: anywhere; }
      ${renderInlineYWLoaderCss()}
    </style>
  </head>
  <body>
    ${renderInlineYWLoader()}
    <main
      class="yw-circle-site"
      data-coach-site-page="public"
      data-coach-slug="${escapeAttribute(site.slug)}"
      data-theme="${CANONICAL_COACH_TEMPLATE_ID}"
      id="top"
    >
      <div class="yw-allia-background" aria-hidden="true"></div>
      <div class="yw-scroll-progress" aria-hidden="true"><span class="yw-scroll-progress__bar"></span></div>

      <nav class="navbar14_component w-nav" aria-label="Coach page navigation">
        <div class="navbar14_container">
          <a class="navbar14_logo-link w-nav-brand yw-navbar-brand" href="#top">
            <span class="yw-navbar-mark" aria-hidden="true">
              <img alt="" decoding="async" loading="eager" src="/assets/yw-logo-transparent.png" />
            </span>
            <span class="yw-navbar-wordmark"><strong>YWN</strong></span>
          </a>
          <div class="navbar14_menu w-nav-menu">
            <div class="navbar14_menu-links">
              <a href="#story">About Us</a>
              <a href="#story">How It Works</a>
              <a href="#bonus">Quality &amp; Innovation</a>
              <a href="#bonus">Our Brands</a>
              <a href="#faq">FAQ</a>
              <a href="#coach-contact-support">Careers</a>
              <a href="#coach-contact-support">Contact Us</a>
            </div>
          </div>
          <div class="navbar14_menu-button w-nav-button" aria-hidden="true"><div class="menu-icon2"></div></div>
        </div>
      </nav>

      <div class="yw-circle-main">
        <section class="yw-circle-hero" id="hero">
          <div class="yw-circle-hero__shell">
            <p class="yw-hero-kicker">${escapeHtml(heroPackage.eyebrow)}</p>
            <p class="yw-hero-pill">${escapeHtml(site.content.brandEyebrow || `Free coach guidance with ${coachName}`)}</p>
            <h1 class="yw-circle-title">${escapeHtml(heroPackage.headline)} <span>${escapeHtml(heroPackage.highlight)}</span></h1>
            <p class="yw-circle-subtitle">${escapeHtml(heroPackage.subheadline)}</p>
            ${renderRegisterAction(site, "yw-register-button yw-hero-top-register", registerLabel)}

            <div class="yw-hero-grid">
              <div class="yw-coach-visual" data-media="${escapeAttribute(site.heroMediaType || "image")}">
                <div class="yw-coach-photo-frame" data-empty="${site.photoUrl || site.logoUrl ? "false" : "true"}">
                  ${renderCanonicalHeroImageContent(site)}
                </div>
                <div class="yw-coach-card">
                  <h2>${escapeHtml(coachName)}</h2>
                  <p>${escapeHtml(coachNiche)}</p>
                </div>
              </div>

              <div class="yw-details-panel">
                <h2 class="yw-details-heading">Coach Support Details</h2>
                <span class="yw-details-line" aria-hidden="true"></span>
                <p class="yw-audience-label">${escapeHtml(heroPackage.helperText)}</p>
                <div class="yw-details-grid">
                  ${detailCards
                    .map(
                      (card, index) => `<article class="yw-detail-card">
                        <span class="yw-detail-icon" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
                        <span><h3>${escapeHtml(card.label)}</h3><p>${escapeHtml(card.value)}</p></span>
                      </article>`
                    )
                    .join("")}
                </div>
                ${renderRegisterAction(site, "yw-register-button", registerLabel)}
              </div>
            </div>
          </div>
        </section>

        ${renderCanonicalMarquee(coachName)}

        <section class="yw-story-section" id="story" aria-labelledby="yw-story-title">
          <div class="yw-story-grid">
            <div class="yw-story-media">
              <div class="yw-story-video-card">
                ${renderCanonicalStoryVideoContent(site)}
              </div>
              <div class="yw-story-media-footer">
                <strong>${escapeHtml(coachName)}</strong>
                <span>${escapeHtml(coachNiche)}</span>
              </div>
            </div>
            <div class="yw-story-copy">
              <h2 id="yw-story-title">${escapeHtml(site.content.introHeading || `Meet Coach ${coachName}`)} <span>${escapeHtml(site.content.visionLabel || "with clarity.")}</span></h2>
              <p>${escapeHtml(site.content.coachIntro || site.bio)}</p>
              <p>${escapeHtml(site.content.visionText || site.vision)}</p>
              <div class="yw-story-stats" aria-label="YW Nutritech coach highlights">
                <div><strong>50K+</strong><span>Community Members</span></div>
                <div><strong>1Cr+</strong><span>People Mission</span></div>
                <div><strong>YW</strong><span>Coach Network</span></div>
              </div>
            </div>
          </div>
        </section>

        <section class="yw-sales-section yw-sales-section--cream" aria-labelledby="yw-familiar-title">
          <div class="yw-sales-shell">
            <p class="yw-kicker">${escapeHtml(site.content.problemSectionLabel || "Does this sound familiar?")}</p>
            <h2 id="yw-familiar-title">${escapeHtml(getSafeCoachTemplateCopy(site.content.problemHeading, `You want clearer ${coachNiche} guidance.`))}</h2>
            <div class="yw-check-grid">
              ${getProblemPoints(site)
                .map((point) => `<div class="yw-check-row"><span aria-hidden="true">&#10003;</span><p>${escapeHtml(point)}</p></div>`)
                .join("")}
            </div>
            ${renderRegisterAction(site, "yw-register-strip", registerLabel)}
          </div>
        </section>

        <section class="yw-sales-section yw-sales-section--mint" aria-labelledby="yw-blueprint-title">
          <div class="yw-sales-shell">
            <p class="yw-kicker">${escapeHtml(site.content.journeySectionLabel || "What you will walk away with")}</p>
            <h2 id="yw-blueprint-title">${escapeHtml(getSafeCoachTemplateCopy(site.content.journeyHeading, "A complete practical coach-support blueprint."))}</h2>
            <div class="yw-blueprint-grid">
              ${getJourneySteps(site)
                .map(
                  (step, index) => `<article>
                    <strong>${String(index + 1).padStart(2, "0")}</strong>
                    <h3>${escapeHtml(step.title)}</h3>
                    <p>${escapeHtml(step.description)}</p>
                  </article>`
                )
                .join("")}
            </div>
            ${renderRegisterAction(site, "yw-register-strip", registerLabel)}
          </div>
        </section>

        <section
          class="yw-sales-section yw-sales-section--dark yw-sales-section--bonus yw-niche-bonus"
          data-yw-ai-adaptive="true"
          data-yw-bonus-count="${bonusSection.items.length}"
          data-yw-bonus-source="universalBonusRegistry"
          data-yw-editable-slots="bonus.heading,bonus.subheading,bonus.items[].title,bonus.items[].description,bonus.ctaText"
          data-yw-locked-fields="bonus.id,bonus.actualAssetUrl,bonus.actualValue,legal.disclaimer,cta.destination"
          data-yw-template-rule="nicheAdaptiveBonusSection"
          id="bonus"
          aria-labelledby="yw-bonus-title"
        >
          <div class="yw-sales-shell yw-bonus-shell">
            <p class="yw-bonus-kicker">Niche-adaptive bonuses</p>
            <h2 id="yw-bonus-title">${escapeHtml(bonusSection.heading)}</h2>
            <p class="yw-section-subcopy">${escapeHtml(bonusSection.subheading)}</p>
            <div class="yw-bonus-grid" data-yw-bonus-grid>
              ${bonusSection.items
                .map(
                  (bonus, index) => `<article class="yw-niche-bonus__card" data-bonus-asset-type="${escapeAttribute(bonus.assetType)}" data-bonus-id="${escapeAttribute(bonus.id)}" data-bonus-locked-asset="true">
                    <div class="yw-bonus-badge">Bonus ${index + 1}</div>
                    <div class="yw-bonus-visual yw-bonus-visual--${escapeAttribute(bonus.assetType)}" aria-hidden="true"></div>
                    <p class="yw-bonus-type">${bonus.assetType === "video" ? "Video Training" : "Digital Guide"}</p>
                    <h3>${escapeHtml(bonus.title)}</h3>
                    <p>${escapeHtml(bonus.description)}</p>
                    <strong data-yw-locked="actualValue">${escapeHtml(bonus.valueLabel)} - Included Free</strong>
                  </article>`
                )
                .join("")}
            </div>
            <p class="yw-bonus-total" data-yw-bonus-total>${escapeHtml(bonusSection.totalValueLabel)}</p>
            <p class="yw-bonus-cta-copy">${escapeHtml(bonusSection.ctaSupportCopy)}</p>
            ${renderRegisterAction(site, "yw-register-strip yw-register-strip--dark yw-bonus-cta", bonusSection.ctaText)}
          </div>
        </section>

        <section class="yw-sales-section yw-sales-section--cream" aria-labelledby="yw-fit-title">
          <div class="yw-sales-shell">
            <h2 id="yw-fit-title">Is this <span>coach support right for you?</span></h2>
            <div class="yw-fit-table" aria-label="Who this coach support is for">
              <div class="yw-fit-col">
                <h3>This IS for you if...</h3>
                <p><span aria-hidden="true">&#10003;</span> You want education-first guidance before taking the next step.</p>
                <p><span aria-hidden="true">&#10003;</span> You are open to practical lifestyle habits and consistency.</p>
                <p><span aria-hidden="true">&#10003;</span> You want to understand the coach's method before registering.</p>
              </div>
              <div class="yw-fit-col yw-fit-col--no">
                <h3>This is NOT for you if...</h3>
                <p><span aria-hidden="true">&#215;</span> You are looking for instant results or guaranteed outcomes.</p>
                <p><span aria-hidden="true">&#215;</span> You need emergency, diagnosis, or treatment advice.</p>
                <p><span aria-hidden="true">&#215;</span> You do not want to take action after learning.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="yw-circle-faq" id="faq" aria-labelledby="yw-faq-title">
          <div class="yw-faq-shell">
            <h2 id="yw-faq-title">${escapeHtml(site.content.faqHeading || "Frequently Asked Questions")}</h2>
            <div class="yw-faq-list">
              ${getFaq(site)
                .map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`)
                .join("")}
            </div>
          </div>
        </section>

        ${renderCanonicalSupportSection(site, support, registerLabel)}
        ${renderCanonicalFooter(site)}
      </div>

      <aside aria-hidden="true" aria-label="Register for free" class="yw-floating-register-cta" data-yw-sticky-register tabindex="-1">
        ${renderRegisterAction(site, "yw-register-button", registerLabel)}
      </aside>
    </main>
    ${renderCanonicalScript(site.slug)}
  </body>
</html>`;
}

function renderCanonicalHeroImageContent(site: PublicCoachSiteRecord) {
  const imageUrl = site.photoUrl || site.logoUrl;

  if (imageUrl) {
    return `<img alt="${escapeAttribute(`${getCanonicalCoachName(site)} profile`)}" decoding="async" src="${escapeAttribute(imageUrl)}" />`;
  }

  return `<span>${escapeHtml(getCanonicalCoachInitials(site))}</span>`;
}

function renderCanonicalStoryVideoContent(site: PublicCoachSiteRecord) {
  const embedVideoUrl = normalizeVideoEmbedUrl(site.videoUrl);
  const uploadedVideoUrl = isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  if (embedVideoUrl) {
    return `<iframe allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture" allowfullscreen src="${escapeAttribute(embedVideoUrl)}" title="${escapeAttribute(`${getCanonicalCoachName(site)} story video`)}"></iframe>`;
  }

  if (uploadedVideoUrl) {
    return `<video controls playsinline preload="metadata" src="${escapeAttribute(uploadedVideoUrl)}" title="${escapeAttribute(`${getCanonicalCoachName(site)} story video`)}"></video>`;
  }

  return `<div class="yw-story-video-placeholder" aria-hidden="true"><span class="yw-story-play"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 6.75L17 12L9 17.25V6.75Z"></path></svg></span></div>`;
}

function renderCanonicalMarquee(coachName: string) {
  return `
    <section class="circle-marquee" aria-label="YW Nutritech Circle marquee" data-yw-circle-marquee data-yw-marquee-brand="YW NUTRITECH CIRCLE" data-yw-marquee-name="${escapeAttribute(coachName)}">
      <div class="circle-marquee__track">
        ${Array.from({ length: 16 })
          .map(
            () => `<span class="circle-marquee__item"><span class="circle-marquee__brand">YW NUTRITECH CIRCLE</span><span class="circle-marquee__star">&#9733;</span><span class="circle-marquee__name">${escapeHtml(coachName)}</span><span class="circle-marquee__star">&#9733;</span></span>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderCanonicalSupportSection(
  site: PublicCoachSiteRecord,
  support: SupportDetails,
  registerLabel: string
) {
  const targetAttribute =
    support.primaryHref.startsWith("mailto:") || support.primaryHref.startsWith("tel:")
      ? ""
      : ` target="_blank" rel="noreferrer"`;
  const trackAttribute = support.whatsappLink ? ` data-track="coach_whatsapp_click"` : "";

  return `
    <section class="yw-sales-section yw-sales-section--mint" id="coach-contact-support">
      <div class="yw-sales-shell">
        <p class="yw-kicker">${escapeHtml(site.content.supportHeading || "Contact Support")}</p>
        <h2>${escapeHtml(getSafeCoachTemplateCopy(site.content.ctaText, `Ready to connect with ${getCanonicalCoachName(site)}?`))}</h2>
        <p class="yw-section-subcopy">${escapeHtml(getSafeCoachTemplateCopy(site.content.trustText, "This page is education-first and does not replace medical advice, diagnosis, or treatment."))}</p>
        ${renderRegisterAction(site, "yw-register-strip", registerLabel)}
        <a class="yw-register-strip"${trackAttribute} href="${escapeAttribute(support.primaryHref)}"${targetAttribute}>${escapeHtml(site.content.supportPrimaryButton || site.content.stickyCtaContactButton || "Contact Support")}</a>
      </div>
    </section>`;
}

function renderCanonicalFooter(site: PublicCoachSiteRecord) {
  return `
    <footer class="yw-brand-footer" data-preview-section="footer">
      <div class="yw-footer-watermark" aria-hidden="true"><span>Y</span><span>W</span><span>N</span></div>
      <div class="yw-footer-content">
        <section class="yw-footer-about" aria-labelledby="yw-footer-title">
          <h2 id="yw-footer-title">About <span>YW Nutritech</span></h2>
          <p>YW Nutritech builds practical wellness education, coach-led support, and nutrition-first guidance for people who want healthier everyday routines.</p>
          <p>Through community learning, simple health-tech tools, and coach referral experiences, YW Nutritech helps coaches connect with people in a clearer, more trusted way.</p>
          <p>We aim to make wellness support more accessible, consistent, and human while keeping every coach visible at the center of the journey.</p>
        </section>
        <div class="yw-footer-stats" aria-label="YW Nutritech community proof">
          <div class="yw-footer-stat"><strong>50K+</strong><span>Community Members</span></div>
          <div class="yw-footer-stat"><strong>1Cr+</strong><span>People Mission</span></div>
          <div class="yw-footer-stat"><strong>YW</strong><span>Coach Network</span></div>
        </div>
        <p class="yw-footer-legal">${escapeHtml(getCanonicalLegalDisclaimer(site))}</p>
        <nav class="yw-footer-legal-links" aria-label="Coach site legal links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/disclaimer">Disclaimer</a>
        </nav>
        <div class="yw-footer-brand">
          <span class="yw-footer-mark" aria-hidden="true"><img alt="" decoding="async" loading="lazy" src="/assets/yw-logo-transparent.png" /></span>
          <span class="yw-footer-brand-text"><strong>YW Nutritech</strong><small>Coach Circle</small></span>
        </div>
      </div>
    </footer>`;
}

function renderCanonicalScript(slug: string) {
  return `
    <script>
      (function () {
        var slug = ${JSON.stringify(slug)};
        var loader = document.getElementById('yw-global-loader');
        function hideLoader() {
          if (!loader) return;
          loader.setAttribute('data-state', 'hidden');
          window.setTimeout(function () {
            if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
          }, 280);
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () { window.setTimeout(hideLoader, 120); }, { once: true });
        } else {
          window.setTimeout(hideLoader, 120);
        }
        window.setTimeout(hideLoader, 1600);

        var root = document.documentElement;
        var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        var progressFrame = 0;
        var pointerFrame = 0;
        var pointerX = 0;
        var pointerY = 0;
        var cta = document.querySelector('.yw-floating-register-cta');
        var trigger = document.querySelector('.circle-marquee');
        var progressBar = document.querySelector('.yw-scroll-progress__bar');
        function clamp(value) { return Math.max(0, Math.min(1, value)); }
        function getScrollY() { return window.scrollY || root.scrollTop || document.body.scrollTop || 0; }
        function updateStickyRegister(scrollTop) {
          if (!cta || !trigger) return;
          var triggerTop = trigger.getBoundingClientRect().top;
          var footer = document.querySelector('.yw-brand-footer');
          var footerTop = footer ? footer.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
          var activationPoint = Math.min(140, window.innerHeight * 0.24);
          var shouldShow = scrollTop > 24 && triggerTop <= activationPoint && footerTop > window.innerHeight * 0.92;
          root.classList.toggle('yw-sticky-register-visible', shouldShow);
          cta.classList.toggle('is-visible', shouldShow);
          cta.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
          cta.tabIndex = shouldShow ? 0 : -1;
        }
        function updateAlliaSectionVars() {
          var hero = document.querySelector('.yw-circle-hero');
          var footer = document.querySelector('.yw-brand-footer');
          if (hero) {
            var heroRect = hero.getBoundingClientRect();
            var travel = Math.max(1, heroRect.height - window.innerHeight * 0.2);
            root.style.setProperty('--yw-hero-progress', clamp(-heroRect.top / travel).toFixed(4));
          }
          if (footer) {
            var footerRect = footer.getBoundingClientRect();
            root.style.setProperty('--yw-footer-progress', clamp((window.innerHeight - footerRect.top) / (window.innerHeight + footerRect.height)).toFixed(4));
          }
        }
        function updateAlliaBackground(scrollTop) {
          var sections = Array.prototype.slice.call(document.querySelectorAll('.yw-circle-hero,.yw-story-section,.yw-sales-section,.yw-circle-faq,.yw-brand-footer')).filter(function (section) {
            return section.offsetHeight > 0;
          });
          if (!sections.length) return;
          var viewportCenter = scrollTop + window.innerHeight / 2;
          var sectionIndex = 0;
          for (var index = 0; index < sections.length; index += 1) {
            var top = sections[index].offsetTop;
            var next = sections[index + 1];
            var bottom = next ? next.offsetTop : top + sections[index].offsetHeight;
            if (viewportCenter >= top && viewportCenter < bottom) {
              sectionIndex = index;
              break;
            }
          }
          var keyframes = [
            ['50%', '50%', '88%', '92%', '#cdf0e8', '#08aaa6', '#153747', '18%', '64%'],
            ['50%', '0%', '112%', '104%', '#cdef63', '#21e6c1', '#d0f5f0', '20%', '66%'],
            ['0%', '50%', '70%', '108%', '#f4f8fa', '#d0f5f0', '#e8f5d6', '15%', '55%'],
            ['50%', '50%', '100%', '100%', '#f4f8fa', '#f4f8fa', '#f4f8fa', '0%', '0%'],
            ['100%', '50%', '112%', '180%', '#d0f5f0', '#d0f5f0', '#e8f5d6', '0%', '0%']
          ][sectionIndex % 5];
          ['--yw-grad-x', '--yw-grad-y', '--yw-grad-size-x', '--yw-grad-size-y', '--yw-color-1', '--yw-color-2', '--yw-color-3', '--yw-stop-1', '--yw-stop-2'].forEach(function (name, index) {
            root.style.setProperty(name, keyframes[index]);
          });
        }
        function updateProgress() {
          progressFrame = 0;
          var scrollTop = getScrollY();
          var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          var progress = clamp(scrollTop / max);
          root.style.setProperty('--yw-scroll-progress', progress.toFixed(4));
          root.style.setProperty('--yw-scroll-y', scrollTop.toFixed(1) + 'px');
          root.classList.toggle('yw-nav-condensed', scrollTop > 36);
          if (progressBar) progressBar.style.transform = 'scaleX(' + progress + ')';
          updateStickyRegister(scrollTop);
          updateAlliaSectionVars();
          updateAlliaBackground(scrollTop);
        }
        function scheduleProgressUpdate() {
          if (progressFrame) return;
          progressFrame = window.requestAnimationFrame(updateProgress);
        }
        function initReveals() {
          var revealTargets = Array.prototype.slice.call(document.querySelectorAll([
            '.circle-marquee',
            '.yw-circle-hero',
            '.yw-story-section',
            '.yw-story-media',
            '.yw-story-copy',
            '.yw-sales-section',
            '.yw-check-grid',
            '.yw-blueprint-grid',
            '.yw-result-cards',
            '.yw-fit-table',
            '.yw-bonus-grid',
            '.yw-circle-faq',
            '.yw-brand-footer',
            '.yw-footer-content',
            '.yw-footer-about',
            '.yw-footer-stats',
            '.yw-footer-brand'
          ].join(',')));
          var effectTargets = Array.prototype.slice.call(document.querySelectorAll([
            '.yw-hero-kicker',
            '.yw-hero-pill',
            '.yw-circle-title',
            '.yw-circle-subtitle',
            '.yw-coach-photo-frame',
            '.yw-coach-card',
            '.yw-details-heading',
            '.yw-audience-label',
            '.yw-detail-card',
            '.yw-register-strip',
            '.yw-register-button',
            '.yw-check-row',
            '.yw-blueprint-grid article',
            '.yw-result-cards article',
            '.yw-bonus-grid article',
            '.yw-fit-col',
            '.yw-circle-faq details',
            '.yw-footer-stat',
            '.yw-footer-legal',
            '.yw-footer-legal-links a'
          ].join(',')));
          revealTargets.forEach(function (target) { target.classList.add('yw-reveal'); });
          effectTargets.forEach(function (target, index) {
            target.classList.add('yw-allia-effect');
            target.style.setProperty('--yw-reveal-delay', Math.min(520, index * 36) + 'ms');
          });
          Array.prototype.slice.call(document.querySelectorAll('.yw-coach-photo-frame,.yw-story-video-card,.yw-footer-brand')).forEach(function (target) {
            target.classList.add('yw-allia-float');
          });
          var allTargets = revealTargets.concat(effectTargets);
          if (!('IntersectionObserver' in window) || (reducedMotion && reducedMotion.matches)) {
            allTargets.forEach(function (target) { target.classList.add('is-visible', 'is-allia-visible'); });
            return;
          }
          var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('is-visible', 'is-allia-visible');
              observer.unobserve(entry.target);
            });
          }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
          allTargets.forEach(function (target) { observer.observe(target); });
        }
        function commitPointer() {
          root.style.setProperty('--yw-pointer-x', pointerX.toFixed(4));
          root.style.setProperty('--yw-pointer-y', pointerY.toFixed(4));
          pointerFrame = 0;
        }
        function updatePointer(event) {
          if (reducedMotion && reducedMotion.matches) return;
          pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
          pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
          if (!pointerFrame) pointerFrame = window.requestAnimationFrame(commitPointer);
        }
        function resetPointer() {
          pointerX = 0;
          pointerY = 0;
          if (!pointerFrame) pointerFrame = window.requestAnimationFrame(commitPointer);
        }
        function getSessionId() {
          try {
            var key = 'yw_analytics_session_id';
            var current = window.sessionStorage.getItem(key);
            if (current) return current;
            var next = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + '-' + String(Math.random()).slice(2);
            window.sessionStorage.setItem(key, next);
            return next;
          } catch (_) {
            return '';
          }
        }
        function track(eventName) {
          try {
            if (!navigator.sendBeacon) return;
            navigator.sendBeacon('/api/coach-events', new Blob([JSON.stringify({
              coachSlug: slug,
              eventName: eventName,
              pagePath: window.location.pathname + window.location.search,
              pageUrl: window.location.href,
              referrer: document.referrer,
              sessionId: getSessionId()
            })], { type: 'application/json' }));
          } catch (_) {}
        }
        initReveals();
        updateProgress();
        window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
        window.addEventListener('resize', scheduleProgressUpdate);
        window.addEventListener('load', scheduleProgressUpdate);
        window.addEventListener('pointermove', updatePointer, { passive: true });
        window.addEventListener('pointerleave', resetPointer, { passive: true });
        track('coach_site_view');
        document.addEventListener('click', function (event) {
          var target = event.target && event.target.closest ? event.target.closest('[data-track]') : null;
          if (target) track(target.getAttribute('data-track'));
        });
      })();
    </script>`;
}

function renderLegacyCoachSiteHtml(site: PublicCoachSiteRecord) {
  const support = getSupportDetails(site);
  const isPaused = false;
  const theme = getCoachTemplateTheme(site.selectedThemeId);
  const themeStyle = createThemeInlineStyle(theme.id);
  const benefitDescriptions = getBenefitDescriptions(site);
  const journeySteps = getJourneySteps(site);
  const benefits = getBenefits(site)
    .map(
      (benefit, index) => `
        <article class="spot-card benefit-card">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(benefit)}</h3>
          <p>${escapeHtml(benefitDescriptions[index] || benefitDescriptions[0] || "")}</p>
        </article>`
    )
    .join("");
  const journey = journeySteps
    .map(
      (step, index) => `
        <article class="spot-card journey-card">
          <small>${String(index + 1).padStart(2, "0")}</small>
          <span>${escapeHtml(step.label)}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.description)}</p>
        </article>`
    )
    .join("");
  const problems = getProblemPoints(site)
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
    <title>${escapeHtml(site.coachName)} | ${escapeHtml(site.content.footerBrandLine || "YW Nutritech Coach Referral")}</title>
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
        min-width: 0;
        background: #fff8ef;
        overflow-x: clip;
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
      html:has([data-coach-site-page="public"]),
      body:has([data-coach-site-page="public"]) {
        overflow-x: clip;
      }
      ${renderInlineYWLoaderCss()}
      .page {
        min-height: 100svh;
        position: relative;
        isolation: isolate;
        overflow-x: clip;
        background: var(--template-bg);
        color: var(--template-ink);
        font-family: var(--template-body-font);
        padding: 0 0 calc(8.75rem + env(safe-area-inset-bottom));
        scroll-padding-top: 6rem;
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
        top: -18vh;
        bottom: -18vh;
        left: 50%;
        width: 100vw;
        z-index: 0;
        pointer-events: none;
        transform: translate3d(-50%, 0, 0) scaleX(1.36);
        transform-origin: center;
        background-image:
          repeating-linear-gradient(100deg, rgb(255 248 239 / 0.38) 0%, rgb(255 248 239 / 0.38) 7%, transparent 10%, transparent 12%, rgb(255 248 239 / 0.38) 16%),
          repeating-linear-gradient(100deg, rgb(216 181 111 / 0.2) 10%, rgb(183 93 120 / 0.22) 15%, rgb(200 184 255 / 0.24) 20%, rgb(242 185 166 / 0.2) 25%, rgb(70 191 192 / 0.14) 30%);
        background-position: 50% 50%, 50% 50%;
        background-size: 300% 190%, 300% 190%;
        filter: blur(8px) saturate(1.08);
        -webkit-mask-image:
          radial-gradient(ellipse at 46% 20%, black 0 34%, transparent 70%),
          linear-gradient(180deg, black 0, rgb(0 0 0 / 0.62) 64%, transparent 100%);
        mask-image:
          radial-gradient(ellipse at 46% 20%, black 0 34%, transparent 70%),
          linear-gradient(180deg, black 0, rgb(0 0 0 / 0.62) 64%, transparent 100%);
        mix-blend-mode: soft-light;
        opacity: 0.6;
        animation: aurora 90s linear infinite;
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
        margin-top: clamp(0.6rem, 2vw, 1.1rem);
        padding: 0.7rem 1rem;
        backdrop-filter: blur(14px) saturate(1.18);
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
      .sticky-coach-register,
      .sticky-coach-contact,
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
      .sticky-coach-register,
      .register-section a {
        border: 1px solid rgb(216 181 111 / 0.44);
        background: var(--template-cta);
        color: var(--template-cta-text);
        box-shadow: 0 1rem 2.5rem var(--template-glow);
        padding: 0 1rem;
      }
      .button.secondary,
      .sticky-coach-contact,
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
      .sticky-coach-cta {
        position: fixed;
        right: max(0.85rem, env(safe-area-inset-right));
        bottom: max(0.85rem, env(safe-area-inset-bottom));
        left: max(0.85rem, env(safe-area-inset-left));
        z-index: 32;
        box-sizing: border-box;
        width: auto;
        max-width: 48rem;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.9rem;
        align-items: center;
        margin-inline: auto;
        border: 1px solid var(--template-card-border);
        border-radius: calc(var(--template-radius) + 8px);
        background:
          linear-gradient(135deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.48)),
          var(--template-card-strong);
        box-shadow:
          0 1.2rem 4rem rgb(16 23 41 / 0.18),
          inset 0 1px 0 rgb(255 255 255 / 0.62);
        color: var(--template-ink);
        padding: 0.72rem;
        backdrop-filter: blur(18px) saturate(1.2);
        -webkit-backdrop-filter: blur(18px) saturate(1.2);
        transform: translate3d(0, 0, 0);
        backface-visibility: hidden;
        contain: layout paint;
        will-change: transform;
      }
      .sticky-coach-context {
        min-width: 0;
        display: grid;
        gap: 0.12rem;
      }
      .sticky-coach-context span {
        color: var(--template-accent);
        font-size: 0.68rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .sticky-coach-context strong {
        color: var(--template-ink);
        font-family: var(--template-heading-font);
        font-size: clamp(0.98rem, 2.2vw, 1.2rem);
        line-height: 1.1;
        overflow-wrap: anywhere;
      }
      .sticky-coach-context small {
        color: var(--template-muted);
        font-size: 0.78rem;
        font-weight: 760;
        line-height: 1.25;
      }
      .sticky-coach-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
      }
      .sticky-coach-register,
      .sticky-coach-contact {
        min-height: 2.75rem;
        white-space: nowrap;
        padding: 0 1.05rem;
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
        box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.14);
      }
      .hero-media {
        aspect-ratio: 4 / 5;
        animation: float-card 8s ease-in-out infinite;
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
        backdrop-filter: blur(10px);
        box-shadow: 0 0.9rem 2rem rgb(0 0 0 / 0.16);
        text-shadow: 0 1px 1px rgb(0 0 0 / 0.28);
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
        background: linear-gradient(135deg, rgb(8 11 23 / 0.74), rgb(255 255 255 / 0.1));
        color: var(--template-inverted-ink);
        padding: 0.95rem;
        backdrop-filter: blur(10px);
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
        background: var(--template-card-strong);
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
        backdrop-filter: blur(10px);
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
        background: rgb(255 255 255 / 0.1);
        color: var(--template-inverted-ink);
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
      .section,
      .support,
      .footer {
        content-visibility: auto;
        contain-intrinsic-size: auto 44rem;
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
      @media (min-width: 761px) and (max-width: 1080px) {
        .hero {
          min-height: min(650px, calc(100svh - 4rem));
          grid-template-columns: minmax(0, 0.98fr) minmax(16.5rem, 0.72fr);
          gap: 1.2rem;
          padding: clamp(1rem, 2.6vw, 2rem);
        }
        .hero h1 {
          max-width: 13ch;
          font-size: clamp(2.05rem, 5.2vw, 3.8rem);
        }
        .lead {
          font-size: 0.96rem;
          line-height: 1.48;
        }
        .brand-assurance {
          margin-top: 0.85rem;
        }
        .actions {
          margin-top: 0.9rem;
        }
        .media-stage {
          width: min(100%, 21rem);
          justify-self: center;
        }
        .hero-metrics {
          margin-top: 0.75rem;
        }
      }
      @media (max-width: 760px), (max-height: 520px) and (orientation: landscape) {
        .nav {
          position: fixed;
          top: calc(1rem + env(safe-area-inset-top));
          left: 1rem;
          right: 1rem;
          z-index: 40;
          width: auto;
          max-width: 84rem;
          isolation: isolate;
          border-color: var(--template-card-border);
          background: var(--template-nav-mobile, var(--template-nav));
          background-color: transparent;
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.42), 0 0 0 1px var(--template-card-border), var(--template-shadow);
          color: var(--template-inverted-ink);
          margin-top: 0;
          opacity: 1;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          animation: none;
          -webkit-backdrop-filter: blur(22px) saturate(1.24);
          backdrop-filter: blur(22px) saturate(1.24);
          will-change: transform;
        }
        .nav::before {
          content: none;
        }
        .nav::after {
          content: none;
        }
        .nav > * {
          position: relative;
          z-index: 1;
        }
      }
      @media (max-width: 760px) {
        .page {
          padding-top: calc(5.35rem + env(safe-area-inset-top));
          padding-bottom: calc(10.5rem + env(safe-area-inset-bottom));
          scroll-padding-top: calc(5.4rem + env(safe-area-inset-top));
        }
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
          min-height: 3.25rem;
          grid-template-columns: minmax(0, 1fr) auto;
          padding: 0.45rem 0.55rem;
          width: auto;
        }
        .nav-links {
          display: none;
        }
        .button.nav-cta {
          min-width: 4.8rem;
          min-height: 2.25rem;
          padding-inline: 0.65rem;
          font-size: 0.8rem;
        }
        .brand small {
          font-size: 0.58rem;
          letter-spacing: 0.06em;
        }
        .hero {
          margin-top: 0.55rem;
          gap: 0.85rem;
          padding: 0.8rem;
        }
        .aurora {
          opacity: 0.28;
          animation: none;
          filter: blur(5px) saturate(1);
        }
        .page::before {
          display: none;
        }
        .trust-row span,
        .brand-assurance,
        .signal-panel,
        .media-caption,
        .section,
        .spot-card,
        .support-card,
        .faq-card {
          backdrop-filter: none;
        }
        .trust-row {
          gap: 0.3rem;
          margin-bottom: 0.5rem;
        }
        .trust-row span {
          padding: 0.3rem 0.42rem;
          font-size: 0.62rem;
        }
        .trust-row span:nth-child(2) {
          display: none;
        }
        .kicker {
          margin-bottom: 0.35rem;
          font-size: 0.64rem;
        }
        .hero h1 {
          max-width: 100%;
          font-size: clamp(1.55rem, 7.8vw, 2.05rem);
          line-height: 1.04;
        }
        .lead {
          display: -webkit-box;
          margin: 0.48rem 0 0;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          font-size: 0.84rem;
          line-height: 1.38;
        }
        .brand-assurance,
        .signal-panel {
          display: none;
        }
        .actions {
          margin-top: 0.65rem;
        }
        .actions .button {
          min-height: 2.35rem;
          font-size: 0.84rem;
          padding-inline: 0.85rem;
        }
        .media-stage {
          width: min(100%, 16.5rem);
          justify-self: center;
          animation: none;
        }
        .hero-media {
          width: 100%;
          display: block;
          aspect-ratio: auto;
          overflow: visible;
        }
        .hero-media img,
        .hero-media video,
        .hero-media iframe {
          width: 100%;
          height: auto;
          aspect-ratio: 4 / 3.55;
          overflow: hidden;
          border-radius: var(--template-radius);
          object-fit: cover;
        }
        .media-caption {
          position: static;
          margin-top: 0.45rem;
          padding: 0.62rem 0.68rem;
        }
        .media-caption span {
          font-size: 0.62rem;
        }
        .media-caption strong,
        .media-caption small {
          line-height: 1.15;
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
          font-size: clamp(1.45rem, 7vw, 2rem);
          line-height: 1.05;
        }
        .sticky-coach-cta {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.6rem;
          border-radius: calc(var(--template-radius) + 6px);
          min-height: 4.7rem;
          padding: 0.56rem;
        }
        .sticky-coach-context {
          gap: 0.08rem;
        }
        .sticky-coach-context span {
          font-size: 0.6rem;
        }
        .sticky-coach-context strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          font-size: clamp(0.82rem, 2.8vw, 0.92rem);
          line-height: 1.06;
          overflow: hidden;
        }
        .sticky-coach-context small {
          display: none;
        }
        .sticky-coach-actions {
          display: inline-flex;
          gap: 0.45rem;
          justify-content: flex-end;
        }
        .sticky-coach-register,
        .sticky-coach-contact {
          min-height: 2.65rem;
          border-radius: var(--template-radius);
          font-size: 0.84rem;
          padding-inline: 0.85rem;
        }
      }
      @media (max-width: 430px) {
        .page {
          padding-bottom: calc(11rem + env(safe-area-inset-bottom));
        }
        .support-actions {
          display: grid;
        }
        .button,
        .sticky-register,
        .support-actions a {
          width: 100%;
        }
        .nav .button,
        .actions .button {
          width: auto;
        }
        .sticky-register {
          right: 0.55rem;
          bottom: 0.55rem;
          left: auto;
          width: auto;
          min-width: 8.4rem;
          min-height: 2.45rem;
          font-size: 0.84rem;
          padding-inline: 0.85rem;
        }
        .sticky-coach-cta {
          right: max(0.55rem, env(safe-area-inset-right));
          bottom: max(0.55rem, env(safe-area-inset-bottom));
          left: max(0.55rem, env(safe-area-inset-left));
          width: auto;
          min-height: 4.7rem;
          padding: 0.52rem;
        }
        .sticky-coach-actions {
          display: inline-flex;
          min-width: max-content;
        }
        .sticky-coach-contact {
          display: none;
        }
        .sticky-coach-register {
          min-width: 7.1rem;
          min-height: 2.45rem;
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .support-identity {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 360px) {
        .nav,
        .hero,
        .hero-metrics,
        .section,
        .support,
        .footer,
        .unavailable-panel {
          width: min(calc(100% - 0.7rem), 84rem);
        }
        .brand strong {
          font-size: 0.82rem;
        }
        .brand small {
          font-size: 0.54rem;
        }
        .nav {
          left: 0.85rem;
          right: 0.85rem;
          width: auto;
        }
        .button.nav-cta {
          min-width: 4.4rem;
          padding-inline: 0.52rem;
        }
        .hero {
          padding: 0.68rem;
        }
        .hero h1 {
          font-size: clamp(1.42rem, 7.2vw, 1.72rem);
        }
        .lead {
          -webkit-line-clamp: 2;
          font-size: 0.8rem;
        }
        .media-stage {
          width: min(100%, 14.6rem);
        }
      }
      @media (max-height: 520px) and (orientation: landscape) {
        .page {
          padding-top: calc(4.2rem + env(safe-area-inset-top));
          padding-bottom: calc(6rem + env(safe-area-inset-bottom));
        }
        .nav {
          top: calc(0.7rem + env(safe-area-inset-top));
          left: 1rem;
          right: 1rem;
          min-height: 3rem;
          padding-block: 0.4rem;
        }
        .hero {
          grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.72fr);
          gap: 0.8rem;
          align-items: center;
        }
        .hero h1 {
          font-size: clamp(1.45rem, 4vw, 2rem);
        }
        .lead {
          -webkit-line-clamp: 2;
        }
        .media-stage {
          width: min(100%, 15rem);
        }
        .sticky-register {
          display: none;
        }
        .sticky-coach-cta {
          bottom: max(0.45rem, env(safe-area-inset-bottom));
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.45rem;
          min-height: 4.55rem;
          padding: 0.52rem;
        }
        .sticky-coach-context small {
          display: none;
        }
        .sticky-coach-context strong {
          font-size: 0.78rem;
          line-height: 1.04;
        }
        .sticky-coach-actions {
          display: inline-flex;
        }
        .sticky-coach-register,
        .sticky-coach-contact {
          min-height: 2.35rem;
          font-size: 0.78rem;
          padding-inline: 0.68rem;
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
      @keyframes yw-loader-orbit {
        to { transform: rotate(360deg); }
      }
      @keyframes yw-loader-auto-hide {
        to {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
      }
      @keyframes view-rise {
        from { opacity: 0.2; transform: translate3d(0, 1.4rem, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .yw-global-loader {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        .yw-global-loader,
        .yw-global-loader * {
          animation: none !important;
          transition-duration: 80ms !important;
        }
      }
    </style>
  </head>
  <body>
    ${renderInlineYWLoader()}
    <main
      class="page"
      data-coach-site-page="public"
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
            <span>${escapeHtml(site.content.brandBadge)}</span>
            <span>${escapeHtml(site.content.brandEyebrow)}</span>
          </div>
          <p class="kicker">${escapeHtml(site.niche)}</p>
          <h1>${escapeHtml(site.content.heroHeadline)}</h1>
          <p class="lead">${escapeHtml(site.content.subheadline)}</p>
          <div class="brand-assurance">
            <span>${escapeHtml(site.content.heroTrustLine)}</span>
            <strong>${escapeHtml(site.content.heroMicroTrustText)}</strong>
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
          <span>${escapeHtml(site.content.introSectionLabel)}</span>
          <h2>${escapeHtml(site.content.introHeading)}</h2>
        </div>
        <div class="intro-grid">
          <article class="spot-card story-card">
            <span>${escapeHtml(site.content.coachIntroLabel)}</span>
            <h3>${escapeHtml(site.coachName)}</h3>
            <p>${escapeHtml(site.content.coachIntro)}</p>
          </article>
          <article class="spot-card story-card">
            <span>${escapeHtml(site.content.visionLabel)}</span>
            <h3>${escapeHtml(site.location || "Yours Wellness Coach")}</h3>
            <p>${escapeHtml(site.content.visionText || site.vision)}</p>
          </article>
        </div>
      </section>

      <section class="section problem-section">
        <div class="problem-copy">
          <span>${escapeHtml(site.content.problemSectionLabel)}</span>
          <h2>${escapeHtml(site.content.problemHeading)}</h2>
          <p>${escapeHtml(site.content.trustText)}</p>
        </div>
        <div class="problem-list">${problems}</div>
      </section>

      <section class="section journey-section" id="journey">
        <div class="section-head">
          <span>${escapeHtml(site.content.journeySectionLabel)}</span>
          <h2>${escapeHtml(site.content.journeyHeading)}</h2>
        </div>
        <div class="journey-grid">${journey}</div>
      </section>

      <section class="section benefits-section" id="benefits">
        <div class="section-head">
          <span>${escapeHtml(site.content.benefitsSectionLabel)}</span>
          <h2>${escapeHtml(site.content.benefitsHeading)}</h2>
        </div>
        <div class="benefit-grid">${benefits}</div>
      </section>

      <section class="section register-section" id="register">
        <div>
          <span>${escapeHtml(site.content.ctaSectionLabel)}</span>
          <h2>${escapeHtml(site.content.ctaText || "Ready to take the first step with this coach?")}</h2>
          <p>${escapeHtml(site.content.trustText)}</p>
        </div>
        ${renderRegisterAction(site, "button primary", site.registerButtonText || "Register Now")}
      </section>

      <section class="section faq-section">
        <div class="section-head">
          <span>${escapeHtml(site.content.faqSectionLabel)}</span>
          <h2>${escapeHtml(site.content.faqHeading)}</h2>
        </div>
        <div class="faq-list">${faq}</div>
      </section>

      ${renderSupportHtml(site, support)}
      ${renderFooterHtml(site)}
      ${renderStickyRegisterAction(site)}`
      }
    </main>
    <script>
      (function () {
        var loader = document.getElementById('yw-global-loader');
        var loaderHideStarted = false;
        function hideGlobalLoader() {
          if (loaderHideStarted) return;
          loaderHideStarted = true;
          if (!loader) return;
          window.setTimeout(function () {
            loader.setAttribute('data-state', 'hidden');
            window.setTimeout(function () {
              if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
            }, 280);
          }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 520);
        }
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          window.setTimeout(hideGlobalLoader, 120);
        } else {
          document.addEventListener('DOMContentLoaded', function () {
            window.setTimeout(hideGlobalLoader, 120);
          }, { once: true });
          window.addEventListener('load', hideGlobalLoader, { once: true });
        }
        window.setTimeout(hideGlobalLoader, 1600);
        var slug = ${JSON.stringify(site.slug)};
        var root = document.documentElement;
        var progressFrame = 0;
        var pointerFrame = 0;
        var pointerEvent = null;
        var pointerSpotlightQuery = window.matchMedia('(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)');
        var allowPointerSpotlight = false;
        function updateProgress() {
          var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          var progress = Math.min(1, Math.max(0, window.scrollY / max));
          root.style.setProperty('--scroll-progress', progress.toFixed(4));
          progressFrame = 0;
        }
        function scheduleProgressUpdate() {
          if (progressFrame) return;
          progressFrame = window.requestAnimationFrame(updateProgress);
        }
        function getSessionId() {
          try {
            var key = 'yw_analytics_session_id';
            var current = window.sessionStorage.getItem(key);
            if (current) return current;
            var next = window.crypto && window.crypto.randomUUID
              ? window.crypto.randomUUID()
              : String(Date.now()) + '-' + String(Math.random()).slice(2);
            window.sessionStorage.setItem(key, next);
            return next;
          } catch (_) {
            return '';
          }
        }
        function track(eventName) {
          try {
            if (!navigator.sendBeacon) return;
            navigator.sendBeacon('/api/coach-events', new Blob([JSON.stringify({
              coachSlug: slug,
              eventName: eventName,
              pagePath: window.location.pathname + window.location.search,
              pageUrl: window.location.href,
              referrer: document.referrer,
              sessionId: getSessionId()
            })], { type: 'application/json' }));
          } catch (_) {}
        }
        updateProgress();
        window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
        track('coach_site_view');
        function handlePointerMove(event) {
          if (!allowPointerSpotlight) return;
          pointerEvent = event;
          if (pointerFrame) return;
          pointerFrame = window.requestAnimationFrame(function () {
            pointerFrame = 0;
            var currentEvent = pointerEvent;
            if (!currentEvent) return;
            var card = currentEvent.target && currentEvent.target.closest ? currentEvent.target.closest('.spot-card, .support-card') : null;
            if (!card) return;
            var rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', (currentEvent.clientX - rect.left) + 'px');
            card.style.setProperty('--mouse-y', (currentEvent.clientY - rect.top) + 'px');
          });
        }
        function syncPointerSpotlight() {
          var nextAllowed = !pointerSpotlightQuery.matches;
          if (nextAllowed === allowPointerSpotlight) return;
          allowPointerSpotlight = nextAllowed;
          if (allowPointerSpotlight) {
            document.addEventListener('pointermove', handlePointerMove, { passive: true });
            return;
          }
          document.removeEventListener('pointermove', handlePointerMove);
          pointerEvent = null;
          if (pointerFrame) {
            window.cancelAnimationFrame(pointerFrame);
            pointerFrame = 0;
          }
        }
        syncPointerSpotlight();
        if (pointerSpotlightQuery.addEventListener) {
          pointerSpotlightQuery.addEventListener('change', syncPointerSpotlight);
        } else if (pointerSpotlightQuery.addListener) {
          pointerSpotlightQuery.addListener(syncPointerSpotlight);
        }
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
  const primarySupportLabel = site.content.supportPrimaryButton || "Contact Support";
  return `
    <section class="support" id="coach-contact-support">
      <article class="support-card">
        ${renderSupportBody(site, support)}
        ${
          compact
            ? `<div class="support-actions"><a href="${escapeAttribute(support.primaryHref)}">${escapeHtml(primarySupportLabel)}</a><a href="/">Go Back Home</a></div>`
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
        <p class="kicker">${escapeHtml(site?.content.supportHeading || "Contact Support")}</p>
        <h2>${escapeHtml(support.name)}</h2>
        <p>${escapeHtml(support.text)}</p>
      </div>
    </div>
    <div class="support-grid">
      ${support.phone ? `<a href="tel:${escapeAttribute(support.phone.replace(/[^\\d+]/g, ""))}"><span>${escapeHtml(site?.content.supportPhoneLabel || "Phone")}</span><strong>${escapeHtml(support.phone)}</strong></a>` : ""}
      ${support.whatsappLink ? `<a data-track="coach_whatsapp_click" href="${escapeAttribute(support.whatsappLink)}" rel="noreferrer" target="_blank"><span>${escapeHtml(site?.content.supportWhatsappLabel || "WhatsApp")}</span><strong>${escapeHtml(site?.content.supportWhatsappButton || "Message coach")}</strong></a>` : ""}
      ${support.email ? `<a href="${escapeAttribute(support.emailHref)}"><span>${escapeHtml(site?.content.supportEmailLabel || "Email")}</span><strong>${escapeHtml(support.email)}</strong></a>` : `<div class="pending"><span>Support</span><strong>Support contact will be updated soon.</strong></div>`}
    </div>
    <p class="privacy">${escapeHtml(site?.content.supportPrivacyNote || "Contact details shown here are public support details, not admin-only data.")} Reference: ${escapeHtml(referenceId)}</p>`;
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
      body{min-width:0;min-height:100vh;display:grid;place-items:center;margin:0;overflow-x:hidden;background:radial-gradient(circle at 14% 10%,rgb(255 211 232/.7),transparent 25rem),radial-gradient(circle at 88% 18%,rgb(196 181 253/.42),transparent 25rem),linear-gradient(135deg,#fffaf7 0%,#fff7fb 48%,#f9f7ff 100%);color:#201628;font-family:"Segoe UI",ui-sans-serif,system-ui,sans-serif;padding:clamp(1rem,4vw,3rem)}
      ${renderInlineYWLoaderCss()}
      main{width:min(100%,60rem);overflow:hidden;border:1px solid rgb(255 255 255/.78);border-radius:1.35rem;background:linear-gradient(145deg,rgb(255 255 255/.86),rgb(255 245 250/.72));box-shadow:0 24px 80px rgb(76 43 70/.16),inset 0 1px 0 rgb(255 255 255/.92)}
      header,.content{padding:clamp(1rem,4vw,2rem)}
      header{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid rgb(222 190 208/.62)}
      .brand{display:inline-flex;align-items:center;gap:.75rem;color:inherit;font-weight:900;text-decoration:none}.brand img{width:2.6rem;height:2.6rem;object-fit:contain}.brand span{display:grid}.brand small{color:#8d637c;font-size:.76rem;font-weight:800}
      .error-code{min-height:2.5rem;display:inline-flex;align-items:center;gap:.45rem;border:1px solid rgb(189 143 178/.32);border-radius:999px;background:rgb(255 255 255/.64);color:#8f164f;cursor:pointer;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84rem;font-weight:900;padding:.48rem .72rem}.error-code span{color:#6c5165;font-family:"Segoe UI",ui-sans-serif,system-ui,sans-serif;font-size:.72rem}
      .content{display:grid;grid-template-columns:minmax(0,1fr) minmax(18rem,.78fr);gap:clamp(1rem,4vw,2rem)}
      h1{margin:0;color:#1c1726;font-family:Georgia,Cambria,"Times New Roman",serif;font-size:clamp(2.2rem,6vw,4.25rem);line-height:.98}p{color:#675466;font-size:clamp(1rem,2vw,1.12rem);font-weight:650;line-height:1.65}.kicker{color:#9b2f66;font-size:.76rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
      .support-card{display:grid;gap:1rem;border:1px solid rgb(235 201 219/.78);border-radius:1.1rem;background:linear-gradient(145deg,rgb(255 255 255/.9),rgb(255 240 247/.72));padding:1rem}.support-identity{display:grid;grid-template-columns:3.6rem minmax(0,1fr);gap:.8rem;align-items:center}.avatar{width:3.6rem;height:3.6rem;display:grid;place-items:center;overflow:hidden;border-radius:999px;background:linear-gradient(135deg,#9f174d,#a855f7);color:#fff;font-weight:950}.avatar img{width:100%;height:100%;object-fit:cover}
      .support-grid{display:grid;gap:.65rem}.support-grid a,.pending{display:grid;gap:.22rem;border:1px solid rgb(242 201 218/.72);border-radius:.85rem;background:rgb(255 255 255/.68);color:inherit;padding:.78rem .85rem;text-decoration:none}.support-grid span{color:#8b6078;font-size:.75rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .support-actions{display:flex;flex-wrap:wrap;gap:.7rem}.support-actions a{min-height:2.9rem;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgb(242 201 218/.78);border-radius:999px;padding:0 1rem;color:#251822;font-weight:900;text-decoration:none}.support-actions a:first-child{background:linear-gradient(135deg,#251822,#9f174d 54%,#a855f7);color:#fff}
      @keyframes yw-loader-orbit{to{transform:rotate(360deg)}}@keyframes yw-loader-auto-hide{to{opacity:0;visibility:hidden;pointer-events:none}}
      @media(prefers-reduced-motion:reduce){.yw-global-loader{opacity:0!important;visibility:hidden!important;pointer-events:none!important}.yw-global-loader,.yw-global-loader *{animation:none!important;transition-duration:80ms!important}}
      @media(max-width:720px){body{padding:.75rem}main{min-height:calc(100svh - 1.5rem);display:grid;align-content:center;border-radius:1rem}header{align-items:flex-start;flex-direction:column}.content{grid-template-columns:1fr}.support-actions a{width:100%}}
    </style>
  </head>
  <body>
    ${renderInlineYWLoader()}
    <main>
      <header>
        <a class="brand" href="/"><img alt="YW Nutritech" src="/images/yw-nutritech-logo.png" /><span><strong>YW Nutritech</strong><small>Support fallback</small></span></a>
        <button class="error-code" data-error-code="${escapeAttribute(errorCode)}" type="button">Error Code: ${escapeHtml(errorCode)} <span>Copy</span></button>
      </header>
      <section class="content">
        <div><p class="kicker">Contact Support</p><h1>Something went wrong</h1><p>${escapeHtml(message)}</p></div>
        <aside class="support-card">
          ${renderSupportBody(site, support, referenceId)}
          <div class="support-actions"><a href="${escapeAttribute(support.primaryHref)}">Contact Support</a><a href="/">Go Back Home</a></div>
        </aside>
      </section>
    </main>
    <script>
      (function () {
        var loader = document.getElementById('yw-global-loader');
        var loaderHideStarted = false;
        function hideGlobalLoader() {
          if (loaderHideStarted) return;
          loaderHideStarted = true;
          if (!loader) return;
          window.setTimeout(function () {
            loader.setAttribute('data-state', 'hidden');
            window.setTimeout(function () {
              if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
            }, 280);
          }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 520);
        }
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          window.setTimeout(hideGlobalLoader, 120);
        } else {
          document.addEventListener('DOMContentLoaded', function () {
            window.setTimeout(hideGlobalLoader, 120);
          }, { once: true });
          window.addEventListener('load', hideGlobalLoader, { once: true });
        }
        window.setTimeout(hideGlobalLoader, 1600);
        var button = document.querySelector('.error-code');
        if (!button) return;
        button.addEventListener('click', function () {
          var code = button.getAttribute('data-error-code') || '';
          if (!code || !navigator.clipboard) return;
          navigator.clipboard.writeText(code).then(function () {
            var label = button.querySelector('span');
            if (label) label.textContent = 'Copied';
          }).catch(function () {});
        });
      })();
    </script>
  </body>
</html>`;
}

function renderFooterHtml(site: PublicCoachSiteRecord) {
  return `
    <footer class="footer">
      <div>
        <span>${escapeHtml(site.content.footerBrandLine)}</span>
        <h2>${escapeHtml(site.content.footerHeadline)}</h2>
        <p><strong>Copyright 2026 | Yours Wellness Center. All rights reserved.</strong></p>
        <p>${escapeHtml(site.content.footerText)}</p>
        <p>NOT FACEBOOK: This site is not part of Facebook or Meta Platforms, Inc. It is not endorsed by Facebook in any way. Facebook is a trademark of Meta Platforms, Inc.</p>
      </div>
      <div class="footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms &amp; Conditions</a>
        <a href="/disclaimer">Disclaimer</a>
      </div>
    </footer>`;
}

function renderStickyRegisterAction(site: PublicCoachSiteRecord) {
  const support = getSupportDetails(site);
  const hasCoachContact = support.name !== DEFAULT_SUPPORT_NAME;
  const stickyLabel = site.content.stickyCtaLabel || "Free guest registration";
  const stickyHeading =
    site.content.stickyCtaHeading || `Ready to connect with Coach ${site.coachName}?`;
  const stickyContext =
    site.content.stickyCtaContext || `${site.niche || "Coach referral"} through YW Nutritech`;

  return `
    <aside class="sticky-coach-cta" aria-label="Coach registration" data-preview-section="sticky-cta">
      <div class="sticky-coach-context">
        <span>${escapeHtml(stickyLabel)}</span>
        <strong>${escapeHtml(stickyHeading)}</strong>
        <small>${escapeHtml(stickyContext)}</small>
      </div>
      <div class="sticky-coach-actions">
        ${renderRegisterAction(site, "button primary sticky-coach-register", site.registerButtonText || "Register Now")}
        ${hasCoachContact ? renderStickyCoachContactAction(site, support) : ""}
      </div>
    </aside>`;
}

function renderStickyCoachContactAction(site: PublicCoachSiteRecord, support: SupportDetails) {
  const trackAttribute = support.whatsappLink ? ` data-track="coach_whatsapp_click"` : "";
  const targetAttribute =
    support.primaryHref.startsWith("mailto:") || support.primaryHref.startsWith("tel:")
      ? ""
      : ` target="_blank" rel="noreferrer"`;
  const label = site.content.stickyCtaContactButton || "Contact Coach";

  return `<a class="button secondary sticky-coach-contact"${trackAttribute} href="${escapeAttribute(support.primaryHref)}"${targetAttribute}>${escapeHtml(label)}</a>`;
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
        <div class="media-caption"><span>${escapeHtml(site.content.heroMediaLabel)}</span><strong>${escapeHtml(site.coachName)}</strong><small>${escapeHtml(site.niche)}</small></div>
      </div>
    </div>`;
}

function renderHeroMediaContent(site: PublicCoachSiteRecord) {
  if (site.heroMediaType === "none") return "";

  const imageUrl = site.heroMediaType === "image" ? site.photoUrl || site.logoUrl : "";
  const embedVideoUrl = site.heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const uploadedVideoUrl =
    site.heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  if (embedVideoUrl) {
    return `<iframe allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture" allowfullscreen src="${escapeAttribute(embedVideoUrl)}" title="${escapeAttribute(`${site.coachName} hero video`)}"></iframe>`;
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

function getBenefitDescriptions(site: PublicCoachSiteRecord) {
  const descriptions = site.content.benefitDescriptions.filter(Boolean);

  return descriptions.length > 0
    ? descriptions
    : getBenefits(site).map(
        () => "Coach-led education designed to make the next step calmer and clearer."
      );
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

function getJourneySteps(site: PublicCoachSiteRecord) {
  return site.content.journeySteps.length > 0
    ? site.content.journeySteps
    : [
        {
          description:
            "Guests understand the coach story, niche, mission, and guidance style.",
          label: "Profile",
          title: `Meet ${site.coachName || "the coach"}`
        },
        {
          description: "The page explains the coach lens in a clear, trustworthy tone.",
          label: "Focus",
          title: `See the ${site.niche || "wellness"} focus`
        },
        {
          description:
            "The CTA sends visitors to the coach registration form when configured.",
          label: "Action",
          title: "Open registration"
        }
      ];
}

function getProblemPoints(site: PublicCoachSiteRecord) {
  const points = site.content.problemPoints.filter(Boolean);

  return points.length > 0 ? points : createProblemPoints(site);
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

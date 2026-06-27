import type { D1Database } from "@cloudflare/workers-types";
import {
  type PublicCoachSiteRecord,
  getPublicCoachSiteBySlug,
  normalizeCoachSlug
} from "../../lib/admin-coach-sites";
import {
  getCanonicalCoachSectionCopy,
  getCanonicalCoachInitials,
  getCanonicalCoachName,
  getCanonicalCoachNiche,
  getCanonicalHeroPackage,
  getCanonicalLegalDisclaimer,
  getCanonicalRegisterLabel,
  getCanonicalCoachNavbarSections,
  getSmartBonusVisualCssType,
  getSmartBonusVisualMark,
  getNicheAdaptiveBonusSection,
  type CanonicalHeroInfoCardKind,
  type NicheAdaptiveBonusItem
} from "../../lib/coach-canonical-template";
import {
  getCoachTemplateTheme,
  getTemplateBackgroundConfig,
  type CoachTemplateBackgroundType
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
  return renderCanonicalCoachSiteHtml(site);
}

function serializeCssVars(cssVars: Record<string, string>) {
  return Object.entries(cssVars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

function getStaticTemplateBackgroundVariant(
  backgroundType: CoachTemplateBackgroundType,
  forceStatic: boolean
) {
  if (forceStatic) return "static";
  if (backgroundType === "aurora") return "aurora";
  if (backgroundType === "grid-glow") return "grid-glow";
  if (backgroundType === "light-rays") return "light-rays";
  if (backgroundType === "liquid-glass") return "liquid-glass";
  if (backgroundType === "particle-field") return "particles";
  if (backgroundType === "prism") return "prism";
  if (backgroundType === "spotlight") return "spotlight";
  if (
    backgroundType === "none" ||
    backgroundType === "noise-texture" ||
    backgroundType === "static-gradient"
  ) {
    return "static";
  }
  return "mesh";
}

function renderCanonicalCoachSiteHtml(site: PublicCoachSiteRecord) {
  const coachName = getCanonicalCoachName(site);
  const coachNiche = getCanonicalCoachNiche(site);
  const heroPackage = getCanonicalHeroPackage(site);
  const bonusSection = getNicheAdaptiveBonusSection(site);
  const registerLabel = getCanonicalRegisterLabel(site);
  const sectionCopy = getCanonicalCoachSectionCopy(site);
  const selectedTheme = getCoachTemplateTheme(site.selectedThemeId);
  const selectedThemeStyle = serializeCssVars(selectedTheme.cssVars);
  const backgroundConfig = getTemplateBackgroundConfig(selectedTheme.id);
  const selectedThemeBackgroundVariant = getStaticTemplateBackgroundVariant(
    backgroundConfig.type,
    backgroundConfig.performanceMode === "disabled"
  );
  const title = `${coachName} | YW Nutritech Coach Circle`;

  return `<!DOCTYPE html>
<html data-wf-domain="alliahealth.co" data-wf-page="6949580ebefd680afac069c3" data-wf-site="6949580dbefd680afac06955" lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttribute(heroPackage.subheadline)}" />
    <link rel="stylesheet" href="/external/cdn.prod.website-files.com/6949580dbefd680afac06955/css/allia-health.webflow.shared.d4c5828f3.min.css" type="text/css" />
    <link data-optimized="2" rel="stylesheet" href="/wp-content/litespeed/css/1e2d793fa3c48bae1a09bb06ed182c7e.css" />
    <link rel="stylesheet" href="/coach-circle-template.css?v=coach-cutout-optimal-hero-size-20260625" />
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
  <body class="wp-singular page-template page-template-elementor_canvas wp-embed-responsive wp-theme-twentytwentythree elementor-default elementor-template-canvas elementor-kit-11 elementor-page elementor-page-11246 yw-circle-body">
    ${renderInlineYWLoader()}
    <div
      class="yw-circle-site"
      data-coach-site-page="public"
      data-coach-slug="${escapeAttribute(site.slug)}"
      data-yw-inspect-mode="false"
      data-theme="${escapeAttribute(selectedTheme.id)}"
      data-yw-template-theme="${escapeAttribute(selectedTheme.id)}"
      style="${escapeAttribute(selectedThemeStyle)}"
      id="top"
    >
      <div
        class="yw-allia-background"
        id="background"
        aria-hidden="true"
        data-background-type="${escapeAttribute(backgroundConfig.type)}"
        data-motion-level="${escapeAttribute(selectedTheme.motion.level)}"
        data-performance-mode="${escapeAttribute(backgroundConfig.performanceMode)}"
        data-reduced-motion="false"
        data-theme="${escapeAttribute(selectedTheme.id)}"
        data-variant="${escapeAttribute(selectedThemeBackgroundVariant)}"
        style="--yw-template-background-intensity: ${escapeAttribute(String(backgroundConfig.intensity))}; --yw-template-background-opacity: ${escapeAttribute(String(backgroundConfig.opacity))};"
      ></div>
      <div class="yw-scroll-progress" aria-hidden="true"><span class="yw-scroll-progress__bar"></span></div>

      ${renderCanonicalNavbar(site, registerLabel)}

      <main class="yw-circle-main" aria-label="YW Nutritech Circle composite page">
        ${renderCanonicalElementorHero(site, sectionCopy, registerLabel)}

        ${renderCanonicalMarquee(coachName)}

        <section class="yw-story-section" id="story" aria-labelledby="yw-story-title" data-yw-section-key="coach">
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
              <h2 id="yw-story-title">${escapeHtml(sectionCopy.trustHeading)} <span>${escapeHtml(sectionCopy.trustLabel)}</span></h2>
              <p>${escapeHtml(sectionCopy.trustIntro)}</p>
              <p>${escapeHtml(sectionCopy.trustMission)}</p>
              <div class="yw-story-stats" aria-label="YW Nutritech coach highlights">
                <div><strong>50K+</strong><span>Community Members</span></div>
                <div><strong>1Cr+</strong><span>People Mission</span></div>
                <div><strong>YW</strong><span>Coach Network</span></div>
              </div>
            </div>
          </div>
        </section>

        <section class="yw-growth-suite" aria-label="Coaching blueprint sections">
        <section class="yw-sales-section yw-sales-section--cream" id="problem" aria-labelledby="yw-familiar-title" data-yw-section-key="problem">
          <div class="yw-sales-shell">
            <p class="yw-kicker">${escapeHtml(sectionCopy.problemLabel)}</p>
            <h2 id="yw-familiar-title">${escapeHtml(sectionCopy.problemHeading)}</h2>
            <div class="yw-check-grid">
              ${sectionCopy.problemPoints
                .map((point) => `<div class="yw-check-row"><span aria-hidden="true">&#10003;</span><p>${escapeHtml(point)}</p></div>`)
                .join("")}
            </div>
            ${renderRegisterAction(site, "yw-register-strip", registerLabel)}
          </div>
        </section>

        <section class="yw-sales-section yw-sales-section--mint" id="how-it-works" aria-labelledby="yw-blueprint-title" data-yw-section-key="journey">
          <div class="yw-sales-shell">
            <p class="yw-kicker">${escapeHtml(sectionCopy.journeyLabel)}</p>
            <h2 id="yw-blueprint-title">${escapeHtml(sectionCopy.journeyHeading)}</h2>
            <div class="yw-blueprint-grid">
              ${sectionCopy.journeySteps
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

        <section class="yw-sales-section yw-sales-section--dark" id="results" aria-labelledby="yw-results-title" data-yw-section-key="results">
          <div class="yw-sales-shell">
            <p class="yw-kicker">${escapeHtml(sectionCopy.resultsLabel)}</p>
            <h2 id="yw-results-title">${escapeHtml(sectionCopy.resultsHeadingMain)} <span>${escapeHtml(sectionCopy.resultsHeadingAccent)}</span></h2>
            <p class="yw-section-subcopy">${escapeHtml(sectionCopy.resultsSubcopy)}</p>
            <div class="yw-result-cards">
              ${sectionCopy.resultsCards
                .map(
                  (card) =>
                    `<article><span>${escapeHtml(card.label)}</span><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p><strong>${escapeHtml(card.attribution)}</strong></article>`
                )
                .join("")}
            </div>
            ${renderRegisterAction(site, "yw-register-strip yw-register-strip--dark", registerLabel)}
          </div>
        </section>

        <section class="yw-sales-section yw-sales-section--cream" id="for-you" aria-labelledby="yw-fit-title" data-yw-section-key="fit">
          <div class="yw-sales-shell">
            <h2 id="yw-fit-title">${escapeHtml(sectionCopy.fitHeadingMain)} <span>${escapeHtml(sectionCopy.fitHeadingAccent)}</span></h2>
            <div class="yw-fit-table" aria-label="${escapeAttribute(sectionCopy.fitAriaLabel)}">
              <div class="yw-fit-col">
                <h3>This IS for you if...</h3>
                ${sectionCopy.fitForPoints
                  .map((point) => `<p><span aria-hidden="true">&#10003;</span> ${escapeHtml(point)}</p>`)
                  .join("")}
              </div>
              <div class="yw-fit-col yw-fit-col--no">
                <h3>This is NOT for you if...</h3>
                ${sectionCopy.fitNotForPoints
                  .map((point) => `<p><span aria-hidden="true">&#215;</span> ${escapeHtml(point)}</p>`)
                  .join("")}
              </div>
            </div>
          </div>
        </section>

        <section
          class="yw-sales-section yw-sales-section--dark yw-sales-section--bonus yw-niche-bonus"
          data-yw-ai-adaptive="true"
          data-yw-bonus-count="${bonusSection.items.length}"
          data-yw-bonus-source="universalBonusRegistry"
          data-yw-coach-name="${escapeAttribute(coachName)}"
          data-yw-coach-niche="${escapeAttribute(coachNiche)}"
          data-yw-editable-slots="bonus.eyebrow,bonus.heading,bonus.subheading,bonus.items[].description,bonus.ctaHelperText"
          data-yw-locked-fields="bonus.id,bonus.lockedAssetId,bonus.items[].displayTitle,bonus.items[].title,bonus.visualType,bonus.assetType,bonus.actualAssetUrl,bonus.actualValue,bonus.actualAvailability,legal.disclaimer,cta.destination,analytics.tracking"
          data-yw-template-rule="nicheAdaptiveBonusSection"
          id="bonus"
          data-yw-section-key="bonuses"
          aria-labelledby="yw-bonus-title"
        >
          <div class="yw-sales-shell yw-bonus-shell">
            <p class="yw-bonus-kicker">${escapeHtml(bonusSection.eyebrow)}</p>
            <h2 id="yw-bonus-title">${escapeHtml(bonusSection.heading)}</h2>
            <p class="yw-section-subcopy">${escapeHtml(bonusSection.subheading)}</p>
            <div class="yw-bonus-grid" data-yw-bonus-grid>
              ${bonusSection.items
                .map(
                  (bonus) => `<article class="yw-niche-bonus__card" data-bonus-asset-type="${escapeAttribute(bonus.assetType)}" data-bonus-id="${escapeAttribute(bonus.id)}" data-bonus-actual-availability="${bonus.actualAvailability ? "true" : "false"}" data-bonus-locked-asset="true" data-bonus-visual-type="${escapeAttribute(bonus.visualType)}" data-yw-registry-source="universalBonusRegistry">
                    <div class="yw-bonus-card-top">
                      <div class="yw-bonus-badge">${escapeHtml(bonus.badge)}</div>
                      <p class="yw-bonus-type">${escapeHtml(bonus.typeLabel)}</p>
                    </div>
                    ${renderSmartBonusVisualHtml(bonus, coachNiche, selectedTheme.id)}
                    <h3>${escapeHtml(bonus.displayTitle)}</h3>
                    <p>${escapeHtml(bonus.description)}</p>
                    <strong data-yw-locked="actualValue">${escapeHtml(bonus.valueDisplay)}</strong>
                  </article>`
                )
                .join("")}
            </div>
            <div class="yw-bonus-cta-panel">
              <p class="yw-bonus-total" data-yw-bonus-total>${escapeHtml(bonusSection.ctaHeading)}</p>
              <p class="yw-bonus-cta-copy">${escapeHtml(bonusSection.ctaHelperText)}</p>
              ${renderRegisterAction(site, "yw-register-strip yw-register-strip--dark yw-bonus-cta", bonusSection.ctaButtonText)}
            </div>
          </div>
        </section>

        <section class="yw-sales-section yw-sales-section--final" aria-labelledby="yw-final-cta-title" data-yw-section-key="final-cta">
          <div class="yw-sales-shell yw-final-cta">
            <h2 id="yw-final-cta-title">${escapeHtml(sectionCopy.finalHeadingMain)} <span>${escapeHtml(sectionCopy.finalHeadingAccent)}</span></h2>
            <p>${escapeHtml(sectionCopy.finalBody)}</p>
            ${renderRegisterAction(site, "yw-register-strip yw-register-strip--dark", registerLabel)}
          </div>
        </section>
        </section>

        ${renderCanonicalFaq(sectionCopy)}

        ${renderCanonicalFooter(site)}
      </main>

      ${renderFloatingRegisterAction(site, registerLabel, sectionCopy.stickyCtaEyebrow)}
    </div>
    <script src="/external/d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8__q_site_6949580dbefd680afac06955.js" type="text/javascript"></script>
    <script src="/external/cdn.prod.website-files.com/6949580dbefd680afac06955/js/webflow.schunk.36b8fb49256177c8.js" type="text/javascript"></script>
    <script src="/external/cdn.prod.website-files.com/6949580dbefd680afac06955/js/webflow.05ef6ae8.15e2de229fe07c28.js" type="text/javascript"></script>
    <script>
      try {
        sessionStorage.setItem("ywLastCoachLandingPath", "/coach/${escapeJsString(site.slug)}");
        localStorage.setItem("ywLastCoachLandingPath", "/coach/${escapeJsString(site.slug)}");
      } catch (_) {}
    </script>
    <script src="/coach-circle-lenis.min.js?v=coach-4176-structural-copy-20260619"></script>
    <script src="/coach-circle-bonus-section.js?v=coach-bonus-universal-services-20260621"></script>
    <script src="/coach-circle-motion.js?v=coach-mobile-nav-sheet-20260622"></script>
    ${renderCanonicalScript(site.slug)}
  </body>
</html>`;
}

function renderCanonicalNavbar(site: PublicCoachSiteRecord, registerLabel: string) {
  const navLinks = getCanonicalCoachNavbarSections()
    .map(
      (section) =>
        `<a href="${escapeAttribute(section.anchorTarget)}" class="navbar14_link w-nav-link" data-yw-nav-link="true" data-yw-section-key="${escapeAttribute(
          section.sectionKey
        )}">${escapeHtml(section.navLabel)}</a>`
    )
    .join("");

  return `
      <div data-collapse="medium" data-animation="default" data-duration="400" data-w-id="ca82c3a1-896f-47be-4f7e-70e88912ab95" data-easing="ease" data-easing2="ease" role="banner" class="navbar14_component w-nav">
        <div class="navbar14_container">
          <a href="#home" aria-current="page" class="navbar14_logo-link w-nav-brand w--current yw-navbar-brand" aria-label="YW Nutritech home" data-yw-nav-link="true" data-yw-section-key="hero">
            <span class="yw-navbar-mark" aria-hidden="true"><img src="/assets/yw-logo-transparent.png" alt="" loading="eager" decoding="async"></span>
            <span class="yw-navbar-wordmark"><strong>YWN</strong></span>
          </a>
          <nav role="navigation" aria-label="Coach page sections" id="w-node-ca82c3a1-896f-47be-4f7e-70e88912ab99-8912ab95" class="navbar14_menu w-nav-menu" data-yw-nav-menu>
            <div class="navbar14_menu-link-wrapper">
              <div class="navbar14_menu-links">
                ${navLinks}
                ${renderNavbarRegisterAction(site, registerLabel)}
              </div>
            </div>
          </nav>
          <button class="navbar14_menu-button w-nav-button" type="button" aria-label="Open coach site menu" aria-expanded="false" aria-controls="w-node-ca82c3a1-896f-47be-4f7e-70e88912ab99-8912ab95" data-yw-nav-toggle>
            <div class="menu-icon2">
              <div class="menu-icon2_line-top"></div>
              <div class="menu-icon2_line-middle"><div class="menu-icon1_line-middle-inner"></div></div>
              <div class="menu-icon2_line-bottom"></div>
            </div>
          </button>
        </div>
      </div>`;
}

function renderNavbarRegisterAction(site: PublicCoachSiteRecord, label: string) {
  const content = `<span class="navbar14_register-icon" aria-hidden="true">${renderRegisterPointerIcon()}</span><span>${escapeHtml(label)}</span>`;

  if (!site.googleFormUrl) {
    return `<button class="navbar14_register w-nav-link" data-missing-link="true" type="button" aria-disabled="true">Registration link pending</button>`;
  }

  return `<a class="navbar14_register w-nav-link" data-track="coach_register_click" href="${escapeAttribute(site.googleFormUrl)}" rel="noreferrer" target="_blank">${content}</a>`;
}

function renderCanonicalElementorHero(
  site: PublicCoachSiteRecord,
  sectionCopy: ReturnType<typeof getCanonicalCoachSectionCopy>,
  registerLabel: string
) {
  const coachName = getCanonicalCoachName(site);
  const coachNiche = getCanonicalCoachNiche(site);
  const heroTitle = `${escapeHtml(sectionCopy.heroTitleMain)}${
    sectionCopy.heroTitleAccent
      ? ` <span class="golden-hoghlight-cu">${escapeHtml(sectionCopy.heroTitleAccent)}</span>`
      : ""
  }`;

  return `
    <div data-elementor-type="wp-page" data-elementor-id="11246" class="elementor elementor-11246 yw-circle-hero" data-elementor-post-type="page" data-yw-section-key="hero" id="home">
      <section class="elementor-section elementor-top-section elementor-element elementor-element-7b3e225 elementor-section-boxed elementor-section-height-default elementor-section-height-default" data-id="7b3e225" data-element_type="section" data-e-type="section" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}">
        <div class="elementor-container elementor-column-gap-default">
          <div class="elementor-column elementor-col-100 elementor-top-column elementor-element elementor-element-0cbc0ab" data-id="0cbc0ab" data-element_type="column" data-e-type="column">
            <div class="elementor-widget-wrap elementor-element-populated">
              <div class="elementor-element elementor-element-175afb4 elementor-widget elementor-widget-heading" data-id="175afb4" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                <div class="elementor-widget-container"><h4 class="elementor-heading-title elementor-size-default">${escapeHtml(sectionCopy.topStrip)}</h4></div>
              </div>
              <div class="elementor-element elementor-element-a2d0984 elementor-widget__width-auto elementor-widget elementor-widget-heading" data-id="a2d0984" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                <div class="elementor-widget-container"><h4 class="elementor-heading-title elementor-size-default">${escapeHtml(sectionCopy.heroEyebrow)}</h4></div>
              </div>
              <div class="elementor-element elementor-element-1a369ef elementor-widget elementor-widget-heading" data-id="1a369ef" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                <div class="elementor-widget-container"><h1 class="elementor-heading-title elementor-size-default">${heroTitle}</h1></div>
              </div>
              <div class="elementor-element elementor-element-7217277 elementor-widget__width-initial elementor-widget-mobile__width-inherit elementor-widget elementor-widget-heading" data-id="7217277" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                <div class="elementor-widget-container"><p class="elementor-heading-title elementor-size-default">${escapeHtml(sectionCopy.heroSubheadline)}</p></div>
              </div>
              <section class="elementor-section elementor-inner-section elementor-element elementor-element-6dae30e elementor-section-boxed elementor-section-height-default elementor-section-height-default" data-id="6dae30e" data-element_type="section" data-e-type="section">
                <div class="elementor-container elementor-column-gap-default">
                  <div class="elementor-column elementor-col-50 elementor-inner-column elementor-element elementor-element-4da1b83" data-id="4da1b83" data-element_type="column" data-e-type="column">
                    <div class="elementor-widget-wrap elementor-element-populated">
                      <div class="elementor-element elementor-element-afb23e5 elementor-widget elementor-widget-image" data-id="afb23e5" data-element_type="widget" data-e-type="widget" data-widget_type="image.default">
                        <div class="elementor-widget-container">${renderCanonicalHeroImageContent(site)}</div>
                      </div>
                      <div class="elementor-element elementor-element-b1105bd elementor-widget__width-initial elementor-widget elementor-widget-icon-box" data-id="b1105bd" data-element_type="widget" data-e-type="widget" data-widget_type="icon-box.default">
                        <div class="elementor-widget-container"><div class="elementor-icon-box-wrapper"><div class="elementor-icon-box-content"><h5 class="elementor-icon-box-title"><span>${escapeHtml(coachName)}</span></h5><p class="elementor-icon-box-description">${escapeHtml(coachNiche)}</p></div></div></div>
                      </div>
                    </div>
                  </div>
                  <div class="elementor-column elementor-col-50 elementor-inner-column elementor-element elementor-element-ca06760" data-id="ca06760" data-element_type="column" data-e-type="column">
                    <div class="elementor-widget-wrap elementor-element-populated">
                      <div class="elementor-element elementor-element-1778ab6 elementor-widget__width-initial elementor-widget-mobile__width-inherit elementor-widget elementor-widget-heading" data-id="1778ab6" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                        <div class="elementor-widget-container"><p class="elementor-heading-title elementor-size-default">${escapeHtml(sectionCopy.detailHeading)}</p></div>
                      </div>
                      <div class="elementor-element elementor-element-b0fe8be elementor-widget elementor-widget-image" data-id="b0fe8be" data-element_type="widget" data-e-type="widget" data-widget_type="image.default">
                        <div class="elementor-widget-container"><img src="/wp-content/uploads/2026/03/Line-11.svg" decoding="async" title="" alt="" width="260" height="18" /></div>
                      </div>
                      <div class="elementor-element elementor-element-05fe630 elementor-widget__width-initial elementor-widget-mobile__width-inherit elementor-widget elementor-widget-heading" data-id="05fe630" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                        <div class="elementor-widget-container"><p class="elementor-heading-title elementor-size-default">${escapeHtml(sectionCopy.detailSubline)}</p></div>
                      </div>
                      ${sectionCopy.detailCards
                        .map((card) =>
                          renderElementorInfoCard(
                            card.id,
                            card.kind,
                            card.label,
                            escapeHtml(card.value)
                          )
                        )
                        .join("")}
                      <div class="elementor-element elementor-element-d43feaa elementor-align-justify elementor-widget__width-initial main_btn elementor-widget elementor-widget-button" data-id="d43feaa" data-element_type="widget" data-e-type="widget" data-widget_type="button.default">
                        <div class="elementor-widget-container"><div class="elementor-button-wrapper">${renderElementorRegisterAction(site, registerLabel)}</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>`;
}

function renderElementorInfoCard(
  id: string,
  kind: CanonicalHeroInfoCardKind,
  label: string,
  valueHtml: string
) {
  return `<div class="elementor-element elementor-element-${escapeAttribute(id)} pp-info-box-left elementor-widget__width-initial elementor-widget elementor-widget-pp-info-box" data-id="${escapeAttribute(id)}" data-element_type="widget" data-e-type="widget" data-widget_type="pp-info-box.default"><div class="elementor-widget-container"><div class="pp-info-box-container"><div class="pp-info-box"><div class="pp-info-box-icon-wrap"><span class="pp-info-box-icon pp-icon">${renderHeroInfoIcon(kind)}</span></div><div class="pp-info-box-content"><div class="pp-info-box-title-wrap"><div class="pp-info-box-title-container"><h4 class="pp-info-box-title">${escapeHtml(label)}</h4></div><h5 class="pp-info-box-subtitle">${valueHtml}</h5></div></div></div></div></div></div>`;
}

function renderHeroInfoIcon(kind: CanonicalHeroInfoCardKind) {
  if (kind === "date") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect class="yw-hero-icon-stroke" x="4" y="5" width="16" height="16" rx="2.25"></rect><line class="yw-hero-icon-stroke" x1="8" y1="3.5" x2="8" y2="7"></line><line class="yw-hero-icon-stroke" x1="16" y1="3.5" x2="16" y2="7"></line><line class="yw-hero-icon-stroke" x1="4.75" y1="9.25" x2="19.25" y2="9.25"></line><circle class="yw-hero-icon-fill" cx="8.15" cy="13.2" r="0.8"></circle><circle class="yw-hero-icon-fill" cx="12" cy="13.2" r="0.8"></circle><circle class="yw-hero-icon-fill" cx="15.85" cy="13.2" r="0.8"></circle><circle class="yw-hero-icon-fill" cx="8.15" cy="16.8" r="0.8"></circle><circle class="yw-hero-icon-fill" cx="12" cy="16.8" r="0.8"></circle></svg>`;
  }

  if (kind === "time") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle class="yw-hero-icon-stroke" cx="12" cy="12" r="8.45"></circle><line class="yw-hero-icon-stroke" x1="12" y1="7.2" x2="12" y2="12.35"></line><line class="yw-hero-icon-stroke" x1="12" y1="12.35" x2="15.3" y2="15.05"></line></svg>`;
  }

  if (kind === "duration") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><line class="yw-hero-icon-stroke" x1="6.2" y1="4.5" x2="17.8" y2="4.5"></line><line class="yw-hero-icon-stroke" x1="6.2" y1="19.5" x2="17.8" y2="19.5"></line><path class="yw-hero-icon-stroke" d="M8 4.5v3.1c0 1.4.78 2.68 2.02 3.32L12 12l1.98-1.08A3.72 3.72 0 0 0 16 7.6V4.5"></path><path class="yw-hero-icon-stroke" d="M8 19.5v-3.1c0-1.4.78-2.68 2.02-3.32L12 12l1.98 1.08A3.72 3.72 0 0 1 16 16.4v3.1"></path></svg>`;
  }

  if (kind === "focus") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle class="yw-hero-icon-stroke" cx="12" cy="12" r="8.2"></circle><circle class="yw-hero-icon-stroke" cx="12" cy="12" r="3.6"></circle><circle class="yw-hero-icon-fill" cx="12" cy="12" r="1.35"></circle></svg>`;
  }

  if (kind === "support") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path class="yw-hero-icon-stroke" d="M7.2 12.5c-1.55 0-2.8-1.25-2.8-2.8s1.25-2.8 2.8-2.8 2.8 1.25 2.8 2.8-1.25 2.8-2.8 2.8Z"></path><path class="yw-hero-icon-stroke" d="M16.8 12.5c-1.55 0-2.8-1.25-2.8-2.8s1.25-2.8 2.8-2.8 2.8 1.25 2.8 2.8-1.25 2.8-2.8 2.8Z"></path><path class="yw-hero-icon-stroke" d="M3.7 18.5c.72-2.05 1.95-3.08 3.5-3.08s2.78 1.03 3.5 3.08"></path><path class="yw-hero-icon-stroke" d="M13.3 18.5c.72-2.05 1.95-3.08 3.5-3.08s2.78 1.03 3.5 3.08"></path></svg>`;
  }

  if (kind === "next") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path class="yw-hero-icon-stroke" d="M5 12h12.5"></path><path class="yw-hero-icon-stroke" d="m13 7.5 4.5 4.5-4.5 4.5"></path><path class="yw-hero-icon-stroke" d="M4.8 5.2h14.4v13.6H4.8z"></path></svg>`;
  }

  if (kind === "location") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path class="yw-hero-icon-stroke" d="M12 20.5s6.2-5.15 6.2-10.05A6.2 6.2 0 0 0 5.8 10.45C5.8 15.35 12 20.5 12 20.5Z"></path><circle class="yw-hero-icon-stroke" cx="12" cy="10.35" r="2.25"></circle></svg>`;
  }

  if (kind === "format") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect class="yw-hero-icon-stroke" height="12.5" rx="2" width="16" x="4" y="5.5"></rect><path class="yw-hero-icon-stroke" d="M8 18.5h8"></path><path class="yw-hero-icon-stroke" d="M10 9h4M8.5 12h7"></path></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle class="yw-hero-icon-stroke" cx="12" cy="12" r="8.5"></circle><path class="yw-hero-icon-stroke" d="M4 12h16"></path><path class="yw-hero-icon-stroke" d="M12 3.5c2.15 2.35 3.25 5.18 3.25 8.5S14.15 18.15 12 20.5"></path><path class="yw-hero-icon-stroke" d="M12 3.5C9.85 5.85 8.75 8.68 8.75 12s1.1 6.15 3.25 8.5"></path></svg>`;
}

function renderElementorRegisterAction(site: PublicCoachSiteRecord, label: string) {
  const content = `<span class="elementor-button-content-wrapper"><span class="elementor-button-icon" aria-hidden="true">${renderRegisterPointerIcon()}</span><span class="elementor-button-text">${escapeHtml(label)}</span></span>`;

  if (!site.googleFormUrl) {
    return `<button aria-disabled="true" class="elementor-button elementor-button-link elementor-size-sm" data-missing-link="true" type="button">Registration link pending</button>`;
  }

  return `<a class="elementor-button elementor-button-link elementor-size-sm" data-track="coach_register_click" href="${escapeAttribute(site.googleFormUrl)}" rel="noreferrer" target="_blank">${content}</a>`;
}

function renderRegisterPointerIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 227 159" fill="none"><path d="M135.53 61.9503C141.303 70.1296 139.577 81.3622 131.807 87.4932H136.935C145.051 87.4932 151.653 80.8898 151.653 72.7738C151.653 64.6579 145.05 58.0544 136.935 58.0544H132.784L135.53 61.9503Z" fill="black"></path><path d="M104.84 83.5986L91.3346 64.4136C89.6418 66.8553 88.7175 69.746 88.7175 72.774C88.7175 80.891 95.321 87.4934 103.437 87.4934H108.524C107.134 86.3899 105.891 85.0877 104.84 83.5986Z" fill="black"></path><path d="M103.436 91.5522C95.319 91.5522 88.7166 98.1557 88.7166 106.272C88.7166 114.389 95.32 120.991 103.436 120.991H133.584C141.701 120.991 148.303 114.388 148.303 106.272C148.303 98.1547 141.7 91.5522 133.584 91.5522H103.436Z" fill="black"></path><path d="M103.436 125.051C95.3191 125.051 88.7166 131.654 88.7166 139.77C88.7166 147.887 95.3201 154.489 103.436 154.489H130.233C138.35 154.489 144.953 147.886 144.953 139.77C144.953 131.653 138.349 125.051 130.233 125.051H103.436Z" fill="black"></path><path d="M39.8686 14.1858C33.795 15.5357 28.3915 18.5335 24.2424 22.8549C20.854 26.3836 17.7851 30.2463 15.1213 34.3389C6.91087 46.9477 2.57094 61.6019 2.57094 76.7177C2.57094 119.602 37.459 154.49 80.3433 154.49H91.8106C87.461 151.048 84.6569 145.735 84.6569 139.771C84.6569 132.455 88.8703 126.12 94.9896 123.021C88.8703 119.923 84.6569 113.588 84.6569 106.272C84.6569 98.957 88.8703 92.6224 94.9896 89.5232C88.8703 86.4251 84.6569 80.0895 84.6569 72.7741C84.6569 68.4098 86.1471 64.2647 88.8751 60.922L83.7804 53.6846C82.5639 51.9568 80.654 50.977 78.5415 50.9974C76.426 51.0179 74.5327 52.0357 73.3474 53.7907C63.3614 68.5666 48.4968 79.8304 31.4916 85.5057C30.428 85.8602 29.2788 85.2865 28.9233 84.223C28.5648 83.1575 29.1434 82.0101 30.206 81.6546C46.3688 76.2599 60.496 65.5571 69.9843 51.5175C71.9 48.6823 75.0839 46.9711 78.5025 46.938C81.9172 46.9049 85.1312 48.5528 87.0996 51.3471L108.158 81.2592C110.423 84.4703 113.805 86.6082 117.679 87.2773C121.553 87.9464 125.457 87.0669 128.669 84.8005C135.303 80.1207 136.89 70.9168 132.212 64.288L94.8075 11.2405C91.3753 6.37269 85.3991 4.0615 79.5855 5.35394L39.8686 14.1858Z" fill="black"></path><path d="M209.281 53.9952C217.398 53.9952 224 47.3918 224 39.2758C224 31.1598 217.397 24.5564 209.281 24.5564L109.164 24.5564L129.922 53.9952L209.281 53.9952Z" fill="black"></path></svg>`;
}

function renderFloatingRegisterAction(site: PublicCoachSiteRecord, label: string, eyebrow: string) {
  if (!site.googleFormUrl) {
    return `<button aria-hidden="true" class="yw-floating-register-cta" data-missing-link="true" data-yw-sticky-register tabindex="-1" type="button"><span class="yw-floating-register-cta__eyebrow">${escapeHtml(eyebrow)}</span><strong>Registration link pending</strong></button>`;
  }

  return `<a aria-hidden="true" class="yw-floating-register-cta" data-track="coach_register_click" data-yw-sticky-register href="${escapeAttribute(site.googleFormUrl)}" rel="noreferrer" tabindex="-1" target="_blank"><span class="yw-floating-register-cta__eyebrow">${escapeHtml(eyebrow)}</span><strong>${escapeHtml(label)}</strong></a>`;
}

function renderCanonicalHeroImageContent(site: PublicCoachSiteRecord) {
  const imageUrl = site.photoUrl || site.logoUrl;

  if (imageUrl) {
    const imageMode = getCanonicalHeroImageMode(imageUrl);
    const imageModeClass =
      imageMode === "cutout" ? "yw-coach-hero-image--cutout" : "yw-coach-hero-image--framed";
    return `<img alt="${escapeAttribute(`${getCanonicalCoachName(site)} profile`)}" class="attachment-full size-full yw-coach-hero-image ${imageModeClass}" data-image-mode="${escapeAttribute(imageMode)}" data-yw-coach-image decoding="async" fetchpriority="high" height="2200" src="${escapeAttribute(imageUrl)}" width="1650" />`;
  }

  return `<span class="yw-coach-hero-image yw-coach-hero-image--empty">${escapeHtml(getCanonicalCoachInitials(site))}</span>`;
}

function getCanonicalHeroImageMode(imageUrl: string) {
  const normalizedUrl = safeDecodeUriComponent(imageUrl).toLowerCase();
  if (normalizedUrl.includes("/cutout/") || normalizedUrl.includes("-cutout.")) {
    return "cutout";
  }

  return "framed";
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function renderCanonicalStoryVideoContent(site: PublicCoachSiteRecord) {
  const embedVideoUrl = normalizeVideoEmbedUrl(site.videoUrl);
  const uploadedVideoUrl = isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  if (embedVideoUrl) {
    return `<iframe allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="yw-story-video" src="${escapeAttribute(embedVideoUrl)}" title="${escapeAttribute(`${getCanonicalCoachName(site)} story video`)}"></iframe>`;
  }

  if (uploadedVideoUrl) {
    return `<video class="yw-story-video" controls playsinline preload="metadata" src="${escapeAttribute(uploadedVideoUrl)}" title="${escapeAttribute(`${getCanonicalCoachName(site)} story video`)}"></video>`;
  }

  return `<div class="yw-story-video-placeholder" aria-hidden="true"><span class="yw-story-play"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 6.75L17 12L9 17.25V6.75Z"></path></svg></span></div>`;
}

function renderCanonicalMarquee(coachName: string) {
  return `
    <section id="circle-marquee" class="circle-marquee" aria-label="Coach circle marquee" data-yw-circle-marquee data-yw-marquee-brand="YW NUTRITECH CIRCLE" data-yw-marquee-name="${escapeAttribute(coachName)}" data-yw-marquee-repeats="20">
      <div class="circle-marquee__track">
        ${Array.from({ length: 20 })
          .map(
            () => `<span class="circle-marquee__item"><span class="circle-marquee__brand">YW NUTRITECH CIRCLE</span><span class="circle-marquee__star">&#9733;</span><span class="circle-marquee__name">${escapeHtml(coachName)}</span><span class="circle-marquee__star">&#9733;</span></span>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderCanonicalFaq(sectionCopy: ReturnType<typeof getCanonicalCoachSectionCopy>) {
  return `
        <div data-elementor-type="wp-page" data-elementor-id="11246" class="elementor elementor-11246 yw-circle-faq" data-elementor-post-type="page" data-yw-section-key="faq" id="faq">
          <section class="elementor-section elementor-top-section elementor-element elementor-element-01e9f7a elementor-section-boxed elementor-section-height-default elementor-section-height-default" data-id="01e9f7a" data-element_type="section" data-e-type="section" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}">
            <div class="elementor-container elementor-column-gap-default">
              <div class="elementor-column elementor-col-100 elementor-top-column elementor-element elementor-element-3db758d" data-id="3db758d" data-element_type="column" data-e-type="column">
                <div class="elementor-widget-wrap elementor-element-populated">
                  <section class="elementor-section elementor-inner-section elementor-element elementor-element-0d3c8f6 elementor-section-boxed elementor-section-height-default elementor-section-height-default" data-id="0d3c8f6" data-element_type="section" data-e-type="section">
                    <div class="elementor-container elementor-column-gap-default">
                      <div class="elementor-column elementor-col-100 elementor-inner-column elementor-element elementor-element-07d4fd5" data-id="07d4fd5" data-element_type="column" data-e-type="column">
                        <div class="elementor-widget-wrap elementor-element-populated">
                          <div class="elementor-element elementor-element-62d1791 elementor-widget__width-initial elementor-widget elementor-widget-heading" data-id="62d1791" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
                            <div class="elementor-widget-container"><h2 id="yw-faq-title" class="elementor-heading-title elementor-size-default">${escapeHtml(sectionCopy.faqHeading)} <span class="brown-hoghlight-cu">${escapeHtml(sectionCopy.faqLabel)}</span></h2></div>
                          </div>
                          <div class="elementor-element elementor-element-75413a5 elementor-widget elementor-widget-accordion" data-id="75413a5" data-element_type="widget" data-e-type="widget" data-widget_type="accordion.default">
                            <div class="elementor-widget-container">
                              <div class="elementor-accordion">
                                ${sectionCopy.faqItems
                                  .map((item, index) => {
                                    const tabId = `122${index + 1}`;
                                    return `<details class="elementor-accordion-item">
                                      <summary id="elementor-tab-title-${tabId}" class="elementor-tab-title" data-tab="${index + 1}" aria-controls="elementor-tab-content-${tabId}" aria-expanded="false" role="button">
                                        <span class="elementor-accordion-icon elementor-accordion-icon-right" aria-hidden="true">
                                          <span class="elementor-accordion-icon-closed">+</span>
                                          <span class="elementor-accordion-icon-opened">-</span>
                                        </span>
                                        <span class="elementor-accordion-title">${escapeHtml(item.question)}</span>
                                      </summary>
                                      <div id="elementor-tab-content-${tabId}" class="elementor-tab-content elementor-clearfix" data-tab="${index + 1}" role="region" aria-labelledby="elementor-tab-title-${tabId}" aria-hidden="true"><p>${escapeHtml(item.answer)}</p></div>
                                    </details>`;
                                  })
                                  .join("")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>`;
}

function renderCanonicalFooter(site: PublicCoachSiteRecord) {
  return `
    <footer class="yw-brand-footer" data-preview-section="footer" data-yw-section-key="contact" id="yw-footer">
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
          <a href="/privacy?returnTo=${encodeURIComponent(`/coach/${site.slug}`)}">Privacy Policy</a>
          <a href="/terms?returnTo=${encodeURIComponent(`/coach/${site.slug}`)}">Terms &amp; Conditions</a>
          <a href="/disclaimer?returnTo=${encodeURIComponent(`/coach/${site.slug}`)}">Disclaimer</a>
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
          var triggerRect = trigger.getBoundingClientRect();
          var activationPoint = Math.max(120, window.innerHeight - 56);
          var triggerReached = triggerRect.top <= activationPoint;
          var shouldShow = scrollTop > 56 && triggerReached;
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
        function initFaqAccordions() {
          Array.prototype.slice.call(document.querySelectorAll('.yw-circle-faq .elementor-accordion')).forEach(function (accordion) {
            if (accordion.getAttribute('data-yw-faq-ready') === 'true') return;
            accordion.setAttribute('data-yw-faq-ready', 'true');
            var items = Array.prototype.slice.call(accordion.querySelectorAll('.elementor-accordion-item'));
            function sync(item) {
              var isOpen = item.hasAttribute('open');
              item.classList.toggle('is-open', isOpen);
              var summary = item.querySelector('.elementor-tab-title');
              var content = item.querySelector('.elementor-tab-content');
              if (summary) summary.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
              if (content) content.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            }
            function setOpen(target, shouldOpen) {
              items.forEach(function (item) {
                item.removeAttribute('open');
                item.classList.remove('is-open');
                sync(item);
              });
              if (shouldOpen) {
                target.setAttribute('open', '');
                sync(target);
              }
            }
            items.forEach(function (item) {
              var summary = item.querySelector('.elementor-tab-title');
              if (!summary) return;
              summary.setAttribute('role', 'button');
              sync(item);
              summary.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(item, !item.hasAttribute('open'));
              });
              summary.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                setOpen(item, !item.hasAttribute('open'));
              });
            });
          });
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
        initFaqAccordions();
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

function renderSmartBonusVisualHtml(
  bonus: NicheAdaptiveBonusItem,
  coachNiche: string,
  themeId: string
) {
  const visualCssType = getSmartBonusVisualCssType(bonus.visualType);
  const baseAttributes = [
    `class="yw-bonus-visual yw-smart-bonus-visual yw-bonus-visual--${escapeAttribute(visualCssType)}"`,
    `data-yw-asset-type="${escapeAttribute(bonus.assetType)}"`,
    `data-yw-bonus-id="${escapeAttribute(bonus.id)}"`,
    `data-yw-niche="${escapeAttribute(coachNiche)}"`,
    `data-yw-smart-bonus="true"`,
    `data-yw-template-theme="${escapeAttribute(themeId)}"`,
    `data-yw-visual-type="${escapeAttribute(bonus.visualType)}"`
  ];

  if (bonus.imageUrl) {
    return `<div ${baseAttributes.join(" ")} data-yw-smart-visual="configured-image" role="img" aria-label="${escapeAttribute(
      bonus.imageAlt || `${bonus.typeLabel} bonus visual`
    )}" style="background-image: linear-gradient(135deg, rgba(4, 31, 39, 0.16), rgba(33, 230, 193, 0.18)), url('${escapeAttribute(
      bonus.imageUrl
    )}')">
      <span class="yw-bonus-visual__orb yw-bonus-visual__orb--image" aria-hidden="true"></span>
      <span class="yw-bonus-visual__micro-lines" aria-hidden="true"></span>
      <span class="yw-bonus-visual__shine" aria-hidden="true"></span>
    </div>`;
  }

  return `<div ${baseAttributes.join(" ")} data-yw-fallback-icon="${escapeAttribute(
    bonus.fallbackIcon
  )}" data-yw-smart-visual="generated" aria-hidden="true">
    <span class="yw-bonus-visual__orb"></span>
    <span class="yw-bonus-visual__product">
      <span class="yw-bonus-visual__mark">${escapeHtml(getSmartBonusVisualMark(bonus))}</span>
    </span>
    <span class="yw-bonus-visual__micro-lines"></span>
    <span class="yw-bonus-visual__shine"></span>
  </div>`;
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

function escapeJsString(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

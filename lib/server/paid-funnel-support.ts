import type { D1Database } from "@cloudflare/workers-types";
import { getCoachById, type Funnel } from "../coach-platform";
import {
  createErrorReference,
  getSupportErrorDefinition,
  type WebsiteErrorCategory
} from "../error-codes";
import { listCoachSitesFromDb } from "./coach-site-storage";
import { insertWebsiteErrorReport } from "./error-reports";

export type PaidFunnelSupportEnv = {
  ADMIN_DB?: D1Database;
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_SUPPORT_MESSAGE?: string;
  NEXT_PUBLIC_SUPPORT_NAME?: string;
  NEXT_PUBLIC_SUPPORT_PHONE?: string;
  NEXT_PUBLIC_SUPPORT_WHATSAPP?: string;
};

type PaidFunnelSupportResponseInput = {
  category?: WebsiteErrorCategory;
  env: PaidFunnelSupportEnv;
  funnel: Funnel | null;
  funnelStep: string;
  request: Request;
  safeMessage?: string;
  status?: number;
  technicalDigest: string;
  userAction: string;
};

type PaidFunnelSupportDetails = {
  coachSlug: string;
  email: string;
  missingFields: string[];
  name: string;
  phone: string;
  primaryHref: string;
  source: "coach" | "default";
  whatsappLink: string;
};

const HTML_HEADERS = {
  "cache-control": "no-store",
  "content-type": "text/html; charset=utf-8"
};

export async function paidFunnelSupportResponse({
  category = "payment_flow_issue",
  env,
  funnel,
  funnelStep,
  request,
  safeMessage,
  status = 503,
  technicalDigest,
  userAction
}: PaidFunnelSupportResponseInput) {
  const definition = getSupportErrorDefinition(category);
  const referenceId = createErrorReference(category, funnel?.id || funnelStep);
  const support = await getPaidFunnelSupportDetails(funnel, env);
  const pagePath = new URL(request.url).pathname;

  await insertWebsiteErrorReport(
    {
      browser: request.headers.get("user-agent") || "",
      category,
      coachSlug: support.coachSlug,
      digest: technicalDigest,
      errorCode: definition.code,
      funnelStep,
      missingSupportFields: support.missingFields,
      pagePath,
      referenceId,
      referrer: request.headers.get("referer") || "",
      safeMessage: safeMessage || definition.publicMessage,
      screenSize: "",
      supportSource: support.source,
      technicalDetails: technicalDigest,
      userAction
    },
    env
  );

  return new Response(renderPaidFunnelSupportHtml({ definitionCode: definition.code, referenceId, safeMessage: safeMessage || definition.publicMessage, support }), {
    status,
    headers: HTML_HEADERS
  });
}

async function getPaidFunnelSupportDetails(
  funnel: Funnel | null,
  env: PaidFunnelSupportEnv
): Promise<PaidFunnelSupportDetails> {
  const coach = funnel ? getCoachById(funnel.coachId) : null;
  const coachSite = await findMatchingCoachSiteSupport(funnel, env);
  const coachEmail = coachSite?.coachEmail?.trim() || "";
  const coachPhone = coachSite?.coachPhone?.trim() || "";
  const coachWhatsapp = coachSite?.whatsappLink?.trim() || "";
  const hasCoachContact = Boolean(coachEmail || coachPhone || coachWhatsapp);

  if (hasCoachContact) {
    const emailHref = coachEmail
      ? `mailto:${coachEmail}?subject=${encodeURIComponent(`Paid masterclass support ${funnel?.entryCode || ""}`)}`
      : "";

    return {
      coachSlug: coachSite?.slug || coach?.slug || "",
      email: coachEmail,
      missingFields: [
        coachEmail ? "" : "coach email",
        coachPhone ? "" : "coach phone",
        coachWhatsapp ? "" : "coach WhatsApp"
      ].filter(Boolean),
      name: coachSite?.coachName || coach?.displayName || "Your Coach",
      phone: coachPhone,
      primaryHref: coachWhatsapp || emailHref || getDefaultSupportHref(env),
      source: "coach",
      whatsappLink: coachWhatsapp
    };
  }

  const defaultEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@ywcoach.com";
  const defaultWhatsapp = env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";

  return {
    coachSlug: coach?.slug || "",
    email: defaultEmail,
    missingFields: coach ? ["coach email", "coach phone", "coach WhatsApp"] : [],
    name: env.NEXT_PUBLIC_SUPPORT_NAME || "Yours Wellness Support",
    phone: env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    primaryHref:
      defaultWhatsapp ||
      `mailto:${defaultEmail}?subject=${encodeURIComponent(`Paid masterclass support ${funnel?.entryCode || "YW"}`)}`,
    source: "default",
    whatsappLink: defaultWhatsapp
  };
}

async function findMatchingCoachSiteSupport(funnel: Funnel | null, env: PaidFunnelSupportEnv) {
  if (!funnel || !env.ADMIN_DB) return null;

  try {
    const coach = getCoachById(funnel.coachId);
    const coachSites = await listCoachSitesFromDb(env);
    if (!coachSites) return null;

    const coachName = normalizeIdentity(coach?.displayName || "");
    const coachSlug = normalizeIdentity(coach?.slug || "");

    return (
      coachSites.find((site) => {
        if (site.status === "removed") return false;

        const siteName = normalizeIdentity(site.coachName);
        const siteSlug = normalizeIdentity(site.slug);

        return (
          (coachName && siteName === coachName) ||
          (coachSlug && (siteSlug === coachSlug || siteSlug.startsWith(`${coachSlug}-`)))
        );
      }) || null
    );
  } catch {
    return null;
  }
}

function renderPaidFunnelSupportHtml({
  definitionCode,
  referenceId,
  safeMessage,
  support
}: {
  definitionCode: string;
  referenceId: string;
  safeMessage: string;
  support: PaidFunnelSupportDetails;
}) {
  const contactHref = escapeAttribute(support.primaryHref || "/");
  const supportName = escapeHtml(support.name);
  const contactLines = [
    support.email ? `<span>Email: ${escapeHtml(support.email)}</span>` : "",
    support.phone ? `<span>Phone: ${escapeHtml(support.phone)}</span>` : "",
    support.whatsappLink ? `<span>WhatsApp support available</span>` : ""
  ]
    .filter(Boolean)
    .join("");
  const copyValue = escapeAttribute(`${definitionCode} ${referenceId}`);

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Paid Masterclass Support | YW Coach</title>
        <style>
          *,
          *::before,
          *::after {
            box-sizing: border-box;
          }
          html {
            width: 100%;
            overflow-x: hidden;
          }
          body {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
              radial-gradient(circle at 18% 18%, rgba(244, 194, 194, 0.32), transparent 34rem),
              radial-gradient(circle at 86% 10%, rgba(168, 85, 247, 0.14), transparent 32rem),
              linear-gradient(145deg, #fffaf5, #fff7fb 52%, #f8fbff);
            color: #241321;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 1rem;
          }
          main {
            width: min(92vw, 36rem);
            max-width: 100%;
            overflow-wrap: anywhere;
            border: 1px solid rgba(158, 54, 109, 0.18);
            border-radius: 1.25rem;
            background: rgba(255, 255, 255, 0.86);
            box-shadow: 0 1.4rem 4rem rgba(76, 31, 62, 0.14);
            padding: clamp(1.35rem, 5vw, 2.35rem);
          }
          .kicker {
            margin: 0 0 0.6rem;
            color: #8b174d;
            font-size: 0.74rem;
            font-weight: 900;
            letter-spacing: 0.09em;
            text-transform: uppercase;
          }
          h1 {
            margin: 0 0 0.8rem;
            font-size: clamp(1.75rem, 7vw, 2.55rem);
            line-height: 1.05;
          }
          p {
            color: #634c5e;
            font-size: 1rem;
            line-height: 1.62;
            margin: 0 0 1rem;
            overflow-wrap: anywhere;
          }
          .support {
            border: 1px solid rgba(190, 24, 93, 0.14);
            border-radius: 1rem;
            background: rgba(255, 250, 252, 0.78);
            padding: 1rem;
            margin: 1rem 0;
          }
          .support strong,
          .support span {
            display: block;
          }
          .support span {
            color: #705669;
            font-weight: 700;
            margin-top: 0.25rem;
          }
          .code {
            display: inline-flex;
            align-items: center;
            max-width: 100%;
            border: 1px solid rgba(190, 24, 93, 0.18);
            border-radius: 999px;
            background: white;
            color: #8b174d;
            cursor: pointer;
            font: inherit;
            font-weight: 900;
            letter-spacing: 0.04em;
            overflow-wrap: anywhere;
            padding: 0.7rem 0.9rem;
            white-space: normal;
          }
          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1.25rem;
          }
          a {
            min-height: 2.8rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(190, 24, 93, 0.16);
            border-radius: 999px;
            color: #241321;
            font-weight: 900;
            padding: 0 1rem;
            text-decoration: none;
          }
          a:first-child {
            background: linear-gradient(135deg, #251126, #9f174d 58%, #a855f7);
            color: white;
          }
          @media (max-width: 420px) {
            .actions,
            .actions a {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <main>
          <p class="kicker">Paid masterclass support</p>
          <h1>We could not complete this step</h1>
          <p>${escapeHtml(safeMessage)}</p>
          <div class="support">
            <strong>${supportName}</strong>
            ${contactLines || "<span>Default support contact will help you.</span>"}
          </div>
          <p>Share this code with support:</p>
          <button class="code" type="button" onclick="navigator.clipboard && navigator.clipboard.writeText('${copyValue}')">${escapeHtml(definitionCode)}</button>
          <p style="margin-top:0.7rem">Reference: ${escapeHtml(referenceId)}</p>
          <div class="actions">
            <a href="${contactHref}" rel="noreferrer">Contact Support</a>
            <a href="/">Go Back Home</a>
          </div>
        </main>
      </body>
    </html>`;
}

function getDefaultSupportHref(env: PaidFunnelSupportEnv) {
  const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@ywcoach.com";

  return `mailto:${supportEmail}?subject=${encodeURIComponent("Paid masterclass support")}`;
}

function normalizeIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

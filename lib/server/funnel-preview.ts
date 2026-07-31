import type { Funnel } from "../coach-platform";

const SOCIAL_PREVIEW_USER_AGENT =
  /facebookexternalhit|WhatsApp\/|TelegramBot|Twitterbot|LinkedInBot|Slackbot|Discordbot|Pinterestbot/i;

export function isSocialPreviewRequest(request: Request) {
  return SOCIAL_PREVIEW_USER_AGENT.test(request.headers.get("user-agent") || "");
}

export function funnelSocialPreviewResponse({
  funnel,
  request
}: {
  funnel: Funnel;
  request: Request;
}) {
  const entryUrl = new URL(`/go/${funnel.entryCode}`, request.url);
  const openUrl = new URL(entryUrl);
  openUrl.searchParams.set("open", "1");
  const imageUrl = new URL("/images/yw-nutritech-logo.png", request.url);
  const title = `${funnel.displayName} | YW Coach`;
  const description = "Open the secure registration page shared by your coach.";

  return new Response(
    `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,nofollow" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="${escapeHtml(title)}" />
          <meta property="og:description" content="${escapeHtml(description)}" />
          <meta property="og:image" content="${escapeHtml(imageUrl.toString())}" />
          <meta property="og:url" content="${escapeHtml(entryUrl.toString())}" />
          <title>${escapeHtml(title)}</title>
        </head>
        <body>
          <main>
            <h1>${escapeHtml(funnel.displayName)}</h1>
            <p>${escapeHtml(description)}</p>
            <a href="${escapeHtml(openUrl.toString())}">Open registration</a>
          </main>
        </body>
      </html>`,
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
        vary: "User-Agent"
      }
    }
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

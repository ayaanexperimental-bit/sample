import type { D1Database } from "@cloudflare/workers-types";
import { verifyAdminInviteToken } from "../../../../../lib/server/admin-user-management";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_DB?: D1Database;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET", "cache-control": "no-store" }
    });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token || token.length < 24 || token.length > 200) {
    return inviteResultPage({
      message: "This admin invite link is invalid or expired.",
      status: 400,
      title: "Invite unavailable"
    });
  }

  try {
    const result = await verifyAdminInviteToken({ env, request, token });
    if (!result.ok) {
      return inviteResultPage({
        message: result.error || "This admin invite link is invalid or expired.",
        status: 400,
        title: "Invite unavailable"
      });
    }

    return inviteResultPage({
      message: "Your admin account is active. You can now log in with your email OTP.",
      status: 200,
      title: "Admin invite accepted"
    });
  } catch {
    return inviteResultPage({
      message: "The admin invite could not be verified right now.",
      status: 503,
      title: "Invite verification failed"
    });
  }
}

function inviteResultPage({
  message,
  status,
  title
}: {
  message: string;
  status: number;
  title: string;
}) {
  const html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)} | YW Coach Admin</title>
        <style>
          body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#fff7fb,#eefdfb);font-family:Inter,Arial,sans-serif;color:#172033}
          main{width:min(92vw,520px);border:1px solid #eed4df;border-radius:18px;background:#fff;padding:32px;box-shadow:0 24px 70px rgba(42,23,36,.16)}
          p:first-child{margin:0 0 12px;color:#087a73;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
          h1{margin:0 0 14px;font-size:32px;line-height:1.05}
          p{font-size:16px;line-height:1.55;color:#5d4f5c}
          a{display:inline-block;margin-top:14px;border-radius:12px;background:#102033;color:#fff;padding:13px 16px;text-decoration:none;font-weight:800}
        </style>
      </head>
      <body>
        <main>
          <p>YW Coach Admin</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
          <a href="/admin/login">Go to admin login</a>
        </main>
      </body>
    </html>`;

  return new Response(html, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8"
    }
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

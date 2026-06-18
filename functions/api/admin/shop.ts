import type { D1Database } from "@cloudflare/workers-types";
import {
  ADMIN_CSRF_HEADER,
  adminJson,
  readJsonBody,
  requireAdmin
} from "../../../lib/server/admin-auth";
import {
  createShopReportCsv,
  listShopAdminSnapshot,
  retryShopPublish,
  updateShopPaymentSettings
} from "../../../lib/server/shop";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  ROOT_OWNER_EMAIL?: string;
  SHOP_RAZORPAY_WEBHOOK_SECRET?: string;
  SHOP_PAYMENT_PAGE_URL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ShopAdminBody = {
  action?: unknown;
  active?: unknown;
  packageLabel?: unknown;
  paymentPageUrl?: unknown;
  providerLabel?: unknown;
  orderId?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET" || request.method === "HEAD") {
    const admin = await requireAdmin(request, env, {
      requiredAnyPermission: ["shop.view", "shop.payment_settings.view", "shop.reports"]
    });
    if (!admin.ok) return admin.response;

    const url = new URL(request.url);
    const report = url.searchParams.get("report");
    if (report) {
      if (!admin.admin.isOwner && !admin.admin.permissions.includes("shop.reports")) {
        return adminJson({ ok: false, error: "Access denied." }, 403);
      }
      const csv = await createShopReportCsv(env, report);
      return new Response(request.method === "HEAD" ? null : csv, {
        headers: {
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="ywcoach-shop-${report.replace(/[^a-z0-9_-]/gi, "") || "report"}.csv"`,
          "content-type": "text/csv; charset=utf-8"
        }
      });
    }

    return adminJson({
      ok: true,
      shop: await listShopAdminSnapshot(env)
    });
  }

  if (request.method === "POST") {
    const admin = await requireAdmin(request, env, {
      requireCsrf: true,
      requiredAnyPermission: ["shop.payment_settings.edit", "shop.recovery"]
    });
    if (!admin.ok) return admin.response;

    if (!request.headers.get(ADMIN_CSRF_HEADER)) {
      return adminJson({ ok: false, error: "Admin request verification failed." }, 403);
    }

    const body = (await readJsonBody<ShopAdminBody>(request)) || {};
    const action = typeof body?.action === "string" ? body.action : "";
    if (action !== "update_payment_settings" && action !== "retry_publish") {
      return adminJson({ ok: false, error: "Unsupported Shop admin action." }, 400);
    }

    if (action === "retry_publish") {
      if (!adminHasPermission(admin.admin, "shop.recovery")) {
        return adminJson({ ok: false, error: "Access denied." }, 403);
      }
      const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
      const result = await retryShopPublish({
        adminEmail: admin.admin.email,
        env,
        orderId
      });

      return adminJson(
        {
          ...result,
          shop: await listShopAdminSnapshot(env)
        },
        result.ok ? 200 : 400
      );
    }

    if (!adminHasPermission(admin.admin, "shop.payment_settings.edit")) {
      return adminJson({ ok: false, error: "Access denied." }, 403);
    }

    const result = await updateShopPaymentSettings({
      active: body.active !== false,
      adminEmail: admin.admin.email,
      env,
      packageLabel: typeof body.packageLabel === "string" ? body.packageLabel : "",
      paymentPageUrl: typeof body.paymentPageUrl === "string" ? body.paymentPageUrl : "",
      providerLabel: typeof body.providerLabel === "string" ? body.providerLabel : "",
      request
    });

    return adminJson(
      {
        ...result,
        shop: result.ok ? await listShopAdminSnapshot(env) : undefined
      },
      result.ok ? 200 : 400
    );
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, HEAD, POST"
  });
}

function adminHasPermission(admin: { isOwner?: boolean; permissions: string[] }, permission: string) {
  return Boolean(admin.isOwner || admin.permissions.includes(permission));
}

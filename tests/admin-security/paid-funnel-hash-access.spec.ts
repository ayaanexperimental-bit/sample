import { expect, test } from "@playwright/test";
import { onRequest as middlewareRequest } from "../../functions/_middleware";
import { onRequest as paymentStartRequest } from "../../functions/api/payment/start";
import { onRequest as paymentSuccessRequest } from "../../functions/api/razorpay/success";
import { onRequest as whatsappAccessRequest } from "../../functions/api/whatsapp-access";

const FUNNEL_ACCESS_SECRET = "local-funnel-hash-secret";
const SUCCESS_ACCESS_SECRET = "local-paid-hash-secret";
const PAID_ENTRY_URL = "https://ywcoach.com/go/gyana-pcos-51";
const PAID_PAGE_PATH = "/gyana/pcos-51";
const SUCCESS_PAGE_PATH = "/gyana/pcos-51/success";
const PAYMENT_PAGE_URL = "https://pages.razorpay.com/pl_hashRegression/view";
const WHATSAPP_URL = "https://chat.whatsapp.com/hashRegressionInvite";

const baseEnv = {
  FUNNEL_ACCESS_SECRET,
  SUCCESS_ACCESS_SECRET
};

test.describe("paid funnel browser-bound hash access", () => {
  test("binds the paid landing URL hash to the browser cookie", async () => {
    const entry = await openEntryLink();

    expect(entry.response.status).toBe(302);
    expect(entry.accessHash.length).toBeGreaterThanOrEqual(32);
    expect(entry.location.pathname).toBe(PAID_PAGE_PATH);

    let matchingNextCalled = false;
    const matching = await middlewareRequest({
      env: baseEnv,
      next: async () => {
        matchingNextCalled = true;
        return new Response("paid landing");
      },
      request: new Request(entry.location, {
        headers: { cookie: entry.funnelCookie }
      })
    });
    expect(matchingNextCalled).toBe(true);
    expect(matching.status).toBe(200);

    let copiedNextCalled = false;
    const copiedIntoAnotherBrowser = await middlewareRequest({
      env: baseEnv,
      next: async () => {
        copiedNextCalled = true;
        return new Response("must stay blocked");
      },
      request: new Request(entry.location)
    });
    expect(copiedNextCalled).toBe(false);
    expect(copiedIntoAnotherBrowser.status).toBe(403);

    const mismatchedUrl = new URL(entry.location);
    mismatchedUrl.searchParams.set("access", "different-browser-access-hash-value");
    const mismatched = await middlewareRequest({
      env: baseEnv,
      next: async () => new Response("must stay blocked"),
      request: new Request(mismatchedUrl, {
        headers: { cookie: entry.funnelCookie }
      })
    });
    expect(mismatched.status).toBe(403);
  });

  test("returns a safe social preview without consuming or exposing browser access", async () => {
    const response = await middlewareRequest({
      env: baseEnv,
      next: async () => new Response("unexpected"),
      request: new Request(PAID_ENTRY_URL, {
        headers: {
          "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
        }
      })
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(html).toContain('property="og:title"');
    expect(html).toContain("Gyana PMOS 51");
    expect(html).not.toContain("Access blocked");
  });

  test("upgrades only the same payment-attempt browser and protects Success plus WhatsApp", async () => {
    const entry = await openEntryLink();
    const paymentStart = await paymentStartRequest({
      env: {
        ...baseEnv,
        RAZORPAY_PAYMENT_PAGE_URL: PAYMENT_PAGE_URL
      },
      request: new Request("https://ywcoach.com/api/payment/start", {
        headers: { cookie: entry.funnelCookie }
      })
    });
    expect(paymentStart.status).toBe(302);
    expect(paymentStart.headers.get("location")).toContain(PAYMENT_PAGE_URL);
    const attemptCookie = extractCookiePair(paymentStart, "yw_payment_attempt");
    expect(attemptCookie).toContain("yw_payment_attempt=");

    const callbackWithoutAttempt = await paymentSuccessRequest({
      env: baseEnv,
      request: new Request("https://ywcoach.com/api/razorpay/success", {
        headers: { cookie: entry.funnelCookie }
      })
    });
    expect(callbackWithoutAttempt.status).toBe(403);
    expect(callbackWithoutAttempt.headers.get("set-cookie")).toBeNull();

    const callback = await paymentSuccessRequest({
      env: baseEnv,
      request: new Request("https://ywcoach.com/api/razorpay/success", {
        headers: { cookie: `${entry.funnelCookie}; ${attemptCookie}` }
      })
    });
    expect(callback.status).toBe(302);
    const successLocation = new URL(callback.headers.get("location") || "https://invalid.local");
    const paidCookie = extractCookiePair(callback, "yw_paid_access");
    expect(successLocation.pathname).toBe(SUCCESS_PAGE_PATH);
    expect(successLocation.searchParams.get("access")).toBe(entry.accessHash);
    expect(paidCookie).toContain("yw_paid_access=");
    expect(callback.headers.get("set-cookie")).toContain("Max-Age=315360000");

    let successNextCalled = false;
    const paidSuccess = await middlewareRequest({
      env: baseEnv,
      next: async () => {
        successNextCalled = true;
        return new Response("paid success");
      },
      request: new Request(successLocation, {
        headers: { cookie: paidCookie }
      })
    });
    expect(successNextCalled).toBe(true);
    expect(paidSuccess.status).toBe(200);

    let copiedSuccessNextCalled = false;
    const copiedSuccess = await middlewareRequest({
      env: baseEnv,
      next: async () => {
        copiedSuccessNextCalled = true;
        return new Response("must stay blocked");
      },
      request: new Request(successLocation)
    });
    expect(copiedSuccessNextCalled).toBe(false);
    expect(copiedSuccess.status).toBe(403);

    const entryCookieOnSuccess = await middlewareRequest({
      env: baseEnv,
      next: async () => new Response("must stay blocked"),
      request: new Request(successLocation, {
        headers: { cookie: entry.funnelCookie }
      })
    });
    expect(entryCookieOnSuccess.status).toBe(403);

    const whatsapp = await whatsappAccessRequest({
      env: {
        ...baseEnv,
        ADMIN_DB: createPrivateLinksDb()
      },
      request: new Request(
        `https://ywcoach.com/api/whatsapp-access?access=${encodeURIComponent(entry.accessHash)}`,
        {
          headers: {
            accept: "application/json",
            cookie: paidCookie
          }
        }
      )
    });
    expect(whatsapp.status).toBe(200);
    expect(await whatsapp.json()).toMatchObject({
      allowed: true,
      joinUrl: WHATSAPP_URL
    });

    const copiedWhatsapp = await whatsappAccessRequest({
      env: {
        ...baseEnv,
        ADMIN_DB: createPrivateLinksDb()
      },
      request: new Request(
        `https://ywcoach.com/api/whatsapp-access?access=${encodeURIComponent(entry.accessHash)}`,
        { headers: { accept: "application/json" } }
      )
    });
    expect(await copiedWhatsapp.json()).toMatchObject({
      allowed: false,
      reason: "paid_access_required"
    });
  });
});

async function openEntryLink() {
  const response = await middlewareRequest({
    env: baseEnv,
    next: async () => new Response("unexpected"),
    request: new Request(PAID_ENTRY_URL, {
      headers: { "user-agent": "Mozilla/5.0 test-browser" }
    })
  });
  const location = new URL(response.headers.get("location") || "https://invalid.local");

  return {
    accessHash: location.searchParams.get("access") || "",
    funnelCookie: extractCookiePair(response, "yw_active_funnel"),
    location,
    response
  };
}

function extractCookiePair(response: Response, name: string) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));

  return match ? `${name}=${match[1]}` : "";
}

function createPrivateLinksDb() {
  return {
    prepare(statement: string) {
      return {
        bind() {
          return {
            first: async () =>
              statement.includes("FROM private_funnel_links")
                ? {
                    funnel_id: "gyana-pcos-51",
                    payment_page_url: PAYMENT_PAGE_URL,
                    payment_updated_at: 0,
                    payment_updated_by: "",
                    updated_at: 0,
                    updated_by: "test",
                    whatsapp_group_url: WHATSAPP_URL
                  }
                : null,
            run: async () => ({ success: true })
          };
        },
        first: async () => null,
        run: async () => ({ success: true })
      };
    }
  } as never;
}

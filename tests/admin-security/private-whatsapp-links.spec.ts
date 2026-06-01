import { expect, test } from "@playwright/test";
import { getFunnelById } from "../../lib/coach-platform";
import { createFunnelAccessCookie } from "../../lib/server/funnel-access";
import { getPrivateWhatsappGroupUrl } from "../../lib/server/private-funnel-links";
import { onRequest as whatsappAccessRequest } from "../../functions/api/whatsapp-access";

const FUNNEL_ACCESS_SECRET = "local-funnel-secret";
const PAID_FUNNEL_ID = "gyana-pcos-51";
const PRIVATE_WHATSAPP_URL = "https://chat.whatsapp.com/localRegressionInvite";

test.describe("private WhatsApp links", () => {
  test("does not keep the paid WhatsApp invite in public funnel config", () => {
    const funnel = getFunnelById(PAID_FUNNEL_ID);

    expect(funnel).toBeTruthy();
    expect("whatsappGroupUrl" in (funnel as Record<string, unknown>)).toBe(false);
  });

  test("resolves private WhatsApp URL only from server env", () => {
    const funnel = getFunnelById(PAID_FUNNEL_ID);
    if (!funnel) throw new Error("Missing paid funnel fixture.");

    expect(getPrivateWhatsappGroupUrl(funnel, {})).toBeNull();
    expect(
      getPrivateWhatsappGroupUrl(funnel, {
        WHATSAPP_GROUP_URL_GYANA_PCOS_51: PRIVATE_WHATSAPP_URL
      })
    ).toBe(PRIVATE_WHATSAPP_URL);
    expect(
      getPrivateWhatsappGroupUrl(funnel, {
        WHATSAPP_GROUP_URL_GYANA_PCOS_51: "https://example.com/not-whatsapp"
      })
    ).toBeNull();
  });

  test("paid WhatsApp API returns join URL only when env and funnel cookie match", async () => {
    const noCookie = await whatsappAccessRequest({
      env: {
        FUNNEL_ACCESS_SECRET,
        WHATSAPP_GROUP_URL_GYANA_PCOS_51: PRIVATE_WHATSAPP_URL
      },
      request: new Request("https://ywcoach.com/api/whatsapp-access")
    });
    expect(noCookie.status).toBe(200);
    expect(await noCookie.json()).toMatchObject({
      allowed: false,
      reason: "funnel_access_required"
    });

    const paidCookie = await createFunnelAccessCookie({
      entryCode: PAID_FUNNEL_ID,
      funnelId: PAID_FUNNEL_ID,
      secret: FUNNEL_ACCESS_SECRET,
      secure: true
    });
    const allowed = await whatsappAccessRequest({
      env: {
        FUNNEL_ACCESS_SECRET,
        WHATSAPP_GROUP_URL_GYANA_PCOS_51: PRIVATE_WHATSAPP_URL
      },
      request: new Request("https://ywcoach.com/api/whatsapp-access", {
        headers: {
          cookie: paidCookie.split(";")[0]
        }
      })
    });

    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      allowed: true,
      joinUrl: PRIVATE_WHATSAPP_URL
    });
  });
});

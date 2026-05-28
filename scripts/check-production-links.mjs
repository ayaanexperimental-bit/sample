const SITE_URL = trimTrailingSlash(process.env.SITE_URL || "https://freedomfromdiabetes.in");
const PAYMENT_HOST = "pages.razorpay.com";
const THANK_YOU_VIDEO_URL = "https://www.youtube.com/watch?v=fLSSje0nCHk";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/FceSzvdQmNr2gHNCSaBXyy";
const REQUEST_TIMEOUT_MS = 12_000;

const checks = [
  {
    name: "Home page",
    url: `${SITE_URL}/`,
    allowedStatuses: [200]
  },
  {
    name: "Success page",
    url: `${SITE_URL}/success`,
    allowedStatuses: [200]
  },
  {
    name: "Payment redirect",
    url: `${SITE_URL}/api/payment/start`,
    allowedStatuses: [302],
    redirect: "manual",
    validate(response) {
      const location = response.headers.get("location") || "";
      const host = safeHost(location);

      if (host !== PAYMENT_HOST) {
        throw new Error(`expected redirect to ${PAYMENT_HOST}, received ${location || "no location"}`);
      }
    }
  },
  {
    name: "WhatsApp group",
    url: WHATSAPP_GROUP_URL,
    allowedStatuses: [200, 301, 302, 303, 307, 308]
  },
  {
    name: "Thank-you video",
    url: THANK_YOU_VIDEO_URL,
    allowedStatuses: [200, 301, 302, 303, 307, 308]
  }
];

let failures = 0;

for (const check of checks) {
  try {
    const response = await request(check);

    if (!check.allowedStatuses.includes(response.status)) {
      throw new Error(`unexpected status ${response.status}`);
    }

    check.validate?.(response);
    await response.body?.cancel();
    console.log(`PASS ${check.name}: ${response.status}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  process.exit(1);
}

function request(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return fetch(check.url, {
    headers: {
      "user-agent": "YoursWellnessLinkCheck/1.0"
    },
    redirect: check.redirect || "follow",
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

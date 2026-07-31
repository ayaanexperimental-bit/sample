const SITE_URL = trimTrailingSlash(process.env.SITE_URL || "https://ywcoach.com");
const ROOT_REDIRECT_URL = "https://yourswellness.in";
const PAYMENT_HOST = "pages.razorpay.com";
const THANK_YOU_VIDEO_URL = "https://www.youtube-nocookie.com/embed/fLSSje0nCHk?rel=0";
const REQUEST_TIMEOUT_MS = 12_000;

const checks = [
  async () => {
    const response = await request(`${SITE_URL}/`, { redirect: "manual" });
    assertStatus(response, [302], "Root redirect");
    assertLocation(response, ROOT_REDIRECT_URL, "Root redirect");
  },
  async () => {
    const guestEntry = await request(`${SITE_URL}/go/gyana-guest`, { redirect: "manual" });
    assertStatus(guestEntry, [302], "Gyana guest entry");
    assertPath(guestEntry.headers.get("location"), "/gyana", "Gyana guest entry");

    const guestCookie = getSetCookie(guestEntry);
    const guestPage = await request(`${SITE_URL}/gyana`, { cookie: guestCookie });
    assertStatus(guestPage, [200], "Gyana guest page");

    const blockedPaid = await request(`${SITE_URL}/gyana/pcos-51`, { cookie: guestCookie });
    assertStatus(blockedPaid, [403], "Guest cannot open paid page");

    const guestWhatsapp = await request(`${SITE_URL}/api/whatsapp-access`, {
      cookie: guestCookie
    });
    assertStatus(guestWhatsapp, [200], "Guest WhatsApp API");
    await assertNoJoinUrl(guestWhatsapp, "Guest WhatsApp API");
  },
  async () => {
    const paidEntry = await request(`${SITE_URL}/go/gyana-pcos-51`, { redirect: "manual" });
    assertStatus(paidEntry, [302], "Gyana paid entry");
    const paidLocation = paidEntry.headers.get("location") || "";
    assertPath(paidLocation, "/gyana/pcos-51", "Gyana paid entry");
    const paidAccessHash = new URL(paidLocation).searchParams.get("access") || "";
    if (!paidAccessHash) {
      throw new Error("Gyana paid entry: missing browser-bound access hash");
    }

    const paidCookie = getSetCookie(paidEntry);
    const paidPage = await request(paidLocation, { cookie: paidCookie });
    assertStatus(paidPage, [200], "Gyana paid page");

    const copiedPaidPage = await request(paidLocation);
    assertStatus(copiedPaidPage, [403], "Copied paid page is blocked");

    const blockedGuest = await request(`${SITE_URL}/gyana`, { cookie: paidCookie });
    assertStatus(blockedGuest, [403], "Paid cannot open guest page");

    const directSuccess = await request(
      `${SITE_URL}/gyana/pcos-51/success?access=${encodeURIComponent(paidAccessHash)}`,
      { cookie: paidCookie }
    );
    assertStatus(directSuccess, [403], "Direct success page is blocked before payment return");

    const paymentRedirect = await request(`${SITE_URL}/api/payment/start`, {
      cookie: paidCookie,
      redirect: "manual"
    });
    assertStatus(paymentRedirect, [302], "Payment redirect");
    assertHost(paymentRedirect.headers.get("location"), PAYMENT_HOST, "Payment redirect");

    const whatsappAccess = await request(
      `${SITE_URL}/api/whatsapp-access?access=${encodeURIComponent(paidAccessHash)}`,
      {
        cookie: paidCookie
      }
    );
    assertStatus(whatsappAccess, [200], "Pre-payment WhatsApp API");
    await assertNoJoinUrl(whatsappAccess, "Pre-payment WhatsApp API");
  },
  async () => {
    const invalidEntry = await request(`${SITE_URL}/go/not-real`, { redirect: "manual" });
    assertStatus(invalidEntry, [404], "Invalid entry link");
  },
  async () => {
    const video = await request(THANK_YOU_VIDEO_URL, { redirect: "manual" });
    assertStatus(video, [200, 301, 302, 303, 307, 308], "Thank-you video");
  }
];

let failures = 0;

for (const check of checks) {
  try {
    await check();
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  process.exit(1);
}

function assertStatus(response, allowedStatuses, name) {
  if (!allowedStatuses.includes(response.status)) {
    throw new Error(`${name}: unexpected status ${response.status}`);
  }

  console.log(`PASS ${name}: ${response.status}`);
}

function assertLocation(response, expected, name) {
  const location = response.headers.get("location") || "";

  if (location !== expected) {
    throw new Error(
      `${name}: expected redirect to ${expected}, received ${location || "no location"}`
    );
  }
}

function assertPath(value, expectedPath, name) {
  const path = safePath(value);

  if (path !== expectedPath) {
    throw new Error(`${name}: expected path ${expectedPath}, received ${value || "no location"}`);
  }
}

function assertHost(value, expectedHost, name) {
  const host = safeHost(value);

  if (host !== expectedHost) {
    throw new Error(`${name}: expected host ${expectedHost}, received ${value || "no location"}`);
  }
}

async function assertNoJoinUrl(response, name) {
  const payload = await response.json();

  if (payload?.joinUrl) {
    throw new Error(`${name}: joinUrl leaked when access was not allowed`);
  }

  console.log(`PASS ${name}: no joinUrl`);
}

function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = {
    "user-agent": "YoursWellnessLinkCheck/1.0"
  };

  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  return fetch(url, {
    headers,
    redirect: options.redirect || "follow",
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

function getSetCookie(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  const [cookie] = setCookie.split(";");

  if (!cookie) {
    throw new Error("missing funnel access cookie");
  }

  return cookie;
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function safePath(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

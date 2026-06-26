import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_COACH_TEMPLATE_THEME_ID,
  COACH_TEMPLATE_THEME_IDS,
  coachTemplateThemes,
  normalizeCoachTemplateThemeId
} from "../../lib/coach-template-themes";
import {
  canonicalCoachSectionRegistry,
  canonicalCoachTemplateRules,
  getCanonicalCoachFaqItems,
  getCanonicalCoachSectionCopy,
  getCanonicalHeroPackage,
  getCanonicalCoachNavbarSections,
  getCanonicalRegisterLabel,
  getNicheAdaptiveBonusSection,
  universalCoachBonuses
} from "../../lib/coach-canonical-template";
import { EMPTY_COACH_SITE_FORM, createCoachContentFromForm } from "../../lib/admin-coach-sites";
import {
  buildCoachSiteFromShopState,
  normalizeShopBuilderState,
  validateShopBuilderState
} from "../../lib/shop-builder";
import { onRequest as handleCoachMediaRequest } from "../../functions/api/coach-media";

const EXPECTED_ACTIVE_SKIN_IDS = [
  CANONICAL_COACH_TEMPLATE_THEME_ID,
  "editorial-wellness",
  "liquid-glass",
  "dark-luxury",
  "soft-feminine",
  "minimal-premium",
  "prism-aurora",
  "performance-energy",
  "creator-brand"
];
const EXPECTED_LEGACY_SKIN_NORMALIZATION = {
  "apple-liquid-glass": "liquid-glass",
  "dark-luxury-wellness": "dark-luxury",
  default: CANONICAL_COACH_TEMPLATE_THEME_ID,
  "not-a-real-template": CANONICAL_COACH_TEMPLATE_THEME_ID,
  "premium-feminine-wellness": "soft-feminine"
} as const;
const LEGACY_THEME_IDS = Object.keys(EXPECTED_LEGACY_SKIN_NORMALIZATION) as Array<
  keyof typeof EXPECTED_LEGACY_SKIN_NORMALIZATION
>;

const UNSAFE_HEALTH_COPY =
  /\b(cure|guarantee(?:d)?|reverse(?:d|s)?|reversal|without medicines?|stop(?:ping)? medicines?|diagnos(?:e|is)|treat(?:ment|s|ed)?|heal(?:s|ed|ing)? disease)\b/i;
const UNSAFE_PROMISE_COPY =
  /\b(cure|guarantee(?:d)?|reverse(?:d|s)? disease|reversal|without medicines?|stop(?:ping)? medicines?|heal(?:s|ed|ing)? disease)\b/i;
const FIXED_BONUS_SERVICE_TITLES = [
  "Life-Long Health Calculators",
  "Lifetime Support Sessions",
  "Lifestyle Success Toolkit"
];
const FIXED_BONUS_IMAGE_URLS = [
  "/assets/bonus-life-long-health-calculators.png",
  "/assets/bonus-lifetime-support-sessions.png",
  "/assets/bonus-lifestyle-success-toolkit.png"
];
const STALE_SECTION_COPY =
  /\b(free live masterclass|limited seats|2[-\s]?hour masterclass|only for women|women only|exclusively for women|the coaching blueprint|this masterclass is free|transformation isn't optional|masterclass right for you|real women|they used this blueprint|secure your seat)\b/i;
const STALE_DETERMINISTIC_DEFAULT_COPY =
  /\b(YW Nutritech premium coach profile|Built for client-ready referrals|Ready to work with this coach|Questions before connecting|Premium Coach Website|premium\s+[a-z0-9 /&-]+\s+support|care lens|support style|Coach media spotlight|Photo and video-ready profile|Contact Coach|Free guest registration)\b/i;
const REPO_ROOT = process.cwd();

test.describe("canonical coach template rules", () => {
  test("canonical renderer exposes only the protected visual skins and old IDs normalize safely", () => {
    expect(COACH_TEMPLATE_THEME_IDS).toEqual(EXPECTED_ACTIVE_SKIN_IDS);
    expect(coachTemplateThemes.map((theme) => theme.id)).toEqual(EXPECTED_ACTIVE_SKIN_IDS);
    expect(coachTemplateThemes[0].id).toBe(CANONICAL_COACH_TEMPLATE_THEME_ID);
    expect(new Set(coachTemplateThemes.map((theme) => theme.id)).size).toBe(
      coachTemplateThemes.length
    );

    for (const themeId of LEGACY_THEME_IDS) {
      expect(normalizeCoachTemplateThemeId(themeId)).toBe(
        EXPECTED_LEGACY_SKIN_NORMALIZATION[themeId]
      );
      expect(normalizeShopBuilderState({ selectedThemeId: themeId }).selectedThemeId).toBe(
        EXPECTED_LEGACY_SKIN_NORMALIZATION[themeId]
      );
    }
  });

  test("theme skins are presentation-only and use the shared background layer", () => {
    const skinRule = canonicalCoachTemplateRules.find(
      (item) => item.ruleKey === "themeSkinPresentationOnly"
    );
    const parityRule = canonicalCoachTemplateRules.find(
      (item) => item.ruleKey === "previewPublicRendererParity"
    );
    const copyRule = canonicalCoachTemplateRules.find(
      (item) => item.ruleKey === "coachCopyQualityGuard"
    );
    const rendererSource = readFileSync(
      join(REPO_ROOT, "components/coach/public-coach-site-page.tsx"),
      "utf8"
    );
    const cssSource = readFileSync(join(REPO_ROOT, "public/coach-circle-template.css"), "utf8");

    expect(skinRule).toBeTruthy();
    expect(skinRule?.enabled).toBe(true);
    expect(skinRule?.aiAdaptive).toBe(false);
    expect(skinRule?.source).toBe("themeSkinRegistry");
    expect(skinRule?.lockedFields).toEqual(
      expect.arrayContaining([
        "route.slug",
        "cta.destination",
        "googleFormUrl",
        "contactSupport.behavior",
        "legal.backToLandingPage",
        "analytics.tracking",
        "inspect.permissions",
        "section.structure"
      ])
    );
    expect(skinRule?.animationBehavior).toEqual(
      expect.objectContaining({
        backgroundDecorativeOnly: true,
        noClickBlocking: true,
        reducedMotionSafe: true,
        staticFallbackRequired: true,
        stickyElementsAboveBackground: true
      })
    );

    expect(parityRule?.lockedFields).toEqual(
      expect.arrayContaining([
        "renderer.component",
        "content.normalization",
        "selectedThemeId",
        "sticky.navbar",
        "sticky.bottomCta",
        "legal.links",
        "faq.accordion"
      ])
    );
    expect(copyRule?.legalSafetyRules).toEqual(
      expect.objectContaining({
        noDeveloperLanguage: true,
        noFakeScarcity: true,
        noGuaranteedResults: true,
        noRawInputCopyPaste: true,
        noWrongNicheLeakage: true,
        preserveDisclaimer: true
      })
    );

    expect(rendererSource).toContain("function TemplateBackgroundLayer");
    expect(rendererSource).toContain("data-motion-level");
    expect(rendererSource).toContain("data-variant");
    expect(rendererSource).toContain("getTemplateBackgroundVariant(selectedTheme.id)");
    expect(cssSource).toContain("--yw-template-background-intensity");
    expect(cssSource).toContain("--yw-template-background-opacity");
    expect(cssSource).toContain('.yw-allia-background[data-variant="aurora"]::before');
    expect(cssSource).toContain('.yw-allia-background[data-motion-level="none"]::before');
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssSource).toContain("Canonical template skin layer");
    expect(cssSource).toContain("--template-nav-surface");
    expect(cssSource).toContain("--template-section-cream");
    expect(cssSource).toContain("--template-section-dark");
    expect(cssSource).toContain("--template-cta");

    for (const themeId of EXPECTED_ACTIVE_SKIN_IDS) {
      expect(cssSource).toContain(`.yw-circle-site[data-yw-template-theme="${themeId}"]`);
      expect(cssSource).toContain(`.yw-allia-background[data-theme="${themeId}"]`);
    }

    const navSurfaces = new Set(
      coachTemplateThemes.map((theme) => theme.cssVars["--yw-theme-nav"])
    );
    const ctaSurfaces = new Set(
      coachTemplateThemes.map((theme) => theme.cssVars["--yw-theme-cta"])
    );
    expect(navSurfaces.size).toBe(coachTemplateThemes.length);
    expect(ctaSurfaces.size).toBe(coachTemplateThemes.length);
  });

  test("canonical navbar is generated from real coach-site section registry", () => {
    const navbarSections = getCanonicalCoachNavbarSections();

    expect(navbarSections.map((section) => section.navLabel)).toEqual([
      "Home",
      "About Coach",
      "Journey",
      "Results",
      "Bonuses",
      "FAQ",
      "Contact"
    ]);
    expect(
      navbarSections.every((section) => section.anchorTarget === `#${section.sectionId}`)
    ).toBe(true);
    expect(navbarSections.every((section) => section.enabled && section.visibleInNavbar)).toBe(
      true
    );
    expect(canonicalCoachSectionRegistry.map((section) => section.sectionId)).toEqual([
      "home",
      "story",
      "problem",
      "how-it-works",
      "results",
      "for-you",
      "bonus",
      "faq",
      "yw-footer"
    ]);

    const componentSource = readFileSync(
      join(REPO_ROOT, "components/coach/public-coach-site-page.tsx"),
      "utf8"
    );
    const staticRendererSource = readFileSync(join(REPO_ROOT, "functions/coach/[slug].ts"), "utf8");
    const combined = `${componentSource}\n${staticRendererSource}`;

    expect(combined).not.toMatch(
      /About Us|Quality & Innovation|Our Brands|Careers|Contact Us|Who We Are|Our Team|A note from our founder/
    );
    expect(combined).toContain("getCanonicalCoachNavbarSections");
    for (const section of navbarSections) {
      expect(combined).toContain(`id="${section.sectionId}"`);
    }
  });

  test("Shop and Admin canonical defaults do not seed stale prototype copy", () => {
    const shopState = normalizeShopBuilderState({
      coachName: "Asha Sharma",
      location: "Bhubaneswar",
      niche: "Gut health",
      shortBio: "Practical education-first wellness guidance."
    });
    const adminContent = createCoachContentFromForm({
      ...EMPTY_COACH_SITE_FORM,
      bio: "Practical education-first wellness guidance.",
      coachName: "Asha Sharma",
      location: "Bhubaneswar",
      niche: "Gut health",
      registerButtonText: "Register Now",
      vision: "Help people build calmer daily routines."
    });

    expect(JSON.stringify(shopState.content)).not.toMatch(STALE_DETERMINISTIC_DEFAULT_COPY);
    expect(JSON.stringify(adminContent)).not.toMatch(STALE_DETERMINISTIC_DEFAULT_COPY);

    const staleSavedSite = buildCoachSiteFromShopState({
      published: true,
      state: {
        coachName: "Asha Sharma",
        contactLink: "https://forms.gle/example",
        content: {
          brandBadge: "YW Nutritech premium coach profile",
          brandEyebrow: "Built for client-ready referrals",
          ctaText: "Ready to work with this coach?",
          faqHeading: "Questions before connecting",
          footerBrandLine: "YW Nutritech Premium Coach Website",
          heroHeadline: "Asha Sharma: premium gut health support",
          heroTrustLine: "YW Nutritech care lens",
          journeySteps: [
            {
              description: "Understand the coach support style before registering.",
              label: "Profile",
              title: "Meet Asha"
            }
          ],
          mediaHeading: "Coach media spotlight",
          mediaSubheading: "Photo and video-ready profile",
          stickyCtaContactButton: "Contact Coach",
          stickyCtaLabel: "Free guest registration"
        },
        niche: "Gut health",
        shortBio: "Practical education-first wellness guidance."
      }
    });
    const rendered = getCanonicalCoachSectionCopy(staleSavedSite);
    const renderedText = [
      rendered.topStrip,
      rendered.heroEyebrow,
      rendered.heroTitleMain,
      rendered.heroTitleAccent,
      rendered.heroSubheadline,
      rendered.faqHeading,
      rendered.stickyCtaEyebrow,
      rendered.trustHeading,
      ...rendered.journeySteps.flatMap((step) => [step.label, step.title, step.description])
    ].join(" ");

    expect(renderedText).not.toMatch(STALE_DETERMINISTIC_DEFAULT_COPY);
  });

  test("Shop input normalization preserves typed URLs while validation/build enforce safe values", () => {
    const shopClientSource = readFileSync(
      join(REPO_ROOT, "app/shop/shop-builder-client.tsx"),
      "utf8"
    );
    const partial = normalizeShopBuilderState({
      coachName: "Asha Sharma",
      contactLink: "h",
      email: "asha@example.com",
      location: "Bhubaneswar",
      niche: "Gut health",
      photoUrl: "https://cdn.example.com/photo.png",
      shortBio: "Practical education-first wellness guidance.",
      videoUrl: "https://youtube.com/watch?v=abc123"
    });

    expect(partial.contactLink).toBe("h");
    expect(partial.photoUrl).toBe("https://cdn.example.com/photo.png");
    expect(partial.videoUrl).toBe("https://youtube.com/watch?v=abc123");
    expect(shopClientSource).not.toContain(
      'placeholder="https://forms.gle/... or https://wa.me/..."'
    );
    expect(shopClientSource).toContain("Paste one public HTTPS registration link only.");
    expect(validateShopBuilderState(partial, { requirePaymentReady: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "contactLink",
          message: "Enter one valid HTTPS registration/contact link only."
        })
      ])
    );

    const duplicateLink = normalizeShopBuilderState({
      ...partial,
      contactLink: "https://forms.gle/one https://forms.gle/two"
    });
    expect(validateShopBuilderState(duplicateLink, { requirePaymentReady: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "contactLink",
          message: "Enter one valid HTTPS registration/contact link only."
        })
      ])
    );

    const invalidPhone = normalizeShopBuilderState({
      ...partial,
      coachPhone: "1234567",
      contactLink: "https://forms.gle/one"
    });
    expect(validateShopBuilderState(invalidPhone, { requirePaymentReady: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "coachPhone",
          message: "Enter one valid 10-digit Indian phone/WhatsApp number."
        })
      ])
    );

    const leadingZeroPhone = normalizeShopBuilderState({
      ...partial,
      coachPhone: "09938999448",
      contactLink: "https://forms.gle/one"
    });
    expect(validateShopBuilderState(leadingZeroPhone, { requirePaymentReady: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "coachPhone",
          message: "Enter one valid 10-digit Indian phone/WhatsApp number."
        })
      ])
    );

    const safePhone = normalizeShopBuilderState({
      ...partial,
      coachPhone: "+91 98765 43210",
      contactLink: "https://forms.gle/one"
    });
    expect(
      validateShopBuilderState(safePhone, { requirePaymentReady: true }).filter(
        (issue) => issue.severity === "error"
      )
    ).toEqual([]);

    const unsafePublicSite = buildCoachSiteFromShopState({
      state: {
        ...partial,
        contactLink: "h",
        photoUrl: "javascript:alert(1)",
        videoUrl: "http://localhost:3000/video"
      }
    });
    expect(unsafePublicSite.googleFormUrl).toBe("");
    expect(unsafePublicSite.photoUrl).toBe("");
    expect(unsafePublicSite.videoUrl).toBe("");
  });

  test("Shop draft entry is email-first while publish keeps complete coach validation", () => {
    const shopClientSource = readFileSync(
      join(REPO_ROOT, "app/shop/shop-builder-client.tsx"),
      "utf8"
    );
    const shopServerSource = readFileSync(join(REPO_ROOT, "lib/server/shop.ts"), "utf8");

    expect(shopClientSource).toContain(
      "Enter a valid email first so we can save and recover this draft."
    );
    expect(shopClientSource).toContain("Coach details come next inside the builder.");
    expect(shopClientSource).toContain("return isValidShopEmail(state.email || state.coachEmail);");
    const entryShellStart = shopClientSource.indexOf("styles.entryShell");
    const entryShellEnd = shopClientSource.indexOf(
      "We create a secure server draft",
      entryShellStart
    );
    const entryShellSource = shopClientSource.slice(entryShellStart, entryShellEnd);
    expect(entryShellSource).not.toContain('label="Coach name"');
    expect(entryShellSource).not.toContain('label="Niche"');
    expect(shopClientSource).not.toContain("Coach name is required before saving a draft.");
    expect(shopServerSource).toContain("Enter a valid email before saving this Shop draft.");
    expect(shopServerSource).toContain("function isValidShopDraftEmail");
    expect(shopServerSource).toContain(
      "payment_status IN ('draft', 'incomplete', 'payment_failed')"
    );
    expect(shopServerSource).toContain("payment_status = 'pending_payment'");

    const emailOnlyDraft = normalizeShopBuilderState({
      email: "draft@example.com"
    });
    expect(emailOnlyDraft.email).toBe("draft@example.com");
    expect(validateShopBuilderState(emailOnlyDraft, { requirePaymentReady: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "coachName" }),
        expect.objectContaining({ field: "niche" }),
        expect.objectContaining({ field: "shortBio" })
      ])
    );
    expect(validateShopBuilderState(emailOnlyDraft, { requirePaymentReady: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "coachName" }),
        expect.objectContaining({ field: "niche" }),
        expect.objectContaining({ field: "shortBio" })
      ])
    );
  });

  test("Shop cutout media URLs stay stable after upload normalization", () => {
    const cutoutUrl =
      "/api/coach-media?key=coach-sites%2Fshop-draft%2Fimage%2Fcutout%2F20260624083011-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png";
    const originalUrl =
      "/api/coach-media?key=coach-sites%2Fshop-draft%2Fimage%2Foriginal%2F20260624083011-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpeg";
    const videoUrl =
      "/api/coach-media?key=coach-sites%2Fshop-draft%2Fvideo%2F20260624083011-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4";

    const normalized = normalizeShopBuilderState({
      coachName: "Media Coach",
      contactLink: "https://forms.gle/media",
      email: "media@example.com",
      niche: "General wellness",
      photoUrl: cutoutUrl,
      slug: "shop-draft",
      videoUrl
    });
    expect(normalized.photoUrl).toBe(cutoutUrl);
    expect(normalized.videoUrl).toBe(videoUrl);

    const publishedSite = buildCoachSiteFromShopState({ state: normalized });
    expect(publishedSite.photoUrl).toBe(cutoutUrl);
    expect(publishedSite.videoUrl).toBe(videoUrl);

    const originalSite = buildCoachSiteFromShopState({
      state: {
        ...normalized,
        photoUrl: originalUrl
      }
    });
    expect(originalSite.photoUrl).toBe(originalUrl);

    const unsafeTemporarySite = buildCoachSiteFromShopState({
      state: {
        ...normalized,
        photoUrl: "blob:http://localhost:3000/preview"
      }
    });
    expect(unsafeTemporarySite.photoUrl).toBe("");
  });

  test("coach media endpoint serves canonical original and cutout image object keys", async () => {
    const servedKeys: string[] = [];
    const makeRequest = (key: string) =>
      handleCoachMediaRequest({
        env: {
          COACH_MEDIA_BUCKET: {
            get: async (objectKey: string) => {
              servedKeys.push(objectKey);
              return {
                body: new Uint8Array([1, 2, 3]),
                httpEtag: '"test-media"',
                httpMetadata: {
                  contentType: "image/png"
                }
              };
            }
          }
        },
        request: new Request(`https://ywcoach.com/api/coach-media?key=${encodeURIComponent(key)}`)
      } as unknown as Parameters<typeof handleCoachMediaRequest>[0]);

    const cutoutResponse = await makeRequest(
      "coach-sites/media-coach/image/cutout/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png"
    );
    expect(cutoutResponse.status).toBe(200);
    expect(cutoutResponse.headers.get("content-type")).toBe("image/png");

    const originalResponse = await makeRequest(
      "coach-sites/media-coach/image/original/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpeg"
    );
    expect(originalResponse.status).toBe(200);

    const legacyImageResponse = await makeRequest(
      "coach-sites/media-coach/image/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png"
    );
    expect(legacyImageResponse.status).toBe(200);

    const videoResponse = await makeRequest(
      "coach-sites/media-coach/video/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4"
    );
    expect(videoResponse.status).toBe(200);

    const blockedResponse = await makeRequest(
      "coach-sites/media-coach/image/private/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png"
    );
    expect(blockedResponse.status).toBe(404);

    expect(servedKeys).toEqual([
      "coach-sites/media-coach/image/cutout/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png",
      "coach-sites/media-coach/image/original/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpeg",
      "coach-sites/media-coach/image/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png",
      "coach-sites/media-coach/video/20260624102030-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4"
    ]);
  });

  test("Admin and Shop hero media support YouTube links plus uploaded videos up to 70 MB", () => {
    const adminClientSource = readFileSync(
      join(REPO_ROOT, "components/admin/admin-coach-sites-manager.tsx"),
      "utf8"
    );
    const shopClientSource = readFileSync(
      join(REPO_ROOT, "app/shop/shop-builder-client.tsx"),
      "utf8"
    );
    const adminMediaApiSource = readFileSync(
      join(REPO_ROOT, "functions/api/admin/coach-sites/media.ts"),
      "utf8"
    );
    const shopMediaApiSource = readFileSync(join(REPO_ROOT, "functions/api/shop/media.ts"), "utf8");

    expect(adminClientSource).toContain("VIDEO_MAX_BYTES = 70 * 1024 * 1024");
    expect(shopClientSource).toContain("SHOP_VIDEO_MAX_BYTES = 70 * 1024 * 1024");

    for (const source of [adminClientSource, shopClientSource]) {
      expect(source).toContain("VIDEO_UPLOAD_ACCEPT");
      expect(source).toContain(".mkv");
      expect(source).toContain("video/x-matroska");
      expect(source).toContain("YouTube/video");
      expect(source).not.toContain("under 24 MB");
    }

    for (const source of [adminMediaApiSource, shopMediaApiSource]) {
      expect(source).toContain("MAX_VIDEO_BYTES = 70 * 1024 * 1024");
      expect(source).toContain(".mkv");
      expect(source).toContain("video/x-matroska");
      expect(source).toContain("YouTube/video URL");
      expect(source).not.toContain("under 24 MB");
    }
  });

  test("coach photo uploads use local browser cutout processing with no paid provider fallback", () => {
    const adminClientSource = readFileSync(
      join(REPO_ROOT, "components/admin/admin-coach-sites-manager.tsx"),
      "utf8"
    );
    const shopClientSource = readFileSync(
      join(REPO_ROOT, "app/shop/shop-builder-client.tsx"),
      "utf8"
    );
    const adminMediaApiSource = readFileSync(
      join(REPO_ROOT, "functions/api/admin/coach-sites/media.ts"),
      "utf8"
    );
    const shopMediaApiSource = readFileSync(join(REPO_ROOT, "functions/api/shop/media.ts"), "utf8");
    const adminReprocessSource = readFileSync(
      join(REPO_ROOT, "functions/api/admin/coach-sites/media-reprocess.ts"),
      "utf8"
    );
    const shopReprocessSource = readFileSync(
      join(REPO_ROOT, "functions/api/shop/media-reprocess.ts"),
      "utf8"
    );
    const clientProcessingSource = readFileSync(
      join(REPO_ROOT, "lib/client/coach-photo-background-removal.ts"),
      "utf8"
    );
    const mediaStorageSource = readFileSync(
      join(REPO_ROOT, "lib/server/coach-site-storage.ts"),
      "utf8"
    );
    const reactSource = readFileSync(
      join(REPO_ROOT, "components/coach/public-coach-site-page.tsx"),
      "utf8"
    );
    const publicRouteSource = readFileSync(join(REPO_ROOT, "functions/coach/[slug].ts"), "utf8");

    for (const source of [adminClientSource, shopClientSource]) {
      expect(source).toContain("prepareCoachHeroPhotoForUpload");
      expect(source).toContain('formData.append("cutoutFile", cutoutFile)');
      expect(source).toContain("Preparing your coach photo...");
      expect(source).toContain("Saving transparent coach photo");
      expect(source).toContain("Use cutout");
      expect(source).toContain("Use original frame");
      expect(source).toContain("Reset image");
      expect(source).not.toContain("Try fallback provider");
      expect(source).not.toContain("premium framed version");
    }

    expect(clientProcessingSource).toContain("@bunnio/rembg-web");
    expect(clientProcessingSource).toContain("onnxruntime-web");
    expect(clientProcessingSource).toContain('REMBG_MODEL_NAME = "u2netp"');
    expect(clientProcessingSource).toContain('REMBG_MODEL_BASE_URL = "/models"');
    expect(clientProcessingSource).toContain('ORT_WASM_BASE_URL = "/ort/"');
    expect(clientProcessingSource).not.toMatch(
      /PHOTOROOM_API_KEY|REMOVEBG_API_KEY|remove\.bg|photoroom/i
    );

    for (const source of [adminMediaApiSource, shopMediaApiSource]) {
      expect(source).toContain("rawCutoutFile");
      expect(source).toContain("Transparent coach cutout is required");
      expect(source).toContain('"original"');
      expect(source).toContain('variant: "cutout"');
      expect(source).toContain("originalUrl");
      expect(source).toContain("cutoutUrl");
      expect(source).toContain("processingStatus");
      expect(source).toContain("qualityStatus");
      expect(source).toContain("fallbackMode");
      expect(source).not.toContain("removeCoachImageBackground");
      expect(source).not.toMatch(/PHOTOROOM_API_KEY|REMOVEBG_API_KEY|IMAGE_BG_REMOVAL_PROVIDER/);
    }

    for (const source of [adminReprocessSource, shopReprocessSource]) {
      expect(source).toContain("Server-side photo reprocessing is disabled");
      expect(source).toContain("410");
      expect(source).not.toMatch(/PHOTOROOM_API_KEY|REMOVEBG_API_KEY/);
    }

    expect(mediaStorageSource).toContain("processing_status");
    expect(mediaStorageSource).toContain("processing_provider");
    expect(mediaStorageSource).toContain("quality_status");
    expect(mediaStorageSource).toContain("fallback_mode");
    expect(mediaStorageSource).toContain("original_object_key");
    expect(mediaStorageSource).toContain("updateCoachSiteMediaProcessing");

    for (const source of [reactSource, publicRouteSource]) {
      expect(source).toContain("data-image-mode");
      expect(source).toContain("yw-coach-hero-image--framed");
      expect(source).toContain("yw-coach-hero-image--cutout");
      expect(source).toContain("/cutout/");
    }
  });

  test("canonical hero and bonus copy stay niche-adaptive without unsafe health claims", () => {
    const niches = [
      {
        value: "PCOS and hormone wellness",
        expectedDescriptionTerm: /cycle patterns|hormone-supportive/i
      },
      {
        value: "Diabetes metabolic habits",
        expectedDescriptionTerm: /HbA1c|Insulin Resistance|eGFR/i
      },
      { value: "Gut health and digestion", expectedDescriptionTerm: /digestion|gut-friendly/i },
      {
        value: "Sleep recovery coaching",
        expectedDescriptionTerm: /sleep routine|evening routines/i
      },
      { value: "Fat loss habits", expectedDescriptionTerm: /BMI|BMR|meal-planning/i },
      {
        value: "Fitness and strength habits",
        expectedDescriptionTerm: /performance habit|workout habit/i
      },
      {
        value: "General wellness",
        expectedDescriptionTerm: /wellness indicators|guided support sessions/i
      }
    ];

    for (const niche of niches) {
      const site = buildCoachSiteFromShopState({
        published: true,
        state: {
          coachName: `Coach ${niche.value.split(" ")[0]}`,
          contactLink: "https://forms.gle/example",
          content: {
            heroHeadline:
              "Reverse Type 2 Diabetes Naturally Without Medicines, Strict Diet or Complex Workouts Using My Proven Magical Lifestyle Method",
            heroTrustLine: "Guaranteed cure blueprint",
            subheadline:
              "Learn how to reverse disease without medicines and guarantee results in a few days."
          },
          niche: niche.value,
          selectedThemeId: "dark-luxury-wellness",
          shortBio: "Practical education-first coaching support."
        }
      });

      expect(site.selectedThemeId).toBe("dark-luxury");

      const hero = getCanonicalHeroPackage(site);
      expect(hero.headline).not.toMatch(UNSAFE_HEALTH_COPY);
      expect(hero.highlight).not.toMatch(UNSAFE_HEALTH_COPY);
      expect(hero.subheadline).not.toMatch(UNSAFE_HEALTH_COPY);
      expect(hero.supportLine).not.toMatch(UNSAFE_HEALTH_COPY);

      const registerLabel = getCanonicalRegisterLabel(site);
      expect(registerLabel).toBe("Register Now");
      expect(registerLabel).not.toMatch(UNSAFE_HEALTH_COPY);

      const bonus = getNicheAdaptiveBonusSection(site);
      expect(bonus.items).toHaveLength(3);
      expect(bonus.eyebrow).toBe("Included Free");
      expect(bonus.heading).toBe("Your Registration Includes Free Wellness Support Tools");
      expect(bonus.heading).not.toContain("Niche-Adaptive");
      expect(bonus.totalValueLabel).toBe("Total bonus value: Rs 9,999");
      expect(bonus.ctaHeading).toBe("Total bonus value: Rs 9,999");
      expect(bonus.ctaText).toBe(registerLabel);
      expect(bonus.ctaButtonText).toBe(registerLabel);
      expect(bonus.ctaHelperText).toContain("Register to unlock");
      expect(bonus.items.map((item) => item.displayTitle)).toEqual(FIXED_BONUS_SERVICE_TITLES);
      expect(bonus.items.map((item) => item.title)).toEqual(FIXED_BONUS_SERVICE_TITLES);
      expect(bonus.items.map((item) => item.lockedAssetId)).toEqual([
        "life-long-health-calculators",
        "lifetime-support-sessions",
        "lifestyle-success-toolkit"
      ]);
      expect(bonus.items.map((item) => item.assetType)).toEqual([
        "calculator_suite",
        "support_session",
        "toolkit"
      ]);
      expect(bonus.items.map((item) => item.visualType)).toEqual([
        "smart_product_tile",
        "smart_support_tile",
        "smart_toolkit_tile"
      ]);
      expect(bonus.items.map((item) => item.valueDisplay)).toEqual([
        "Worth Rs 3,200 - Included Free",
        "Worth Rs 3,200 - Included Free",
        "Worth Rs 3,599 - Included Free"
      ]);
      expect(bonus.items.map((item) => item.imageUrl)).toEqual(FIXED_BONUS_IMAGE_URLS);
      for (const text of [
        bonus.eyebrow,
        bonus.heading,
        bonus.subheading,
        bonus.ctaHeading,
        bonus.ctaHelperText,
        ...bonus.items.map((item) => `${item.displayTitle} ${item.description} ${item.typeLabel}`)
      ]) {
        expect(text).not.toMatch(UNSAFE_HEALTH_COPY);
        expect(text).not.toMatch(/niche[-\s]?adaptive/i);
      }
      expect(bonus.items.map((item) => item.description).join(" ")).toMatch(
        niche.expectedDescriptionTerm
      );
    }
  });

  test("canonical section copy adapts across required niches without stale one-niche language", () => {
    const niches = [
      {
        allowedWomenContext: true,
        expectedTitle: /Hormone-Supportive|Habit Path/i,
        forbidden: /\b(HbA1c|Insulin|eGFR|gut|sleep|fat-loss|workout)\b/i,
        niche: "PCOS / PMOS women's hormone wellness"
      },
      {
        expectedTitle: /Metabolic|Clarity Path/i,
        forbidden:
          /\b(PCOS|PMOS|women only|exclusively for women|hormone-supportive|gut|sleep|fat-loss|workout)\b/i,
        niche: "Diabetes metabolic wellness"
      },
      {
        expectedTitle: /Weight-Management|Habit Plan/i,
        forbidden: /\b(PCOS|PMOS|diabetes|HbA1c|gut|sleep routine|workout)\b/i,
        niche: "Fat loss habits"
      },
      {
        expectedTitle: /Gut Wellness|Framework/i,
        forbidden: /\b(PCOS|PMOS|diabetes|HbA1c|sleep routine|fat-loss|workout)\b/i,
        niche: "Gut health and digestion"
      },
      {
        expectedTitle: /Sleep Rhythm|Reset/i,
        forbidden: /\b(PCOS|PMOS|diabetes|HbA1c|gut digestion|fat-loss|workout)\b/i,
        niche: "Sleep recovery coaching"
      },
      {
        expectedTitle: /Strength|Consistency Plan/i,
        forbidden: /\b(PCOS|PMOS|diabetes|HbA1c|gut digestion|sleep routine|fat-loss)\b/i,
        niche: "Fitness and strength habits"
      },
      {
        expectedTitle: /Lifestyle|Clarity System/i,
        forbidden:
          /\b(PCOS|PMOS|women only|diabetes|HbA1c|gut digestion|sleep routine|fat-loss|workout)\b/i,
        niche: "General wellness"
      }
    ];

    for (const item of niches) {
      const site = buildCoachSiteFromShopState({
        published: true,
        state: {
          coachName: `Coach ${item.niche.split(" ")[0]}`,
          contactLink: "https://forms.gle/example",
          content: {
            brandBadge: "FREE LIVE MASTERCLASS EXCLUSIVELY FOR WOMEN | LIMITED SEATS AVAILABLE",
            brandEyebrow: "2-HOUR MASTERCLASS BY GYANA RANJAN",
            ctaText: "Register Now",
            faq: [
              { answer: "", question: "How do I attend the masterclass?" },
              { answer: "undefined", question: "Is this only for women?" }
            ],
            faqHeading: "Frequently Asked",
            heroHeadline: "The Coaching Blueprint",
            heroMediaLabel: "Masterclass Details",
            heroTrustLine: "Only for Women",
            introHeading:
              "Personal PMOS / Women Wellness guidance inside a premium wellness-tech ecosystem.",
            journeyHeading: "The complete blueprint. Nothing held back.",
            problemHeading:
              "For guests who need direction before committing to a bigger PMOS / Women Wellness program.",
            problemPoints: [
              "Too much conflicting PMOS / Women Wellness advice",
              "HbA1c and Insulin Resistance diabetes leakage",
              "Gut digestion and sleep routine leakage",
              "Fat-loss workout leakage"
            ],
            subheadline:
              "The exact 10-step system Indian women are using to launch a profitable coaching business from home without quitting their jobs."
          },
          niche: item.niche,
          selectedThemeId: "default",
          shortBio: "Practical education-first coaching support."
        }
      });
      const sectionCopy = getCanonicalCoachSectionCopy(site);
      const faqItems = getCanonicalCoachFaqItems(site);
      const renderedText = [
        sectionCopy.topStrip,
        sectionCopy.heroEyebrow,
        sectionCopy.heroTitleMain,
        sectionCopy.heroTitleAccent,
        sectionCopy.heroSubheadline,
        sectionCopy.detailHeading,
        sectionCopy.detailSubline,
        ...sectionCopy.detailCards.flatMap((card) => [card.label, card.value]),
        sectionCopy.trustHeading,
        sectionCopy.problemHeading,
        ...sectionCopy.problemPoints,
        sectionCopy.journeyHeading,
        ...sectionCopy.journeySteps.flatMap((step) => [step.label, step.title, step.description]),
        sectionCopy.resultsLabel,
        sectionCopy.resultsHeadingMain,
        sectionCopy.resultsHeadingAccent,
        sectionCopy.resultsSubcopy,
        sectionCopy.fitHeadingMain,
        sectionCopy.fitHeadingAccent,
        sectionCopy.finalHeadingMain,
        sectionCopy.finalHeadingAccent,
        sectionCopy.finalBody,
        sectionCopy.stickyCtaEyebrow,
        sectionCopy.faqHeading,
        ...faqItems.flatMap((faq) => [faq.question, faq.answer])
      ].join(" ");

      expect(`${sectionCopy.heroTitleMain} ${sectionCopy.heroTitleAccent}`).toMatch(
        item.expectedTitle
      );
      expect(renderedText).not.toMatch(STALE_SECTION_COPY);
      expect(renderedText).not.toMatch(UNSAFE_PROMISE_COPY);
      if (!item.allowedWomenContext)
        expect(renderedText).not.toMatch(
          /\b(women only|exclusively for women|PMOS|PCOS|hormone-supportive)\b/i
        );
      expect(renderedText).not.toMatch(item.forbidden);
      expect(sectionCopy.detailCards.map((card) => card.label)).not.toEqual([
        "DATE",
        "TIME",
        "DURATION",
        "Language"
      ]);
      expect(faqItems.length).toBeGreaterThanOrEqual(5);
      for (const faq of faqItems) {
        expect(faq.question).toBeTruthy();
        expect(faq.answer).toBeTruthy();
        expect(faq.answer).not.toMatch(/\b(undefined|null|lorem)\b/i);
        expect(faq.answer.length).toBeGreaterThan(30);
      }
    }
  });

  test("public renderers no longer hardcode stale masterclass section copy", () => {
    const reactSource = readFileSync(
      join(REPO_ROOT, "components/coach/public-coach-site-page.tsx"),
      "utf8"
    );
    const publicRouteSource = readFileSync(join(REPO_ROOT, "functions/coach/[slug].ts"), "utf8");

    for (const source of [reactSource, publicRouteSource]) {
      expect(source).not.toMatch(
        /FREE LIVE MASTERCLASS EXCLUSIVELY FOR WOMEN|LIMITED SEATS AVAILABLE/i
      );
      expect(source).not.toMatch(/2-Hour Masterclass by|Masterclass Details|Only for Women/i);
      expect(source).not.toMatch(
        /Real results\. Real women\.|They used this blueprint|This masterclass is free/i
      );
      expect(source).not.toMatch(/Free live masterclass|masterclass right for you/i);
      expect(source).toContain("getCanonicalCoachSectionCopy");
      expect(source).toContain("sectionCopy.faqItems");
      expect(source).toContain("sectionCopy.stickyCtaEyebrow");
    }
  });

  test("canonical bonus titles cannot be replaced by saved benefits or wrong-niche copy", () => {
    const site = buildCoachSiteFromShopState({
      published: true,
      state: {
        coachName: "Coach Generic",
        contactLink: "https://forms.gle/example",
        content: {
          benefits: [
            "Diabetes Reversal Success Toolkit",
            "Golden Cage Hormone Habit Guide",
            "Vision Board Video"
          ],
          benefitDescriptions: [
            "Access HbA1c, Insulin Resistance, and eGFR diabetes tools for your diabetes reversal journey.",
            "Join PCOS hormone-only sessions for women only.",
            "Use the Vision Board Video for guaranteed results."
          ],
          benefitsHeading: "Claim Your Free Diabetes Reversal Bonuses"
        },
        niche: "General wellness",
        shortBio: "Practical education-first coaching support."
      }
    });

    const bonus = getNicheAdaptiveBonusSection(site);

    expect(bonus.heading).toBe("Your Registration Includes Free Wellness Support Tools");
    expect(bonus.items.map((item) => item.displayTitle)).toEqual(FIXED_BONUS_SERVICE_TITLES);
    expect(bonus.items.map((item) => item.description).join(" ")).not.toMatch(
      /\b(HbA1c|Insulin Resistance|eGFR|diabetes|PCOS|women only|Vision Board|reversal|guaranteed)\b/i
    );
    expect(bonus.items[0].description).toContain("wellness indicators");
    expect(bonus.items[1].description).toContain("guided support sessions");
    expect(bonus.items[2].description).toContain("lifestyle checklists");
  });

  test("canonical bonus descriptions do not leak unrelated niche wording", () => {
    const cases = [
      {
        forbidden:
          /\b(HbA1c|A1C|Insulin|eGFR|blood sugar|glucose|diabetes|sugar-aware|metabolic|gut|digestion|sleep routine|fat-loss|weight-loss|workout|strength training)\b/i,
        niche: "PCOS hormone wellness",
        expectedFallback: /cycle patterns|hormone-supportive/i
      },
      {
        forbidden:
          /\b(PCOS|PCOD|PMOS|hormone|hormonal|cycle patterns|periods|menstrual|women only|gut|digestion|sleep|fat-loss|workout)\b/i,
        niche: "Diabetes metabolic habits",
        expectedFallback: /HbA1c|Insulin Resistance|eGFR/i
      },
      {
        forbidden:
          /\b(HbA1c|Insulin|eGFR|diabetes|PCOS|hormone|sleep routine|fat-loss|weight-loss|workout|strength training)\b/i,
        niche: "Gut health and digestion",
        expectedFallback: /digestion patterns|gut-friendly/i
      },
      {
        forbidden:
          /\b(HbA1c|Insulin|eGFR|diabetes|PCOS|hormone|gut|digestion|fat-loss|weight-loss|workout|strength training)\b/i,
        niche: "Sleep recovery coaching",
        expectedFallback: /sleep routine|evening routines/i
      },
      {
        forbidden:
          /\b(HbA1c|Insulin|eGFR|diabetes|PCOS|hormone|gut|digestion|sleep routine|workout habit)\b/i,
        niche: "Fat loss habits",
        expectedFallback: /BMI|BMR|meal-planning/i
      },
      {
        forbidden:
          /\b(HbA1c|Insulin|eGFR|diabetes|PCOS|hormone|gut|digestion|sleep routine|weight-loss)\b/i,
        niche: "Fitness and strength habits",
        expectedFallback: /performance habit|workout habit/i
      },
      {
        forbidden:
          /\b(HbA1c|A1C|Insulin|eGFR|blood sugar|glucose|diabetes|sugar-aware|metabolic|PCOS|PCOD|PMOS|hormone|hormonal|gut|digestion|sleep|fat-loss|weight-loss|workout|strength training|women only)\b/i,
        niche: "General wellness",
        expectedFallback: /wellness indicators|guided support sessions/i
      }
    ];

    for (const item of cases) {
      const site = buildCoachSiteFromShopState({
        published: true,
        state: {
          coachName: `Coach ${item.niche.split(" ")[0]}`,
          contactLink: "https://forms.gle/example",
          content: {
            benefitDescriptions: [
              "Access HbA1c, A1C, Insulin Resistance, eGFR, blood sugar, glucose, metabolic, and sugar-aware diabetes tools.",
              "Join PCOS, PMOS, hormone, menstrual cycle, gut digestion, sleep routine, fat-loss, weight-loss, workout, and strength training sessions.",
              "Use women only niche assets, gut-friendly tracking, bedtime planning, and guaranteed transformation copy."
            ],
            benefitsHeading: "Registration includes free bonus support tools"
          },
          niche: item.niche,
          shortBio: "Practical education-first coaching support."
        }
      });

      const bonus = getNicheAdaptiveBonusSection(site);
      const renderedDescriptions = bonus.items.map((bonusItem) => bonusItem.description).join(" ");

      expect(renderedDescriptions).not.toMatch(item.forbidden);
      expect(renderedDescriptions).toMatch(item.expectedFallback);
    }
  });

  test("PMOS spelling still maps to the women hormone profile without unrelated niche copy", () => {
    const site = buildCoachSiteFromShopState({
      published: true,
      state: {
        coachName: "Coach PMOS",
        contactLink: "https://forms.gle/example",
        content: {
          benefitDescriptions: [
            "Access HbA1c and diabetes tools.",
            "Join gut digestion and sleep routine sessions.",
            "Use workout and fat-loss habit assets."
          ],
          benefitsHeading: "Registration includes free bonus support tools"
        },
        niche: "PMOS / Women Wellness",
        shortBio: "Practical education-first coaching support."
      }
    });

    const bonus = getNicheAdaptiveBonusSection(site);
    const renderedDescriptions = bonus.items.map((item) => item.description).join(" ");

    expect(renderedDescriptions).toMatch(/cycle patterns|hormone-supportive/i);
    expect(renderedDescriptions).not.toMatch(
      /\b(HbA1c|diabetes|gut digestion|sleep routine|workout|fat-loss)\b/i
    );
  });

  test("public route source cannot opt into the removed legacy template renderer", () => {
    const source = readFileSync(join(REPO_ROOT, "functions/coach/[slug].ts"), "utf8");
    const renderWrapper =
      source.match(
        /function renderCoachSiteHtml\(site: PublicCoachSiteRecord\) \{[\s\S]*?\n\}/
      )?.[0] || "";

    expect(source).not.toContain("__legacy_rollback");
    expect(renderWrapper).toContain("return renderCanonicalCoachSiteHtml(site);");
    expect(renderWrapper).not.toContain("renderLegacyCoachSiteHtml(site)");
  });

  test("coach legal return links cannot fall back to the root redirect domain", () => {
    const legalSource = readFileSync(
      join(REPO_ROOT, "components/coach/coach-legal-page.tsx"),
      "utf8"
    );
    const publicRouteSource = readFileSync(join(REPO_ROOT, "functions/coach/[slug].ts"), "utf8");

    expect(legalSource).toContain("href={returnHref}");
    expect(legalSource).not.toContain('data-yw-return-link href="/"');
    expect(legalSource).not.toContain('href="/"');
    expect(legalSource).toContain("const landingPath = useSyncExternalStore");
    expect(legalSource).toContain('const returnHref = landingPath || "#"');
    expect(legalSource).toContain('next.searchParams.set("returnTo", landingPath)');
    expect(legalSource).toContain("window.sessionStorage.setItem(storageKey, landingPath)");
    expect(publicRouteSource).toContain(
      "/privacy?returnTo=${encodeURIComponent(`/coach/${site.slug}`)}"
    );
    expect(publicRouteSource).toContain(
      "/terms?returnTo=${encodeURIComponent(`/coach/${site.slug}`)}"
    );
    expect(publicRouteSource).toContain(
      "/disclaimer?returnTo=${encodeURIComponent(`/coach/${site.slug}`)}"
    );
  });

  test("browser bonus helper cannot preserve old titles, wrong niche descriptions, or old CTA labels", async ({
    page
  }) => {
    await page.setContent(`
      <section
        data-yw-template-rule="nicheAdaptiveBonusSection"
        data-yw-coach-name="Coach Neutral"
        data-yw-coach-niche="General wellness"
      >
        <div class="yw-bonus-shell">
          <p class="yw-bonus-kicker">Included Free</p>
          <h2 id="yw-bonus-title">Registration includes free bonus support tools</h2>
          <p class="yw-section-subcopy">Practical tools to support your lifestyle journey.</p>
          <div class="yw-bonus-grid" data-yw-bonus-grid>
            <article><h3>Diabetes Reversal Success Toolkit</h3><p>Access HbA1c, A1C, insulin, eGFR, diabetes and glucose tools.</p></article>
            <article><h3>Golden Cage Hormone Guide</h3><p>Join PCOS, PMOS, hormone, menstrual cycle and women only support.</p></article>
            <article><h3>Vision Board Video</h3><p>Use gut digestion, sleep routine, fat-loss, workout and strength training assets.</p></article>
          </div>
          <div class="yw-bonus-cta-panel">
            <p data-yw-bonus-total></p>
            <p class="yw-bonus-cta-copy">Register to unlock these support tools.</p>
            <a class="yw-register-strip yw-bonus-cta">Start My Diabetes Reversal Journey</a>
          </div>
        </div>
      </section>
    `);
    await page.addScriptTag({ path: join(REPO_ROOT, "public/coach-circle-bonus-section.js") });

    const rendered = await page.evaluate(() => {
      const section = document.querySelector("[data-yw-template-rule='nicheAdaptiveBonusSection']");
      const bonusWindow = window as typeof window & {
        ywAdaptBonusSectionCopy?: (options: { niche: string }) => {
          items?: Array<{ description: string }>;
        };
      };
      const pmosModel = bonusWindow.ywAdaptBonusSectionCopy?.({ niche: "PMOS / Women Wellness" });
      const imageVisuals = Array.from(
        section?.querySelectorAll(".yw-bonus-visual[data-yw-smart-visual='configured-image']") || []
      ).map((node) => ({
        hasMicroLines: Boolean(node.querySelector(".yw-bonus-visual__micro-lines")),
        hasOrb: Boolean(node.querySelector(".yw-bonus-visual__orb")),
        hasShine: Boolean(node.querySelector(".yw-bonus-visual__shine"))
      }));

      return {
        cta: section?.querySelector(".yw-bonus-cta")?.textContent?.trim(),
        descriptions: Array.from(
          section?.querySelectorAll(".yw-niche-bonus__card > p:not(.yw-bonus-type)") || []
        ).map((node) => node.textContent?.trim() || ""),
        imageVisuals,
        pmosDescriptions:
          pmosModel?.items?.map((item: { description: string }) => item.description).join(" ") ||
          "",
        titles: Array.from(section?.querySelectorAll(".yw-niche-bonus__card h3") || []).map(
          (node) => node.textContent?.trim() || ""
        )
      };
    });

    expect(rendered.titles).toEqual(FIXED_BONUS_SERVICE_TITLES);
    expect(rendered.cta).toBe("Register Now");
    expect(rendered.descriptions.join(" ")).not.toMatch(
      /\b(HbA1c|A1C|insulin|eGFR|diabetes|glucose|PCOS|PMOS|hormone|menstrual|women only|gut digestion|sleep routine|fat-loss|workout|strength training|reversal)\b/i
    );
    expect(rendered.descriptions.join(" ")).toMatch(
      /wellness indicators|guided support sessions|lifestyle checklists/i
    );
    expect(rendered.pmosDescriptions).toMatch(/cycle patterns|hormone-supportive/i);
    expect(rendered.pmosDescriptions).not.toMatch(
      /\b(HbA1c|diabetes|gut digestion|sleep routine|workout|fat-loss)\b/i
    );
    expect(rendered.imageVisuals).toHaveLength(3);
    expect(
      rendered.imageVisuals.every(
        (visual) => visual.hasOrb && visual.hasMicroLines && visual.hasShine
      )
    ).toBe(true);
  });

  test("canonical bonus inspect and lock rules match the production template contract", () => {
    const rule = canonicalCoachTemplateRules.find(
      (item) => item.ruleKey === "nicheAdaptiveBonusSection"
    );
    expect(rule).toBeTruthy();
    expect(rule?.enabled).toBe(true);
    expect(rule?.aiAdaptive).toBe(true);
    expect(rule?.cardCount).toBe(3);
    expect(rule?.smartVisuals).toBe(true);
    expect(rule?.source).toBe("universalBonusRegistry");
    expect(rule?.editableSlots).toEqual(
      expect.arrayContaining([
        "bonus.eyebrow",
        "bonus.heading",
        "bonus.subheading",
        "bonus.items[].description",
        "bonus.ctaHelperText"
      ])
    );
    expect(rule?.editableSlots).not.toContain("bonus.items[].displayTitle");
    expect(rule?.editableSlots).not.toContain("bonus.items[].title");
    expect(rule?.editableSlots).not.toContain("bonus.ctaText");
    expect(rule?.lockedFields).toEqual(
      expect.arrayContaining([
        "bonus.id",
        "bonus.lockedAssetId",
        "bonus.items[].displayTitle",
        "bonus.items[].title",
        "bonus.visualType",
        "bonus.assetType",
        "bonus.actualAssetUrl",
        "bonus.actualValue",
        "bonus.actualAvailability",
        "legal.disclaimer",
        "cta.destination",
        "analytics.tracking"
      ])
    );
    expect(rule?.valueDisplayRules?.neverInventValue).toBe(true);
    expect(rule?.fallbackBehavior?.missingImage).toBe("SmartBonusVisual");

    expect(universalCoachBonuses.map((bonus) => bonus.id)).toEqual([
      "life-long-health-calculators",
      "lifetime-support-sessions",
      "lifestyle-success-toolkit"
    ]);
    expect(universalCoachBonuses.map((bonus) => bonus.baseTitle)).toEqual(
      FIXED_BONUS_SERVICE_TITLES
    );
    expect(universalCoachBonuses.map((bonus) => bonus.imageUrl)).toEqual(FIXED_BONUS_IMAGE_URLS);
    expect(universalCoachBonuses.every((bonus) => bonus.actualAssetUrl === "")).toBe(true);
    expect(universalCoachBonuses.map((bonus) => bonus.actualValue)).toEqual([3200, 3200, 3599]);
    expect(universalCoachBonuses.every((bonus) => bonus.actualAvailability === true)).toBe(true);
  });

  test("configured bonus image visuals keep the canonical motion chrome in every renderer", () => {
    const reactSource = readFileSync(
      join(REPO_ROOT, "components/coach/public-coach-site-page.tsx"),
      "utf8"
    );
    const publicRouteSource = readFileSync(join(REPO_ROOT, "functions/coach/[slug].ts"), "utf8");
    const browserHelperSource = readFileSync(
      join(REPO_ROOT, "public/coach-circle-bonus-section.js"),
      "utf8"
    );
    const cssSource = readFileSync(join(REPO_ROOT, "public/coach-circle-template.css"), "utf8");

    expect(reactSource).toContain('data-yw-smart-visual="configured-image"');
    expect(publicRouteSource).toContain('data-yw-smart-visual="configured-image"');
    expect(browserHelperSource).toContain(
      'wrapper.dataset.ywSmartVisual = item.imageUrl ? "configured-image" : "generated"'
    );

    for (const source of [reactSource, publicRouteSource, browserHelperSource]) {
      expect(source).toContain("yw-bonus-visual__orb yw-bonus-visual__orb--image");
      expect(source).toContain("yw-bonus-visual__micro-lines");
      expect(source).toContain("yw-bonus-visual__shine");
    }

    expect(cssSource).toContain("@keyframes yw-bonus-orb-drift");
    expect(cssSource).toContain("@keyframes yw-bonus-grid-drift");
    expect(cssSource).toContain("@keyframes yw-bonus-shine-pass");
    expect(cssSource).toContain(".yw-bonus-visual--image .yw-bonus-visual__orb");
  });
});

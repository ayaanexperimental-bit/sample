import { expect, test } from "@playwright/test";
import {
  createAdminCsrfToken,
  createAdminSessionCookie,
  type AdminSessionPayload
} from "../../lib/server/admin-auth";
import { onRequest as coachPageRequest } from "../../functions/coach/[slug]";
import { onRequest as coachSitesRequest } from "../../functions/api/admin/coach-sites/index";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_DEV_OTP = "123456";
const ADMIN_SESSION_SECRET = "local-admin-coach-sites-danger-secret";

test.describe("coach site dangerous actions", () => {
  test("draft publish pipeline persists, lists, and renders public coach template", async () => {
    const coachSitesDb = createCoachSitesDb();
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: coachSitesDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const missingFormPublish = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          site: {
            coachName: "Pipeline Coach",
            content: {
              benefits: ["Benefit one"],
              coachIntro: "Pipeline intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Pipeline headline",
              socialCopy: "Pipeline social copy",
              subheadline: "Pipeline subheadline",
              trustText: "Pipeline trust",
              visionText: "Pipeline vision"
            },
            googleFormUrl: "",
            id: "coach-site-pipeline",
            niche: "Pipeline Wellness",
            publicUrl: "/coach/pipeline-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "pipeline-coach",
            status: "published"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(missingFormPublish.status).toBe(400);
    expect(await missingFormPublish.json()).toMatchObject({
      error: "Google Form registration link is required before publishing.",
      ok: false
    });

    const duplicateFormPublish = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          site: {
            coachEmail: "pipeline@example.com",
            coachName: "Pipeline Coach",
            coachPhone: "+919876543210",
            content: {
              benefits: ["Benefit one", "Benefit two", "Benefit three"],
              coachIntro: "Pipeline intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Pipeline headline",
              socialCopy: "Pipeline social copy",
              subheadline: "Pipeline subheadline",
              trustText: "Pipeline trust",
              visionText: "Pipeline vision"
            },
            googleFormUrl: "https://forms.gle/pipelineCoach https://forms.gle/duplicateCoach",
            heroMediaType: "none",
            id: "coach-site-pipeline",
            niche: "Pipeline Wellness",
            publicUrl: "/coach/pipeline-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "pipeline-coach",
            status: "published"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(duplicateFormPublish.status).toBe(400);
    expect(await duplicateFormPublish.json()).toMatchObject({
      error: "Use a valid Google Form registration link before publishing.",
      ok: false
    });

    const duplicateEmailPublish = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          site: {
            coachEmail: "pipeline@example.com, second@example.com",
            coachName: "Pipeline Coach",
            coachPhone: "+919876543210",
            content: {
              benefits: ["Benefit one", "Benefit two", "Benefit three"],
              coachIntro: "Pipeline intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Pipeline headline",
              socialCopy: "Pipeline social copy",
              subheadline: "Pipeline subheadline",
              trustText: "Pipeline trust",
              visionText: "Pipeline vision"
            },
            googleFormUrl: "https://forms.gle/pipelineCoach",
            heroMediaType: "none",
            id: "coach-site-pipeline",
            niche: "Pipeline Wellness",
            publicUrl: "/coach/pipeline-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "pipeline-coach",
            status: "published"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(duplicateEmailPublish.status).toBe(400);
    expect(await duplicateEmailPublish.json()).toMatchObject({
      error: "Use one valid support email before publishing.",
      ok: false
    });

    const invalidPhonePublish = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          site: {
            coachEmail: "pipeline@example.com",
            coachName: "Pipeline Coach",
            coachPhone: "09938999448",
            content: {
              benefits: ["Benefit one", "Benefit two", "Benefit three"],
              coachIntro: "Pipeline intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Pipeline headline",
              socialCopy: "Pipeline social copy",
              subheadline: "Pipeline subheadline",
              trustText: "Pipeline trust",
              visionText: "Pipeline vision"
            },
            googleFormUrl: "https://forms.gle/pipelineCoach",
            heroMediaType: "none",
            id: "coach-site-pipeline",
            niche: "Pipeline Wellness",
            publicUrl: "/coach/pipeline-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "pipeline-coach",
            status: "published"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(invalidPhonePublish.status).toBe(400);
    expect(await invalidPhonePublish.json()).toMatchObject({
      error: "Use one valid 10-digit Indian support phone/WhatsApp number before publishing.",
      ok: false
    });

    const saveDraft = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          site: {
            coachEmail: "pipeline@example.com",
            coachName: "Pipeline Coach",
            coachPhone: "+919876543210",
            content: {
              benefits: ["Benefit one", "Benefit two", "Benefit three"],
              coachIntro: "Pipeline intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Pipeline headline",
              socialCopy: "Pipeline social copy",
              subheadline: "Pipeline subheadline",
              trustText: "Pipeline trust",
              visionText: "Pipeline vision"
            },
            googleFormUrl: "https://forms.gle/pipelineCoach",
            heroMediaType: "none",
            id: "coach-site-pipeline",
            niche: "Pipeline Wellness",
            publicUrl: "/coach/pipeline-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "pipeline-coach",
            status: "draft",
            whatsappLink: "https://wa.me/919876543210"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(saveDraft.status).toBe(200);
    expect(await saveDraft.json()).toMatchObject({
      coachSite: {
        publicUrl: "/coach/pipeline-coach",
        slug: "pipeline-coach",
        status: "draft"
      },
      ok: true
    });

    const continueDraftList = await coachSitesRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/coach-sites", {
        headers: {
          cookie
        }
      })
    });
    expect(continueDraftList.status).toBe(200);
    const continueDraftBody = await continueDraftList.json();
    expect(continueDraftBody.coachSites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coachName: "Pipeline Coach",
          googleFormUrl: "https://forms.gle/pipelineCoach",
          publicUrl: "/coach/pipeline-coach",
          slug: "pipeline-coach",
          status: "draft"
        })
      ])
    );

    const updateSameDraft = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          mode: "edit",
          site: {
            coachEmail: "pipeline@example.com",
            coachName: "Pipeline Coach",
            coachPhone: "+919876543210",
            content: {
              benefits: ["Updated benefit one", "Updated benefit two", "Updated benefit three"],
              coachIntro: "Updated pipeline intro",
              ctaText: "Register Now",
              faq: [{ answer: "Updated answer", question: "Updated question" }],
              heroHeadline: "Updated pipeline headline",
              socialCopy: "Updated pipeline social copy",
              subheadline: "Updated pipeline subheadline",
              trustText: "Updated pipeline trust",
              visionText: "Updated pipeline vision"
            },
            googleFormUrl: "https://forms.gle/pipelineCoach",
            heroMediaType: "none",
            id: "coach-site-pipeline",
            niche: "Updated Pipeline Wellness",
            publicUrl: "/coach/pipeline-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "pipeline-coach",
            status: "draft",
            whatsappLink: "https://wa.me/919876543210"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(updateSameDraft.status).toBe(200);
    expect(await updateSameDraft.json()).toMatchObject({
      coachSite: {
        niche: "Updated Pipeline Wellness",
        publicUrl: "/coach/pipeline-coach",
        selectedThemeId: "canonical-coach-site-template",
        slug: "pipeline-coach",
        status: "draft"
      },
      ok: true
    });

    const updatedDraftList = await coachSitesRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/coach-sites", {
        headers: {
          cookie
        }
      })
    });
    expect(updatedDraftList.status).toBe(200);
    const updatedDraftBody = await updatedDraftList.json();
    const pipelineDrafts = updatedDraftBody.coachSites.filter(
      (site: { slug?: string }) => site.slug === "pipeline-coach"
    );
    expect(pipelineDrafts).toHaveLength(1);
    expect(pipelineDrafts[0]).toMatchObject({
      content: expect.objectContaining({
        heroHeadline: "Updated pipeline headline"
      }),
      niche: "Updated Pipeline Wellness",
      publicUrl: "/coach/pipeline-coach",
      selectedThemeId: "canonical-coach-site-template",
      status: "draft"
    });

    const publishDraft = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          siteId: "coach-site-pipeline",
          status: "published"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(publishDraft.status).toBe(200);
    expect(await publishDraft.json()).toMatchObject({
      coachSite: {
        publicUrl: "/coach/pipeline-coach",
        slug: "pipeline-coach",
        status: "published"
      },
      ok: true
    });

    const listed = await coachSitesRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/coach-sites", {
        headers: {
          cookie
        }
      })
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.coachSites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          publicUrl: "/coach/pipeline-coach",
          slug: "pipeline-coach",
          status: "published"
        })
      ])
    );

    const publicPage = await coachPageRequest({
      env,
      params: { slug: "pipeline-coach" },
      request: new Request("http://127.0.0.1/coach/pipeline-coach")
    });
    expect(publicPage.status).toBe(200);
    const html = await publicPage.text();
    expect(html).toContain("Pipeline Coach");
    expect(html).toContain("Updated Pipeline Wellness");
    expect(html).toContain('data-track="coach_register_click"');
    expect(html).not.toContain("Updated pipeline headline");
    expect(html).not.toContain("FREE LIVE MASTERCLASS EXCLUSIVELY FOR WOMEN");
    expect(html).not.toContain("LIMITED SEATS AVAILABLE");
    expect(html).toContain("https://forms.gle/pipelineCoach");
    expect(html).not.toContain("Something went wrong");
  });

  test("archive and remove require admin session, CSRF, and OTP", async () => {
    const coachSitesDb = createCoachSitesDb();
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: coachSitesDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };

    const unauthenticated = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        {},
        "PATCH"
      )
    });
    expect(unauthenticated.status).toBe(401);

    const { cookie, csrfToken } = await createAdminTestSession(env);

    const missingCsrf = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie },
        "PATCH"
      )
    });
    expect(missingCsrf.status).toBe(403);

    const missingOtp = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(missingOtp.status).toBe(400);

    const sendOtp = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          action: "send_otp",
          siteId: "coach-site-local",
          status: "removed"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(sendOtp.status).toBe(200);
    expect(await sendOtp.json()).toMatchObject({
      localOtpMode: true,
      ok: true
    });

    const wrongOtp = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: "000000",
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(wrongOtp.status).toBe(401);
    expect(coachSitesDb.records.get("coach-site-local")?.status).toBe("published");

    const archive = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(archive.status).toBe(200);
    expect(await archive.json()).toMatchObject({
      coachSite: {
        id: "coach-site-local",
        status: "archived"
      },
      ok: true
    });

    const remove = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "coach left program",
          siteId: "coach-site-local",
          status: "removed"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(remove.status).toBe(200);
    expect(await remove.json()).toMatchObject({
      coachSite: {
        id: "coach-site-local",
        status: "removed"
      },
      ok: true
    });

    const listed = await coachSitesRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/coach-sites", {
        headers: { cookie, host: "127.0.0.1" }
      })
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.coachSites).toEqual([]);
  });

  test("delete draft removes only draft coach sites without weakening published-site OTP", async () => {
    const coachSitesDb = createCoachSitesDb();
    coachSitesDb.records.set("coach-site-draft", {
      ...coachSitesDb.records.get("coach-site-local")!,
      id: "coach-site-draft",
      coach_id: "coach-draft",
      coach_name: "Draft Coach",
      public_url: "/coach/draft-coach",
      slug: "draft-coach",
      status: "draft",
      updated_at: 1780000200
    });
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: coachSitesDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const deletePublished = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          action: "delete_draft",
          siteId: "coach-site-local",
          status: "removed"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(deletePublished.status).toBe(400);
    expect(coachSitesDb.records.get("coach-site-local")?.status).toBe("published");

    const deleteDraft = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          action: "delete_draft",
          siteId: "coach-site-draft",
          status: "removed"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(deleteDraft.status).toBe(200);
    expect(await deleteDraft.json()).toMatchObject({
      coachSite: {
        id: "coach-site-draft",
        status: "removed"
      },
      ok: true
    });
  });

  test("reactivate restores archived coach sites without changing their public link", async () => {
    const coachSitesDb = createCoachSitesDb();
    coachSitesDb.records.set("coach-site-archived", {
      ...coachSitesDb.records.get("coach-site-local")!,
      archived_at: 1780000300,
      id: "coach-site-archived",
      public_url: "/coach/archived-coach",
      slug: "archived-coach",
      status: "archived",
      updated_at: 1780000300
    });
    coachSitesDb.records.set("coach-site-archived-draft", {
      ...coachSitesDb.records.get("coach-site-local")!,
      archived_at: 1780000350,
      id: "coach-site-archived-draft",
      published_at: null,
      public_url: "/coach/archived-draft",
      slug: "archived-draft",
      status: "archived",
      updated_at: 1780000350
    });
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: coachSitesDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const restorePublished = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          action: "reactivate",
          siteId: "coach-site-archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(restorePublished.status).toBe(200);
    expect(await restorePublished.json()).toMatchObject({
      coachSite: {
        id: "coach-site-archived",
        publicUrl: "/coach/archived-coach",
        status: "published"
      },
      ok: true
    });
    expect(coachSitesDb.records.get("coach-site-archived")?.archived_at).toBeNull();
    expect(coachSitesDb.records.get("coach-site-archived")?.public_url).toBe(
      "/coach/archived-coach"
    );

    const restoreDraft = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          action: "reactivate",
          siteId: "coach-site-archived-draft"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(restoreDraft.status).toBe(200);
    expect(await restoreDraft.json()).toMatchObject({
      coachSite: {
        id: "coach-site-archived-draft",
        publicUrl: "/coach/archived-draft",
        status: "draft"
      },
      ok: true
    });
    expect(coachSitesDb.records.get("coach-site-archived-draft")?.archived_at).toBeNull();
  });

  test("public archived coach page shows temporary unavailable support fallback", async () => {
    const coachSitesDb = createCoachSitesDb();
    coachSitesDb.records.set("coach-site-archived", {
      ...coachSitesDb.records.get("coach-site-local")!,
      archived_at: 1780000300,
      id: "coach-site-archived",
      public_url: "/coach/archived-coach",
      slug: "archived-coach",
      status: "archived",
      updated_at: 1780000300
    });

    const response = await coachPageRequest({
      env: {
        ADMIN_DB: coachSitesDb.db
      },
      params: {
        slug: "archived-coach"
      },
      request: new Request("http://127.0.0.1/coach/archived-coach", {
        headers: {
          host: "127.0.0.1"
        }
      })
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("This coach page is temporarily unavailable.");
    expect(html).toContain("Error Code:");
  });

  test("blocks duplicate coach-site entries by coach identity", async () => {
    const coachSitesDb = createCoachSitesDb();
    coachSitesDb.records.set("coach-site-local-copy", {
      ...coachSitesDb.records.get("coach-site-local")!,
      coach_name: "Local Coach",
      id: "coach-site-local-copy",
      public_url: "/coach/local-coach-copy",
      slug: "local-coach-copy",
      status: "draft",
      updated_at: 1770000000
    });
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: coachSitesDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const listed = await coachSitesRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/coach-sites", {
        headers: {
          cookie
        }
      })
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.coachSites).toHaveLength(1);
    expect(listedBody.coachSites[0]).toMatchObject({
      coachName: "Local Coach",
      slug: "local-coach"
    });

    const duplicateSave = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          site: {
            coachName: "Local Coach",
            content: {
              benefits: ["Benefit one"],
              coachIntro: "Duplicate intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Duplicate headline",
              socialCopy: "Duplicate social copy",
              subheadline: "Duplicate subheadline",
              trustText: "Duplicate trust",
              visionText: "Duplicate vision"
            },
            googleFormUrl: "https://forms.gle/duplicateCoach",
            heroMediaType: "none",
            id: "coach-site-local-duplicate-attempt",
            niche: "Duplicate Wellness",
            publicUrl: "/coach/local-coach-another",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "local-coach-another",
            status: "draft"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(duplicateSave.status).toBe(409);
    expect(await duplicateSave.json()).toMatchObject({
      duplicateCoachSite: {
        id: "coach-site-local",
        slug: "local-coach",
        status: "published"
      },
      ok: false
    });
    expect(coachSitesDb.records.has("coach-site-local-duplicate-attempt")).toBe(false);

    const sameIdCreate = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          mode: "create",
          site: {
            ...coachSitesDb.records.get("coach-site-local"),
            coachName: "Local Coach",
            googleFormUrl: "https://forms.gle/localCoach",
            id: "coach-site-local",
            niche: "Wellness",
            publicUrl: "/coach/local-coach",
            slug: "local-coach",
            status: "draft"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(sameIdCreate.status).toBe(409);

    const sameIdEdit = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          mode: "edit",
          site: {
            coachName: "Local Coach",
            content: {
              benefits: ["Benefit one"],
              coachIntro: "Edited intro",
              ctaText: "Register Now",
              faq: [{ answer: "Answer", question: "Question" }],
              heroHeadline: "Edited headline",
              socialCopy: "Edited social copy",
              subheadline: "Edited subheadline",
              trustText: "Edited trust",
              visionText: "Edited vision"
            },
            googleFormUrl: "https://forms.gle/localCoach",
            heroMediaType: "none",
            id: "coach-site-local",
            niche: "Wellness",
            publicUrl: "/coach/local-coach",
            registerButtonText: "Register Now",
            selectedThemeId: "canonical-coach-site-template",
            slug: "local-coach",
            status: "draft"
          }
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "POST"
      )
    });
    expect(sameIdEdit.status).toBe(200);
  });
});

type CoachSiteRowRecord = {
  analytics_json: string;
  archived_at: number | null;
  bio: string;
  coach_email: string;
  coach_id: string;
  coach_name: string;
  coach_phone: string;
  content_json: string;
  created_at: number;
  created_by: string;
  existing_paid_funnel_url: string;
  google_form_url: string;
  hero_media_type: string;
  id: string;
  location: string;
  logo_url: string;
  niche: string;
  photo_url: string;
  published_at: number | null;
  public_url: string;
  register_button_text: string;
  selected_theme_id: string;
  paid_funnel_context: string;
  slug: string;
  status: string;
  support_text: string;
  updated_at: number;
  updated_by: string;
  video_url: string;
  vision: string;
  whatsapp_link: string;
};

function createCoachSitesDb() {
  const records = new Map<string, CoachSiteRowRecord>([
    [
      "coach-site-local",
      {
        analytics_json: JSON.stringify({
          averageVisits: 0,
          conversionRate: "0%",
          dailyVisits: 0,
          deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
          lastUpdated: "Test",
          monthlyVisits: 0,
          region: "Test",
          source: "Test",
          totalRegisterClicks: 0,
          totalVisits: 0,
          totalWhatsappClicks: 0,
          videoPlays: 0,
          weeklyVisits: 0
        }),
        archived_at: null,
        bio: "Test coach bio.",
        coach_email: "",
        coach_id: "coach-local",
        coach_name: "Local Coach",
        coach_phone: "",
        content_json: JSON.stringify({
          benefits: ["Benefit one", "Benefit two", "Benefit three"],
          coachIntro: "Intro",
          ctaText: "Register Now",
          faq: [{ answer: "Answer", question: "Question" }],
          heroHeadline: "Local coach headline",
          socialCopy: "Social copy",
          subheadline: "Subheadline",
          trustText: "Trust text",
          visionText: "Vision"
        }),
        created_at: 1780000000,
        created_by: ADMIN_EMAIL,
        existing_paid_funnel_url: "",
        google_form_url: "https://forms.gle/localCoach",
        hero_media_type: "none",
        id: "coach-site-local",
        location: "Local",
        logo_url: "",
        niche: "Wellness",
        photo_url: "",
        published_at: 1780000005,
        public_url: "/coach/local-coach",
        register_button_text: "Register Now",
        selected_theme_id: "canonical-coach-site-template",
        paid_funnel_context: "",
        slug: "local-coach",
        status: "published",
        support_text: "",
        updated_at: 1780000100,
        updated_by: ADMIN_EMAIL,
        video_url: "",
        vision: "Vision",
        whatsapp_link: ""
      }
    ]
  ]);

  return {
    db: {
      prepare(statement: string) {
        return {
          all: async () => ({
            results: Array.from(records.values()).filter((record) =>
              statement.includes("WHERE status <> 'removed'") ? record.status !== "removed" : true
            )
          }),
          bind(...values: unknown[]) {
            return createCoachSitesStatement(statement, values, records);
          },
          first: async () => null,
          run: async () => ({ success: true })
        };
      }
    } as never,
    records
  };
}

function createCoachSitesStatement(
  statement: string,
  values: unknown[],
  records: Map<string, CoachSiteRowRecord>
) {
  return {
    first: async () => {
      if (statement.includes("SELECT id, coach_id, created_at, created_by, published_at")) {
        const id = String(values[0] || "");
        const slug = String(values[1] || "");
        const existing =
          records.get(id) || Array.from(records.values()).find((record) => record.slug === slug);

        return existing
          ? {
              archived_at: existing.archived_at,
              coach_id: existing.coach_id,
              created_at: existing.created_at,
              created_by: existing.created_by,
              id: existing.id,
              published_at: existing.published_at
            }
          : null;
      }

      if (statement.includes("SELECT * FROM coach_sites WHERE id")) {
        return records.get(String(values[0] || "")) || null;
      }

      if (statement.includes("SELECT * FROM coach_sites") && statement.includes("WHERE slug")) {
        return (
          Array.from(records.values()).find((record) => record.slug === String(values[0] || "")) ||
          null
        );
      }

      return null;
    },
    run: async () => {
      if (statement.includes("INSERT INTO coach_sites")) {
        const [
          id,
          coachId,
          coachName,
          slug,
          status,
          niche,
          location,
          bio,
          vision,
          coachEmail,
          coachPhone,
          whatsappLink,
          photoUrl,
          logoUrl,
          videoUrl,
          existingPaidFunnelUrl,
          googleFormUrl,
          heroMediaType,
          publicUrl,
          registerButtonText,
          selectedThemeId,
          paidFunnelContext,
          supportText,
          contentJson,
          analyticsJson,
          createdAt,
          updatedAt,
          publishedAt,
          archivedAt,
          createdBy,
          updatedBy
        ] = values;
        const recordId = String(id || "");
        records.set(recordId, {
          analytics_json: String(analyticsJson || "{}"),
          archived_at: archivedAt === null ? null : Number(archivedAt || 0) || null,
          bio: String(bio || ""),
          coach_email: String(coachEmail || ""),
          coach_id: String(coachId || ""),
          coach_name: String(coachName || ""),
          coach_phone: String(coachPhone || ""),
          content_json: String(contentJson || "{}"),
          created_at: Number(createdAt || 0),
          created_by: String(createdBy || ""),
          existing_paid_funnel_url: String(existingPaidFunnelUrl || ""),
          google_form_url: String(googleFormUrl || ""),
          hero_media_type: String(heroMediaType || "image"),
          id: recordId,
          location: String(location || ""),
          logo_url: String(logoUrl || ""),
          niche: String(niche || ""),
          photo_url: String(photoUrl || ""),
          published_at: publishedAt === null ? null : Number(publishedAt || 0) || null,
          public_url: String(publicUrl || ""),
          register_button_text: String(registerButtonText || "Register Now"),
          selected_theme_id: String(selectedThemeId || "canonical-coach-site-template"),
          paid_funnel_context: String(paidFunnelContext || ""),
          slug: String(slug || ""),
          status: String(status || "draft"),
          support_text: String(supportText || ""),
          updated_at: Number(updatedAt || 0),
          updated_by: String(updatedBy || ""),
          video_url: String(videoUrl || ""),
          vision: String(vision || ""),
          whatsapp_link: String(whatsappLink || "")
        });
      }

      if (statement.includes("UPDATE coach_sites")) {
        const [status, updatedAt, updatedBy, id] = values;
        const existing = records.get(String(id || ""));
        if (existing) {
          const nextStatus = String(status || existing.status);
          const nextUpdatedAt = Number(updatedAt || 0);
          records.set(existing.id, {
            ...existing,
            created_by: existing.created_by || String(updatedBy || ""),
            archived_at:
              nextStatus === "archived" || nextStatus === "removed" ? nextUpdatedAt : null,
            published_at:
              nextStatus === "published" && !existing.published_at
                ? nextUpdatedAt
                : existing.published_at,
            status: nextStatus,
            updated_at: nextUpdatedAt,
            updated_by: String(updatedBy || "")
          });
        }
      }

      return { success: true };
    }
  };
}

async function createAdminTestSession(env: {
  ADMIN_ALLOWED_EMAILS: string;
  ADMIN_SESSION_SECRET: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSessionPayload = {
    email: ADMIN_EMAIL,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const sessionCookie = await createAdminSessionCookie({
    email: ADMIN_EMAIL,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: false
  });
  const csrfToken = await createAdminCsrfToken({ env, session });

  if (!sessionCookie) throw new Error("Expected admin session cookie.");
  if (!csrfToken) throw new Error("Expected admin CSRF token.");

  return {
    cookie: sessionCookie.split(";")[0],
    csrfToken
  };
}

function jsonRequest(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  method = "POST"
) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1",
      ...headers
    },
    method
  });
}

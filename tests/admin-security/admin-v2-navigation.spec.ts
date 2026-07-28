import { expect, test } from "@playwright/test";
import {
  getAdminV2AvailableModuleActions,
  resolveAdminV2CoachSiteFocus
} from "../../lib/admin-v2-navigation";

test.describe("Admin V2 navigation", () => {
  test("shows only production modules allowed by the current admin profile", () => {
    expect(
      getAdminV2AvailableModuleActions({
        isOwner: false,
        permissions: ["overview.view", "coach_sites.view", "website_creator.create"]
      }).map((action) => action.viewId)
    ).toEqual(["overview", "coach-sites", "create-coach-site"]);
  });

  test("maps reporting and coach-performance modules to real production views", () => {
    expect(
      getAdminV2AvailableModuleActions({
        isOwner: false,
        permissions: [
          "backup_cleanup.view",
          "coach_analytics.top_performers",
          "error_reports.view"
        ]
      }).map((action) => action.viewId)
    ).toEqual(["top-coaches", "error-reports"]);
  });

  test("keeps Shop visible for production Shop sub-permissions", () => {
    for (const permission of ["shop.view", "shop.payment_settings.view", "shop.reports"]) {
      expect(
        getAdminV2AvailableModuleActions({
          isOwner: false,
          permissions: [permission]
        }).map((action) => action.viewId)
      ).toContain("shop");
    }
  });

  test("keeps merged maintenance and Admin Users out of the standalone V2 launcher", () => {
    expect(
      getAdminV2AvailableModuleActions({
        isOwner: false,
        permissions: ["backup_cleanup.view", "admin_users.manage"]
      }).map((action) => action.viewId)
    ).not.toContain("backup-cleanup");

    expect(
      getAdminV2AvailableModuleActions({
        isOwner: true,
        permissions: []
      }).map((action) => action.viewId)
    ).not.toContain("admin-users");
  });

  test("resolves an explicit coach-site handoff exactly and fails closed when identity is ambiguous", () => {
    const sites = [
      {
        coachId: "coach-a",
        coachName: "Coach A",
        id: "site-a",
        slug: "coach-a"
      },
      {
        coachId: "coach-b",
        coachName: "Coach B",
        id: "site-b",
        slug: "coach-b"
      }
    ];

    expect(
      resolveAdminV2CoachSiteFocus(sites, {
        coachId: "coach-b",
        coachSlug: "coach-b",
        siteId: "site-b"
      })?.id
    ).toBe("site-b");
    expect(
      resolveAdminV2CoachSiteFocus(
        [...sites, { coachId: "coach-b", coachName: "Coach B alternate", id: "site-b-2", slug: "coach-b" }],
        { coachId: "coach-b", coachSlug: "coach-b" }
      )
    ).toBeNull();
    expect(
      resolveAdminV2CoachSiteFocus(sites, {
        coachId: "coach-b",
        coachSlug: "coach-b",
        siteId: "site-a"
      })
    ).toBeNull();
    expect(resolveAdminV2CoachSiteFocus(sites, { coachSlug: "missing-coach" })).toBeNull();
  });
});

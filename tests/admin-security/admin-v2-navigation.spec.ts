import { expect, test } from "@playwright/test";
import { getAdminV2AvailableModuleActions } from "../../lib/admin-v2-navigation";

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
});

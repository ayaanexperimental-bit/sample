import { expect, test } from "@playwright/test";
import { adminControlCenterData } from "../../lib/admin-control-center";
import { getAdminV2DashboardData } from "../../lib/admin-v2-dashboard-data";

test.describe("Admin V2 data adapter", () => {
  test("maps real admin payload shapes and gates sources by RBAC before fetch", async () => {
    const requestedPaths: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const path =
        typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      requestedPaths.push(path);

      if (path.startsWith("/api/admin/analytics-events")) {
        return jsonResponse({
          analyticsSummaries: [
            {
              coachId: "coach-1",
              coachSlug: "coach-one",
              dailyVisits: 4,
              deviceBreakdown: { desktop: 3, mobile: 6, tablet: 1 },
              funnelId: "free",
              funnelType: "free_guest_link",
              lastActivity: "2026-06-30T10:00:00.000Z",
              monthlyVisits: 20,
              paymentButtonClicks: 0,
              paymentInitiated: 0,
              paymentSuccess: 0,
              region: "IN",
              registerClicks: 5,
              source: "direct",
              successPageViews: 0,
              totalVisits: 10,
              videoPlays: 2,
              weeklyVisits: 8,
              whatsappClicks: 3
            },
            {
              coachId: "coach-2",
              coachSlug: "coach-two",
              dailyVisits: 2,
              deviceBreakdown: { desktop: 1, mobile: 3, tablet: 0 },
              funnelId: "paid",
              funnelType: "paid_masterclass",
              lastActivity: "2026-06-30T11:00:00.000Z",
              monthlyVisits: 12,
              paymentButtonClicks: 4,
              paymentInitiated: 2,
              paymentSuccess: 1,
              region: "IN",
              registerClicks: 4,
              source: "campaign",
              successPageViews: 1,
              totalVisits: 6,
              videoPlays: 1,
              weeklyVisits: 5,
              whatsappClicks: 2
            }
          ],
          audienceRegions: [
            {
              children: [
                {
                  children: [],
                  coordinates: { lat: 20.9517, lng: 85.0985, scope: "known" },
                  countryLabel: "India",
                  deviceBreakdown: { desktop: 1, mobile: 4, tablet: 0, unknown: 0 },
                  id: "region:india:odisha",
                  label: "Odisha",
                  lastActivity: "2026-06-30T12:30:00.000Z",
                  level: "region",
                  parentId: "country:india",
                  paymentSuccess: 1,
                  registerClicks: 4,
                  share: 31.3,
                  sourceBreakdown: [{ label: "direct", share: 100, visits: 5 }],
                  visits: 5
                }
              ],
              coordinates: { lat: 20.5937, lng: 78.9629, scope: "known" },
              countryLabel: "India",
              deviceBreakdown: { desktop: 4, mobile: 9, tablet: 1, unknown: 0 },
              id: "country:india",
              label: "India",
              lastActivity: "2026-06-30T12:30:00.000Z",
              level: "country",
              parentId: null,
              paymentSuccess: 1,
              registerClicks: 9,
              share: 100,
              sourceBreakdown: [
                { label: "direct", share: 62.5, visits: 10 },
                { label: "campaign", share: 37.5, visits: 6 }
              ],
              visits: 16
            }
          ],
          configured: true,
          ok: true,
          previousAnalyticsSummaries: [],
          recentEvents: [
            {
              coachId: "coach-1",
              coachSlug: "coach-one",
              createdAt: "2026-06-30T12:30:00.000Z",
              deviceType: "mobile",
              eventName: "coach_register_click",
              funnelId: "free",
              funnelType: "free_guest_link",
              pagePath: "/coach-one",
              region: "IN",
              source: "direct"
            }
          ],
          source: "d1_analytics_events"
        });
      }

      if (path === "/api/admin/coach-sites") {
        return jsonResponse({
          coachSites: [{ status: "published" }, { status: "draft" }],
          configured: true,
          ok: true
        });
      }

      if (path === "/api/admin/error-reports") {
        return jsonResponse({
          errorReports: [{ status: "New" }, { status: "Fixed" }],
          persistence: "d1_table"
        });
      }

      throw new Error(`Unexpected Admin V2 adapter request: ${path}`);
    };

    const snapshot = await getAdminV2DashboardData({
      adminAccess: {
        isOwner: false,
        permissions: ["coach_analytics.view", "coach_sites.view", "error_reports.view"]
      },
      fetcher
    });

    expect(requestedPaths).toEqual([
      "/api/admin/coach-sites",
      "/api/admin/analytics-events?range=7d",
      "/api/admin/error-reports"
    ]);
    expect(snapshot.status).toBe("ready");
    expect(snapshot.sources.authSession).toMatchObject({
      source: "admin-session",
      status: "ready"
    });
    expect(snapshot.sources.users.status).toBe("not-authorized");
    expect(snapshot.sources.shop.status).toBe("not-authorized");
    expect(snapshot.sourceSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "authSession",
          label: "Admin session",
          status: "ready",
          tone: "success"
        }),
        expect.objectContaining({
          id: "analyticsEvents",
          label: "Analytics events",
          status: "ready",
          tone: "success"
        }),
        expect.objectContaining({
          id: "users",
          label: "Admin users",
          status: "not-authorized",
          tone: "warning"
        })
      ])
    );
    expect(snapshot.recentSignals).toEqual([
      expect.objectContaining({
        detail: "coach-one / free guest link / mobile / IN",
        label: "Coach Register Click",
        timestamp: "2026-06-30T12:30:00.000Z"
      })
    ]);
    expect(snapshot.sources.analyticsEvents.data?.audienceRegions).toEqual([
      expect.objectContaining({
        children: expect.arrayContaining([expect.objectContaining({ label: "Odisha" })]),
        id: "country:india",
        label: "India",
        sourceBreakdown: expect.arrayContaining([expect.objectContaining({ label: "direct" })]),
        visits: 16
      })
    ]);
    expect(snapshot.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "total-visits", value: 16 }),
        expect.objectContaining({ id: "register-clicks", value: 9 }),
        expect.objectContaining({ id: "payment-success", value: 1 }),
        expect.objectContaining({ id: "coach-sites-total", value: 2 }),
        expect.objectContaining({ id: "coach-sites-published", value: 1 }),
        expect.objectContaining({ id: "open-error-reports", value: 1 })
      ])
    );
  });

  test("hydrates protected paid-link metadata with complete canonical payment rows", async () => {
    const canonicalLink = adminControlCenterData.paidMasterclassLinks[0];
    expect(canonicalLink).toBeTruthy();

    const snapshot = await getAdminV2DashboardData({
      adminAccess: {
        isOwner: false,
        permissions: ["paid_masterclass.view_settings"]
      },
      fetcher: async (input) => {
        const path =
          typeof input === "string" ? input : input instanceof Request ? input.url : String(input);

        if (path === "/api/admin/masterclass-private-link") {
          return jsonResponse({
            links: [
              {
                configured: true,
                entryCode: canonicalLink.entryCode,
                funnelId: canonicalLink.funnelId,
                paymentPageConfigured: true,
                paymentPageStorageSource: "d1_table",
                paymentPageUpdatedAt: "2026-07-27T07:00:00.000Z",
                paymentPageUpdatedBy: "admin@example.com",
                storageSource: "d1_table",
                updatedAt: "2026-07-27T07:00:00.000Z",
                updatedBy: "admin@example.com"
              }
            ],
            ok: true,
            privateLinkValuesExposed: false
          });
        }

        if (path === "/api/admin/masterclass-settings") {
          return jsonResponse({ ok: true });
        }

        throw new Error(`Unexpected Admin V2 adapter request: ${path}`);
      }
    });

    expect(snapshot.sources.masterclassPrivateLinks.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coachName: canonicalLink.coachName,
          displayName: canonicalLink.displayName,
          entryPath: canonicalLink.entryPath,
          funnelId: canonicalLink.funnelId,
          paidPagePath: canonicalLink.paidPagePath,
          successPath: canonicalLink.successPath
        })
      ])
    );
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status
  });
}

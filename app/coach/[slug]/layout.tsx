import type { ReactNode } from "react";
import { CoachSupportProvider } from "../../../components/coach/coach-support-context";
import { getPublicCoachSiteBySlug, normalizeCoachSlug } from "../../../lib/admin-coach-sites";

type CoachRouteLayoutProps = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export default async function CoachRouteLayout({ children, params }: CoachRouteLayoutProps) {
  const { slug } = await params;
  const normalizedSlug = normalizeCoachSlug(slug);
  const site = getPublicCoachSiteBySlug(normalizedSlug);

  return (
    <CoachSupportProvider site={site} slug={normalizedSlug}>
      {children}
    </CoachSupportProvider>
  );
}

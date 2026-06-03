import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCoachSitePage } from "../../../components/coach/public-coach-site-page";
import { approvedCoachSites, getPublicCoachSiteBySlug } from "../../../lib/admin-coach-sites";

export const dynamicParams = false;

type PublicCoachRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return approvedCoachSites
    .filter((site) => site.status === "published" || site.status === "paused")
    .map((site) => ({
      slug: site.slug
    }));
}

export async function generateMetadata({ params }: PublicCoachRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const site = getPublicCoachSiteBySlug(slug);

  if (!site) {
    return {
      title: "Coach Page | YW Coach",
      robots: {
        follow: false,
        index: false
      }
    };
  }

  return {
    title: `${site.coachName} | YW Coach`,
    description: site.content.subheadline,
    robots: {
      follow: true,
      index: true
    }
  };
}

export default async function PublicCoachPage({ params }: PublicCoachRouteProps) {
  const { slug } = await params;
  const site = getPublicCoachSiteBySlug(slug);

  if (!site) {
    notFound();
  }

  return <PublicCoachSitePage site={site} />;
}

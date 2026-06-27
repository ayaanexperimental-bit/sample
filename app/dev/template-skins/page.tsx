import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCoachTemplateFeatureFlags } from "@/lib/coach-template-themes";
import { TemplateSkinsGalleryClient } from "./template-skins-gallery-client";

export const metadata: Metadata = {
  title: "Template Skins Gallery | YW Nutritech",
  description: "Internal coach-site template skin QA gallery.",
  robots: {
    follow: false,
    index: false
  }
};

export default function TemplateSkinsGalleryPage() {
  const featureFlags = getCoachTemplateFeatureFlags();
  if (
    process.env.NODE_ENV === "production" &&
    !featureFlags.enableTemplateSkinDebugPanel
  ) {
    notFound();
  }

  return <TemplateSkinsGalleryClient />;
}

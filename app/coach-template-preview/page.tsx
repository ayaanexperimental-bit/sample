import type { Metadata } from "next";
import { Suspense } from "react";

import { CoachTemplatePreviewClient } from "./coach-template-preview-client";

export const metadata: Metadata = {
  title: "Coach Template Preview | YW Nutritech",
  description: "Premium YW Nutritech coach referral template theme preview."
};

export default function CoachTemplatePreviewPage() {
  return (
    <Suspense fallback={null}>
      <CoachTemplatePreviewClient />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { ProgramSuccessPage } from "@/components/coach/program-success-page";
import { getFunnelById } from "@/lib/coach-platform";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  },
  title: "Registration Successful | Gyana PMOS 51"
};

export default function Page() {
  const funnel = getFunnelById("gyana-pcos-51");

  if (!funnel) {
    return null;
  }

  return <ProgramSuccessPage thankYouVideoUrl={funnel.thankYouVideoUrl ?? ""} />;
}

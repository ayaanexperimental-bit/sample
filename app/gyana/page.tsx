import type { Metadata } from "next";
import { GuestCoachPage } from "@/components/coach/guest-coach-page";
import { getCoachBySlug } from "@/lib/coach-platform";

export const metadata: Metadata = {
  title: "Gyana Ranjan PMOS Guest Session | YW Coach",
  description:
    "A practical PMOS and women wellness guest session page with Coach Gyana Ranjan on YW Coach."
};

export default function Page() {
  const coach = getCoachBySlug("gyana");

  if (!coach) {
    return null;
  }

  return <GuestCoachPage coach={coach} />;
}

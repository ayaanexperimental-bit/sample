import type { Metadata } from "next";
import { BlockedPage } from "@/components/coach/blocked-page";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  },
  title: "Link Not Available"
};

export default function SuccessPage() {
  return <BlockedPage />;
}

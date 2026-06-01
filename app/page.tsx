import type { Metadata } from "next";
import { YW_ROOT_REDIRECT_URL } from "@/lib/coach-platform";

export const metadata: Metadata = {
  title: "YW Coach"
};

export default function Home() {
  return (
    <main className="root-redirect-page">
      <meta httpEquiv="refresh" content={`0;url=${YW_ROOT_REDIRECT_URL}`} />
      <a href={YW_ROOT_REDIRECT_URL}>Continue to Yours Wellness</a>
    </main>
  );
}

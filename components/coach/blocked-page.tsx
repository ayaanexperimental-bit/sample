import { BLOCKED_LINK_MESSAGE } from "@/lib/coach-platform";

export function BlockedPage() {
  return (
    <main className="blocked-page">
      <section className="blocked-page__panel" aria-labelledby="blocked-title">
        <p className="blocked-page__kicker">Link unavailable</p>
        <h1 id="blocked-title">Access blocked</h1>
        <p>{BLOCKED_LINK_MESSAGE}</p>
      </section>
    </main>
  );
}

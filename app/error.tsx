"use client";

type ErrorPageProps = {
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="success-page">
      <article className="success-document success-thank-you" aria-labelledby="error-title">
        <p className="policy-kicker success-kicker">Something went wrong</p>
        <h1 id="error-title">This page could not load properly</h1>
        <p className="success-subtitle">
          Please try again. If the issue continues, return to the main page and reopen this section.
        </p>
        <button className="success-whatsapp-button" onClick={reset} type="button">
          Try Again
        </button>
      </article>
    </main>
  );
}

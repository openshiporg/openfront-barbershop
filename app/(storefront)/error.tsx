'use client';

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-storefront className="sf-state">
      <main id="main-content" role="alert">
        <h1 className="sf-display sf-h1">This page couldn’t load</h1>
        <p className="sf-lead"><span className="sf-dot is-alert" aria-hidden="true" />Temporarily unavailable. Nothing was changed; try again in a moment.</p>
        <div className="sf-actions"><button type="button" onClick={reset} className="sf-btn is-primary">Try again</button></div>
      </main>
    </div>
  );
}

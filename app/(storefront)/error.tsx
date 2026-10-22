'use client';

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-storefront className="sf-state">
      <main id="main-content" role="alert">
        <p className="sf-eyebrow"><span className="sf-dot is-alert" aria-hidden="true" />Temporarily unavailable</p>
        <h1 className="sf-display text-[var(--text-display-s)]">This page couldn’t load</h1>
        <p className="sf-muted">Nothing was changed. Try again in a moment.</p>
        <div className="sf-track"><button type="button" onClick={reset} className="sf-pill is-primary">Try again</button></div>
      </main>
    </div>
  );
}

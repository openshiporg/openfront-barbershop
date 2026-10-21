'use client';

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-storefront className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 text-[var(--color-ink)]">
      <main id="main-content" className="w-full max-w-xl border border-[var(--color-rule-strong)] p-8 text-center sm:p-12" role="alert">
        <p className="sf-eyebrow">Temporarily unavailable</p>
        <h1 className="sf-display mt-4 text-[var(--text-title)]">This page couldn’t load.</h1>
        <p className="mt-4 text-[var(--color-ink-muted)]">Nothing was changed. Try again in a moment, or contact the shop.</p>
        <button type="button" onClick={reset} className="sf-btn sf-btn-primary mt-6">Try again</button>
      </main>
    </div>
  );
}

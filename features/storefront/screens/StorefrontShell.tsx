import type { CSSProperties } from 'react';
import { storefrontThemeStyle } from '@/features/shared/storefront-settings';
import { getPublicStorefrontSettingsState } from '../lib/data/settings';
import { StorefrontFooter } from '../components/StorefrontFooter';
import { StorefrontNav } from '../components/StorefrontNav';

function UnconfiguredStorefront({ unavailable = false }: { unavailable?: boolean }) {
  if (unavailable) {
    return (
      <div data-storefront className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 text-[var(--color-ink)]">
        <main className="w-full max-w-xl border border-[var(--color-rule-strong)] p-8 text-center sm:p-12" role="alert">
          <p className="sf-eyebrow">Temporarily unavailable</p>
          <h1 className="sf-display mt-4 text-[var(--text-title)]">This page couldn’t load.</h1>
          <p className="mt-4 text-[var(--color-ink-muted)]">Try again in a moment, or contact the shop.</p>
        </main>
      </div>
    );
  }
  return (
    <div data-storefront className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 text-[var(--color-ink)]">
      <main className="w-full max-w-xl border border-[var(--color-rule-strong)] p-8 text-center sm:p-12">
        <p className="sf-eyebrow">Storefront unavailable</p>
        <h1 className="sf-display mt-4 text-[var(--text-title)]">Storefront not configured</h1>
        <p className="mt-4 text-[var(--color-ink-muted)]">
          This shop’s online storefront isn’t open yet.
        </p>
      </main>
    </div>
  );
}

export async function StorefrontShell({ children, allowUnavailableChildren = false }: { children: React.ReactNode; allowUnavailableChildren?: boolean }) {
  const state = await getPublicStorefrontSettingsState();
  if (state.status !== 'published') return allowUnavailableChildren ? <div data-storefront className="min-h-screen">{children}</div> : <UnconfiguredStorefront unavailable={state.status === 'unavailable'} />;
  const { settings } = state;

  return (
    <div
      data-storefront
      className="flex min-h-screen flex-col"
      style={storefrontThemeStyle(settings.brandColor, settings.logoColor) as CSSProperties}
    >
      <a href="#main-content" className="sf-skip-link">
        Skip to content
      </a>
      <StorefrontNav settings={settings} />
      <div className="flex-1">{children}</div>
      <StorefrontFooter settings={settings} />
    </div>
  );
}

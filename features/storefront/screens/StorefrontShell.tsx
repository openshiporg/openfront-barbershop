import type { CSSProperties } from 'react';
import { storefrontThemeStyle } from '@/features/shared/storefront-settings';
import { getPublicStorefrontSettingsState } from '../lib/data/settings';
import { shopHours } from '../lib/hours';
import { StorefrontFooter } from '../components/StorefrontFooter';
import { StorefrontNav } from '../components/StorefrontNav';

function UnconfiguredStorefront({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <div data-storefront className="sf-state">
      <main role={unavailable ? 'alert' : undefined}>
        <p className="sf-eyebrow"><span className={`sf-dot ${unavailable ? 'is-alert' : ''}`} aria-hidden="true" />{unavailable ? 'Temporarily unavailable' : 'Storefront closed'}</p>
        <h1 className="sf-display text-[var(--text-display-s)]">{unavailable ? 'This page couldn’t load' : 'Storefront not configured'}</h1>
        <p className="sf-muted">{unavailable ? 'Try again in a moment.' : 'This shop’s online storefront isn’t open yet.'}</p>
      </main>
    </div>
  );
}

export async function StorefrontShell({ children, allowUnavailableChildren = false }: { children: React.ReactNode; allowUnavailableChildren?: boolean }) {
  const state = await getPublicStorefrontSettingsState();
  if (state.status !== 'published') return allowUnavailableChildren ? <div data-storefront className="min-h-screen">{children}</div> : <UnconfiguredStorefront unavailable={state.status === 'unavailable'} />;
  const { settings } = state;
  const { state: openState } = shopHours(settings.hours, settings.timezone);

  return (
    <div
      data-storefront
      className="flex min-h-screen flex-col"
      style={storefrontThemeStyle(settings.brandColor, settings.logoColor) as CSSProperties}
    >
      <a href="#main-content" className="sf-skip-link">
        Skip to content
      </a>
      <StorefrontNav settings={settings} openState={openState} />
      <div className="flex-1">{children}</div>
      <StorefrontFooter settings={settings} />
    </div>
  );
}

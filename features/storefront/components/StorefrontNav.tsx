'use client';

import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { phoneHref, type PublicStorefrontSettings } from '@/features/shared/storefront-settings';
import type { ShopOpenState } from '../lib/hours';
import { StoreLogo } from './StoreLogo';

const items = [
  { href: '/queue', label: 'Walk-ins' },
  { href: '/services', label: 'Prices' },
  { href: '/barbers', label: 'Barbers' },
  { href: '/shop', label: 'Shop' },
  { href: '/memberships', label: 'Memberships' },
  { href: '/appointment', label: 'My appointment' },
  { href: '/account', label: 'Account' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The black sign band: shop name, open state and today's hours, the way in. */
export function StorefrontNav({ settings, openState, todayHours = null }: { settings: PublicStorefrontSettings; openState: ShopOpenState; todayHours?: string | null }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const telephoneHref = phoneHref(settings.phone);
  const isHome = pathname === '/';
  const status = openState ? <><span className={`sf-dot ${openState.open ? 'is-live' : 'is-alert'}`} aria-hidden="true" /><strong>{openState.label}</strong></> : null;

  return (
    <>
    <header className="sf-nav">
      <div className="sf-container sf-nav-bar">
        <Link href="/" className="sf-brand" aria-label={`${settings.name} home`} onClick={() => setOpen(false)}>
          <StoreLogo svg={settings.logoIcon} color={settings.logoColor} />
          {isHome ? null : <span className="sf-brand-name">{settings.name}</span>}
        </Link>

        <nav className="sf-nav-links" aria-label="Primary navigation">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined} className="sf-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sf-nav-actions">
          {!isHome && status ? <span className="sf-nav-status">{status}</span> : null}
          <Link href="/book" className="sf-nav-book" onClick={() => setOpen(false)}>Book</Link>
          <button
            type="button"
            className="sf-nav-toggle"
            aria-expanded={open}
            aria-controls="storefront-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="storefront-menu" className="sf-container sf-nav-sheet" aria-label="Menu">
          <Link href="/" onClick={() => setOpen(false)} aria-current={isHome ? 'page' : undefined}>Home <ArrowRight aria-hidden="true" /></Link>
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
              {item.label} <ArrowRight aria-hidden="true" />
            </Link>
          ))}
          <p className="sf-nav-sheet-status">
            {status ? <span>{status}</span> : null}
            {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`} className="sf-mono">{settings.phone}</a> : null}
          </p>
        </nav>
      ) : null}
    </header>

      {isHome ? (
        <div className="sf-sign-band">
        <div className="sf-container sf-sign">
          <div className="grid min-w-0 gap-2">
            <h1 className="sf-display">{settings.name}</h1>
            {settings.tagline ? <p className="sf-sign-meta">{settings.tagline}</p> : null}
          </div>
          <p className="sf-sign-meta">
            {status ? <span>{status}</span> : null}
            {todayHours ? <span>Today {todayHours}</span> : null}
            {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`} className="sf-mono">{settings.phone}</a> : null}
          </p>
        </div>
        </div>
      ) : null}
    </>
  );
}

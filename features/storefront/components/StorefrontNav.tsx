'use client';

import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { phoneHref, type PublicStorefrontSettings } from '@/features/shared/storefront-settings';
import type { ShopOpenState } from '../lib/hours';
import { StoreLogo } from './StoreLogo';

const items = [
  { href: '/services', label: 'Services' },
  { href: '/barbers', label: 'Barbers' },
  { href: '/queue', label: 'Walk-ins' },
  { href: '/appointment', label: 'My appointment' },
  { href: '/account', label: 'Account' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StorefrontNav({ settings, openState }: { settings: PublicStorefrontSettings; openState: ShopOpenState }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const telephoneHref = phoneHref(settings.phone);

  return (
    <header className="sf-nav">
      <div className="sf-nav-strip">
        <div className="sf-container sf-nav-strip-row">
          <span>{openState ? <><span className={`sf-dot ${openState.open ? 'is-live' : ''}`} aria-hidden="true" />{openState.label}</> : settings.address || settings.name}</span>
          {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`} className="sf-mono">{settings.phone}</a> : null}
        </div>
      </div>

      <div className="sf-container sf-nav-bar">
        <Link href="/" className="sf-brand" aria-label={`${settings.name} home`} onClick={() => setOpen(false)}>
          <StoreLogo svg={settings.logoIcon} color={settings.logoColor} />
          <span className="sf-brand-name">{settings.name}</span>
        </Link>

        <nav className="sf-nav-links" aria-label="Primary navigation">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined} className="sf-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sf-nav-actions">
          <div className="sf-track">
            <Link href="/book" className="sf-pill is-primary" onClick={() => setOpen(false)}>Book</Link>
            <button
              type="button"
              className="sf-pill sf-nav-toggle"
              aria-expanded={open}
              aria-controls="storefront-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <nav id="storefront-menu" className="sf-container sf-nav-sheet" aria-label="Menu">
          <Link href="/" onClick={() => setOpen(false)} aria-current={pathname === '/' ? 'page' : undefined}>Home <ArrowUpRight aria-hidden="true" className="size-5" /></Link>
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
              {item.label} <ArrowUpRight aria-hidden="true" className="size-5" />
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="sf-pole" aria-hidden="true" />
    </header>
  );
}

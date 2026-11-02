'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Home, Menu, Scissors, User, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { phoneHref, type PublicStorefrontSettings } from '@/features/shared/storefront-settings';
import type { ShopOpenState } from '../lib/hours';
import { StoreMark } from './StoreMark';

const items = [
  { href: '/shop', label: 'Shop' },
  { href: '/services', label: 'Services' },
  { href: '/barbers', label: 'Barbers' },
  { href: '/memberships', label: 'Memberships' },
  { href: '/queue', label: 'Walk-ins' },
  { href: '/appointment', label: 'My appointment' },
];

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/appointment', label: 'Appointments', icon: CalendarDays },
  { href: '/services', label: 'Services', icon: Scissors },
  { href: '/account', label: 'Profile', icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Floating paper bar: links left, the shop's own logo centred, account and Book right. Phone adds a tab bar. */
export function StorefrontNav({ settings, openState }: { settings: PublicStorefrontSettings; openState: ShopOpenState; todayHours?: string | null }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const telephoneHref = phoneHref(settings.phone);
  const status = openState ? <><span className={`sf-dot ${openState.open ? 'is-live' : 'is-alert'}`} aria-hidden="true" /><strong>{openState.label}</strong></> : null;

  return (
    <>
      <header className="sf-nav">
        <div className="sf-nav-bar">
          <nav className="sf-nav-links" aria-label="Primary navigation">
            {items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined} className="sf-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          <Link href="/" className="sf-brand" aria-label={`${settings.name} home`} onClick={() => setOpen(false)}>
            <StoreMark svg={settings.logoIcon} color={settings.logoColor} />
            <span className="sf-brand-name">{settings.name}</span>
          </Link>

          <div className="sf-nav-actions">
            <Link href="/account" className="sf-nav-icon" aria-label="Account" aria-current={isActive(pathname, '/account') ? 'page' : undefined}><User aria-hidden="true" /></Link>
            <Link href="/appointment" className="sf-nav-icon" aria-label="My appointment" aria-current={isActive(pathname, '/appointment') ? 'page' : undefined}><CalendarDays aria-hidden="true" /></Link>
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
          <nav id="storefront-menu" className="sf-nav-sheet" aria-label="Menu">
            <Link href="/" onClick={() => setOpen(false)} aria-current={pathname === '/' ? 'page' : undefined}>Home <ArrowRight aria-hidden="true" /></Link>
            {[...items, { href: '/account', label: 'Account' }].map((item) => (
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

      {/* Desktop: the side tab from the flash sheet, always one click from booking. */}
      <Link href="/book" className="sf-side-tab" aria-label="Book now">
        <span>Book now</span>
        <ArrowRight aria-hidden="true" />
      </Link>

      {/* Phone: bottom tab bar. */}
      <nav className="sf-tabbar" aria-label="Quick navigation">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(pathname, href) ? 'page' : undefined}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Home, Menu, Scissors, Ticket, User, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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

/* The drawer carries every page; the tab bar is the four things a customer does. Account sits in the header. */
const drawerItems = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/barbers', label: 'Barbers' },
  { href: '/queue', label: 'Walk-ins' },
  { href: '/memberships', label: 'Memberships' },
  { href: '/shop', label: 'Shop' },
  { href: '/gift-cards', label: 'Gift cards' },
  { href: '/appointment', label: 'My appointment' },
  { href: '/account', label: 'Account' },
];

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/book', label: 'Book', icon: Scissors },
  { href: '/queue', label: 'Walk-ins', icon: Ticket },
  { href: '/appointment', label: 'My visit', icon: CalendarDays },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Floating paper bar: links left, the shop's own logo centred, account and Book right. Phone adds a tab bar. */
export function StorefrontNav({ settings, openState }: { settings: PublicStorefrontSettings; openState: ShopOpenState; todayHours?: string | null }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Open drawer: the page behind stays put, Escape closes it, Tab stays inside, focus returns to the menu button.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    const opener = toggle.current;
    root.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('.sf-drawer-close')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return setOpen(false);
      if (event.key !== 'Tab' || !drawer.current) return;
      const stops = drawer.current.querySelectorAll<HTMLElement>('a[href], button');
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { root.style.overflow = previous; document.removeEventListener('keydown', onKey); opener?.focus(); };
  }, [open]);
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
            <Link href="/account" className="sf-nav-icon is-account" aria-label="Account" aria-current={isActive(pathname, '/account') ? 'page' : undefined}><User aria-hidden="true" /></Link>
            <Link href="/appointment" className="sf-nav-icon" aria-label="My appointment" aria-current={isActive(pathname, '/appointment') ? 'page' : undefined}><CalendarDays aria-hidden="true" /></Link>
            <Link href="/book" className="sf-nav-book" onClick={() => setOpen(false)}>Book</Link>
            <button
              type="button"
              ref={toggle}
              className="sf-nav-toggle"
              aria-expanded={open}
              aria-controls="storefront-menu"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>

        {open ? (
          <div className="sf-drawer-layer">
            <button type="button" className="sf-drawer-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />
            <div ref={drawer} id="storefront-menu" className="sf-drawer" role="dialog" aria-modal="true" aria-label="Menu">
              <div className="sf-drawer-head">
                <p className="sf-drawer-title">Menu</p>
                <button type="button" className="sf-drawer-close" aria-label="Close menu" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>
              </div>
              <Link href="/book" className="sf-drawer-book" onClick={() => setOpen(false)}>Book a time <ArrowRight aria-hidden="true" /></Link>
              <nav className="sf-drawer-links" aria-label="Menu">
                {drawerItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>{item.label}</Link>
                ))}
              </nav>
              <p className="sf-drawer-foot">
                {status ? <span>{status}</span> : null}
                {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`}>{settings.phone}</a> : null}
              </p>
            </div>
          </div>
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

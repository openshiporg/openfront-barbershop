'use client';

import Link from 'next/link';
import { StoreLogo } from './StoreLogo';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { phoneHref, type PublicStorefrontSettings } from '@/features/shared/storefront-settings';

const items = [
  { href: '/services', label: 'Services' },
  { href: '/account', label: 'Account' },
  { href: '/barbers', label: 'Barbers' },
  { href: '/queue', label: 'Walk-ins' },
  { href: '/appointment', label: 'Appointment status' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StorefrontNav({ settings }: { settings: PublicStorefrontSettings }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const telephoneHref = phoneHref(settings.phone);

  return (
    <header className="sf-nav">
      <div className="sf-nav-utility">
        <div className="sf-container sf-nav-utility-row">
          <span>{settings.tagline || 'Independent barbering'}</span>
          {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`}>{settings.phone}</a> : <span />}
        </div>
      </div>

      <div className="sf-container sf-nav-brand-row">
        <Link href="/" className="sf-wordmark" aria-label={`${settings.name} home`}>
          <StoreLogo svg={settings.logoIcon} color={settings.logoColor} />
          <span className="sf-wordmark-name">{settings.name}</span>
        </Link>
        {settings.address ? <p className="sf-nav-address">{settings.address}</p> : null}
        <button
          type="button"
          className="sf-nav-toggle"
          aria-expanded={open}
          aria-controls="storefront-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span>{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>

      <div className="sf-nav-rule" aria-hidden="true" />
      <div id="storefront-menu" className={`sf-container sf-nav-menu ${open ? 'is-open' : ''}`}>
        {open ? <Link href="/" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 md:hidden"><StoreLogo svg={settings.logoIcon} color={settings.logoColor} />{settings.name}</Link> : null}
        <nav className="sf-nav-links" aria-label="Primary navigation">
          <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} className="sf-nav-link">Home</Link>
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(pathname, item.href) ? 'page' : undefined} className="sf-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/book" className="sf-btn sf-btn-primary sf-nav-book">Book a chair</Link>
      </div>
    </header>
  );
}

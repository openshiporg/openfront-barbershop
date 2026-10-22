import Link from 'next/link';
import { StoreLogo } from './StoreLogo';
import { phoneHref, type PublicStorefrontSettings } from '@/features/shared/storefront-settings';

export function StorefrontFooter({ settings }: { settings: PublicStorefrontSettings }) {
  const telephoneHref = phoneHref(settings.phone);

  return (
    <footer className="sf-footer">
      <div className="sf-pole" aria-hidden="true" />
      <div className="sf-container sf-footer-main">
        <div className="grid gap-4">
          <p className="sf-footer-mark"><StoreLogo svg={settings.logoIcon} color={settings.logoColor} />{settings.name}</p>
          {settings.tagline ? <p className="max-w-md text-[var(--color-inverse-muted)]">{settings.tagline}</p> : null}
        </div>
        <nav className="sf-footer-nav" aria-label="Storefront links">
          <Link href="/book">Book a chair</Link>
          <Link href="/queue">Walk-ins</Link>
          <Link href="/services">Services</Link>
          <Link href="/barbers">Barbers</Link>
          <Link href="/appointment">My appointment</Link>
          <Link href="/account">Account</Link>
        </nav>
      </div>
      <div className="sf-container sf-footer-base">
        {settings.address ? <address>{settings.address}</address> : null}
        {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`} className="sf-mono">{settings.phone}</a> : null}
        <span>© {new Date().getFullYear()} {settings.name}</span>
        <Link href="/dashboard">Staff sign in</Link>
      </div>
    </footer>
  );
}

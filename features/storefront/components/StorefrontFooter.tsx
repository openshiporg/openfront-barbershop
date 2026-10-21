import Link from 'next/link';
import { StoreLogo } from './StoreLogo';
import { phoneHref, type PublicStorefrontSettings } from '@/features/shared/storefront-settings';

export function StorefrontFooter({ settings }: { settings: PublicStorefrontSettings }) {
  const telephoneHref = phoneHref(settings.phone);

  return (
    <footer className="sf-footer">
      <div className="sf-container sf-footer-main">
        <div>
          <p className="sf-footer-wordmark flex items-center gap-2"><StoreLogo svg={settings.logoIcon} color={settings.logoColor} />{settings.name}</p>
          {settings.tagline ? <p className="sf-footer-tagline">{settings.tagline}</p> : null}
        </div>
        <nav className="sf-footer-nav" aria-label="Storefront links">
          <Link href="/services">Services</Link>
          <Link href="/account">Account</Link>
          <Link href="/barbers">Barbers</Link>
          <Link href="/queue">Walk-ins</Link>
          <Link href="/appointment">Appointment status</Link>
          <Link href="/book">Book a chair</Link>
        </nav>
      </div>
      <div className="sf-container sf-footer-contact">
        {settings.address ? <address>{settings.address}</address> : null}
        {telephoneHref && settings.phone ? <a href={`tel:${telephoneHref}`}>{settings.phone}</a> : null}
        <span>© {new Date().getFullYear()} {settings.name}</span>
        <Link href="/dashboard">Staff sign in</Link>
      </div>
    </footer>
  );
}

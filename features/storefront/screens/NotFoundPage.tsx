import Link from 'next/link';
import { StorefrontShell } from './StorefrontShell';

export default function NotFoundPage() {
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]">
        <p className="sf-eyebrow mb-3"><span className="sf-dot is-alert" aria-hidden="true" />404</p>
        <h1 className="sf-display text-[var(--text-display-s)]">Page not found</h1>
        <div className="sf-track mt-8">
          <Link href="/book" className="sf-pill is-primary">Book a chair</Link>
          <Link href="/services" className="sf-pill">Services</Link>
          <Link href="/" className="sf-pill">Home</Link>
        </div>
      </main>
    </StorefrontShell>
  );
}

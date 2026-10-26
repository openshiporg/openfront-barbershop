import Link from 'next/link';
import { StorefrontShell } from './StorefrontShell';

export default function NotFoundPage() {
  return (
    <StorefrontShell allowUnavailableChildren>
      <main id="main-content" className="sf-container-narrow py-[var(--space-3xl)]">
        <h1 className="sf-display sf-h1">Page not found</h1>
        <p className="sf-lead mt-3">That address isn’t on this shop’s site. Take a number or book a time instead.</p>
        <div className="sf-actions mt-8">
          <Link href="/queue" className="sf-btn">Join the line</Link>
          <Link href="/book" className="sf-btn is-primary">Book a time</Link>
          <Link href="/" className="sf-btn is-quiet">Home</Link>
        </div>
      </main>
    </StorefrontShell>
  );
}

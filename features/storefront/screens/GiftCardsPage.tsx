import Link from 'next/link';
import { GiftCardBuy } from '../components/GiftCardBuy';
import { getGiftCardOptions } from '../lib/data/giftCards';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { StorefrontShell } from './StorefrontShell';

/** Digital gift cards, emailed with a code that pays at checkout in the shop. */
export default async function GiftCardsPage() {
  const [settings, options] = await Promise.all([getPublicStorefrontSettings(), getGiftCardOptions()]);
  if (!settings) return <StorefrontShell><></></StorefrontShell>;
  return (
    <StorefrontShell>
      <main id="main-content">
        <section className="sf-container sf-page-head">
          <div className="sf-page-head-row">
            <h1 className="sf-display">Gift cards</h1>
            <div className="sf-actions"><Link href="/book" className="sf-btn">Book a time</Link></div>
          </div>
          <p className="sf-lead">A fresh cut for someone else. Emailed in minutes, good for any service, tip or product for a year.</p>
        </section>
        <section className="sf-container-narrow sf-section is-tight">
          {options.online && options.amounts.length
            ? <div className="sf-card"><GiftCardBuy amounts={options.amounts} /></div>
            : <p className="sf-notice">Gift cards are sold at the counter right now. Ask at your next visit.</p>}
        </section>
      </main>
    </StorefrontShell>
  );
}

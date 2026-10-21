import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { Suspense } from 'react';
import { getAllBarbers, getAllServices, type StorefrontBarber, type StorefrontService } from '../lib/data/services';
import { getPublicStorefrontSettings } from '../lib/data/settings';
import { getPublicBookingEligibility } from '../lib/data/booking-eligibility';
import { BookingPage } from './BookingPage';
import { StorefrontShell } from './StorefrontShell';

export default async function BookingPageServer() {
  const [catalog, settings, bookingEligibility] = await Promise.all([
    // A failed catalog request must not look like an empty menu, and must not
    // hide the check for an earlier unconfirmed booking request.
    Promise.all([getAllServices(), getAllBarbers()])
      .then(([services, barbers]) => ({ services, barbers, error: null as string | null }))
      .catch(() => ({ services: [] as StorefrontService[], barbers: [] as StorefrontBarber[], error: 'Services and barbers couldn’t be loaded. Try again in a moment, or call the shop.' })),
    getPublicStorefrontSettings(),
    getPublicBookingEligibility(),
  ]);

  const identity = await keystoneClient<{ authenticatedItem: { id: string } | null }>('query { authenticatedItem { ... on User { id } } }');
  const accountId = identity.success ? identity.data.authenticatedItem?.id || '' : '';
  return (
    <StorefrontShell allowUnavailableChildren>
        <Suspense fallback={<div className="min-h-screen bg-background" aria-label="Loading booking" />}>
          <BookingPage accountId={accountId} services={catalog.services} barbers={catalog.barbers} settings={settings} bookingEligibility={bookingEligibility} catalogError={catalog.error} />
        </Suspense>
    </StorefrontShell>
  );
}

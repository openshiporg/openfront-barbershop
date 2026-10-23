'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice, Pill, selectClass, StatusDot, Track } from '@/features/platform/lib/ui';
import { useOnboardingApi } from '../hooks/useOnboardingApi';

function timeZones(current: string) {
  let zones: string[] = [];
  try { zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') || []; } catch { zones = []; }
  return zones.includes(current) ? zones : [current, ...zones];
}

const rowClass = 'flex min-h-11 items-center justify-between gap-3 border-b text-sm font-medium last:border-b-0 hover:text-foreground';

export default function OnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [complete, setComplete] = useState(false);
  const [localFixtures, setLocalFixtures] = useState(false);
  const [mode, setMode] = useState<'minimal' | 'full'>('full');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shop, setShop] = useState(() => ({ shopName: '', shopAddress: '', shopPhone: '', shopTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York' }));
  const { runOnboarding } = useOnboardingApi();
  const field = (key: keyof typeof shop) => ({ id: `onboarding-${key}`, value: shop[key], onChange: (event: React.ChangeEvent<HTMLInputElement>) => setShop({ ...shop, [key]: event.target.value }) });
  const run = () => { setError(null); startTransition(async () => { const result = await runOnboarding(mode, shop); if (result.success) { const credentials = result.data.stats.PractitionerCredential; setLocalFixtures(Boolean(credentials && credentials.created + credentials.reused > 0)); setComplete(true); } else setError(result.error); }); };
  return <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle><StatusDot tone={complete ? (localFixtures ? 'live' : 'wait') : 'info'} />{complete ? 'Setup saved' : 'Shop setup'}</DialogTitle>
        <DialogDescription>{complete ? localFixtures ? 'Sample local practitioner records · offline payments · no licensing claim' : 'Configuration saved' : 'Your shop · sample services, barbers and weekly hours · offline payments'}</DialogDescription>
      </DialogHeader>
      {!complete ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="onboarding-shopName">Shop name</Label><Input {...field('shopName')} maxLength={120} autoComplete="organization" required /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="onboarding-shopAddress">Address</Label><Input {...field('shopAddress')} maxLength={200} autoComplete="street-address" /></div>
          <div className="grid gap-1.5"><Label htmlFor="onboarding-shopPhone">Phone</Label><Input {...field('shopPhone')} maxLength={40} type="tel" autoComplete="tel" /></div>
          <div className="grid gap-1.5"><Label htmlFor="onboarding-shopTimezone">Timezone</Label><select id="onboarding-shopTimezone" value={shop.shopTimezone} onChange={(event) => setShop({ ...shop, shopTimezone: event.target.value })} className={`${selectClass} font-mono`}>{timeZones(shop.shopTimezone).map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></div>
        </div>
      ) : null}
      {!complete ? (
        <Track block label="Setup size">
          {(['minimal', 'full'] as const).map(value => (
            <Pill
              key={value}
              variant="flat"
              role="radio"
              aria-checked={mode === value}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => setMode(value)}
              onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const next = mode === 'full' ? 'minimal' : 'full'; setMode(next); const group = event.currentTarget.parentElement; requestAnimationFrame(() => (group?.querySelector('[aria-checked="true"]') as HTMLButtonElement | null)?.focus()); } }}
              className="h-11"
            >
              {value === 'full' ? 'Full setup' : 'Minimal setup'}
            </Pill>
          ))}
        </Track>
      ) : (
        <nav className="grid gap-4">
          {!localFixtures ? (
            <div>
              <p className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"><StatusDot tone="wait" />Review before taking bookings</p>
              <Link href="/dashboard/booking-policies" className={rowClass}>Booking policy and jurisdiction <ArrowUpRight className="size-4" /></Link>
              <Link href="/dashboard/platform/store-settings" className={rowClass}>Shop details <ArrowUpRight className="size-4" /></Link>
              <Link href="/dashboard/practitioner-credentials" className={rowClass}>Practitioner credentials · licensed services only <ArrowUpRight className="size-4" /></Link>
            </div>
          ) : null}
          <div>
            <Link href="/dashboard/platform/services" className={rowClass}>Services & packages <ArrowUpRight className="size-4" /></Link>
            <Link href="/dashboard/platform/customers" className={rowClass}>Customers <ArrowUpRight className="size-4" /></Link>
            <Link href="/dashboard/platform/staff" className={rowClass}>Barbers & schedules <ArrowUpRight className="size-4" /></Link>
          </div>
        </nav>
      )}
      {error ? <Notice tone="alert">{error}</Notice> : null}
      <div className="flex justify-end">
        <Track>
          <Pill onClick={onClose}>Close</Pill>
          {!complete ? <Pill variant="primary" disabled={pending || !shop.shopName.trim()} onClick={run}>{pending ? 'Saving…' : `Run ${mode} setup`}</Pill> : null}
        </Track>
      </div>
    </DialogContent>
  </Dialog>;
}

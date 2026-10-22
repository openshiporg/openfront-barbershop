'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Notice, Pill, StatusDot, Track } from '@/features/platform/lib/ui';
import { useOnboardingApi } from '../hooks/useOnboardingApi';

const rowClass = 'flex min-h-11 items-center justify-between gap-3 border-b text-sm font-medium last:border-b-0 hover:text-foreground';

export default function OnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [complete, setComplete] = useState(false);
  const [localFixtures, setLocalFixtures] = useState(false);
  const [mode, setMode] = useState<'minimal' | 'full'>('full');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { runOnboarding } = useOnboardingApi();
  const run = () => { setError(null); startTransition(async () => { const result = await runOnboarding(mode); if (result.success) { const credentials = result.data.stats.PractitionerCredential; setLocalFixtures(Boolean(credentials && credentials.created + credentials.reused > 0)); setComplete(true); } else setError(result.error); }); };
  return <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle><StatusDot tone={complete ? (localFixtures ? 'live' : 'wait') : 'info'} />{complete ? 'Setup saved' : 'Shop setup'}</DialogTitle>
        <DialogDescription>{complete ? localFixtures ? 'Sample local practitioner records · offline payments · no licensing claim' : 'Configuration saved · not yet ready for bookings' : 'Sample services, barbers and weekly hours · offline payments · no customers, bookings, stock or payments'}</DialogDescription>
      </DialogHeader>
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
              <p className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"><StatusDot tone="wait" />Needed before confirming appointments</p>
              <Link href="/dashboard/practitioner-credentials" className={rowClass}>Barber practitioner credentials <ArrowUpRight className="size-4" /></Link>
              <Link href="/dashboard/booking-policies" className={rowClass}>Booking policy and jurisdiction <ArrowUpRight className="size-4" /></Link>
              <Link href="/dashboard/platform/store-settings" className={rowClass}>Shop details <ArrowUpRight className="size-4" /></Link>
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
          {!complete ? <Pill variant="primary" disabled={pending} onClick={run}>{pending ? 'Saving…' : `Run ${mode} setup`}</Pill> : null}
        </Track>
      </div>
    </DialogContent>
  </Dialog>;
}

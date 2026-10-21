'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOnboardingApi } from '../hooks/useOnboardingApi';

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
      <DialogHeader><DialogTitle>{complete ? 'Setup saved' : 'Shop setup'}</DialogTitle><DialogDescription>{complete ? localFixtures ? 'Sample local practitioner records · offline payments · no licensing claim' : 'Shop configuration saved · not yet ready for bookings' : 'Sample services, barbers and weekly hours for your shop · offline payments · no customers, bookings, stock or payments are created'}</DialogDescription></DialogHeader>
      {!complete ? <div className="flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Setup size">{(['minimal', 'full'] as const).map(value => <button key={value} type="button" role="radio" aria-checked={mode === value} tabIndex={mode === value ? 0 : -1} onClick={() => setMode(value)} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const next = mode === 'full' ? 'minimal' : 'full'; setMode(next); const group = event.currentTarget.parentElement; requestAnimationFrame(() => (group?.querySelector('[aria-checked="true"]') as HTMLButtonElement | null)?.focus()); } }} className={`min-h-11 flex-1 rounded-md px-4 ${mode === value ? 'bg-background shadow-sm' : ''}`}>{value === 'full' ? 'Full setup' : 'Minimal setup'}</button>)}</div> : <nav className="grid gap-2">{!localFixtures ? <div className="grid gap-1 rounded-lg border p-3 text-sm"><p className="font-medium">Still needed before appointments can be confirmed</p><Link href="/dashboard/practitioner-credentials" className="inline-flex min-h-11 items-center">Add each barber's verified practitioner credentials ↗</Link><Link href="/dashboard/booking-policies" className="inline-flex min-h-11 items-center">Review the booking policy and jurisdiction ↗</Link><Link href="/dashboard/platform/store-settings" className="inline-flex min-h-11 items-center">Review shop details ↗</Link></div> : null}<Link href="/dashboard/platform/services" className="inline-flex min-h-11 items-center">Services & packages ↗</Link><Link href="/dashboard/platform/customers" className="inline-flex min-h-11 items-center">Customers ↗</Link><Link href="/dashboard/platform/staff" className="inline-flex min-h-11 items-center">Barbers & schedules ↗</Link></nav>}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button>{!complete ? <Button disabled={pending} onClick={run}>{pending ? 'Saving…' : `Run ${mode} setup`}</Button> : null}</div>
    </DialogContent>
  </Dialog>;
}

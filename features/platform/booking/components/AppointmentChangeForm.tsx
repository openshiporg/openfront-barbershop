'use client';

import { useId, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { shopDateKey, shopMinute } from '@/features/shared/shop-time';
import { useCommandKey } from '@/features/platform/lib/useCommandKey';
import { manageStaffAppointmentAction } from '../actions/appointments';
import { parseShopDateTime } from '../lib/shopTimeInput';
import { Pill, selectClass, Track } from '@/features/platform/lib/ui';

type BarberOption = { id: string; displayName?: string | null; bookingEnabled?: boolean | null };

function pad(value: number) { return String(value).padStart(2, '0'); }

export function AppointmentChangeForm({ appointmentId, startsAt, barberId, barbers, specialistIds, timeZone, onClose }: {
  appointmentId: string;
  startsAt?: string | null;
  barberId?: string | null;
  barbers: BarberOption[];
  specialistIds?: string[];
  timeZone: string;
  onClose: () => void;
}) {
  const id = useId();
  const initialDate = startsAt ? shopDateKey(startsAt, timeZone) : '';
  const initialMinute = startsAt ? shopMinute(startsAt, timeZone) : 0;
  const initialTime = startsAt ? `${pad(Math.floor(initialMinute / 60))}:${pad(initialMinute % 60)}` : '';
  const [action, setAction] = useState<'reschedule' | 'cancel'>('reschedule');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [nextBarberId, setNextBarberId] = useState(barberId || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { keyFor, settle } = useCommandKey(`appointment-change:${appointmentId}`);
  const eligibleBarbers = barbers.filter((barber) => barber.bookingEnabled !== false && (!specialistIds?.length || specialistIds.includes(barber.id)));

  const submit = () => {
    setError(null); setStatus(null);
    if (reason.trim().length < 2) { setError('Enter a reason for this change.'); return; }
    let nextStart: string | undefined;
    if (action === 'reschedule') {
      const when = parseShopDateTime(date, time, timeZone);
      if (!when.ok) { setError(when.error); return; }
      const sameTime = startsAt && new Date(startsAt).toISOString() === when.iso;
      const sameBarber = nextBarberId === (barberId || '');
      if (sameTime && sameBarber) { setError('Choose a different time or barber.'); return; }
      nextStart = sameTime ? undefined : when.iso;
    }
    const input = { appointmentId, action, startsAt: nextStart, barberId: action === 'reschedule' && nextBarberId !== (barberId || '') ? nextBarberId : undefined, reason: reason.trim() };
    const key = keyFor(input);
    startTransition(async () => {
      try {
        const result = await manageStaffAppointmentAction(input, key);
        if (!result.success || result.data?.appointmentId !== appointmentId) {
          setError(result.error || 'The change could not be confirmed. Refresh the booking board before retrying.');
          return;
        }
        settle();
        const fee = Number(result.data?.feeAmount || 0);
        const deposit = String(result.data?.depositConsequence || 'none');
        setStatus(`${action === 'cancel' ? 'Appointment cancelled' : 'Appointment updated'}.${fee > 0 ? ` Policy fee recorded: $${(fee / 100).toFixed(2)} (not charged automatically).` : ''}${deposit !== 'none' ? ` Deposit follow-up: ${deposit.replace(/_/g, ' ')}.` : ''}`);
      } catch {
        setError('Connection interrupted. The change may have been recorded. Submit again without edits to check; it will not apply twice.');
      }
    });
  };

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <Track label="Change type">
        <Pill size="sm" variant="flat" aria-pressed={action === 'reschedule'} onClick={() => setAction('reschedule')}>Reschedule</Pill>
        <Pill size="sm" variant="flat" aria-pressed={action === 'cancel'} onClick={() => setAction('cancel')}>Cancel</Pill>
      </Track>
      {action === 'reschedule' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid gap-1"><Label htmlFor={`${id}-date`}>Date</Label><Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor={`${id}-time`}>Time ({timeZone})</Label><Input id={`${id}-time`} type="time" step={300} value={time} onChange={(event) => setTime(event.target.value)} /></div>
          <div className="grid gap-1">
            <Label htmlFor={`${id}-barber`}>Barber</Label>
            <select id={`${id}-barber`} value={nextBarberId} onChange={(event) => setNextBarberId(event.target.value)} className={selectClass}>
              {eligibleBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.displayName || 'Barber'}</option>)}
              {barberId && !eligibleBarbers.some((barber) => barber.id === barberId) && <option value={barberId}>Current barber</option>}
            </select>
          </div>
        </div>
      )}
      <div className="grid gap-1"><Label htmlFor={`${id}-reason`}>Reason</Label><Input id={`${id}-reason`} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></div>
      <Track>
        <Pill size="sm" variant={action === 'cancel' ? 'danger' : 'primary'} disabled={pending} onClick={submit}>{pending ? 'Saving…' : action === 'cancel' ? 'Cancel appointment' : 'Save change'}</Pill>
        <Pill size="sm" disabled={pending} onClick={onClose}>Close</Pill>
      </Track>
      <div aria-live="polite">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {status && <p role="status" className="text-sm">{status}</p>}
      </div>
    </div>
  );
}

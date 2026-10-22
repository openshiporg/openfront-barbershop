'use client';

import { useId, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { shopWallTime, formatShopDateTime } from '../../../shared/shop-time';
import { useCommandKey } from '../../lib/useCommandKey';
import { Notice, Pill, StatusDot, Track } from '../../lib/ui';
import { cancelScheduleExceptionAction, createScheduleExceptionAction, scheduleShiftAction, transitionShiftAction } from '../actions/workforce';

type Shift = { id: string; status: string; scheduledStart: string; scheduledEnd: string; clockedInAt?: string | null };
type Exception = { id: string; exceptionType: string; startsAt: string; endsAt: string; reason: string };
type CommandResult = { success: boolean; error?: string | null };

type WorkforceControlsProps = {
  barberId?: string;
  chairId?: string;
  shifts: Shift[];
  exceptions: Exception[];
  // null when the shop has no valid timezone: time-changing forms are disabled.
  timeZone: string | null;
};

// Converts a datetime-local wall time in the shop timezone. Returns an error
// message instead of silently dropping invalid or non-existent (DST gap) times.
function wallTimeToIso(value: string, timeZone: string): { iso: string | null; error: string | null } {
  if (!value) return { iso: null, error: null };
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return { iso: null, error: 'Enter a valid date and time.' };
  try {
    const minute = Number(match[2]) * 60 + Number(match[3]);
    const instant = shopWallTime(match[1], minute, timeZone);
    const roundTrip = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant).replace(', ', 'T');
    if (roundTrip !== `${match[1]}T${match[2]}:${match[3]}`) return { iso: null, error: `That time does not exist in ${timeZone} (daylight saving change).` };
    return { iso: instant.toISOString(), error: null };
  } catch {
    return { iso: null, error: 'Enter a valid date and time.' };
  }
}

export function WorkforceControls({ barberId, chairId, shifts, exceptions, timeZone }: WorkforceControlsProps) {
  const id = useId();
  const scope = barberId ? `barber:${barberId}` : 'shop';
  const { keyFor, settle } = useCommandKey(`workforce:${scope}`);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [pending, begin] = useTransition();

  const startTime = timeZone ? wallTimeToIso(start, timeZone) : { iso: null, error: null };
  const endTime = timeZone ? wallTimeToIso(end, timeZone) : { iso: null, error: null };
  const orderError = startTime.iso && endTime.iso && endTime.iso <= startTime.iso ? 'End must be after start.' : null;
  const validWindow = Boolean(startTime.iso && endTime.iso && !orderError);
  const busy = pending || pendingTarget !== null;

  const execute = (target: string, body: unknown, command: (key: string) => Promise<CommandResult>, success: string) => {
    const key = keyFor(body, target);
    setMessage(null);
    setPendingTarget(target);
    begin(async () => {
      try {
        const result = await command(key);
        if (result.success) {
          settle(target);
          setMessage({ kind: 'status', text: success });
          if (target === 'window') { setStart(''); setEnd(''); setReason(''); }
        } else {
          setMessage({ kind: 'error', text: result.error || 'Unable to save.' });
        }
      } catch {
        setMessage({ kind: 'error', text: 'Connection interrupted. The change may have been saved. Retry to confirm; the same request will not be applied twice.' });
      } finally {
        setPendingTarget(null);
      }
    });
  };

  const windowBody = (type: string) => ({ type, barberId, chairId, start: startTime.iso, end: endTime.iso, reason: reason.trim() });

  if (!timeZone) {
    return <p role="status" className="mt-4 border-t pt-4 text-sm text-muted-foreground"><StatusDot tone="off" />Shop timezone not set. Scheduling unavailable.</p>;
  }

  return <div className="mt-4 space-y-3 border-t pt-4">
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${id}-start`} className="text-xs text-muted-foreground">Start ({timeZone})</Label>
        <Input id={`${id}-start`} type="datetime-local" value={start} aria-invalid={Boolean(startTime.error)} aria-describedby={startTime.error ? `${id}-start-error` : undefined} onChange={(event) => setStart(event.target.value)} className="mt-1" />
        {startTime.error && <p id={`${id}-start-error`} role="alert" className="mt-1 text-xs text-destructive">{startTime.error}</p>}
      </div>
      <div>
        <Label htmlFor={`${id}-end`} className="text-xs text-muted-foreground">End ({timeZone})</Label>
        <Input id={`${id}-end`} type="datetime-local" value={end} aria-invalid={Boolean(endTime.error || orderError)} aria-describedby={endTime.error || orderError ? `${id}-end-error` : undefined} onChange={(event) => setEnd(event.target.value)} className="mt-1" />
        {(endTime.error || orderError) && <p id={`${id}-end-error`} role="alert" className="mt-1 text-xs text-destructive">{endTime.error || orderError}</p>}
      </div>
    </div>
    <div>
      <Label htmlFor={`${id}-reason`} className="text-xs text-muted-foreground">Reason</Label>
      <Input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1" />
    </div>
    <Track>
      {barberId && <Pill size="sm" disabled={busy || !validWindow} onClick={() => execute('window', windowBody('shift'), (key) => scheduleShiftAction({ barberId, scheduledStart: startTime.iso!, scheduledEnd: endTime.iso! }, key), 'Shift scheduled.')}>Schedule shift</Pill>}
      {barberId && <Pill size="sm" disabled={busy || !validWindow || !reason.trim()} onClick={() => execute('window', windowBody('time_off'), (key) => createScheduleExceptionAction({ barberId, exceptionType: 'time_off', startsAt: startTime.iso!, endsAt: endTime.iso!, reason: reason.trim() }, key), 'Time off added.')}>Time off</Pill>}
      {barberId && <Pill size="sm" disabled={busy || !validWindow || !reason.trim()} onClick={() => execute('window', windowBody('working_override'), (key) => createScheduleExceptionAction({ barberId, exceptionType: 'working_override', startsAt: startTime.iso!, endsAt: endTime.iso!, reason: reason.trim() }, key), 'Working hours override added.')}>Override</Pill>}
      {chairId && <Pill size="sm" disabled={busy || !validWindow || !reason.trim()} onClick={() => execute('window', windowBody('chair_unavailable'), (key) => createScheduleExceptionAction({ chairId, exceptionType: 'chair_unavailable', startsAt: startTime.iso!, endsAt: endTime.iso!, reason: reason.trim() }, key), 'Chair blocked.')}>Block chair</Pill>}
      {!barberId && <Pill size="sm" variant="danger" disabled={busy || !validWindow || !reason.trim()} onClick={() => execute('window', windowBody('shop_closure'), (key) => createScheduleExceptionAction({ exceptionType: 'shop_closure', startsAt: startTime.iso!, endsAt: endTime.iso!, reason: reason.trim() }, key), 'Shop closure added.')}>Close shop</Pill>}
    </Track>
    {shifts.map((shift) => {
      const overdue = shift.status === 'clocked_in' && new Date(shift.scheduledEnd).getTime() < Date.now();
      const disabled = busy;
      return <div key={shift.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-xs last:border-b-0">
        <span className="min-w-0"><StatusDot tone={overdue ? 'alert' : shift.status === 'clocked_in' ? 'live' : 'info'} />
          {formatShopDateTime(shift.scheduledStart, timeZone)} – {formatShopDateTime(shift.scheduledEnd, timeZone)} · {shift.status.replaceAll('_', ' ')}
          {shift.clockedInAt && ` · in at ${formatShopDateTime(shift.clockedInAt, timeZone)}`}
          {overdue && <strong className="ml-1 text-destructive">· past scheduled end</strong>}
          {pendingTarget === shift.id && ' · saving…'}
        </span>
        <Track>
          {shift.status === 'scheduled' && <Pill size="sm" variant="primary" disabled={disabled} onClick={() => execute(shift.id, { shift: shift.id, action: 'clock_in' }, (key) => transitionShiftAction(shift.id, 'clock_in', key), 'Clocked in.')}>Clock in</Pill>}
          {shift.status === 'clocked_in' && <Pill size="sm" variant="primary" disabled={disabled} onClick={() => execute(shift.id, { shift: shift.id, action: 'clock_out' }, (key) => transitionShiftAction(shift.id, 'clock_out', key), 'Clocked out.')}>Clock out</Pill>}
          {['scheduled', 'clocked_in'].includes(shift.status) && <Pill size="sm" disabled={disabled} onClick={() => execute(shift.id, { shift: shift.id, action: 'cancel' }, (key) => transitionShiftAction(shift.id, 'cancel', key), 'Shift cancelled.')}>Cancel</Pill>}
        </Track>
      </div>;
    })}
    {exceptions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-xs last:border-b-0"><span className="min-w-0"><StatusDot tone="wait" />{item.exceptionType.replaceAll('_', ' ')} · {formatShopDateTime(item.startsAt, timeZone)} – {formatShopDateTime(item.endsAt, timeZone)} · {item.reason}{pendingTarget === item.id && ' · saving…'}</span><Track><Pill size="sm" disabled={busy} onClick={() => execute(item.id, { exception: item.id, action: 'cancel' }, (key) => cancelScheduleExceptionAction(item.id, key), 'Exception cancelled.')}>Cancel</Pill></Track></div>)}
    <div aria-live="polite">{message && <Notice tone={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</Notice>}</div>
  </div>;
}

'use client';

import { useId, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { shopWallTime, formatShopDateTime } from '../../../shared/shop-time';
import { useCommandKey } from '../../lib/useCommandKey';
import { Notice, Pill, StatusDot } from '../../lib/ui';
import { Segmented } from '../../records/lib/controls';
import { cancelScheduleExceptionAction, createScheduleExceptionAction, scheduleShiftAction, transitionShiftAction } from '../actions/workforce';

type Shift = { id: string; status: string; scheduledStart: string; scheduledEnd: string; clockedInAt?: string | null };
type Exception = { id: string; exceptionType: string; startsAt: string; endsAt: string; reason: string };
type CommandResult = { success: boolean; error?: string | null };

type WorkforceControlsProps = {
  barberId?: string;
  chairId?: string;
  chairLabel?: string;
  // 'compact' drops the top rule when the controls sit in a drawer.
  bare?: boolean;
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

type Kind = 'shift' | 'time_off' | 'working_override' | 'chair_unavailable' | 'shop_closure';
const SUBMIT: Record<Kind, string> = { shift: 'Schedule shift', time_off: 'Add time off', working_override: 'Add hours override', chair_unavailable: 'Block chair', shop_closure: 'Close shop' };
const DONE: Record<Kind, string> = { shift: 'Shift scheduled.', time_off: 'Time off added.', working_override: 'Hours override added.', chair_unavailable: 'Chair blocked.', shop_closure: 'Shop closure added.' };
const EXCEPTION: Record<string, string> = { time_off: 'Time off', working_override: 'Hours override', chair_unavailable: 'Chair blocked', shop_closure: 'Shop closed' };
const SHIFT: Record<string, string> = { scheduled: 'Scheduled', clocked_in: 'Clocked in' };

/** Short zone name for labels ("EDT"), falling back to the IANA id. */
export function zoneLabel(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value || timeZone;
  } catch { return timeZone; }
}

export function WorkforceControls({ barberId, chairId, chairLabel, bare = false, shifts, exceptions, timeZone }: WorkforceControlsProps) {
  const id = useId();
  const scope = barberId ? `barber:${barberId}` : 'shop';
  const { keyFor, settle } = useCommandKey(`workforce:${scope}`);
  const [kind, setKind] = useState<Kind>(barberId ? 'shift' : 'shop_closure');
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
  const needsReason = kind !== 'shift';
  const missing = !start || !end ? 'Enter a start and end.' : needsReason && !reason.trim() ? 'Enter a reason.' : null;

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
    return <p role="status" className={bare ? 'text-sm text-muted-foreground' : 'mt-4 border-t pt-4 text-sm text-muted-foreground'}><StatusDot tone="off" />Shop timezone not set. Scheduling unavailable.</p>;
  }

  const submit = () => {
    if (!validWindow || (needsReason && !reason.trim())) return;
    const startsAt = startTime.iso!, endsAt = endTime.iso!, why = reason.trim();
    if (kind === 'shift' && barberId) execute('window', windowBody('shift'), (key) => scheduleShiftAction({ barberId, scheduledStart: startsAt, scheduledEnd: endsAt }, key), DONE.shift);
    else if (kind === 'chair_unavailable' && chairId) execute('window', windowBody(kind), (key) => createScheduleExceptionAction({ chairId, exceptionType: kind, startsAt, endsAt, reason: why }, key), DONE[kind]);
    else if (kind === 'shop_closure') execute('window', windowBody(kind), (key) => createScheduleExceptionAction({ exceptionType: kind, startsAt, endsAt, reason: why }, key), DONE[kind]);
    else if ((kind === 'time_off' || kind === 'working_override') && barberId) execute('window', windowBody(kind), (key) => createScheduleExceptionAction({ barberId, exceptionType: kind, startsAt, endsAt, reason: why }, key), DONE[kind]);
  };
  const choices: Array<{ value: Kind; label: string }> = barberId
    ? [{ value: 'shift', label: 'Shift' }, { value: 'time_off', label: 'Time off' }, { value: 'working_override', label: 'Hours override' }, ...(chairId ? [{ value: 'chair_unavailable' as Kind, label: chairLabel ? `Block ${chairLabel}` : 'Block chair' }] : [])]
    : [];
  const zone = zoneLabel(timeZone);

  return <div className={bare ? 'space-y-5' : 'mt-4 space-y-5 border-t pt-4'}>
    <div className="space-y-3">
      {choices.length ? <Segmented label="What to add" value={kind} options={choices} onChange={(value) => { setKind(value); setMessage(null); }} disabled={busy} className="w-full [&>*]:flex-1" /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-start`} className="text-xs text-muted-foreground">Starts ({zone})</Label>
          <Input id={`${id}-start`} type="datetime-local" value={start} aria-invalid={Boolean(startTime.error)} aria-describedby={startTime.error ? `${id}-start-error` : undefined} onChange={(event) => setStart(event.target.value)} className="mt-1 h-9 rounded-[6px] tabular-nums" />
          {startTime.error && <p id={`${id}-start-error`} role="alert" className="mt-1 text-xs text-destructive">{startTime.error}</p>}
        </div>
        <div>
          <Label htmlFor={`${id}-end`} className="text-xs text-muted-foreground">Ends ({zone})</Label>
          <Input id={`${id}-end`} type="datetime-local" value={end} aria-invalid={Boolean(endTime.error || orderError)} aria-describedby={endTime.error || orderError ? `${id}-end-error` : undefined} onChange={(event) => setEnd(event.target.value)} className="mt-1 h-9 rounded-[6px] tabular-nums" />
          {(endTime.error || orderError) && <p id={`${id}-end-error`} role="alert" className="mt-1 text-xs text-destructive">{endTime.error || orderError}</p>}
        </div>
      </div>
      {needsReason ? (
        <div>
          <Label htmlFor={`${id}-reason`} className="text-xs text-muted-foreground">Reason</Label>
          <Input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-9 rounded-[6px]" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Pill variant={kind === 'shop_closure' ? 'danger' : 'primary'} disabled={busy || !validWindow || (needsReason && !reason.trim())} onClick={submit}>{pendingTarget === 'window' ? 'Saving…' : kind === 'chair_unavailable' && chairLabel ? `Block ${chairLabel}` : SUBMIT[kind]}</Pill>
        {missing && !busy ? <span className="text-xs text-muted-foreground">{missing}</span> : null}
      </div>
    </div>
    <div aria-live="polite">{message && <Notice tone={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</Notice>}</div>
    {shifts.length || exceptions.length ? (
      <div>
        <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">Coming up</h3>
        {shifts.map((shift) => {
          const overdue = shift.status === 'clocked_in' && new Date(shift.scheduledEnd).getTime() < Date.now();
          return <div key={shift.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
            <span className="min-w-0"><StatusDot tone={overdue ? 'alert' : shift.status === 'clocked_in' ? 'live' : 'info'} />
              <span className="font-medium">{SHIFT[shift.status] || shift.status.replaceAll('_', ' ')} shift</span>
              <span className="block pl-4 text-xs tabular-nums text-muted-foreground">{formatShopDateTime(shift.scheduledStart, timeZone)} – {formatShopDateTime(shift.scheduledEnd, timeZone)}{shift.clockedInAt && ` · in at ${formatShopDateTime(shift.clockedInAt, timeZone)}`}{overdue && <strong className="ml-1 font-medium text-destructive">· past scheduled end</strong>}{pendingTarget === shift.id && ' · saving…'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              {shift.status === 'scheduled' && <Pill size="sm" variant="primary" disabled={busy} onClick={() => execute(shift.id, { shift: shift.id, action: 'clock_in' }, (key) => transitionShiftAction(shift.id, 'clock_in', key), 'Clocked in.')}>Clock in</Pill>}
              {shift.status === 'clocked_in' && <Pill size="sm" variant="primary" disabled={busy} onClick={() => execute(shift.id, { shift: shift.id, action: 'clock_out' }, (key) => transitionShiftAction(shift.id, 'clock_out', key), 'Clocked out.')}>Clock out</Pill>}
              {['scheduled', 'clocked_in'].includes(shift.status) && <Pill size="sm" variant="flat" disabled={busy} onClick={() => execute(shift.id, { shift: shift.id, action: 'cancel' }, (key) => transitionShiftAction(shift.id, 'cancel', key), 'Shift cancelled.')}>Cancel shift</Pill>}
            </span>
          </div>;
        })}
        {exceptions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
          <span className="min-w-0"><StatusDot tone="wait" /><span className="font-medium">{EXCEPTION[item.exceptionType] || item.exceptionType.replaceAll('_', ' ')}</span><span className="block pl-4 text-xs tabular-nums text-muted-foreground">{formatShopDateTime(item.startsAt, timeZone)} – {formatShopDateTime(item.endsAt, timeZone)} · {item.reason}{pendingTarget === item.id && ' · saving…'}</span></span>
          <Pill size="sm" variant="flat" disabled={busy} onClick={() => execute(item.id, { exception: item.id, action: 'cancel' }, (key) => cancelScheduleExceptionAction(item.id, key), 'Removed.')}>Remove</Pill>
        </div>)}
      </div>
    ) : null}
  </div>;
}

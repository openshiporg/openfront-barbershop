'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm, Field, TransitionPills, useFormAction } from '@/features/platform/lib/forms';
import { Notice, Pill, selectClass, StatusDot, Track } from '@/features/platform/lib/ui';
import { addCredentialAction, saveWeeklyHoursAction, setCredentialStatusAction, updateBarberAction, type BarberPageData } from '../actions/barbers';

const DAYS: Array<[string, string]> = [['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun']];
const hhmm = (minute: number | null | undefined) => (minute == null ? '' : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);

export function EditBarberButton({ data }: { data: BarberPageData }) {
  const { barber } = data;
  const [chairId, setChairId] = useState(barber.chair?.id || '');
  const [services, setServices] = useState(barber.specialties.map((service) => service.id));
  const chair = data.chairs.find((item) => item.id === chairId);
  return (
    <DrawerForm trigger="Edit profile" triggerVariant="primary" title={`Edit ${barber.displayName}`} action={(form) => updateBarberAction(barber.id, form)}>
      <input type="hidden" name="chairNumber" value={chair?.chairNumber || ''} />
      {services.map((id) => <input key={id} type="hidden" name="serviceIds" value={id} />)}
      <Field id="barber-name" label="Name"><Input id="barber-name" name="displayName" defaultValue={barber.displayName} required maxLength={120} /></Field>
      <Field id="barber-legal" label="Legal name"><Input id="barber-legal" name="legalName" defaultValue={barber.legalName || ''} maxLength={120} /></Field>
      <Field id="barber-phone" label="Phone"><Input id="barber-phone" name="phone" type="tel" defaultValue={barber.phone || ''} maxLength={40} /></Field>
      <Field id="barber-email" label="Email"><Input id="barber-email" name="email" type="email" defaultValue={barber.email || ''} maxLength={254} /></Field>
      <Field id="barber-chair" label="Chair"><select id="barber-chair" name="chairId" value={chairId} onChange={(event) => setChairId(event.target.value)} className={selectClass}><option value="">No chair</option>{data.chairs.map((item) => <option key={item.id} value={item.id}>Chair {item.chairNumber}{item.stationName ? ` · ${item.stationName}` : ''}{item.status !== 'active' ? ` (${item.status})` : ''}</option>)}</select></Field>
      <Field id="barber-status" label="Status"><select id="barber-status" name="status" defaultValue={barber.status} className={selectClass}><option value="active">Active</option><option value="away">Away</option><option value="inactive">Inactive</option></select></Field>
      <Field id="barber-buffer" label="Cleanup after visits (min)"><Input id="barber-buffer" name="bufferMinutes" type="number" inputMode="numeric" min={0} max={240} step={5} defaultValue={barber.bufferMinutes ?? 10} className="font-mono" /></Field>
      <Field id="barber-commission" label="Service commission (%)"><Input id="barber-commission" name="commissionPercent" type="number" inputMode="decimal" min={0} max={100} step="0.5" defaultValue={(barber.serviceCommissionRateBps ?? 0) / 100} className="font-mono" /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="bookingEnabled" defaultChecked={barber.bookingEnabled} className="size-4" />Takes online bookings</label>
      <fieldset className="grid gap-1.5 sm:col-span-2">
        <legend className="pb-1.5 text-sm font-medium">Services</legend>
        <Track label="Services" wrap>
          {data.services.map((service) => {
            const on = services.includes(service.id);
            return <Pill key={service.id} size="sm" variant="flat" aria-pressed={on} onClick={() => setServices(on ? services.filter((id) => id !== service.id) : [...services, service.id])}>{service.name}</Pill>;
          })}
        </Track>
      </fieldset>
      <Field id="barber-photo" label="Photo" wide><Input id="barber-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" /></Field>
      <Field id="barber-bio" label="Bio" wide><Textarea id="barber-bio" name="bio" defaultValue={barber.bio || ''} maxLength={2000} /></Field>
    </DrawerForm>
  );
}

export function WeeklyHoursForm({ data }: { data: BarberPageData }) {
  const byDay = new Map(data.barber.schedules.map((row) => [row.dayOfWeek, row]));
  const [working, setWorking] = useState(() => Object.fromEntries(DAYS.map(([day]) => [day, Boolean(byDay.get(day)?.isWorking)])));
  const [saved, setSaved] = useState(false);
  const { submit, pending, error } = useFormAction((form) => saveWeeklyHoursAction(data.barber.id, form), () => setSaved(true));
  return (
    <form onSubmit={(event) => { setSaved(false); submit(event); }} className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-1.5 font-medium">Day</th><th className="font-medium">Works</th><th className="font-medium">Start</th><th className="font-medium">End</th><th className="font-medium">Break from</th><th className="font-medium">Break to</th></tr></thead>
          <tbody>
            {DAYS.map(([day, label]) => {
              const row = byDay.get(day);
              const on = working[day];
              return (
                <tr key={day} className="border-t">
                  <td className="py-2 font-medium"><StatusDot tone={on ? 'live' : 'off'} />{label}</td>
                  <td><input type="checkbox" name={`${day}-working`} aria-label={`Works ${label}`} checked={on} onChange={(event) => setWorking({ ...working, [day]: event.target.checked })} className="size-4" /></td>
                  {(['start', 'end', 'breakStart', 'breakEnd'] as const).map((part) => {
                    const value = part === 'start' ? row?.startMinute : part === 'end' ? row?.endMinute : part === 'breakStart' ? row?.breakStartMinute : row?.breakEndMinute;
                    const fallback = part === 'start' ? '09:00' : part === 'end' ? '18:00' : '';
                    return <td key={part} className="pr-2"><Input type="time" step={900} name={`${day}-${part}`} aria-label={`${label} ${part}`} defaultValue={row?.isWorking ? hhmm(value) : fallback} disabled={!on} className="h-8 w-28 font-mono" /></td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {saved && !error ? <Notice>Hours saved</Notice> : null}
      <Track><Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save hours'}</Pill></Track>
    </form>
  );
}

export function AddCredentialButton({ data }: { data: BarberPageData }) {
  const [supervised, setSupervised] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <DrawerForm trigger="Add credential" title="Add practitioner credential" action={(form) => addCredentialAction(data.barber.id, form)}>
      <Field id="cred-service" label="Service"><select id="cred-service" name="serviceId" required className={selectClass}>{data.services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.credentialRequired ? ' · licensed' : ''}</option>)}</select></Field>
      <Field id="cred-type" label="Type"><select id="cred-type" name="credentialType" className={selectClass}><option value="barber">Barber</option><option value="master_barber">Master barber</option><option value="apprentice">Apprentice</option><option value="cosmetology">Cosmetology</option><option value="other">Other</option></select></Field>
      <Field id="cred-number" label="Licence number"><Input id="cred-number" name="credentialNumber" required maxLength={80} className="font-mono" /></Field>
      <Field id="cred-authority" label="Issued by"><Input id="cred-authority" name="issuingAuthority" required maxLength={160} /></Field>
      <Field id="cred-jurisdiction" label="Jurisdiction"><Input id="cred-jurisdiction" name="jurisdictionCode" defaultValue={data.shop.jurisdictionCode} required maxLength={20} className="font-mono uppercase" /></Field>
      <Field id="cred-from" label="Valid from"><Input id="cred-from" name="effectiveFrom" type="date" defaultValue={today} required className="font-mono" /></Field>
      <Field id="cred-to" label="Expires"><Input id="cred-to" name="expiresAt" type="date" required className="font-mono" /></Field>
      <Field id="cred-evidence" label="Evidence reference" wide><Input id="cred-evidence" name="evidence" required maxLength={500} placeholder="Registry link or document ID" /></Field>
      <Field id="cred-scope" label="Scope" wide><Input id="cred-scope" name="scopeDescription" maxLength={500} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="supervisionRequired" checked={supervised} onChange={(event) => setSupervised(event.target.checked)} className="size-4" />Works under supervision</label>
      {supervised ? <Field id="cred-supervisor" label="Supervisor" wide><select id="cred-supervisor" name="supervisorId" required className={selectClass}>{data.barbers.filter((barber) => barber.id !== data.barber.id).map((barber) => <option key={barber.id} value={barber.id}>{barber.displayName}</option>)}</select></Field> : null}
    </DrawerForm>
  );
}

export function CredentialStatus({ barberId, credentialId, status }: { barberId: string; credentialId: string; status: string }) {
  if (status !== 'active') return null;
  return <TransitionPills label="Credential status" current={status} options={[{ value: 'suspended', label: 'Suspend' }, { value: 'expired', label: 'Mark expired' }, { value: 'revoked', label: 'Revoke', danger: true }]} run={(next) => setCredentialStatusAction(barberId, credentialId, next, '')} />;
}

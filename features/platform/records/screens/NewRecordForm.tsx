'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Notice, Pill, PillLink, Section, selectClass, Track } from '@/features/platform/lib/ui';
import { createBarberAction, createCustomerAction, createProductAction, createServiceAction, type RecordOptions } from '../actions/records';

export type RecordKind = 'service' | 'barber' | 'customer' | 'product';

export const RECORD_RETURN: Record<RecordKind, string> = {
  service: '/dashboard/platform/services',
  barber: '/dashboard/platform/staff',
  customer: '/dashboard/platform/customers',
  product: '/dashboard/platform/services',
};

function Field({ id, label, children, wide = false }: { id: string; label: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? 'grid gap-1.5 sm:col-span-2' : 'grid gap-1.5'}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Picks({ label, options, value, onChange }: { label: string; options: RecordOptions['barbers']; value: string[]; onChange: (next: string[]) => void }) {
  if (!options.length) return null;
  return (
    <fieldset className="grid gap-1.5 sm:col-span-2">
      <legend className="pb-1.5 text-sm font-medium">{label}</legend>
      <Track label={label}>
        {options.map((option) => {
          const on = value.includes(option.id);
          return <Pill key={option.id} size="sm" variant="flat" aria-pressed={on} onClick={() => onChange(on ? value.filter((id) => id !== option.id) : [...value, option.id])}>{option.name}</Pill>;
        })}
      </Track>
    </fieldset>
  );
}

const money = { type: 'number', inputMode: 'decimal' as const, min: 0, step: '0.01', className: 'font-mono' };

export function NewRecordForm({ kind, options }: { kind: RecordKind; options: RecordOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ durationMinutes: '30', price: '', deposit: '', status: 'active', cost: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const bind = (key: string) => ({ id: `record-${key}`, name: key, value: form[key] || '', onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const chair = options.chairs.find((item) => item.id === form.chairId);
      const result = kind === 'service'
        ? await createServiceAction({ name: form.name || '', description: form.description || '', categoryId: form.categoryId || '', durationMinutes: Number(form.durationMinutes), price: Number(form.price || 0), deposit: Number(form.deposit || 0), barberIds: picked, status: form.status === 'hidden' ? 'hidden' : 'active' })
        : kind === 'barber'
          ? await createBarberAction({ displayName: form.name || '', chairId: chair?.id || '', chairNumber: chair?.number || '', phone: form.phone || '', email: form.email || '', bio: form.bio || '', serviceIds: picked })
          : kind === 'customer'
            ? await createCustomerAction({ firstName: form.firstName || '', lastName: form.lastName || '', phone: form.phone || '', email: form.email || '' })
            : await createProductAction({ name: form.name || '', sku: form.sku || '', price: Number(form.price || 0), cost: Number(form.cost || 0), description: form.description || '' });
      if (!result.success) { setError(result.error); return; }
      router.push(kind === 'customer' ? `${RECORD_RETURN.customer}?customer=${encodeURIComponent(result.id)}` : RECORD_RETURN[kind]);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <Section title={options.shopName}>
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === 'service' && <>
            <Field id="record-name" label="Name" wide><Input {...bind('name')} required maxLength={120} /></Field>
            <Field id="record-categoryId" label="Category"><select {...bind('categoryId')} className={selectClass}><option value="">No category</option>{options.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field id="record-status" label="Online"><select {...bind('status')} className={selectClass}><option value="active">Shown on storefront</option><option value="hidden">Hidden</option></select></Field>
            <Field id="record-durationMinutes" label="Time in chair (min)"><Input {...bind('durationMinutes')} type="number" inputMode="numeric" min={5} max={480} step={5} required className="font-mono" /></Field>
            <Field id="record-price" label="Price ($)"><Input {...bind('price')} {...money} required /></Field>
            <Field id="record-deposit" label="Deposit ($)"><Input {...bind('deposit')} {...money} placeholder="0.00" /></Field>
            <Picks label="Barbers" options={options.barbers} value={picked} onChange={setPicked} />
            <Field id="record-description" label="Description" wide><Textarea {...bind('description')} maxLength={2000} /></Field>
          </>}
          {kind === 'barber' && <>
            <Field id="record-name" label="Name" wide><Input {...bind('name')} required maxLength={120} /></Field>
            <Field id="record-chairId" label="Chair"><select {...bind('chairId')} className={selectClass}><option value="">No chair yet</option>{options.chairs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field id="record-phone" label="Phone"><Input {...bind('phone')} type="tel" maxLength={40} /></Field>
            <Field id="record-email" label="Email" wide><Input {...bind('email')} type="email" maxLength={254} /></Field>
            <Picks label="Services" options={options.services} value={picked} onChange={setPicked} />
            <Field id="record-bio" label="Bio" wide><Textarea {...bind('bio')} maxLength={2000} /></Field>
          </>}
          {kind === 'customer' && <>
            <Field id="record-firstName" label="First name"><Input {...bind('firstName')} required maxLength={120} autoComplete="off" /></Field>
            <Field id="record-lastName" label="Last name"><Input {...bind('lastName')} maxLength={120} autoComplete="off" /></Field>
            <Field id="record-phone" label="Phone"><Input {...bind('phone')} type="tel" required maxLength={40} /></Field>
            <Field id="record-email" label="Email"><Input {...bind('email')} type="email" maxLength={254} /></Field>
          </>}
          {kind === 'product' && <>
            <Field id="record-name" label="Name"><Input {...bind('name')} required maxLength={120} /></Field>
            <Field id="record-sku" label="SKU"><Input {...bind('sku')} maxLength={60} className="font-mono" /></Field>
            <Field id="record-price" label="Price ($)"><Input {...bind('price')} {...money} required /></Field>
            <Field id="record-cost" label="Cost ($)"><Input {...bind('cost')} {...money} /></Field>
            <Field id="record-description" label="Description" wide><Textarea {...bind('description')} maxLength={2000} /></Field>
          </>}
        </div>
      </Section>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      <Track>
        <PillLink href={RECORD_RETURN[kind]}>Cancel</PillLink>
        <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Pill>
      </Track>
    </form>
  );
}

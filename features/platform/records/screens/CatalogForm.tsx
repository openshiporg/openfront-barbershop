'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, inputMoney, toDollars } from '@/features/platform/lib/forms';
import { Notice, Pill, PillLink, Section, selectClass, StatusDot, Track, type Tone } from '@/features/platform/lib/ui';
import { saveCatalogRecordAction, type CatalogKind, type CatalogOptions, type CatalogRecord } from '../actions/catalog';

const STATUS: Record<CatalogKind, Array<{ value: string; label: string; tone: Tone }>> = {
  service: [{ value: 'active', label: 'On the menu', tone: 'live' }, { value: 'hidden', label: 'Hidden', tone: 'off' }, { value: 'archived', label: 'Archived', tone: 'off' }],
  product: [{ value: 'active', label: 'For sale', tone: 'live' }, { value: 'draft', label: 'Draft', tone: 'wait' }, { value: 'archived', label: 'Archived', tone: 'off' }],
  package: [{ value: 'active', label: 'For sale', tone: 'live' }, { value: 'hidden', label: 'Hidden', tone: 'off' }, { value: 'archived', label: 'Archived', tone: 'off' }],
  plan: [{ value: 'active', label: 'For sale', tone: 'live' }, { value: 'paused', label: 'Paused', tone: 'wait' }, { value: 'archived', label: 'Archived', tone: 'off' }],
};
const PRODUCT_TYPES = [['pomade', 'Pomade'], ['beard_care', 'Beard care'], ['shampoo', 'Shampoo'], ['tool', 'Tool'], ['other', 'Other']];
const BACK = '/dashboard/platform/services';

export function CatalogForm({ kind, record, options }: { kind: CatalogKind; record: CatalogRecord | null; options: CatalogOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(record?.status || 'active');
  const [barbers, setBarbers] = useState<string[]>(record?.barberIds || []);
  const [lines, setLines] = useState(() => record?.items?.length ? record.items.map((item) => ({ serviceId: item.serviceId, quantity: String(item.quantity) })) : [{ serviceId: options.services[0]?.id || '', quantity: '5' }]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCatalogRecordAction(kind, record?.id || null, form);
      if (!result.success) { setError(result.error || 'This couldn’t be saved.'); return; }
      if (!record) { router.push(BACK); router.refresh(); return; }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <input type="hidden" name="status" value={status} />
      {barbers.map((id) => <input key={id} type="hidden" name="barberIds" value={id} />)}
      <Section title={options.shopName} actions={(
        <Track label="Status">
          {STATUS[kind].map((option) => <Pill key={option.value} size="sm" variant="flat" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}><StatusDot tone={option.tone} className="mr-0" />{option.label}</Pill>)}
        </Track>
      )}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="catalog-name" label="Name" wide><Input id="catalog-name" name="name" defaultValue={record?.name} required maxLength={120} /></Field>
          <Field id="catalog-price" label={kind === 'plan' ? 'Price per period ($)' : 'Price ($)'}><Input id="catalog-price" name="price" {...inputMoney} defaultValue={record ? toDollars(record.price) : ''} required /></Field>

          {kind === 'service' && <>
            <Field id="catalog-durationMinutes" label="Time in chair (min)"><Input id="catalog-durationMinutes" name="durationMinutes" type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={record?.durationMinutes ?? 30} required className="font-mono" /></Field>
            <Field id="catalog-deposit" label="Deposit ($)"><Input id="catalog-deposit" name="deposit" {...inputMoney} defaultValue={record ? toDollars(record.depositAmount) : ''} placeholder="0.00" /></Field>
            <Field id="catalog-bookingBufferMinutes" label="Cleanup after (min)"><Input id="catalog-bookingBufferMinutes" name="bookingBufferMinutes" type="number" inputMode="numeric" min={0} max={240} step={5} defaultValue={record?.bookingBufferMinutes ?? 10} className="font-mono" /></Field>
            <Field id="catalog-categoryId" label="Category" wide><select id="catalog-categoryId" name="categoryId" defaultValue={record?.categoryId || ''} className={selectClass}><option value="">No category</option>{options.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            {options.barbers.length ? (
              <fieldset className="grid gap-1.5 sm:col-span-2">
                <legend className="pb-1.5 text-sm font-medium">Barbers</legend>
                <Track label="Barbers">
                  {options.barbers.map((barber) => {
                    const on = barbers.includes(barber.id);
                    return <Pill key={barber.id} size="sm" variant="flat" aria-pressed={on} onClick={() => setBarbers(on ? barbers.filter((id) => id !== barber.id) : [...barbers, barber.id])}>{barber.name}</Pill>;
                  })}
                </Track>
                <span className="text-xs text-muted-foreground">{barbers.length ? `${barbers.length} selected` : 'Any barber'}</span>
              </fieldset>
            ) : null}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="credentialRequired" defaultChecked={record?.credentialRequired} className="size-4" />Licensed service: book only with a credentialed barber</label>
            {record?.waiverRequired ? <p className="text-xs text-muted-foreground sm:col-span-2"><StatusDot tone="wait" />Waiver required</p> : null}
          </>}

          {kind === 'product' && <>
            <Field id="catalog-sku" label="SKU"><Input id="catalog-sku" name="sku" defaultValue={record?.sku} maxLength={60} className="font-mono" /></Field>
            <Field id="catalog-cost" label="Cost ($)"><Input id="catalog-cost" name="cost" {...inputMoney} defaultValue={record ? toDollars(record.cost) : ''} /></Field>
            <Field id="catalog-productType" label="Type"><select id="catalog-productType" name="productType" defaultValue={record?.productType || 'other'} className={selectClass}>{PRODUCT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          </>}

          {kind === 'plan' && <>
            <Field id="catalog-billingInterval" label="Billed"><select id="catalog-billingInterval" name="billingInterval" defaultValue={record?.billingInterval || 'monthly'} className={selectClass}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Yearly</option></select></Field>
            <Field id="catalog-includedVisits" label="Visits included"><Input id="catalog-includedVisits" name="includedVisits" type="number" inputMode="numeric" min={0} max={100} defaultValue={record?.includedVisits ?? 1} className="font-mono" /></Field>
            <Field id="catalog-discountPercent" label="Member discount (%)"><Input id="catalog-discountPercent" name="discountPercent" type="number" inputMode="numeric" min={0} max={100} defaultValue={record?.discountPercent ?? 0} className="font-mono" /></Field>
          </>}

          {kind === 'package' && (
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="pb-1 text-sm font-medium">Visits in the package</legend>
              {lines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select name="itemService" aria-label="Service" value={line.serviceId} onChange={(event) => setLines(lines.map((item, at) => at === index ? { ...item, serviceId: event.target.value } : item))} className={selectClass}>
                    {options.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </select>
                  <Input name="itemQuantity" aria-label="Visits" type="number" inputMode="numeric" min={1} max={50} value={line.quantity} onChange={(event) => setLines(lines.map((item, at) => at === index ? { ...item, quantity: event.target.value } : item))} className="w-20 font-mono" />
                  <Pill size="sm" variant="danger" aria-label="Remove" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, at) => at !== index))}>Remove</Pill>
                </div>
              ))}
              <Track><Pill size="sm" disabled={!options.services.length} onClick={() => setLines([...lines, { serviceId: options.services[0]?.id || '', quantity: '1' }])}>Add service</Pill></Track>
            </fieldset>
          )}

          <Field id="catalog-description" label="Description" wide><Textarea id="catalog-description" name="description" defaultValue={record?.description} maxLength={2000} /></Field>
        </div>
      </Section>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {saved ? <Notice>Saved</Notice> : null}
      <Track>
        <PillLink href={BACK}>{record ? 'Back' : 'Cancel'}</PillLink>
        <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Pill>
      </Track>
    </form>
  );
}

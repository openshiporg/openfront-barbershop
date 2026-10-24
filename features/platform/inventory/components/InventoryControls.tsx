'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm, Field, inputMoney, toDollars, TransitionPills } from '@/features/platform/lib/forms';
import { selectClass } from '@/features/platform/lib/ui';
import { adjustLotAction, receiveDeliveryAction, saveSupplierAction, setSupplierStatusAction, type SupplierRow } from '../actions/inventory';

export function ReceiveDeliveryButton({ productId, suppliers, cost }: { productId: string; suppliers: Array<{ id: string; name: string }>; cost: number }) {
  return (
    <DrawerForm trigger="Receive delivery" triggerVariant="primary" title="Receive delivery" action={(form) => receiveDeliveryAction(productId, form)} submitLabel="Add to stock">
      <Field id="lot-number" label="Lot or delivery number"><Input id="lot-number" name="lotNumber" required maxLength={80} className="font-mono" /></Field>
      <Field id="lot-quantity" label="Units"><Input id="lot-quantity" name="quantity" type="number" inputMode="numeric" min={1} max={10000} required className="font-mono" /></Field>
      <Field id="lot-cost" label="Unit cost ($)"><Input id="lot-cost" name="unitCost" {...inputMoney} defaultValue={toDollars(cost)} /></Field>
      <Field id="lot-expires" label="Expires"><Input id="lot-expires" name="expiresAt" type="date" className="font-mono" /></Field>
      <Field id="lot-supplier" label="Supplier" wide><select id="lot-supplier" name="supplierId" className={selectClass}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
    </DrawerForm>
  );
}

export function AdjustStockButton({ productId, lots }: { productId: string; lots: Array<{ id: string; lotNumber: string; quantityRemaining: number | null }> }) {
  if (!lots.length) return null;
  return (
    <DrawerForm trigger="Adjust stock" title="Adjust stock" action={(form) => adjustLotAction(productId, form)} submitLabel="Record">
      <Field id="adjust-lot" label="Lot" wide><select id="adjust-lot" name="lotId" className={selectClass}>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · {lot.quantityRemaining ?? 0} left</option>)}</select></Field>
      <Field id="adjust-type" label="Type"><select id="adjust-type" name="movementType" className={selectClass}><option value="waste">Waste or damage</option><option value="adjustment">Count correction</option></select></Field>
      <Field id="adjust-quantity" label="Units (− to remove)"><Input id="adjust-quantity" name="quantity" type="number" inputMode="numeric" min={-10000} max={10000} required className="font-mono" /></Field>
      <Field id="adjust-reason" label="Reason" wide><Input id="adjust-reason" name="reason" required maxLength={500} /></Field>
    </DrawerForm>
  );
}

function SupplierFields({ supplier }: { supplier?: SupplierRow }) {
  return <>
    <Field id="supplier-name" label="Name" wide><Input id="supplier-name" name="name" defaultValue={supplier?.name} required maxLength={120} /></Field>
    <Field id="supplier-contact" label="Contact"><Input id="supplier-contact" name="contactName" defaultValue={supplier?.contactName || ''} maxLength={120} /></Field>
    <Field id="supplier-phone" label="Phone"><Input id="supplier-phone" name="phone" type="tel" defaultValue={supplier?.phone || ''} maxLength={40} /></Field>
    <Field id="supplier-email" label="Email"><Input id="supplier-email" name="email" type="email" defaultValue={supplier?.email || ''} maxLength={254} /></Field>
    <Field id="supplier-website" label="Website"><Input id="supplier-website" name="website" type="url" defaultValue={supplier?.website || ''} maxLength={300} /></Field>
    <Field id="supplier-notes" label="Notes" wide><Textarea id="supplier-notes" name="notes" defaultValue={supplier?.notes || ''} maxLength={2000} /></Field>
  </>;
}

export function NewSupplierButton() {
  return <DrawerForm trigger="New supplier" triggerVariant="primary" title="New supplier" action={(form) => saveSupplierAction(null, form)}><SupplierFields /></DrawerForm>;
}

export function SupplierActions({ supplier }: { supplier: SupplierRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <DrawerForm trigger="Edit" title={`Edit ${supplier.name}`} action={(form) => saveSupplierAction(supplier.id, form)}><SupplierFields supplier={supplier} /></DrawerForm>
      <TransitionPills label="Supplier status" current={supplier.status} options={[{ value: 'active', label: 'Use' }, { value: 'paused', label: 'Pause' }, { value: 'archived', label: 'Archive' }]} run={(status) => setSupplierStatusAction(supplier.id, status)} />
    </span>
  );
}

'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm, Field, inputMoney, toDollars } from '@/features/platform/lib/forms';
import { selectClass } from '@/features/platform/lib/ui';
import { RowMenu, statusItems } from '@/features/platform/records/lib/controls';
import { adjustLotAction, receiveDeliveryAction, saveSupplierAction, setSupplierStatusAction, type SupplierRow } from '../actions/inventory';

const inputClass = 'h-9 rounded-[6px]';

function DeliveryFields({ cost, suppliers, supplierId }: { cost: number; suppliers: Array<{ id: string; name: string }>; supplierId?: string }) {
  return <>
    <Field id="lot-number" label="Lot or delivery number"><Input id="lot-number" name="lotNumber" required maxLength={80} className={`${inputClass} font-mono`} /></Field>
    <Field id="lot-quantity" label="Units"><Input id="lot-quantity" name="quantity" type="number" inputMode="numeric" min={1} max={10000} required className={`${inputClass} font-mono`} /></Field>
    <Field id="lot-cost" label="Unit cost ($)"><Input id="lot-cost" name="unitCost" {...inputMoney} defaultValue={toDollars(cost)} className={`${inputClass} font-mono`} /></Field>
    <Field id="lot-expires" label="Expires"><Input id="lot-expires" name="expiresAt" type="date" className={`${inputClass} font-mono`} /></Field>
    {supplierId
      ? <input type="hidden" name="supplierId" value={supplierId} />
      : <Field id="lot-supplier" label="Supplier" wide><select id="lot-supplier" name="supplierId" className={selectClass}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>}
  </>;
}

export function ReceiveDeliveryButton({ productId, productName, suppliers, cost, compact = false }: { productId: string; productName?: string; suppliers: Array<{ id: string; name: string }>; cost: number; compact?: boolean }) {
  return (
    <DrawerForm trigger={compact ? 'Receive' : 'Receive delivery'} triggerVariant={compact ? 'raised' : 'primary'} title={productName ? `Receive ${productName}` : 'Receive delivery'} action={(form) => receiveDeliveryAction(productId, form)} submitLabel="Add to stock">
      <DeliveryFields cost={cost} suppliers={suppliers} />
    </DrawerForm>
  );
}

/** Receive a delivery from one supplier: pick the product, the supplier is fixed. */
export function ReceiveFromSupplierButton({ supplier, products }: { supplier: { id: string; name: string }; products: Array<{ id: string; name: string; cost: number; onHand: number; low: boolean }> }) {
  const [productId, setProductId] = useState(products.find((product) => product.low)?.id || products[0]?.id || '');
  const product = products.find((item) => item.id === productId);
  if (!products.length) return null;
  return (
    <DrawerForm trigger="Receive delivery" title={`Delivery from ${supplier.name}`} action={(form) => receiveDeliveryAction(String(form.get('productId') || productId), form)} submitLabel="Add to stock">
      <Field id="lot-product" label="Product" wide>
        <select id="lot-product" name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} className={selectClass}>
          {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.onHand} on hand{item.low ? ' · low' : ''}</option>)}
        </select>
      </Field>
      <DeliveryFields key={productId} cost={product?.cost || 0} suppliers={[]} supplierId={supplier.id} />
    </DrawerForm>
  );
}

export function AdjustStockButton({ productId, lots }: { productId: string; lots: Array<{ id: string; lotNumber: string; quantityRemaining: number | null }> }) {
  if (!lots.length) return null;
  return (
    <DrawerForm trigger="Adjust stock" title="Adjust stock" action={(form) => adjustLotAction(productId, form)} submitLabel="Record">
      <Field id="adjust-lot" label="Lot" wide><select id="adjust-lot" name="lotId" className={selectClass}>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · {lot.quantityRemaining ?? 0} left</option>)}</select></Field>
      <Field id="adjust-type" label="Type"><select id="adjust-type" name="movementType" className={selectClass}><option value="waste">Waste or damage</option><option value="adjustment">Count correction</option></select></Field>
      <Field id="adjust-quantity" label="Units (− to remove)"><Input id="adjust-quantity" name="quantity" type="number" inputMode="numeric" min={-10000} max={10000} required className={`${inputClass} font-mono`} /></Field>
      <Field id="adjust-reason" label="Reason" wide><Input id="adjust-reason" name="reason" required maxLength={500} className={inputClass} /></Field>
    </DrawerForm>
  );
}

function SupplierFields({ supplier }: { supplier?: SupplierRow }) {
  return <>
    <Field id="supplier-name" label="Name" wide><Input id="supplier-name" name="name" defaultValue={supplier?.name} required maxLength={120} className={inputClass} /></Field>
    <Field id="supplier-contact" label="Contact"><Input id="supplier-contact" name="contactName" defaultValue={supplier?.contactName || ''} maxLength={120} className={inputClass} /></Field>
    <Field id="supplier-phone" label="Phone"><Input id="supplier-phone" name="phone" type="tel" defaultValue={supplier?.phone || ''} maxLength={40} className={inputClass} /></Field>
    <Field id="supplier-email" label="Email"><Input id="supplier-email" name="email" type="email" defaultValue={supplier?.email || ''} maxLength={254} className={inputClass} /></Field>
    <Field id="supplier-website" label="Website"><Input id="supplier-website" name="website" type="url" defaultValue={supplier?.website || ''} maxLength={300} className={inputClass} /></Field>
    <Field id="supplier-notes" label="Notes" wide><Textarea id="supplier-notes" name="notes" defaultValue={supplier?.notes || ''} maxLength={2000} className="rounded-[6px]" /></Field>
  </>;
}

export function NewSupplierButton() {
  return <DrawerForm trigger="New supplier" triggerVariant="primary" title="New supplier" action={(form) => saveSupplierAction(null, form)}><SupplierFields /></DrawerForm>;
}

export function SupplierActions({ supplier }: { supplier: SupplierRow }) {
  return (
    <span className="inline-flex items-center gap-1">
      <DrawerForm trigger="Edit" title={`Edit ${supplier.name}`} action={(form) => saveSupplierAction(supplier.id, form)}><SupplierFields supplier={supplier} /></DrawerForm>
      <RowMenu label={`More actions for ${supplier.name}`} title={supplier.name} items={statusItems(supplier.status, [
        { value: 'active', label: 'Use again' },
        { value: 'paused', label: 'Pause orders' },
        { value: 'archived', label: 'Archive supplier', danger: true },
      ], (status) => setSupplierStatusAction(supplier.id, status))} />
    </span>
  );
}

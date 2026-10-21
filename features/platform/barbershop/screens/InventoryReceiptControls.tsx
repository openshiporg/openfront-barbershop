'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { shopDateKey, shopWallTime } from '@/features/shared/shop-time';
import { useCommandKey } from '../../lib/useCommandKey';
import { receiveInventoryAction } from '../actions/inventory';

type Named = { id: string; name: string };
type Product = Named & { cost?: number | null; onHand: number; reorderSuggested: boolean };

type Errors = Partial<Record<'product' | 'lot' | 'quantity' | 'cost' | 'receivedAt' | 'expiresAt', string>>;

function parseQuantity(value: string) {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
}

function parseCents(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return NaN;
  return Math.round(Number(trimmed) * 100);
}

export function InventoryReceiptControls({ products, suppliers, supplierTotal, timeZone }: { products: Product[]; suppliers: Named[]; supplierTotal?: number | null; timeZone?: string | null }) {
  const id = useId();
  const { keyFor, settle } = useCommandKey('inventory-receipt');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [receivedOn, setReceivedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [outcome, setOutcome] = useState<{ kind: 'status' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);
  const selected = products.find((item) => item.id === productId);

  const chooseProduct = (value: string) => {
    setProductId(value);
    const product = products.find((item) => item.id === value);
    // Catalog cost is only a suggestion; the operator declares the invoiced cost.
    if (product && !unitCost && typeof product.cost === 'number') setUnitCost((product.cost / 100).toFixed(2));
  };

  const dayStart = (date: string) => (timeZone ? shopWallTime(date, 0, timeZone).toISOString() : null);

  const receive = () => {
    const next: Errors = {};
    const parsedQuantity = parseQuantity(quantity);
    const parsedCost = parseCents(unitCost);
    if (!productId) next.product = 'Choose a product.';
    if (!lotNumber.trim()) next.lot = 'Enter the supplier lot or receipt number.';
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) next.quantity = 'Enter a whole number of units, 1 or more.';
    if (!Number.isInteger(parsedCost) || parsedCost < 0) next.cost = 'Enter the invoiced unit cost, for example 4.50.';
    if ((receivedOn || expiresOn) && !timeZone) next.receivedAt = 'Set the shop timezone in Store Settings before entering dates.';
    if (receivedOn && timeZone && receivedOn > shopDateKey(new Date(), timeZone)) next.receivedAt = 'The received date cannot be in the future.';
    if (expiresOn && receivedOn && expiresOn < receivedOn) next.expiresAt = 'Expiry must be on or after the received date.';
    setErrors(next);
    if (Object.keys(next).length) {
      setOutcome({ kind: 'error', text: 'Fix the highlighted fields.' });
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const input = {
      productId,
      supplierId: supplierId || undefined,
      lotNumber: lotNumber.trim(),
      quantity: parsedQuantity,
      unitCost: parsedCost,
      receivedAt: receivedOn ? dayStart(receivedOn) || undefined : undefined,
      expiresAt: expiresOn ? dayStart(expiresOn) || undefined : undefined,
    };
    const key = keyFor(input);
    setOutcome(null);
    start(async () => {
      try {
        const result = await receiveInventoryAction(input, key);
        if (result.success) {
          settle();
          setOutcome({ kind: 'status', text: `Received ${input.quantity} × ${selected?.name || 'product'} (lot ${input.lotNumber}).` });
          setLotNumber(''); setQuantity(''); setUnitCost(''); setReceivedOn(''); setExpiresOn('');
        } else {
          setOutcome({ kind: 'error', text: result.error || 'Unable to receive inventory.' });
        }
      } catch {
        setOutcome({ kind: 'error', text: 'Connection interrupted. The receipt may have been recorded. Retry to confirm; it will not be recorded twice.' });
      }
    });
  };

  const field = (name: keyof Errors) => ({ 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined });
  const fieldError = (name: keyof Errors) => errors[name] ? <p id={`${id}-${name}-error`} className="mt-1 text-xs text-destructive">{errors[name]}</p> : null;
  const selectClass = 'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm';

  return <div ref={formRef} className="space-y-3 rounded-lg border border-dashed p-4">
    <div><p className="font-medium">Receive inventory</p><p className="text-xs text-muted-foreground">Record a delivery as a new lot. Products at 5 or fewer units are marked reorder.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <div><Label htmlFor={`${id}-product`}>Product</Label><select id={`${id}-product`} value={productId} onChange={(event) => chooseProduct(event.target.value)} className={selectClass} {...field('product')}><option value="">Choose a product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.onHand} on hand{item.reorderSuggested ? ' · reorder' : ''}</option>)}</select>{fieldError('product')}</div>
      <div><Label htmlFor={`${id}-supplier`}>Supplier</Label><select id={`${id}-supplier`} value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={selectClass}><option value="">No supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{typeof supplierTotal === 'number' && supplierTotal > suppliers.length && <p className="mt-1 text-xs text-muted-foreground">Showing {suppliers.length} of {supplierTotal} suppliers.</p>}</div>
      <div><Label htmlFor={`${id}-lot`}>Lot / receipt number</Label><Input id={`${id}-lot`} value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} className="mt-1" {...field('lot')} />{fieldError('lot')}</div>
      <div><Label htmlFor={`${id}-quantity`}>Quantity received</Label><Input id={`${id}-quantity`} value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" className="mt-1" {...field('quantity')} />{fieldError('quantity')}</div>
      <div><Label htmlFor={`${id}-cost`}>Invoiced unit cost (USD)</Label><Input id={`${id}-cost`} value={unitCost} onChange={(event) => setUnitCost(event.target.value)} inputMode="decimal" className="mt-1" {...field('cost')} />{selected && typeof selected.cost === 'number' && <p className="mt-1 text-xs text-muted-foreground">Catalog cost {(selected.cost / 100).toFixed(2)}</p>}{fieldError('cost')}</div>
      <div><Label htmlFor={`${id}-received`}>Received on{timeZone ? ` (${timeZone})` : ''}</Label><Input id={`${id}-received`} type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} className="mt-1" {...field('receivedAt')} /><p className="mt-1 text-xs text-muted-foreground">Leave empty for now.</p>{fieldError('receivedAt')}</div>
      <div><Label htmlFor={`${id}-expires`}>Expires on (optional)</Label><Input id={`${id}-expires`} type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} className="mt-1" {...field('expiresAt')} />{fieldError('expiresAt')}</div>
    </div>
    <Button disabled={pending || !products.length} onClick={receive}>{pending ? 'Recording…' : 'Receive inventory'}</Button>
    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{outcome?.kind === 'status' ? outcome.text : ''}</p>
    {outcome?.kind === 'error' && <p role="alert" className="text-xs text-destructive">{outcome.text}</p>}
  </div>;
}

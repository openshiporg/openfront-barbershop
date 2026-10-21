'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { selectActiveShopAction, type ShopChoice } from '../actions/shop';

type ActiveShopSelectorProps = {
  activeShop?: ShopChoice | null;
  shops: ShopChoice[];
  total?: number;
  // Return true when the page holds unsaved edits bound to the current shop.
  hasUnsavedChanges?: () => boolean;
};

export function ActiveShopSelector({ activeShop, shops, total, hasUnsavedChanges }: ActiveShopSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  if (!shops.length) {
    return <p role="status" className="text-sm text-muted-foreground">You have no active shop memberships. Ask a shop owner to invite you.</p>;
  }

  const change = (shopId: string) => {
    if (!shopId || shopId === activeShop?.id) return;
    if (hasUnsavedChanges?.() && !window.confirm('Switching shops discards your unsaved changes for the current shop. Continue?')) return;
    setError(null);
    setStatus('');
    startTransition(async () => {
      const result = await selectActiveShopAction(shopId);
      if (!result.success) {
        setError(result.error || 'Unable to switch shops.');
        return;
      }
      setStatus(`Active shop: ${result.shop?.name || 'selected'}.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="active-shop">Active shop</Label>
      <Select value={activeShop?.id || ''} onValueChange={change} disabled={pending || (shops.length === 1 && activeShop?.id === shops[0].id)}>
        <SelectTrigger id="active-shop" className="w-full sm:w-80">
          <SelectValue placeholder="Select a shop" />
        </SelectTrigger>
        <SelectContent>
          {shops.map((shop) => <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {typeof total === 'number' && total > shops.length && (
        <p className="text-xs text-muted-foreground">Showing {shops.length} of {total} shops.</p>
      )}
      {!activeShop && <p className="text-sm text-muted-foreground">Select the shop you want to work in.</p>}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{pending ? 'Switching shop…' : status}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

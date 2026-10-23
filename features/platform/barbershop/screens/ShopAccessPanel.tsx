'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Empty, Notice, Pill, Section, StatusDot, Tag, Track } from '@/features/platform/lib/ui';
import { claimShopOwnershipAction, type ClaimableShop } from '../actions/shop';

/** Shown on platform pages when the signed-in user belongs to no active shop. */
export function ShopAccessPanel({ shops }: { shops: ClaimableShop[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [claiming, setClaiming] = useState('');
  const [error, setError] = useState<string | null>(null);

  const claim = (shop: ClaimableShop) => {
    setError(null);
    setClaiming(shop.id);
    startTransition(async () => {
      const result = await claimShopOwnershipAction(shop.id);
      if (!result.success) { setError(result.error); setClaiming(''); return; }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 px-4 py-6 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight"><StatusDot tone="off" />No shop access</h1>
      {shops.length ? (
        <Section title="Shops" count={shops.length}>
          <ul>
            {shops.map((shop) => (
              <li key={shop.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{shop.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{shop.slug}</span>
                </span>
                <span className="flex items-center gap-2">
                  {shop.isPublic ? <Tag tone="live">Storefront</Tag> : null}
                  <Track><Pill size="sm" variant="primary" disabled={pending} onClick={() => claim(shop)}>{claiming === shop.id ? 'Joining…' : 'Join as owner'}</Pill></Track>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Empty>Ask a shop owner or manager to add you, or run shop setup from the sidebar.</Empty>
      )}
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { DrawerForm, Field } from '@/features/platform/lib/forms';
import { Pill, Track } from '@/features/platform/lib/ui';
import { payBarberAction, transitionCommissionsAction } from '../actions/payroll';

export function CommissionRowActions({ id, status }: { id: string; status: string }) {
  return <BulkCommissionActions ids={[id]} status={status} size="sm" />;
}

export function BulkCommissionActions({ ids, status, size = 'md' }: { ids: string[]; status: string; size?: 'sm' | 'md' }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!ids.length || !['projected', 'approved'].includes(status)) return null;
  const run = (toStatus: 'approved' | 'voided') => {
    setError(null);
    startTransition(async () => {
      const result = await transitionCommissionsAction(ids, toStatus);
      if (!result.success) setError(result.error || 'This couldn’t be changed.');
      router.refresh();
    });
  };
  return (
    <span className="inline-grid gap-1">
      <Track wrap>
        {status === 'projected' ? <Pill size={size} variant={size === 'md' ? 'primary' : 'raised'} disabled={pending} onClick={() => run('approved')}>{ids.length > 1 ? `Approve ${ids.length}` : 'Approve'}</Pill> : null}
        <Pill size={size} variant="danger" disabled={pending} onClick={() => run('voided')}>{ids.length > 1 ? `Void ${ids.length}` : 'Void'}</Pill>
      </Track>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

export function PayBarberButton({ name, ids, total }: { name: string; ids: string[]; total: string }) {
  return (
    <DrawerForm trigger={`Pay ${total}`} triggerVariant="primary" title={`Pay ${name}`} description={`${ids.length} approved ${ids.length === 1 ? 'commission' : 'commissions'} · ${total}`} action={(form) => payBarberAction(ids, form)} submitLabel="Record payout">
      <Field id="payout-reference" label="Paid by" wide><Input id="payout-reference" name="reference" required maxLength={500} placeholder="Cash, transfer or cheque reference" /></Field>
    </DrawerForm>
  );
}

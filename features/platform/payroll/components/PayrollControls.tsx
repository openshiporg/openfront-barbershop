'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { DrawerForm, Field } from '@/features/platform/lib/forms';
import { Pill } from '@/features/platform/lib/ui';
import { RowMenu } from '@/features/platform/records/lib/controls';
import { payBarberAction, transitionCommissionsAction } from '../actions/payroll';

/** One commission: Approve as the visible action (when it applies), Void in the row menu. */
export function CommissionRowActions({ id, status }: { id: string; status: string }) {
  return <CommissionActions ids={[id]} status={status} size="sm" />;
}

/** Everything shown in the current filter. */
export function BulkCommissionActions({ ids, status }: { ids: string[]; status: string }) {
  return <CommissionActions ids={ids} status={status} size="md" />;
}

function CommissionActions({ ids, status, size }: { ids: string[]; status: string; size: 'sm' | 'md' }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!ids.length || !['projected', 'approved'].includes(status)) return null;
  const many = ids.length > 1;
  const approve = () => {
    setError(null);
    startTransition(async () => {
      const result = await transitionCommissionsAction(ids, 'approved');
      if (!result.success) setError(result.error || 'This couldn’t be approved.');
      router.refresh();
    });
  };
  return (
    <span className="inline-grid justify-items-end gap-1">
      <span className="inline-flex items-center gap-1">
        {status === 'projected' ? <Pill size="sm" variant={size === 'md' ? 'primary' : 'raised'} disabled={pending} onClick={approve}>{pending ? 'Approving…' : many ? `Approve ${ids.length}` : 'Approve'}</Pill> : null}
        <RowMenu label={many ? `More actions for ${ids.length} commissions` : 'More actions for this commission'} items={[{ label: many ? `Void ${ids.length} commissions` : 'Void commission', danger: true, run: () => transitionCommissionsAction(ids, 'voided') }]} />
      </span>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

export function PayBarberButton({ name, ids, total }: { name: string; ids: string[]; total: string }) {
  return (
    <DrawerForm trigger={`Pay ${total}`} triggerVariant="primary" title={`Pay ${name}`} description={`${ids.length} approved ${ids.length === 1 ? 'commission' : 'commissions'} · ${total}`} action={(form) => payBarberAction(ids, form)} submitLabel="Record payout">
      <Field id="payout-reference" label="Paid by" wide><Input id="payout-reference" name="reference" required maxLength={500} placeholder="Cash, transfer or cheque reference" className="h-9 rounded-[6px]" /></Field>
    </DrawerForm>
  );
}

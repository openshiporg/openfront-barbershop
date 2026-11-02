'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pill } from '@/features/platform/lib/ui';

/** "Refund deposit" with a confirm step. The key is minted once per opened dialog, so a retried click replays instead of refunding twice. */
export function RefundDepositButton({ amountLabel, customer, disabled, onOpen, onConfirm }: {
  amountLabel: string;
  customer: string;
  disabled?: boolean;
  onOpen?: () => void;
  onConfirm: (idempotencyKey: string) => void;
}) {
  const [key, setKey] = useState('');
  return (
    <AlertDialog onOpenChange={(open) => { if (open) { setKey(crypto.randomUUID()); onOpen?.(); } }}>
      <AlertDialogTrigger asChild>
        <Pill size="sm" disabled={disabled}>Refund deposit</Pill>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refund {amountLabel} deposit?</AlertDialogTitle>
          <AlertDialogDescription>
            {customer}&rsquo;s card deposit of {amountLabel} goes back to the card it was paid with. This can&rsquo;t be undone from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep deposit</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(key || crypto.randomUUID())}>Refund {amountLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

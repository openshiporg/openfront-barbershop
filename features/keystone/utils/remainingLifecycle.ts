export function calculateNoShowEvidence(
  policy: { feeAmount?: number | null; graceMinutes?: number | null; appliesToMemberships?: boolean | null },
  customer: { hasMembership: boolean }
) {
  const feeWaived = customer.hasMembership && !policy.appliesToMemberships;
  return {
    feeAmount: feeWaived ? 0 : Math.max(0, Math.floor(Number(policy.feeAmount || 0))),
    graceMinutes: Math.max(0, Math.floor(Number(policy.graceMinutes || 0))),
    feeWaived,
  };
}

export function assertCommissionTransition(current: string, next: string) {
  if (current === next) return;
  if (['paid', 'voided'].includes(current)) throw new Error('Terminal commissions cannot transition.');
  const allowed: Record<string, string[]> = {
    projected: ['approved', 'voided'],
    // approved -> paid happens only through the payout command with a reference.
    approved: ['voided'],
  };
  if (!allowed[current]?.includes(next)) {
    throw new Error(next === 'paid' ? 'Record commission payment with Create payout.' : `Commission cannot transition from ${current} to ${next}.`);
  }
}

export function calculateProductSale(input: { unitPrice: number; quantity: number; taxRateBps: number }) {
  const unitPrice = Math.max(0, Math.floor(Number(input.unitPrice || 0)));
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) throw new Error('Product quantity must be between 1 and 100.');
  const taxRateBps = Math.min(10_000, Math.max(0, Math.floor(Number(input.taxRateBps || 0))));
  const subtotal = unitPrice * quantity;
  const taxAmount = Math.round((subtotal * taxRateBps) / 10_000);
  return { unitPrice, quantity, subtotal, taxAmount, total: subtotal + taxAmount };
}

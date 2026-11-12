/** What a receipt still holds after refunds. Payments and Reports both use this so they agree. */
export function netReceiptTotal(receipt: {
  status?: string | null;
  total?: number | null;
  paymentSession?: { refundedAmount?: number | null } | null;
  cashRefund?: { amount?: number | null } | null;
}) {
  const total = receipt.total || 0;
  if (total < 0) return total;
  if (receipt.status === 'refunded') return 0;
  return Math.max(0, total - (receipt.paymentSession?.refundedAmount || 0) - (receipt.cashRefund?.amount || 0));
}

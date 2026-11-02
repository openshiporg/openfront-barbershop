// Deposit refunds from the booking board. Pure helpers so the rules are testable
// without a browser, database or payment processor.

export type BoardDepositSession = {
  id: string;
  status?: string | null;
  amount?: number | null;
  refundedAmount?: number | null;
  /** Settled by a card processor (Stripe). Offline/in-person sessions are never refunded here. */
  processor?: boolean | null;
};

export type DepositRefundResult = {
  success: boolean;
  error?: string | null;
  paymentSession?: { id?: string | null; status?: string | null; amount?: number | null; refundedAmount?: number | null } | null;
};

const REFUNDABLE = ['captured', 'partially_refunded'];

function remainingOf(session: BoardDepositSession) {
  return Math.max(0, (session.amount || 0) - (session.refundedAmount || 0));
}

/** The one processor-captured deposit that still holds money, if any. */
export function refundableDeposit(sessions?: BoardDepositSession[] | null): (BoardDepositSession & { remaining: number }) | null {
  for (const session of sessions || []) {
    if (!session?.id || !session.processor || !REFUNDABLE.includes(String(session.status))) continue;
    const remaining = remainingOf(session);
    if (remaining > 0) return { ...session, remaining };
  }
  return null;
}

/** What the board says about deposit money after any refund. Null when nothing was refunded. */
export function depositRefundState(sessions?: BoardDepositSession[] | null): { tone: 'refunded' | 'partial'; refunded: number } | null {
  const refunded = (sessions || []).reduce((sum, session) => sum + Math.max(0, session?.refundedAmount || 0), 0);
  if (refunded <= 0) return null;
  const open = (sessions || []).some((session) => session?.status === 'partially_refunded');
  return { tone: open ? 'partial' : 'refunded', refunded };
}

export function depositRefundFeedback(result: DepositRefundResult, paymentSessionId: string, formatMoney: (cents?: number | null) => string) {
  if (!result.success) return result.error || 'Unable to refund this deposit.';
  const session = result.paymentSession;
  if (session?.id !== paymentSessionId || !session.status) {
    return 'The refund reported success, but it could not be matched to this deposit. Refresh the booking board before trying again.';
  }
  if (session.status === 'refunded') return `Deposit refunded: ${formatMoney(session.refundedAmount ?? session.amount)}.`;
  if (session.status === 'partially_refunded') return `Deposit partly refunded: ${formatMoney(session.refundedAmount)} of ${formatMoney(session.amount)}.`;
  return `Deposit is ${session.status.replace(/_/g, ' ')}, not refunded. Refresh the booking board to check it.`;
}

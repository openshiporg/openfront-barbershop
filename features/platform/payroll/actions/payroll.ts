'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { platformCommand, platformRequest, trimmed } from '@/features/platform/lib/platformRequest';

export type CommissionRow = {
  id: string; status: string; commissionAmount: number | null; serviceAmount: number | null; productAmount: number | null; commissionRate: string | null; createdAt: string; paidAt: string | null;
  barber: { id: string; displayName: string } | null;
  appointment: { id: string; startsAt: string; serviceTitleSnapshot: string | null; customer: { firstName: string; lastName: string | null } | null } | null;
  transaction: { completedAt: string | null } | null;
};
export type PayoutRow = { id: string; payoutNumber: string; status: string; totalAmount: number; commissionCount: number; paidAt: string; notes: string | null; barber: { id: string; displayName: string } | null };
export type TipRow = { amount: number | null; barber: { id: string; displayName: string } | null };
export type PayrollData = {
  shopName: string; timezone: string; status: string; barberId: string;
  commissions: CommissionRow[]; counts: Record<string, number>;
  approvedByBarber: Array<{ barber: { id: string; displayName: string }; ids: string[]; total: number }>;
  payouts: PayoutRow[]; tips: TipRow[]; barbers: Array<{ id: string; displayName: string }>;
};

const STATUSES = ['projected', 'approved', 'paid', 'voided'];

export async function getPayrollAction(input: { status?: string; barberId?: string }): Promise<PayrollData | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const status = STATUSES.includes(input.status || '') ? String(input.status) : 'projected';
  const barberId = input.barberId || '';
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const where = { shop: { id: { equals: shop.id } }, status: { equals: status }, ...(barberId ? { barber: { id: { equals: barberId } } } : {}) };
  const result = await platformRequest<{
    shop: { timezone: string | null } | null; commissions: CommissionRow[]; approved: CommissionRow[];
    projected: number; approvedCount: number; paid: number; voided: number;
    commissionPayouts: PayoutRow[]; tips: TipRow[]; barbers: Array<{ id: string; displayName: string }>;
  }>(`
    query Payroll($shop: ID!, $where: CommissionWhereInput!, $since: DateTime!) {
      shop(where: { id: $shop }) { timezone }
      commissions(where: $where, orderBy: [{ createdAt: desc }], take: 100) { id status commissionAmount serviceAmount productAmount commissionRate createdAt paidAt barber { id displayName } appointment { id startsAt serviceTitleSnapshot customer { firstName lastName } } transaction { completedAt } }
      approved: commissions(where: { shop: { id: { equals: $shop } }, status: { equals: approved } }, take: 500) { id status commissionAmount serviceAmount productAmount commissionRate createdAt paidAt barber { id displayName } appointment { id startsAt serviceTitleSnapshot customer { firstName lastName } } transaction { completedAt } }
      projected: commissionsCount(where: { shop: { id: { equals: $shop } }, status: { equals: projected } })
      approvedCount: commissionsCount(where: { shop: { id: { equals: $shop } }, status: { equals: approved } })
      paid: commissionsCount(where: { shop: { id: { equals: $shop } }, status: { equals: paid } })
      voided: commissionsCount(where: { shop: { id: { equals: $shop } }, status: { equals: voided } })
      commissionPayouts(where: { shop: { id: { equals: $shop } } }, orderBy: [{ paidAt: desc }], take: 20) { id payoutNumber status totalAmount commissionCount paidAt notes barber { id displayName } }
      tips(where: { shop: { id: { equals: $shop } }, paidAt: { gte: $since } }, take: 1000) { amount barber { id displayName } }
      barbers(where: { shop: { id: { equals: $shop } } }, orderBy: [{ displayName: asc }]) { id displayName }
    }`, { shop: shop.id, where, since });
  if (!result.ok) return null;
  const groups = new Map<string, { barber: { id: string; displayName: string }; ids: string[]; total: number }>();
  for (const row of result.data.approved) {
    if (!row.barber) continue;
    const group = groups.get(row.barber.id) || { barber: row.barber, ids: [], total: 0 };
    group.ids.push(row.id);
    group.total += row.commissionAmount || 0;
    groups.set(row.barber.id, group);
  }
  return {
    shopName: shop.name, timezone: result.data.shop?.timezone || 'UTC', status, barberId,
    commissions: result.data.commissions,
    counts: { projected: result.data.projected, approved: result.data.approvedCount, paid: result.data.paid, voided: result.data.voided },
    approvedByBarber: [...groups.values()].sort((a, b) => a.barber.displayName.localeCompare(b.barber.displayName)),
    payouts: result.data.commissionPayouts, tips: result.data.tips, barbers: result.data.barbers,
  };
}

const refresh = () => { revalidatePath('/dashboard/platform/payroll'); revalidatePath('/dashboard/platform/barbershop'); revalidatePath('/dashboard/platform/reports'); };

export async function transitionCommissionsAction(ids: string[], toStatus: 'approved' | 'voided') {
  for (const id of ids.slice(0, 100)) {
    const result = await platformCommand(`mutation($id: ID!, $status: String!, $key: String!) { transitionCommission(commissionId: $id, toStatus: $status, idempotencyKey: $key) { success error data } }`, { id, status: toStatus, key: randomUUID() }, 'transitionCommission');
    if (!result.success) { refresh(); return result; }
  }
  refresh();
  return { success: true, error: null };
}

export async function payBarberAction(ids: string[], form: FormData) {
  const notes = trimmed(form.get('reference'), 500);
  if (!notes) return { success: false, error: 'Enter how it was paid, for example "Cash 10/23" or a transfer reference.' };
  if (!ids.length || ids.length > 100) return { success: false, error: 'Pay between 1 and 100 commissions at a time.' };
  const result = await platformCommand(`mutation($ids: [ID!]!, $notes: String, $key: String!) { payApprovedCommissions(commissionIds: $ids, notes: $notes, idempotencyKey: $key) { success error data } }`, { ids, notes, key: randomUUID() }, 'payApprovedCommissions');
  if (result.success) refresh();
  return result;
}

'use server';

import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { platformRequest, trimmed } from '@/features/platform/lib/platformRequest';

export type ChairRow = { id: string; chairNumber: string; stationName: string | null; locationNote: string | null; status: string; assignedBarbers: Array<{ id: string; displayName: string }>; upcoming: number };

export async function getChairsAction(): Promise<{ shopName: string; chairs: ChairRow[] } | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const result = await platformRequest<{ barberChairs: Array<Omit<ChairRow, 'upcoming'> & { appointmentsCount: number }> }>(`
    query($shop: ID!, $now: DateTime!) { barberChairs(where: { shop: { id: { equals: $shop } } }, orderBy: [{ chairNumber: asc }]) {
      id chairNumber stationName locationNote status assignedBarbers { id displayName }
      appointmentsCount(where: { startsAt: { gte: $now }, status: { in: [requested, confirmed, checked_in, in_chair] } })
    } }`, { shop: shop.id, now: new Date().toISOString() });
  return { shopName: shop.name, chairs: result.ok ? result.data.barberChairs.map(({ appointmentsCount, ...chair }) => ({ ...chair, upcoming: appointmentsCount })) : [] };
}

const refresh = () => { revalidatePath('/dashboard/platform/staff', 'layout'); revalidatePath('/dashboard/platform/barbershop'); };

export async function saveChairAction(id: string | null, form: FormData) {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const chairNumber = trimmed(form.get('chairNumber'), 20);
  if (!chairNumber) return { success: false, error: 'Enter a chair number.' };
  const data = { chairNumber, stationName: trimmed(form.get('stationName'), 120), locationNote: trimmed(form.get('locationNote'), 500) };
  const result = id
    ? await platformRequest(`mutation($id: ID!, $data: BarberChairUpdateInput!) { updateBarberChair(where: { id: $id }, data: $data) { id } }`, { id, data })
    : await platformRequest(`mutation($data: BarberChairCreateInput!) { createBarberChair(data: $data) { id } }`, { data: { ...data, status: 'active', shop: { connect: { id: shop.id } } } });
  if (!result.ok) return { success: false, error: result.error.includes('unique') ? 'That chair number is already used.' : result.error };
  refresh();
  return { success: true };
}

export async function setChairStatusAction(id: string, status: string) {
  if (!['active', 'maintenance', 'reserved'].includes(status)) return { success: false, error: 'Choose a chair status.' };
  const result = await platformRequest(`mutation($id: ID!, $status: BarberChairStatusType) { updateBarberChair(where: { id: $id }, data: { status: $status }) { id } }`, { id, status });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}

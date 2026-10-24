'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { activeShop } from '@/features/platform/lib/activeShop';
import { formImage, platformCommand, platformRequest, trimmed } from '@/features/platform/lib/platformRequest';
import { uploadRecordImage } from '@/features/platform/lib/uploadImage';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type BarberDetail = {
  id: string; displayName: string; legalName: string | null; bio: string | null; phone: string | null; email: string | null;
  chairNumber: string | null; status: string; bookingEnabled: boolean; bufferMinutes: number | null; serviceCommissionRateBps: number | null;
  chair: { id: string; chairNumber: string } | null;
  specialties: Array<{ id: string; name: string }>;
  schedules: Array<{ id: string; dayOfWeek: string; isWorking: boolean; startMinute: number | null; endMinute: number | null; breakStartMinute: number | null; breakEndMinute: number | null }>;
  credentials: Array<{ id: string; credentialType: string; credentialNumber: string; issuingAuthority: string; jurisdictionCode: string; status: string; effectiveFrom: string; expiresAt: string; supervisionRequired: boolean; service: { id: string; name: string } | null; supervisor: { id: string; displayName: string } | null }>;
  appointments: Array<{ id: string; startsAt: string; status: string; serviceTitleSnapshot: string | null; price: number | null; customer: { firstName: string; lastName: string | null } | null }>;
  shifts: Array<{ id: string; status: string; scheduledStart: string; scheduledEnd: string; clockedInAt: string | null }>;
  scheduleExceptions: Array<{ id: string; exceptionType: string; startsAt: string; endsAt: string; reason: string }>;
};

export type BarberPageData = {
  shop: { id: string; name: string; timezone: string; jurisdictionCode: string };
  barber: BarberDetail;
  chairs: Array<{ id: string; chairNumber: string; stationName: string | null; status: string }>;
  services: Array<{ id: string; name: string; credentialRequired: boolean }>;
  barbers: Array<{ id: string; displayName: string }>;
};

export async function getBarberPageAction(id: string): Promise<BarberPageData | null> {
  const shop = await activeShop();
  if (!shop) return null;
  const result = await platformRequest<{ barber: BarberDetail | null; shop: { timezone: string | null; jurisdictionCode: string | null } | null; barberChairs: BarberPageData['chairs']; services: BarberPageData['services']; barbers: BarberPageData['barbers'] }>(`
    query BarberPage($id: ID!, $shop: ID!, $now: DateTime!) {
      barber(where: { id: $id }) {
        id displayName legalName bio phone email chairNumber status bookingEnabled bufferMinutes serviceCommissionRateBps
        chair { id chairNumber }
        specialties(orderBy: [{ name: asc }]) { id name }
        schedules { id dayOfWeek isWorking startMinute endMinute breakStartMinute breakEndMinute }
        credentials(orderBy: [{ effectiveFrom: desc }]) { id credentialType credentialNumber issuingAuthority jurisdictionCode status effectiveFrom expiresAt supervisionRequired service { id name } supervisor { id displayName } }
        appointments(orderBy: [{ startsAt: desc }], take: 10) { id startsAt status serviceTitleSnapshot price customer { firstName lastName } }
        shifts(where: { status: { in: [scheduled, clocked_in] } }, orderBy: [{ scheduledStart: asc }], take: 20) { id status scheduledStart scheduledEnd clockedInAt }
        scheduleExceptions(where: { status: { equals: active }, endsAt: { gt: $now } }, orderBy: [{ startsAt: asc }], take: 20) { id exceptionType startsAt endsAt reason }
      }
      shop(where: { id: $shop }) { timezone jurisdictionCode }
      barberChairs(where: { shop: { id: { equals: $shop } } }, orderBy: [{ chairNumber: asc }]) { id chairNumber stationName status }
      services(where: { shop: { id: { equals: $shop } }, status: { not: { equals: archived } } }, orderBy: [{ name: asc }]) { id name credentialRequired }
      barbers(where: { shop: { id: { equals: $shop } }, status: { not: { equals: inactive } } }, orderBy: [{ displayName: asc }]) { id displayName }
    }`, { id, shop: shop.id, now: new Date().toISOString() });
  if (!result.ok || !result.data.barber) return null;
  return {
    shop: { id: shop.id, name: shop.name, timezone: result.data.shop?.timezone || 'UTC', jurisdictionCode: result.data.shop?.jurisdictionCode || '' },
    barber: result.data.barber, chairs: result.data.barberChairs, services: result.data.services, barbers: result.data.barbers,
  };
}

const refresh = (id: string) => { revalidatePath('/dashboard/platform/staff', 'layout'); revalidatePath(`/dashboard/platform/staff/${id}`); revalidatePath('/barbers'); };

export async function updateBarberAction(id: string, form: FormData) {
  const displayName = trimmed(form.get('displayName'), 120);
  const bufferMinutes = Math.floor(Number(form.get('bufferMinutes') || 0));
  const commission = Number(form.get('commissionPercent') || 0);
  const status = String(form.get('status') || 'active');
  if (!displayName) return { success: false, error: 'Enter the barber’s name.' };
  if (!(bufferMinutes >= 0 && bufferMinutes <= 240)) return { success: false, error: 'Cleanup time must be 0 to 240 minutes.' };
  if (!(commission >= 0 && commission <= 100)) return { success: false, error: 'Commission must be 0 to 100%.' };
  if (!['active', 'away', 'inactive'].includes(status)) return { success: false, error: 'Choose a status.' };
  const photo = formImage(form, 'photo');
  if (photo && 'error' in photo) return { success: false, error: photo.error };
  const chairId = String(form.get('chairId') || '');
  const chairNumber = trimmed(form.get('chairNumber'), 40);
  const serviceIds = form.getAll('serviceIds').map(String).filter(Boolean);
  const result = await platformRequest(`mutation($id: ID!, $data: BarberUpdateInput!) { updateBarber(where: { id: $id }, data: $data) { id } }`, { id, data: {
    displayName, legalName: trimmed(form.get('legalName'), 120), bio: trimmed(form.get('bio'), 2000), phone: trimmed(form.get('phone'), 40), email: trimmed(form.get('email'), 254),
    status, bookingEnabled: form.get('bookingEnabled') === 'on', bufferMinutes, serviceCommissionRateBps: Math.round(commission * 100),
    ...(chairId ? { chair: { connect: { id: chairId } }, chairNumber } : { chair: { disconnect: true }, chairNumber: '' }),
    specialties: { set: serviceIds.map((serviceId) => ({ id: serviceId })) },
  } });
  if (!result.ok) return { success: false, error: result.error };
  if (photo) {
    const uploaded = await uploadRecordImage('Barber', id, 'photo', photo);
    if (!uploaded.success) return { success: false, error: uploaded.error };
  }
  refresh(id);
  return { success: true };
}

const toMinute = (value: FormDataEntryValue | null) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
};

/** Saves all seven days at once: existing rows are updated, missing days are created. */
export async function saveWeeklyHoursAction(barberId: string, form: FormData) {
  const page = await getBarberPageAction(barberId);
  if (!page) return { success: false, error: 'Barber not found in the active shop.' };
  const existing = new Map(page.barber.schedules.map((row) => [row.dayOfWeek, row]));
  for (const day of DAYS) {
    const isWorking = form.get(`${day}-working`) === 'on';
    const startMinute = toMinute(form.get(`${day}-start`));
    const endMinute = toMinute(form.get(`${day}-end`));
    const breakStartMinute = toMinute(form.get(`${day}-breakStart`));
    const breakEndMinute = toMinute(form.get(`${day}-breakEnd`));
    if (isWorking && (startMinute === null || endMinute === null || endMinute <= startMinute)) return { success: false, error: `${day[0].toUpperCase()}${day.slice(1)}: end must be after start.` };
    if (isWorking && (breakStartMinute === null) !== (breakEndMinute === null)) return { success: false, error: `${day[0].toUpperCase()}${day.slice(1)}: set both break times or neither.` };
    const data = { isWorking, startMinute: isWorking ? startMinute : 0, endMinute: isWorking ? endMinute : 0, breakStartMinute: isWorking ? breakStartMinute : null, breakEndMinute: isWorking ? breakEndMinute : null };
    const row = existing.get(day);
    const unchanged = row && row.isWorking === data.isWorking && (!isWorking || (row.startMinute === data.startMinute && row.endMinute === data.endMinute && row.breakStartMinute === data.breakStartMinute && row.breakEndMinute === data.breakEndMinute));
    if (unchanged || (!row && !isWorking)) continue;
    const result = row
      ? await platformRequest(`mutation($id: ID!, $data: BarberScheduleUpdateInput!) { updateBarberSchedule(where: { id: $id }, data: $data) { id } }`, { id: row.id, data })
      : await platformRequest(`mutation($data: BarberScheduleCreateInput!) { createBarberSchedule(data: $data) { id } }`, { data: { ...data, dayOfWeek: day, barber: { connect: { id: barberId } } } });
    if (!result.ok) return { success: false, error: `${day[0].toUpperCase()}${day.slice(1)}: ${result.error}` };
  }
  refresh(barberId);
  return { success: true };
}

export async function addCredentialAction(barberId: string, form: FormData) {
  const shop = await activeShop();
  if (!shop) return { success: false, error: 'Select an active shop first.' };
  const serviceId = String(form.get('serviceId') || '');
  const credentialNumber = trimmed(form.get('credentialNumber'), 80);
  const issuingAuthority = trimmed(form.get('issuingAuthority'), 160);
  const jurisdictionCode = trimmed(form.get('jurisdictionCode'), 20).toUpperCase();
  const evidence = trimmed(form.get('evidence'), 500);
  const effectiveFrom = new Date(String(form.get('effectiveFrom') || ''));
  const expiresAt = new Date(String(form.get('expiresAt') || ''));
  const supervisionRequired = form.get('supervisionRequired') === 'on';
  const supervisorId = String(form.get('supervisorId') || '');
  if (!serviceId || !credentialNumber || !issuingAuthority || !jurisdictionCode || !evidence) return { success: false, error: 'Fill in service, licence number, issuer, jurisdiction and evidence.' };
  if (Number.isNaN(effectiveFrom.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= effectiveFrom) return { success: false, error: 'The expiry must be after the start date.' };
  const result = await platformRequest(`mutation($data: PractitionerCredentialCreateInput!) { createPractitionerCredential(data: $data) { id } }`, { data: {
    shop: { connect: { id: shop.id } }, barber: { connect: { id: barberId } }, service: { connect: { id: serviceId } },
    credentialType: String(form.get('credentialType') || 'barber'), credentialNumber, issuingAuthority, jurisdictionCode,
    scopeDescription: trimmed(form.get('scopeDescription'), 500) || 'Licensed to perform this service',
    // Only a digest of the evidence reference (licence photo link, registry entry) is stored.
    evidenceHash: createHash('sha256').update(evidence).digest('hex'),
    status: 'active', effectiveFrom: effectiveFrom.toISOString(), expiresAt: expiresAt.toISOString(), verifiedAt: new Date().toISOString(),
    supervisionRequired, ...(supervisionRequired && supervisorId ? { supervisor: { connect: { id: supervisorId } } } : {}),
  } });
  if (!result.ok) return { success: false, error: result.error };
  refresh(barberId);
  return { success: true };
}

export async function setCredentialStatusAction(barberId: string, credentialId: string, status: string, reason: string) {
  const result = await platformCommand(`mutation($credentialId: ID!, $status: String!, $reason: String!, $key: String!) { setPractitionerCredentialStatus(credentialId: $credentialId, status: $status, reason: $reason, idempotencyKey: $key) { success error data } }`,
    { credentialId, status, reason: reason.trim() || `Marked ${status} by staff`, key: randomUUID() }, 'setPractitionerCredentialStatus');
  if (result.success) refresh(barberId);
  return result;
}

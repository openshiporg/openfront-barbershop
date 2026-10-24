'use server';

import { storefrontClient } from '../config';
import { rememberAccess } from '../access-cookies';
import { readAccess } from '../access-cookie-read';

type QueueEntry = { id: string; status: string; quotedWaitMinutes: number | null; requestedBarber?: { displayName: string } | null };
export type QueueStatusLookup = { status: 'found'; entry: QueueEntry } | { status: 'not_found' } | { status: 'unavailable' };

/** Reads the entry with this browser's access cookie; the link carries only the id. */
export async function getStorefrontQueueStatus(queueEntryId: string): Promise<QueueStatusLookup> {
  const accessToken = await readAccess('queue', queueEntryId);
  if (!accessToken) return { status: 'not_found' };
  try {
    const result = await storefrontClient.request<{ getPublicQueueEntry: QueueEntry | null }>('query($queueEntryId:ID!,$accessToken:String!){getPublicQueueEntry(queueEntryId:$queueEntryId,accessToken:$accessToken){id status quotedWaitMinutes requestedBarber{displayName}}}', { queueEntryId, accessToken });
    return result.getPublicQueueEntry ? { status: 'found', entry: result.getPublicQueueEntry } : { status: 'not_found' };
  } catch { return { status: 'unavailable' }; }
}

/**
 * The browser generates the access token before sending, so a retry after a lost
 * response returns the same queue entry instead of creating or blocking a second one.
 */
export async function joinStorefrontQueue(input: { customerName: string; phone: string; partySize: number; requestedServiceId: string; accessToken: string }) {
  try {
    const result = await storefrontClient.request<{ createPublicQueueEntry: { success: boolean; error?: string | null; accessToken?: string | null; queueEntry?: QueueEntry | null } }>('mutation($customerName:String!,$phone:String!,$partySize:Int!,$requestedServiceId:ID!,$accessToken:String){createPublicQueueEntry(customerName:$customerName,phone:$phone,partySize:$partySize,requestedServiceId:$requestedServiceId,accessToken:$accessToken){success error accessToken queueEntry{id status quotedWaitMinutes requestedBarber{displayName}}}}', input);
    const outcome = result.createPublicQueueEntry;
    if (outcome.success && outcome.queueEntry && outcome.accessToken) await rememberAccess('queue', outcome.queueEntry.id, outcome.accessToken);
    return { success: outcome.success, error: outcome.error || null, queueEntry: outcome.queueEntry || null, unknown: false };
  } catch {
    return { success: false, error: 'We couldn’t confirm whether you joined the queue. Try again; you won’t be added twice.', queueEntry: null, unknown: true };
  }
}

type PublicQueueRow = { id: string; status: string; requestedService?: { durationMinutes?: number | null } | null };
type PublicWalkInStatus = { open: boolean; barbersOnNow: number; opensAt: string | null };
export type QueueSummary = { open: boolean; opensAt: string | null; waiting: number; inChair: number; waitMinutes: number; order: string[] };

const DEFAULT_VISIT_MINUTES = 30;

/**
 * Public line summary for today. The wait for someone joining now is the
 * chair time of everyone ahead, shared across the barbers on the floor now.
 */
export async function getStorefrontQueueSummary(): Promise<QueueSummary | null> {
  try {
    const result = await storefrontClient.request<{ getPublicQueue: PublicQueueRow[]; getPublicWalkInStatus: PublicWalkInStatus }>('query{getPublicQueue{id status requestedService{durationMinutes}} getPublicWalkInStatus{open barbersOnNow opensAt}}');
    const status = result.getPublicWalkInStatus;
    const waiting = result.getPublicQueue.filter((entry) => entry.status === 'waiting' || entry.status === 'texted');
    const chairMinutes = waiting.reduce((total, entry) => total + (entry.requestedService?.durationMinutes || DEFAULT_VISIT_MINUTES), 0);
    return {
      open: status.open,
      opensAt: status.opensAt,
      waiting: waiting.length,
      inChair: result.getPublicQueue.filter((entry) => entry.status === 'in_chair').length,
      waitMinutes: Math.ceil(chairMinutes / Math.max(1, status.barbersOnNow) / 5) * 5,
      order: waiting.map((entry) => entry.id),
    };
  } catch { return null; }
}

/** Barbers working right now, for the storefront's "On the floor" board. */
export async function getStorefrontOnNowBarberIds(): Promise<string[] | null> {
  try {
    const result = await storefrontClient.request<{ getPublicWalkInStatus: { onNowIds: string[] } }>('query{getPublicWalkInStatus{onNowIds}}');
    return result.getPublicWalkInStatus.onNowIds;
  } catch { return null; }
}

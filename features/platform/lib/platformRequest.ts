import { ClientError, GraphQLClient } from 'graphql-request';
import { getAuthHeaders } from '@/features/dashboard/lib/cookies';
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl';

/**
 * Server-side GraphQL call for platform commands. Unlike the shared dashboard
 * client it keeps Keystone's own validation and access messages, which are
 * written for merchants, so a refused save says why. Anything else stays generic.
 */
export type PlatformResult<T> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC = 'This couldn’t be saved. Check the fields and try again.';

function readable(error: unknown): string {
  if (!(error instanceof ClientError)) return GENERIC;
  const first = error.response.errors?.[0];
  const code = first?.extensions?.code;
  const message = String(first?.message || '');
  if (code === 'KS_VALIDATION_FAILURE') {
    const lines = message.split('\n').slice(1).map((line) => line.replace(/^\s*-\s*/, '').replace(/^[\w.]+:\s*/, '').trim()).filter(Boolean);
    return lines.join(' ') || GENERIC;
  }
  if (code === 'KS_ACCESS_DENIED') return 'Your role in this shop doesn’t allow this.';
  if (code === 'KS_USER_INPUT_ERROR' || code === 'BAD_USER_INPUT') return 'Some fields are not valid.';
  return GENERIC;
}

export async function platformRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<PlatformResult<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { headers: (await getAuthHeaders()) || {}, redirect: 'error' });
    return { ok: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    return { ok: false, error: readable(error) };
  }
}

/** Domain commands answer { success, error }; their errors are already merchant copy. */
export async function platformCommand(query: string, variables: Record<string, unknown>, field: string): Promise<{ success: boolean; error: string | null; data?: unknown }> {
  const result = await platformRequest<Record<string, { success: boolean; error?: string | null; data?: unknown }>>(query, variables);
  if (!result.ok) return { success: false, error: result.error };
  const outcome = result.data[field];
  return outcome?.success ? { success: true, error: null, data: outcome.data } : { success: false, error: outcome?.error || GENERIC };
}

export const dollarsToCents = (value: unknown) => Math.round(Number(value || 0) * 100);
export const trimmed = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** A photo chosen in a platform form, or null when none was picked. */
export function formImage(form: FormData, field: string): File | { error: string } | null {
  const file = form.get(field);
  if (!(file instanceof File) || !file.size) return null;
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return { error: 'Use a JPG, PNG, WebP, GIF or AVIF image.' };
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Images must be 5 MB or smaller.' };
  return file;
}

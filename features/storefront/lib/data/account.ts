'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type AccountState = { error: string | null; success?: string | null };
const failed = { error: 'Unable to sign in with those details.' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInAccount(_previous: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (email.length > 254 || password.length > 1000) return failed;
  const result = await keystoneClient<{ authenticateUserWithPassword: { sessionToken?: string } }>(`mutation($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { ... on UserAuthenticationWithPasswordSuccess { sessionToken } } }`, { email, password });
  const token = result.success ? result.data.authenticateUserWithPassword?.sessionToken : null;
  if (!token) return failed;
  (await cookies()).set('keystonejs-session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 3600 });
  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function signUpAccount(previous: AccountState, form: FormData): Promise<AccountState> {
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (!name || name.length > 120 || !EMAIL_PATTERN.test(email) || email.length > 254 || password.length < 10 || password.length > 1000) return { error: 'Enter a name, email and a password of at least 10 characters.' };
  // Only identity fields are sent: no role, membership or shop assignment.
  const result = await keystoneClient(`mutation($name: String!, $email: String!, $password: String!) { createUser(data: { name: $name, email: $email, password: $password }) { id } }`, { name, email, password });
  if (!result.success) return { error: 'We couldn’t create an account with those details. If you already have an account, sign in or reset your password. Otherwise, book as a guest or contact the shop.' };
  return signInAccount(previous, form);
}

export async function requestAccountPasswordReset(_previous: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { error: 'Enter the email address on your account.' };
  const result = await keystoneClient<{ sendUserPasswordResetLink: boolean }>('mutation($email: String!) { sendUserPasswordResetLink(email: $email) }', { email });
  if (!result.success || result.data.sendUserPasswordResetLink !== true) return { error: 'We couldn’t send a reset email right now. Try again later or contact the shop.' };
  // Same response whether or not an account exists for this email.
  return { error: null, success: 'If an account exists for that email, a password reset link is on its way.' };
}

export async function redeemAccountPasswordReset(_previous: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const token = String(form.get('token') || '');
  const password = String(form.get('password') || '');
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || !token || token.length > 500) return { error: 'This reset link is invalid. Request a new one.' };
  if (password.length < 10 || password.length > 1000) return { error: 'Choose a password of at least 10 characters.' };
  const result = await keystoneClient<{ redeemUserPasswordResetToken: { code: string } | null }>('mutation($email: String!, $token: String!, $password: String!) { redeemUserPasswordResetToken(email: $email, token: $token, password: $password) { code } }', { email, token, password });
  if (!result.success) return { error: 'Your password couldn’t be reset right now. Try again later.' };
  if (result.data.redeemUserPasswordResetToken?.code) return { error: 'This reset link is invalid or has expired. Request a new one.' };
  return { error: null, success: 'Your password has been reset. You can now sign in.' };
}

export async function signOutAccount() {
  await keystoneClient('mutation { endSession }');
  (await cookies()).delete('keystonejs-session');
  revalidatePath('/', 'layout');
  redirect('/account');
}

export type StorefrontAccount = { id: string; name: string; email: string };

/** Distinguishes a signed-out visitor from an identity lookup that failed. */
export async function getStorefrontAccountState(): Promise<{ status: 'signed_in'; user: StorefrontAccount } | { status: 'signed_out' } | { status: 'unavailable' }> {
  const result = await keystoneClient<{ authenticatedItem: StorefrontAccount | null }>('query { authenticatedItem { ... on User { id name email } } }', {}, { cache: 'no-store' });
  if (!result.success) return { status: 'unavailable' };
  return result.data.authenticatedItem ? { status: 'signed_in', user: result.data.authenticatedItem } : { status: 'signed_out' };
}

export async function getStorefrontAccount() {
  const state = await getStorefrontAccountState();
  return state.status === 'signed_in' ? state.user : null;
}

export type AccountBooking = { id: string; startsAt: string; timeZone: string | null; serviceTitleSnapshot: string; barberNameSnapshot: string; status: string; paymentStatus: string; price: number };
export type AccountBookingPage = { bookings: AccountBooking[]; hasMore: boolean; page: number; pageSize: number; total: number };
export async function getStorefrontBookingHistory(page = 1) {
  return keystoneClient<{ accountBookings: { success: boolean; error: string | null; data: AccountBookingPage | null } }>('query($page: Int) { accountBookings(page: $page) { success error data } }', { page }, { cache: 'no-store' });
}

export async function exportStorefrontAccountData() {
  const result = await keystoneClient<{ exportMyAccountData: { success: boolean; error: string | null; data: unknown } }>('query { exportMyAccountData { success error data } }', {}, { cache: 'no-store' });
  if (!result.success) return { success: false as const, error: 'Your data couldn’t be exported right now. Try again later.' };
  const payload = result.data.exportMyAccountData;
  return payload.success ? { success: true as const, data: payload.data } : { success: false as const, error: payload.error || 'Sign in to export your data.' };
}

export const GUEST_BOOKING_PURPOSE = 'guest_booking_v1' as const;
export type GuestBookingBody = {
  purpose: typeof GUEST_BOOKING_PURPOSE;
  shopId: string;
  serviceId: string;
  barberId: string | null;
  startsAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  /** What the customer reviewed; the server refuses the booking if these changed. */
  reviewedPrice?: number;
  reviewedDurationMinutes?: number;
  reviewedPolicyVersion?: string;
};
export type GuestBookingCommand = { requestKey: string; guestProof: string; requestBody: string };
export const PRIVATE_COMMAND_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

/** Canonical bytes are saved before I/O and never reconstructed from current UI state. */
export function guestBookingBody(input: Omit<GuestBookingBody, 'purpose'>): GuestBookingBody {
  return {
    purpose: GUEST_BOOKING_PURPOSE, shopId: input.shopId.trim(), serviceId: input.serviceId.trim(),
    barberId: input.barberId?.trim() || null, startsAt: input.startsAt,
    customerName: input.customerName.trim(), customerPhone: input.customerPhone.trim(),
    customerEmail: input.customerEmail.trim(), notes: input.notes.trim(),
    ...(input.reviewedPrice === undefined ? {} : { reviewedPrice: input.reviewedPrice }),
    ...(input.reviewedDurationMinutes === undefined ? {} : { reviewedDurationMinutes: input.reviewedDurationMinutes }),
    ...(input.reviewedPolicyVersion === undefined ? {} : { reviewedPolicyVersion: input.reviewedPolicyVersion }),
  };
}

const isWholeNumber = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000_000);

export function parseGuestBookingBody(bytes: string): GuestBookingBody {
  if (typeof bytes !== 'string' || bytes.length > 12000) throw new Error('Invalid booking command.');
  const value = JSON.parse(bytes) as GuestBookingBody;
  if (!value || value.purpose !== GUEST_BOOKING_PURPOSE
    || !['shopId', 'serviceId', 'startsAt', 'customerName', 'customerPhone', 'customerEmail', 'notes'].every((key) => typeof value[key as keyof GuestBookingBody] === 'string')
    || !(value.barberId === null || typeof value.barberId === 'string')
    || !isWholeNumber(value.reviewedPrice) || !isWholeNumber(value.reviewedDurationMinutes)
    || !(value.reviewedPolicyVersion === undefined || (typeof value.reviewedPolicyVersion === 'string' && value.reviewedPolicyVersion.length <= 400))) throw new Error('Invalid booking command.');
  const body = guestBookingBody(value);
  if (!body.shopId || !body.serviceId || body.shopId.length > 200 || body.serviceId.length > 200
    || (body.barberId && body.barberId.length > 200)
    || body.customerName.length < 2 || body.customerName.length > 120
    || body.customerPhone.replace(/\D/g, '').length < 7 || body.customerPhone.length > 40
    || body.customerEmail.length > 254 || body.notes.length > 2000
    || !Number.isFinite(new Date(body.startsAt).getTime())
    || new Date(body.startsAt).toISOString() !== body.startsAt
    || JSON.stringify(body) !== bytes) throw new Error('Invalid booking command.');
  return body;
}

export function validateGuestBookingCommand(command: GuestBookingCommand) {
  if (!PRIVATE_COMMAND_PATTERN.test(command.requestKey) || !PRIVATE_COMMAND_PATTERN.test(command.guestProof)) throw new Error('Invalid booking command.');
  return parseGuestBookingBody(command.requestBody);
}

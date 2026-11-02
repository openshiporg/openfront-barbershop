/**
 * The Customer record a signed-in account books as, in one shop.
 *
 * Guest bookings always create their own Customer: contact details are not
 * authentication, so a guest is never attached to an existing profile (or its
 * package balances) because they typed a known phone or email. A signed-in
 * account is different: its own earlier bookings already prove which record is
 * theirs, so they keep one Customer instead of one per booking.
 *
 * Reuse order, all within the booking shop:
 *  1. the Customer linked to the account (Customer.user);
 *  2. the Customer used by the account's own most recent booking.
 * Email alone is never matched: sign-up does not verify email, so matching on it
 * would let anyone claim a walk-in's history by registering their address.
 * Only when neither exists is a Customer created, linked to the account when the
 * account has no linked profile yet.
 */
export type AccountCustomerClient = {
  customer: {
    findFirst(args: { where: Record<string, unknown>; select: { id: true; userId: true } }): Promise<{ id: string; userId: string | null } | null>;
    findUnique(args: { where: { userId: string }; select: { id: true } }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  appointment: {
    findFirst(args: { where: Record<string, unknown>; orderBy: Record<string, 'asc' | 'desc'>[]; select: { customerId: true } }): Promise<{ customerId: string | null } | null>;
  };
};

export type BookingContact = { shopId: string; firstName: string; lastName: string; phone: string; email: string };

export async function resolveBookingCustomer(client: AccountCustomerClient, contact: BookingContact, accountId?: string | null): Promise<{ id: string; reused: boolean }> {
  if (accountId) {
    const linked = await client.customer.findFirst({ where: { shopId: contact.shopId, userId: accountId }, select: { id: true, userId: true } });
    if (linked) return { id: linked.id, reused: true };
    const previous = await client.appointment.findFirst({
      where: { shopId: contact.shopId, accountId, customerId: { not: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { customerId: true },
    });
    if (previous?.customerId) {
      const owned = await client.customer.findFirst({ where: { id: previous.customerId, shopId: contact.shopId }, select: { id: true, userId: true } });
      if (owned) {
        // Link it so later bookings and balances find it directly.
        if (!owned.userId && !(await client.customer.findUnique({ where: { userId: accountId }, select: { id: true } }))) {
          await client.customer.update({ where: { id: owned.id }, data: { userId: accountId } });
        }
        return { id: owned.id, reused: true };
      }
    }
  }
  const linkAccount = accountId && !(await client.customer.findUnique({ where: { userId: accountId }, select: { id: true } }));
  const created = await client.customer.create({
    data: {
      shopId: contact.shopId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      status: 'active',
      ...(linkAccount ? { userId: accountId } : {}),
    },
  });
  return { id: created.id, reused: false };
}

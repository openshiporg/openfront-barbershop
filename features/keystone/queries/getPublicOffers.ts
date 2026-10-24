import { resolvePublishedShop } from '../utils/publicShop';

type Context = { sudo(): { prisma: import('@prisma/client').PrismaClient } };

/** Active packages and membership plans of the published shop. */
export async function getPublicMembershipOffers(_root: unknown, _args: unknown, context: Context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  if (!shop) return { packages: [], plans: [] };
  const [packages, plans] = await Promise.all([
    prisma.servicePackage.findMany({
      where: { shopId: shop.id, status: 'active' }, orderBy: [{ price: 'asc' }],
      select: { id: true, name: true, description: true, price: true, items: { where: { service: { status: 'active' } }, select: { quantity: true, service: { select: { id: true, name: true } } } } },
    }),
    prisma.membershipPlan.findMany({
      where: { shopId: shop.id, status: 'active' }, orderBy: [{ price: 'asc' }],
      select: { id: true, name: true, description: true, price: true, billingInterval: true, includedVisits: true, discountPercent: true },
    }),
  ]);
  return {
    packages: packages.map((item) => ({ ...item, price: item.price ?? 0, items: item.items.flatMap((line) => (line.service ? [{ quantity: line.quantity ?? 1, serviceId: line.service.id, serviceName: line.service.name }] : [])) })),
    plans: plans.map((plan) => ({ ...plan, price: plan.price ?? 0, billingInterval: plan.billingInterval ?? 'monthly' })),
  };
}

/** A published barber's weekly working days, for the storefront barber page. */
export async function getPublicBarberWeek(_root: unknown, args: { barberId: string }, context: Context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  if (!shop || !args.barberId) return [];
  const barber = await prisma.barber.findFirst({ where: { id: args.barberId, shopId: shop.id, status: 'active', bookingEnabled: true }, select: { id: true } });
  if (!barber) return [];
  return prisma.barberSchedule.findMany({ where: { barberId: barber.id, isWorking: true }, select: { dayOfWeek: true, startMinute: true, endMinute: true } });
}

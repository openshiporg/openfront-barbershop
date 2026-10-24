import type { PrismaClient } from '@prisma/client';

import { requireSingleActiveShop, type Session } from '../access';
import { currentManagedActiveShopIds } from '../utils/currentAuthorization';

type Context = {
  session?: Session;
  prisma: PrismaClient;
  sudo(): { prisma: PrismaClient };
  db: { ShopMembership: { createOne(args: { data: Record<string, unknown> }): Promise<{ id: string }> } };
};

const ROLES = new Set(['owner', 'manager', 'front_desk', 'barber', 'viewer']);

/** Owners and managers of the active shop; everyone else sees no roster. */
async function managedShop(context: Context) {
  const shopId = requireSingleActiveShop(context.session);
  const managed = await currentManagedActiveShopIds(context.session, context.prisma);
  if (!managed.includes(shopId)) throw new Error('Only a shop owner or manager can manage the team.');
  return shopId;
}

/** The active shop's memberships with each member's name and email. */
export async function platformTeam(_root: unknown, _args: unknown, context: Context) {
  try {
    const shopId = await managedShop(context);
    const memberships = await context.sudo().prisma.shopMembership.findMany({
      where: { shopId },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, membershipRole: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true, barberProfile: { select: { id: true, displayName: true } } } } },
    });
    return { success: true, error: null, data: { selfId: context.session?.itemId || null, memberships } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to load the team.', data: null };
  }
}

/**
 * Adds an existing account to the active shop. The membership is created
 * through the list API as the caller, so the owner/manager grant rules in the
 * ShopMembership hooks still apply.
 */
export async function addShopMemberByEmail(_root: unknown, args: { email: string; membershipRole: string }, context: Context) {
  try {
    const shopId = await managedShop(context);
    const email = String(args.email || '').trim().toLowerCase();
    const membershipRole = String(args.membershipRole || 'viewer');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email.');
    if (!ROLES.has(membershipRole)) throw new Error('Choose a role.');
    const user = await context.sudo().prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
    if (!user) throw new Error('No account uses that email. Ask them to create one on the storefront account page, then add them.');
    const existing = await context.sudo().prisma.shopMembership.findFirst({ where: { shopId, userId: user.id }, select: { id: true, status: true } });
    if (existing) throw new Error(existing.status === 'active' ? 'They are already on the team.' : 'They already have a membership here. Restore it from the team list.');
    const created = await context.db.ShopMembership.createOne({ data: { shop: { connect: { id: shopId } }, user: { connect: { id: user.id } }, membershipRole, status: 'active' } });
    return { success: true, error: null, data: { id: created.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const readable = message.includes('You provided invalid data') ? message.split('\n').slice(1).map((line) => line.replace(/^\s*-\s*[\w.]+:\s*/, '')).join(' ') : message;
    return { success: false, error: readable || 'Unable to add this member.', data: null };
  }
}

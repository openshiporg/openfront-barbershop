import { activeMembershipRole, managedShopIds } from '../access';
import { hasCurrentRolePermission } from './currentAuthorization';
import type { BaseListTypeInfo, ListConfig } from '@keystone-6/core/types';

/**
 * Keystone 6.5 connects inverse relations using target READ access, not the
 * target's update hooks. A command-only child is therefore not protected by its
 * list access alone. Keep inverse collections read-only; catalog specialties
 * are the sole editable many-to-many relation and validate both shop owners.
 * Internal domain commands/seed contexts intentionally use Prisma or sudo.
 */
const editableCollections = new Set(['Service.specialists', 'Barber.specialties']);
const identityRelations = new Set([
  'User.activeShop', 'User.barberProfile', 'User.customerProfile',
  'Barber.user', 'Customer.user',
]);
const archivedRoots = new Set([
  'Shop', 'Service', 'ServiceCategory', 'Barber', 'BarberChair', 'Customer',
  'ServicePackage', 'MembershipPlan', 'Product', 'Supplier', 'PaymentProvider',
]);

type FilterArgs = { session?: any; context?: any; listKey?: string; fieldKey?: string };

/**
 * Keystone does not apply the TARGET list's read access to a nested where/orderBy, so a
 * relation filter or a read-gated scalar filter can count hidden rows. A field is filterable
 * or orderable only when the caller could read what it points at: the target list's query
 * access for relations, the field's own read access for scalars. Lists whose rows are
 * narrowed per person (not per shop) need a stronger gate.
 */
const strongTargetGate: Record<string, (args: FilterArgs) => Promise<boolean> | boolean> = {
  User: async ({ session, context }) => Boolean(session?.itemId) && ((await hasCurrentRolePermission(session, 'canSeeOtherPeople', context?.prisma)) || (await hasCurrentRolePermission(session, 'canManageRoles', context?.prisma))),
  Role: async ({ session, context }) => hasCurrentRolePermission(session, 'canManageRoles', context?.prisma),
  ShopMembership: ({ session }) => managedShopIds(session).length > 0,
  CustomerNote: ({ session }) => activeMembershipRole(session) === 'owner',
};

async function canReadTarget(target: any, targetKey: string, args: FilterArgs) {
  try {
    const strong = strongTargetGate[targetKey];
    if (strong && !(await strong(args))) return false;
    const access = target?.access;
    const query = typeof access === 'object' ? access?.operation : undefined;
    const gate = typeof query === 'object' ? query?.query : query;
    const allowed = typeof gate === 'function' ? await gate({ session: args.session, context: args.context, listKey: targetKey, operation: 'query' }) : gate ?? true;
    if (!allowed) return false;
    const rowFilter = typeof access === 'object' ? access?.filter?.query : undefined;
    if (typeof rowFilter === 'function') return (await rowFilter({ session: args.session, context: args.context, listKey: targetKey, operation: 'query' })) !== false;
    return true;
  } catch {
    return false;
  }
}

async function canReadField(read: unknown, args: FilterArgs) {
  if (read === undefined || read === true) return true;
  if (typeof read !== 'function') return Boolean(read);
  try {
    return (await read({ session: args.session, context: args.context, listKey: args.listKey, fieldKey: args.fieldKey, operation: 'read', item: {}, inputData: {} })) === true;
  } catch {
    return false;
  }
}

// Admin meta asks about every field on every request; answer once per request context and target.
const decisions = new WeakMap<object, Map<string, Promise<boolean>>>();
function once(args: FilterArgs, key: string, compute: () => Promise<boolean>) {
  const scope = args.context && typeof args.context === 'object' ? args.context : args.session ?? decisions;
  let cache = decisions.get(scope);
  if (!cache) decisions.set(scope, cache = new Map());
  const hit = cache.get(key);
  if (hit) return hit;
  const result = compute();
  cache.set(key, result);
  return result;
}

const both = (existing: unknown, key: string, check: (args: FilterArgs) => Promise<boolean>) =>
  existing === false ? false : async (args: FilterArgs) => (typeof existing === 'function' ? Boolean(await existing(args)) : existing !== false) && once(args, key, () => check(args));

function gateFiltering(listKey: string, fieldKey: string, field: any, lists: Record<string, any>) {
  const relation = field.dbField;
  const check = relation.kind === 'relation'
    ? async (args: FilterArgs) => (await canReadField(field.access?.read, args)) && canReadTarget(lists[relation.list], relation.list, args)
    : (args: FilterArgs) => canReadField(field.access?.read, args);
  const needsGate = relation.kind === 'relation' || (field.access && typeof field.access === 'object' && field.access.read !== undefined && field.access.read !== true);
  if (!needsGate) return field;
  const key = relation.kind === 'relation' ? `list:${relation.list}` : `field:${listKey}.${fieldKey}`;
  return { ...field, isFilterable: both(field.isFilterable, key, check), isOrderable: both(field.isOrderable, key, check) };
}

export function enforceRelationshipBoundaries<T extends Record<string, ListConfig<BaseListTypeInfo>>>(lists: T): T {
  for (const [listKey, config] of Object.entries(lists)) {
    for (const [fieldKey, factory] of Object.entries(config.fields)) {
      config.fields[fieldKey] = (meta) => {
        const field = gateFiltering(listKey, fieldKey, factory(meta), lists);
        const relation = field.dbField;
        if (relation.kind !== 'relation') return field;
        const name = `${listKey}.${fieldKey}`;
        if ((relation.mode === 'many' && !editableCollections.has(name)) || identityRelations.has(name)) {
          return { ...field, access: { ...(typeof field.access === 'object' ? field.access : {}), create: () => false, update: () => false }, ui: { ...field.ui, createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } } };
        }
        return field;
      };
    }
    // Archival preserves relationship identity and historical evidence. sudo
    // fixtures can still clean up their own isolated test records.
    if (archivedRoots.has(listKey) && typeof config.access === 'object') {
      const previous = config.access.operation;
      config.access = { ...config.access, operation: typeof previous === 'function'
        ? (args) => args.operation === 'delete' ? false : previous(args)
        : { ...previous, query: previous?.query ?? (() => false), create: previous?.create ?? (() => false), update: previous?.update ?? (() => false), delete: () => false } };
    }
  }
  return lists;
}

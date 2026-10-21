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

export function enforceRelationshipBoundaries<T extends Record<string, ListConfig<BaseListTypeInfo>>>(lists: T): T {
  for (const [listKey, config] of Object.entries(lists)) {
    for (const [fieldKey, factory] of Object.entries(config.fields)) {
      config.fields[fieldKey] = (meta) => {
        const field = factory(meta);
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

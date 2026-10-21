import { list } from '@keystone-6/core';
import { checkbox, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { isSyntheticAuthority, isLocalAuthorityFixture, isLocalFixtureShop } from '../utils/localFixtureAuthority';
import { connectedRelationshipId, validateShopRelationships } from '../utils/shopRelationshipHooks';
import { trackingFields } from './trackingFields';

export const PractitionerCredential = list({
  hooks: {
    validate: {
      create: async (args) => {
        await validateShopRelationships(args, [
          { field: 'barber', delegate: 'barber' },
          { field: 'service', delegate: 'service' },
          { field: 'supervisor', delegate: 'barber' },
        ]);
        const evidence = { credentialNumber: String(args.resolvedData.credentialNumber || ''), issuingAuthority: String(args.resolvedData.issuingAuthority || ''), scopeDescription: String(args.resolvedData.scopeDescription || ''), evidenceHash: String(args.resolvedData.evidenceHash || '') };
        if (isSyntheticAuthority(evidence) && (!isLocalAuthorityFixture(evidence) || !await isLocalFixtureShop(args.context.prisma, connectedRelationshipId(args.resolvedData.shop) || ''))) args.addValidationError('Synthetic evidence is limited to the disposable local/offline fixture contract.');
        const barberId = (args.resolvedData.barber as { connect?: { id?: string } } | undefined)?.connect?.id;
        const serviceId = (args.resolvedData.service as { connect?: { id?: string } } | undefined)?.connect?.id;
        if (!barberId || !serviceId) args.addValidationError('Practitioner and service scope are required.');
        const effectiveFrom = new Date(String(args.resolvedData.effectiveFrom || ''));
        const expiresAt = new Date(String(args.resolvedData.expiresAt || ''));
        const verifiedAt = new Date(String(args.resolvedData.verifiedAt || ''));
        if ([effectiveFrom, expiresAt, verifiedAt].some((date) => Number.isNaN(date.getTime())) || expiresAt <= effectiveFrom || verifiedAt > new Date()) {
          args.addValidationError('Credential effective, expiry, and verification dates are invalid.');
        }
        const supervisionRequired = args.resolvedData.supervisionRequired === true;
        const supervisor = args.resolvedData.supervisor as { connect?: { id?: string } } | undefined;
        if (supervisionRequired && !supervisor?.connect?.id) args.addValidationError('A supervisor is required for supervised authority.');
        if (supervisor?.connect?.id && supervisor.connect.id === barberId) args.addValidationError('A practitioner cannot supervise their own authority.');
      },
    },
  },
  access: {
    operation: {
      query: permissions.canReadStaff,
      create: permissions.canManageStaff,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessShopRecords },
  },
  ui: { listView: { initialColumns: ['barber', 'service', 'credentialType', 'jurisdictionCode', 'status', 'effectiveFrom', 'expiresAt'] } },
  fields: {
    shop: relationship({ ref: 'Shop.practitionerCredentials', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: { update: () => false } }),
    barber: relationship({ ref: 'Barber.credentials', access: { update: () => false } }),
    service: relationship({ ref: 'Service.practitionerCredentials', access: { update: () => false } }),
    supervisor: relationship({ ref: 'Barber.supervisedCredentials', access: { update: () => false } }),
    credentialType: select({
      type: 'enum',
      options: [
        { label: 'Barber', value: 'barber' },
        { label: 'Master Barber', value: 'master_barber' },
        { label: 'Apprentice', value: 'apprentice' },
        { label: 'Cosmetology', value: 'cosmetology' },
        { label: 'Other', value: 'other' },
      ],
      validation: { isRequired: true },
    }),
    credentialNumber: text({ validation: { isRequired: true }, access: { update: () => false } }),
    issuingAuthority: text({ validation: { isRequired: true }, access: { update: () => false } }),
    jurisdictionCode: text({ validation: { isRequired: true }, access: { update: () => false }, ui: { description: 'Merchant-reviewed jurisdiction code, for example US-NY.' } }),
    scopeDescription: text({ validation: { isRequired: true }, access: { update: () => false }, ui: { displayMode: 'textarea' } }),
    evidenceHash: text({ validation: { isRequired: true }, access: { update: () => false }, ui: { description: 'SHA-256 or stronger digest of the reviewed authority evidence; never a raw credential image.' } }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'active',
      validation: { isRequired: true },
    }),
    effectiveFrom: timestamp({ validation: { isRequired: true }, access: { update: () => false } }),
    expiresAt: timestamp({ validation: { isRequired: true }, access: { update: () => false } }),
    verifiedAt: timestamp({ validation: { isRequired: true }, access: { update: () => false } }),
    supervisionRequired: checkbox({ defaultValue: false, access: { update: () => false } }),
    ...trackingFields,
  },
});

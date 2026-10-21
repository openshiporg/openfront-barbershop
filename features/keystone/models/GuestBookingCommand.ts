import { list } from '@keystone-6/core';
import { json, relationship, text, timestamp } from '@keystone-6/core/fields';

import { trackingFields } from './trackingFields';

const deny = () => false;
const sealed = { read: deny, create: deny, update: deny };
const rejectCrud = ({ addValidationError }: { addValidationError(message: string): void }) => addValidationError('Guest booking evidence is command-owned.');

/** No inverse collections: public/model CRUD cannot move an original receipt. */
export const GuestBookingCommand = list({
  access: { operation: { query: deny, create: deny, update: deny, delete: deny } },
  hooks: { validate: { create: rejectCrud, update: rejectCrud, delete: rejectCrud } },
  ui: { isHidden: true },
  fields: {
    requestKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: sealed }),
    purpose: text({ validation: { isRequired: true }, access: sealed }),
    actor: text({ validation: { isRequired: true }, access: sealed }),
    payloadHash: text({ validation: { isRequired: true }, access: sealed }),
    proofHash: text({ validation: { isRequired: true }, access: sealed }),
    shop: relationship({ ref: 'Shop', db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll('?', '') }, access: sealed }),
    appointment: relationship({ ref: 'Appointment', db: { foreignKey: true }, access: sealed }),
    receipt: json({ access: sealed }),
    expiresAt: timestamp({ access: sealed }),
    revokedAt: timestamp({ access: sealed }),
    ...trackingFields,
  },
});

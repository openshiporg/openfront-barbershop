import { list } from '@keystone-6/core';
import { json, text } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { trackingFields } from './trackingFields';

export const ShopSettings = list({
  isSingleton: true,
  graphql: { plural: 'shopSettingsItems' },
  access: {
    operation: {
      query: permissions.canAccessDashboard,
      create: permissions.canManageOnboarding,
      update: permissions.canManageOnboarding,
      delete: permissions.canManageOnboarding,
    },
  },
  ui: {
    isHidden: true,
    // The dashboard derives GraphQL names from this label; "Shop Settings"
    // would collapse to the list key and fail the whole admin meta load.
    plural: 'Shop Settings Items',
    listView: { initialColumns: ['name', 'tagline', 'phone', 'timezone'] },
  },
  fields: {
    key: text({
      isIndexed: 'unique',
      defaultValue: 'primary',
      validation: { isRequired: true },
    }),
    name: text({ validation: { isRequired: true } }),
    tagline: text(),
    address: text(),
    phone: text(),
    timezone: text({ defaultValue: 'America/New_York' }),
    currencyCode: text({ defaultValue: 'USD' }),
    hours: json({ defaultValue: {} }),
    ...trackingFields,
  },
});

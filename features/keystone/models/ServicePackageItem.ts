import { list } from "@keystone-6/core";
import { integer, relationship } from "@keystone-6/core/fields";

import { type Session } from "../access";
import { currentShopForPermission } from '../utils/currentAuthorization';
import { validatePackageItem } from '../utils/childRecordValidation';
import { trackingFields } from "./trackingFields";

const currentPackageItemAccess = async ({ session }: { session?: Session }) =>
  Boolean(await currentShopForPermission(session, 'canManageMemberships'));

const currentPackageItemFilter = async (session?: Session) => {
  const shopId = await currentShopForPermission(session, 'canManageMemberships');
  return shopId ? { package: { shop: { id: { equals: shopId } } } } : false;
};

export const ServicePackageItem = list({
  hooks: { validate: { create: validatePackageItem, update: validatePackageItem } },
  access: {
    operation: {
      query: currentPackageItemAccess,
      create: currentPackageItemAccess,
      update: currentPackageItemAccess,
      delete: currentPackageItemAccess,
    },
    filter: {
      query: ({ session }) => currentPackageItemFilter(session),
      update: ({ session }) => currentPackageItemFilter(session),
      delete: ({ session }) => currentPackageItemFilter(session),
    },
  },
  ui: {
    listView: {
      initialColumns: ["package", "service", "quantity"],
    },
  },
  fields: {
    package: relationship({ ref: "ServicePackage.items", access: { update: () => false } }),
    service: relationship({ ref: "Service.packageItems", access: { update: () => false } }),
    quantity: integer({ defaultValue: 1, validation: { min: 1 } }),
    ...trackingFields,
  },
});

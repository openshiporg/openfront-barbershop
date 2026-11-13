"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
function membershipShopIds(session) {
  return Array.from(new Set(
    (session?.data.shopMemberships ?? []).filter((membership) => membership.status === "active" && membership.shop?.status === "active").map((membership) => membership.shop?.id).filter((shopId) => Boolean(shopId))
  )).sort();
}
function activeShopIds(session) {
  const eligibleShopIds = membershipShopIds(session);
  const selectedShopId = session?.data.activeShop?.status === "active" ? session.data.activeShop.id : "";
  if (selectedShopId) return eligibleShopIds.includes(selectedShopId) ? [selectedShopId] : [];
  return eligibleShopIds.length === 1 ? eligibleShopIds : [];
}
function managedShopIds(session) {
  return Array.from(new Set(
    (session?.data.shopMemberships ?? []).filter(
      (membership) => membership.status === "active" && membership.shop?.status === "active" && ["owner", "manager"].includes(membership.membershipRole || "")
    ).map((membership) => membership.shop?.id).filter((shopId) => Boolean(shopId))
  )).sort();
}
function shopRelationshipFilter(session, relationship47 = "shop") {
  const shopIds = activeShopIds(session);
  return shopIds.length > 0 ? { [relationship47]: { id: { in: shopIds } } } : false;
}
function requireSingleActiveShop(session) {
  const shopIds = activeShopIds(session);
  if (shopIds.length !== 1) {
    throw new Error("Select exactly one active shop before performing this operation.");
  }
  return shopIds[0];
}
function membershipRoleAllows(membershipRole, permission) {
  if (!SHOP_SCOPED_PERMISSIONS.has(permission)) return true;
  const capabilities = MEMBERSHIP_ROLE_CAPABILITIES[membershipRole || "viewer"];
  return Boolean(capabilities?.includes(permission));
}
function activeMembershipRole(session) {
  const [shopId] = activeShopIds(session);
  if (!shopId) return null;
  return (session?.data.shopMemberships ?? []).find(
    (membership) => membership.status === "active" && membership.shop?.id === shopId && membership.shop?.status === "active"
  )?.membershipRole ?? null;
}
function shopPermission(permission) {
  return ({ session }) => {
    if (!session?.data.role?.[permission]) return false;
    if (!activeShopIds(session).length) return true;
    return membershipRoleAllows(activeMembershipRole(session), permission);
  };
}
var MEMBERSHIP_ROLE_CAPABILITIES, SHOP_SCOPED_PERMISSIONS, canAccessDashboard, permissions, rules;
var init_access = __esm({
  "features/keystone/access.ts"() {
    "use strict";
    MEMBERSHIP_ROLE_CAPABILITIES = {
      owner: ["canAccessDashboard", "canManageOnboarding", "canManageServices", "canManageStaff", "canManageSchedules", "canManageAppointments", "canManageQueue", "canManageCustomers", "canManageCustomerNotes", "canManageMemberships", "canManagePayments", "canViewReports"],
      manager: ["canAccessDashboard", "canManageOnboarding", "canManageServices", "canManageStaff", "canManageSchedules", "canManageAppointments", "canManageQueue", "canManageCustomers", "canManageCustomerNotes", "canManageMemberships", "canManagePayments", "canViewReports"],
      front_desk: ["canAccessDashboard", "canManageAppointments", "canManageQueue", "canManageCustomers", "canManageCustomerNotes", "canManageMemberships", "canManagePayments"],
      barber: ["canAccessDashboard", "canManageAppointments", "canManageQueue", "canManageCustomers", "canManageCustomerNotes"],
      viewer: ["canAccessDashboard", "canViewReports"]
    };
    SHOP_SCOPED_PERMISSIONS = new Set(MEMBERSHIP_ROLE_CAPABILITIES.owner);
    canAccessDashboard = ({ session }) => session?.data.role?.canAccessDashboard ?? false;
    permissions = {
      canAccessDashboard,
      canManageShops: ({ session }) => managedShopIds(session).length > 0,
      canManageOnboarding: ({ session }) => session?.data.role?.canManageOnboarding ?? false,
      canManagePeople: ({ session }) => session?.data.role?.canManagePeople ?? false,
      canManageRoles: ({ session }) => session?.data.role?.canManageRoles ?? false,
      canReadServices: shopPermission("canManageServices"),
      canManageServices: shopPermission("canManageServices"),
      canReadStaff: shopPermission("canManageStaff"),
      canManageStaff: shopPermission("canManageStaff"),
      canReadSchedules: shopPermission("canManageSchedules"),
      canManageSchedules: shopPermission("canManageSchedules"),
      canReadAppointments: shopPermission("canManageAppointments"),
      canManageAppointments: shopPermission("canManageAppointments"),
      canReadQueue: shopPermission("canManageQueue"),
      canManageQueue: shopPermission("canManageQueue"),
      canReadCustomers: shopPermission("canManageCustomers"),
      canManageCustomers: shopPermission("canManageCustomers"),
      canReadCustomerNotes: shopPermission("canManageCustomerNotes"),
      canManageCustomerNotes: shopPermission("canManageCustomerNotes"),
      canReadMemberships: shopPermission("canManageMemberships"),
      canManageMemberships: shopPermission("canManageMemberships"),
      canReadPayments: shopPermission("canManagePayments"),
      canManagePayments: shopPermission("canManagePayments"),
      canViewReports: shopPermission("canViewReports")
    };
    rules = {
      canReadCustomerNotes: async ({ session, context }) => {
        const shopIds = activeShopIds(session);
        if (!session?.itemId || !shopIds.length || !context) return false;
        const prisma = context.prisma;
        const [user, memberships] = await Promise.all([
          prisma.user.findUnique({
            where: { id: session.itemId },
            select: { role: { select: { canManageCustomerNotes: true } } }
          }),
          prisma.shopMembership.findMany({
            where: { userId: session.itemId, shopId: { in: shopIds }, status: "active", shop: { status: "active" } },
            select: { shopId: true, membershipRole: true }
          })
        ]);
        if (!user?.role?.canManageCustomerNotes) return false;
        const currentShopIds = Array.from(new Set(memberships.filter((membership) => membershipRoleAllows(membership.membershipRole, "canManageCustomerNotes")).map((membership) => membership.shopId))).sort();
        if (!currentShopIds.length) return false;
        const ownerShopIds = memberships.filter((membership) => membership.membershipRole === "owner").map((membership) => membership.shopId);
        const visibilityFilter = ownerShopIds.length ? { OR: [{ visibility: { equals: "staff" } }, { shop: { id: { in: ownerShopIds } } }] } : { visibility: { equals: "staff" } };
        return { AND: [{ shop: { id: { in: currentShopIds } } }, visibilityFilter] };
      },
      canAccessBarberShopRecords: ({ session }) => {
        const shopIds = activeShopIds(session);
        return shopIds.length ? { barber: { shop: { id: { in: shopIds } } } } : false;
      },
      canAccessPackageShopRecords: ({ session }) => {
        const shopIds = activeShopIds(session);
        return shopIds.length ? { package: { shop: { id: { in: shopIds } } } } : false;
      },
      canAccessShopRecords: ({ session }) => shopRelationshipFilter(session),
      canAccessTransactionShopRecords: ({ session }) => {
        const shopIds = activeShopIds(session);
        return shopIds.length > 0 ? { transaction: { shop: { id: { in: shopIds } } } } : false;
      },
      canAccessCustomerPackageShopRecords: ({ session }) => {
        const shopIds = activeShopIds(session);
        return shopIds.length > 0 ? { customerPackage: { shop: { id: { in: shopIds } } } } : false;
      },
      canReadShops: ({ session }) => {
        const shopIds = membershipShopIds(session);
        return shopIds.length > 0 ? { id: { in: shopIds } } : false;
      },
      canManageShops: ({ session }) => {
        const shopIds = managedShopIds(session);
        return shopIds.length > 0 ? { id: { in: shopIds } } : false;
      },
      canReadPublishedServices: ({ session }) => {
        if (session?.data.role?.canAccessDashboard) return true;
        return { status: { equals: "active" } };
      },
      canReadPublishedServiceCategories: ({ session }) => {
        if (session?.data.role?.canAccessDashboard) return true;
        return { status: { equals: "active" } };
      },
      canReadPublishedStaff: ({ session }) => {
        if (session?.data.role?.canAccessDashboard) return true;
        return {
          status: { equals: "active" },
          bookingEnabled: { equals: true }
        };
      }
    };
  }
});

// features/keystone/utils/shopRelationshipHooks.ts
function connectedRelationshipId(value) {
  if (!value || typeof value !== "object") return void 0;
  const relationship47 = value;
  if (relationship47.disconnect) return void 0;
  return typeof relationship47.connect?.id === "string" ? relationship47.connect.id : void 0;
}
function connectedRelationshipIds(value) {
  if (!value || typeof value !== "object") return [];
  const relationship47 = value;
  const candidates = [
    ...Array.isArray(relationship47.connect) ? relationship47.connect : relationship47.connect ? [relationship47.connect] : [],
    ...Array.isArray(relationship47.set) ? relationship47.set : []
  ];
  return candidates.map((item) => item.id).filter((id) => typeof id === "string");
}
async function validateShopRelationships(args, relationships) {
  const shopId = connectedRelationshipId(args.resolvedData.shop) || String(args.item?.shopId || "");
  if (!shopId) {
    args.addValidationError("Shop is required for this merchant record.");
    return;
  }
  if (args.context.session && !activeShopIds(args.context.session).includes(shopId)) {
    args.addValidationError("Not authorized to create or change records for this shop.");
  }
  for (const relationship47 of relationships) {
    const prisma = args.context.prisma;
    if (relationship47.many) {
      const relationIds = connectedRelationshipIds(args.resolvedData[relationship47.field]);
      if (relationIds.length === 0) continue;
      const relatedItems = await prisma[relationship47.delegate].findMany({
        where: { id: { in: relationIds } },
        select: { id: true, shopId: true }
      });
      if (relatedItems.length !== new Set(relationIds).size || relatedItems.some((related2) => related2.shopId !== shopId)) {
        args.addValidationError(`${relationship47.field} must belong to the same shop.`);
      }
      continue;
    }
    const relationId = args.resolvedData[relationship47.field] === void 0 ? String(args.item?.[`${relationship47.field}Id`] || "") : connectedRelationshipId(args.resolvedData[relationship47.field]);
    if (!relationId) continue;
    const related = await prisma[relationship47.delegate].findUnique({
      where: { id: relationId },
      select: { id: true, shopId: true }
    });
    if (!related || related.shopId !== shopId) {
      args.addValidationError(`${relationship47.field} must belong to the same shop.`);
    }
  }
}
var init_shopRelationshipHooks = __esm({
  "features/keystone/utils/shopRelationshipHooks.ts"() {
    "use strict";
    init_access();
  }
});

// features/keystone/models/trackingFields.ts
var import_fields, trackingFields;
var init_trackingFields = __esm({
  "features/keystone/models/trackingFields.ts"() {
    "use strict";
    import_fields = require("@keystone-6/core/fields");
    trackingFields = {
      createdAt: (0, import_fields.timestamp)({
        access: { read: () => true, create: () => false, update: () => false },
        validation: { isRequired: true },
        defaultValue: { kind: "now" },
        ui: {
          createView: { fieldMode: "hidden" },
          itemView: { fieldMode: "read" }
        }
      }),
      updatedAt: (0, import_fields.timestamp)({
        access: { read: () => true, create: () => false, update: () => false },
        db: { updatedAt: true },
        validation: { isRequired: true },
        defaultValue: { kind: "now" },
        ui: {
          createView: { fieldMode: "hidden" },
          itemView: { fieldMode: "read" }
        }
      })
    };
  }
});

// features/keystone/models/WaiverForm.ts
var import_core, import_fields2, WaiverForm;
var init_WaiverForm = __esm({
  "features/keystone/models/WaiverForm.ts"() {
    "use strict";
    import_core = require("@keystone-6/core");
    import_fields2 = require("@keystone-6/core/fields");
    init_access();
    init_shopRelationshipHooks();
    init_trackingFields();
    WaiverForm = (0, import_core.list)({
      hooks: { validate: {
        create: (args) => validateShopRelationships(args, [
          { field: "customer", delegate: "customer" },
          { field: "appointment", delegate: "appointment" },
          { field: "service", delegate: "service" }
        ]),
        update: (args) => validateShopRelationships(args, [
          { field: "customer", delegate: "customer" },
          { field: "appointment", delegate: "appointment" },
          { field: "service", delegate: "service" }
        ])
      } },
      access: {
        operation: { query: permissions.canReadCustomers, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["title", "customer", "waiverType", "status"] } },
      fields: {
        shop: (0, import_fields2.relationship)({ ref: "Shop.waiverForms", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        title: (0, import_fields2.text)({ validation: { isRequired: true } }),
        customer: (0, import_fields2.relationship)({ ref: "Customer" }),
        appointment: (0, import_fields2.relationship)({ ref: "Appointment" }),
        service: (0, import_fields2.relationship)({ ref: "Service" }),
        waiverType: (0, import_fields2.select)({ type: "enum", options: [{ label: "Service-specific", value: "service" }, { label: "Chemical Service", value: "chemical_service" }, { label: "Minor Consent", value: "minor_consent" }, { label: "Photo Release", value: "photo_release" }, { label: "General", value: "general" }], defaultValue: "general" }),
        status: (0, import_fields2.select)({ type: "enum", options: [{ label: "Draft", value: "draft" }, { label: "Sent", value: "sent" }, { label: "Signed", value: "signed" }, { label: "Expired", value: "expired" }], defaultValue: "draft" }),
        templateKey: (0, import_fields2.text)({ access: { update: () => false } }),
        templateVersion: (0, import_fields2.text)({ access: { update: () => false } }),
        templateHash: (0, import_fields2.text)({ access: { update: () => false } }),
        signatureKeyHash: (0, import_fields2.text)({ isIndexed: "unique", access: { read: () => false, update: () => false } }),
        signedByName: (0, import_fields2.text)({ access: { update: () => false } }),
        signerRole: (0, import_fields2.select)({ type: "enum", options: [{ label: "Customer", value: "customer" }, { label: "Guardian", value: "guardian" }], access: { update: () => false } }),
        guardianName: (0, import_fields2.text)({ access: { update: () => false } }),
        affirmation: (0, import_fields2.checkbox)({ defaultValue: false, access: { update: () => false } }),
        affirmationHash: (0, import_fields2.text)({ access: { read: () => false, update: () => false } }),
        signedAt: (0, import_fields2.timestamp)({ access: { update: () => false } }),
        documentUrl: (0, import_fields2.text)(),
        metadata: (0, import_fields2.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/GroomingNote.ts
var import_core2, import_fields3, GroomingNote;
var init_GroomingNote = __esm({
  "features/keystone/models/GroomingNote.ts"() {
    "use strict";
    import_core2 = require("@keystone-6/core");
    import_fields3 = require("@keystone-6/core/fields");
    init_access();
    init_shopRelationshipHooks();
    init_trackingFields();
    GroomingNote = (0, import_core2.list)({
      hooks: { validate: {
        create: (args) => validateShopRelationships(args, [
          { field: "customer", delegate: "customer" },
          { field: "barber", delegate: "barber" },
          { field: "appointment", delegate: "appointment" }
        ]),
        update: (args) => validateShopRelationships(args, [
          { field: "customer", delegate: "customer" },
          { field: "barber", delegate: "barber" },
          { field: "appointment", delegate: "appointment" }
        ])
      } },
      access: {
        operation: { query: permissions.canReadCustomerNotes, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["title", "customer", "barber", "noteType"] } },
      fields: {
        shop: (0, import_fields3.relationship)({ ref: "Shop.groomingNotes", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        title: (0, import_fields3.text)({ validation: { isRequired: true } }),
        customer: (0, import_fields3.relationship)({ ref: "Customer" }),
        barber: (0, import_fields3.relationship)({ ref: "Barber" }),
        appointment: (0, import_fields3.relationship)({ ref: "Appointment" }),
        noteType: (0, import_fields3.select)({ type: "enum", options: [{ label: "Cut Formula", value: "cut_formula" }, { label: "Beard Detail", value: "beard_detail" }, { label: "Product Preference", value: "product_preference" }, { label: "Allergy", value: "allergy" }], defaultValue: "cut_formula" }),
        body: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
        photoUrl: (0, import_fields3.text)(),
        privateToStaff: (0, import_fields3.checkbox)({ defaultValue: true }),
        metadata: (0, import_fields3.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/WaitlistEntry.ts
var import_core3, import_fields4, WaitlistEntry;
var init_WaitlistEntry = __esm({
  "features/keystone/models/WaitlistEntry.ts"() {
    "use strict";
    import_core3 = require("@keystone-6/core");
    import_fields4 = require("@keystone-6/core/fields");
    init_access();
    init_shopRelationshipHooks();
    init_trackingFields();
    WaitlistEntry = (0, import_core3.list)({
      hooks: { validate: {
        create: (args) => validateShopRelationships(args, [{ field: "customer", delegate: "customer" }, { field: "requestedService", delegate: "service" }, { field: "requestedBarber", delegate: "barber" }]),
        update: (args) => validateShopRelationships(args, [{ field: "customer", delegate: "customer" }, { field: "requestedService", delegate: "service" }, { field: "requestedBarber", delegate: "barber" }])
      } },
      access: { operation: { query: permissions.canReadQueue, create: () => false, update: () => false, delete: () => false }, filter: { query: rules.canAccessShopRecords } },
      ui: { listView: { initialColumns: ["customerName", "requestedService", "requestedBarber", "status"] } },
      fields: {
        shop: (0, import_fields4.relationship)({ ref: "Shop.waitlistEntries", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        customerName: (0, import_fields4.text)({ validation: { isRequired: true } }),
        phone: (0, import_fields4.text)(),
        customer: (0, import_fields4.relationship)({ ref: "Customer" }),
        requestedService: (0, import_fields4.relationship)({ ref: "Service" }),
        requestedBarber: (0, import_fields4.relationship)({ ref: "Barber" }),
        status: (0, import_fields4.select)({ type: "enum", options: [{ label: "Waiting", value: "waiting" }, { label: "Notified", value: "notified" }, { label: "Booked", value: "booked" }, { label: "Expired", value: "expired" }], defaultValue: "waiting" }),
        preferredAt: (0, import_fields4.timestamp)(),
        notifiedAt: (0, import_fields4.timestamp)(),
        notes: (0, import_fields4.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields4.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/deleteHistoryGuard.ts
async function deleteHistoryProblem(prisma, listKey, id) {
  const rule = DELETE_HISTORY[listKey];
  if (!rule) return null;
  const counts = await Promise.all(rule.references.map((r) => prisma[r.model].count({ where: { [r.field]: id } })));
  const found = rule.references.map((r, i) => counts[i] ? `${counts[i]} ${counts[i] === 1 ? r.one : r.many}` : "").filter(Boolean);
  if (!found.length) return null;
  return listKey === "Role" ? `${found.join(", ")} this role. ${rule.instead}` : `This has ${found.join(", ")}. ${rule.instead}`;
}
function historyDeleteGuard(listKey) {
  return async ({ item, context, addValidationError }) => {
    if (listKey === "User" && String(item.id) === String(context.session?.itemId || "")) {
      addValidationError("You can\u2019t delete your own account.");
      return;
    }
    const problem = await deleteHistoryProblem(context.prisma, listKey, String(item.id));
    if (problem) addValidationError(problem);
  };
}
var ref, DELETE_HISTORY;
var init_deleteHistoryGuard = __esm({
  "features/keystone/utils/deleteHistoryGuard.ts"() {
    "use strict";
    ref = (model, field, one, many = `${one}s`) => ({ model, field, one, many });
    DELETE_HISTORY = {
      NoShowPolicy: {
        instead: "Archive the policy instead; charged no-shows keep the policy they were charged under.",
        references: [ref("noShowEvent", "policyId", "no-show charge")]
      },
      Role: {
        instead: "Give them another role first.",
        references: [ref("user", "roleId", "person still has", "people still have")]
      },
      User: {
        instead: "Remove their shop access instead of deleting the account.",
        references: [
          ref("barber", "userId", "barber profile"),
          ref("customer", "userId", "customer profile"),
          ref("appointment", "accountId", "booked appointment"),
          ref("shopMembership", "userId", "shop membership")
        ]
      }
    };
  }
});

// features/keystone/models/NoShowPolicy.ts
var import_core4, import_fields5, NoShowPolicy;
var init_NoShowPolicy = __esm({
  "features/keystone/models/NoShowPolicy.ts"() {
    "use strict";
    import_core4 = require("@keystone-6/core");
    import_fields5 = require("@keystone-6/core/fields");
    init_access();
    init_shopRelationshipHooks();
    init_trackingFields();
    init_deleteHistoryGuard();
    NoShowPolicy = (0, import_core4.list)({
      hooks: { validate: {
        delete: historyDeleteGuard("NoShowPolicy"),
        create: (args) => validateShopRelationships(args, []),
        update: (args) => validateShopRelationships(args, [])
      } },
      access: {
        operation: { query: permissions.canReadAppointments, create: permissions.canManageAppointments, update: permissions.canManageAppointments, delete: permissions.canManageAppointments },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["name", "status", "feeAmount", "graceMinutes"] } },
      fields: {
        shop: (0, import_fields5.relationship)({ ref: "Shop.noShowPolicies", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields5.text)({ validation: { isRequired: true } }),
        status: (0, import_fields5.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Archived", value: "archived" }], defaultValue: "active" }),
        feeAmount: (0, import_fields5.integer)({ defaultValue: 0, validation: { min: 0 } }),
        graceMinutes: (0, import_fields5.integer)({ defaultValue: 10, validation: { min: 0 } }),
        appliesToMemberships: (0, import_fields5.checkbox)({ defaultValue: false }),
        description: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
        events: (0, import_fields5.relationship)({ ref: "NoShowEvent.policy", many: true }),
        metadata: (0, import_fields5.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Tip.ts
var import_core5, import_fields6, Tip;
var init_Tip = __esm({
  "features/keystone/models/Tip.ts"() {
    "use strict";
    import_core5 = require("@keystone-6/core");
    import_fields6 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    Tip = (0, import_core5.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "barber", delegate: "barber" },
            { field: "customer", delegate: "customer" },
            { field: "transaction", delegate: "checkoutTransaction" },
            { field: "appointment", delegate: "appointment" }
          ])
        }
      },
      access: {
        operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["tipNumber", "barber", "customer", "amount"] } },
      fields: {
        shop: (0, import_fields6.relationship)({ ref: "Shop.tips", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        tipNumber: (0, import_fields6.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        barber: (0, import_fields6.relationship)({ ref: "Barber" }),
        customer: (0, import_fields6.relationship)({ ref: "Customer" }),
        transaction: (0, import_fields6.relationship)({ ref: "CheckoutTransaction" }),
        appointment: (0, import_fields6.relationship)({ ref: "Appointment" }),
        amount: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
        paymentMethod: (0, import_fields6.select)({ type: "enum", options: [{ label: "Card", value: "card" }, { label: "Cash", value: "cash" }, { label: "Wallet", value: "wallet" }], defaultValue: "card" }),
        paidAt: (0, import_fields6.timestamp)(),
        metadata: (0, import_fields6.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/settledEvidence.ts
function settledAppointmentMutationError(existingItem, resolvedData, operation) {
  const status = String(existingItem.paymentStatus || "");
  if (!["paid", "refunded"].includes(status)) return null;
  if (operation === "delete") return "Settled appointments cannot be deleted.";
  const changedKeys = Object.keys(resolvedData).filter((key) => key !== "updatedAt");
  const isPaidToRefunded = status === "paid" && changedKeys.length === 1 && changedKeys[0] === "paymentStatus" && resolvedData.paymentStatus === "refunded";
  return isPaidToRefunded ? null : "Settled appointment evidence is immutable.";
}
function settledCommissionMutationError(existingItem, operation) {
  if (existingItem.status !== "paid") return null;
  return operation === "delete" ? "Paid commission evidence cannot be deleted." : "Paid commission evidence is immutable.";
}
var init_settledEvidence = __esm({
  "features/keystone/utils/settledEvidence.ts"() {
    "use strict";
  }
});

// features/keystone/models/Commission.ts
var import_core6, import_fields7, Commission;
var init_Commission = __esm({
  "features/keystone/models/Commission.ts"() {
    "use strict";
    import_core6 = require("@keystone-6/core");
    import_fields7 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_settledEvidence();
    init_shopRelationshipHooks();
    Commission = (0, import_core6.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "barber", delegate: "barber" },
            { field: "transaction", delegate: "checkoutTransaction" },
            { field: "appointment", delegate: "appointment" }
          ]),
          update: async (args) => {
            const error = settledCommissionMutationError(args.item, "update");
            if (error) args.addValidationError(error);
            await validateShopRelationships(args, [
              { field: "barber", delegate: "barber" },
              { field: "transaction", delegate: "checkoutTransaction" },
              { field: "appointment", delegate: "appointment" }
            ]);
          },
          delete: ({ item, addValidationError }) => {
            const error = settledCommissionMutationError(item, "delete");
            if (error) addValidationError(error);
          }
        }
      },
      access: {
        operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["commissionNumber", "barber", "status", "commissionAmount"] } },
      fields: {
        shop: (0, import_fields7.relationship)({ ref: "Shop.commissions", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        commissionNumber: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        barber: (0, import_fields7.relationship)({ ref: "Barber.commissions" }),
        transaction: (0, import_fields7.relationship)({ ref: "CheckoutTransaction" }),
        appointment: (0, import_fields7.relationship)({ ref: "Appointment" }),
        payout: (0, import_fields7.relationship)({ ref: "CommissionPayout.commissions" }),
        status: (0, import_fields7.select)({ type: "enum", options: [{ label: "Projected", value: "projected" }, { label: "Approved", value: "approved" }, { label: "Paid", value: "paid" }, { label: "Voided", value: "voided" }], defaultValue: "projected" }),
        serviceAmount: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        productAmount: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        commissionRate: (0, import_fields7.decimal)({ defaultValue: "0" }),
        commissionAmount: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        paidAt: (0, import_fields7.timestamp)(),
        metadata: (0, import_fields7.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Supplier.ts
var import_core7, import_fields8, Supplier;
var init_Supplier = __esm({
  "features/keystone/models/Supplier.ts"() {
    "use strict";
    import_core7 = require("@keystone-6/core");
    import_fields8 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    Supplier = (0, import_core7.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: (args) => validateShopRelationships(args, [])
        }
      },
      access: {
        operation: { query: permissions.canAccessDashboard, create: permissions.canManageServices, update: permissions.canManageServices, delete: permissions.canManageServices },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["name", "status", "contactName"] } },
      fields: {
        shop: (0, import_fields8.relationship)({ ref: "Shop.suppliers", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields8.text)({ validation: { isRequired: true } }),
        status: (0, import_fields8.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Archived", value: "archived" }], defaultValue: "active" }),
        contactName: (0, import_fields8.text)(),
        email: (0, import_fields8.text)(),
        phone: (0, import_fields8.text)(),
        website: (0, import_fields8.text)(),
        notes: (0, import_fields8.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields8.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/InventoryLot.ts
var import_core8, import_fields9, InventoryLot;
var init_InventoryLot = __esm({
  "features/keystone/models/InventoryLot.ts"() {
    "use strict";
    import_core8 = require("@keystone-6/core");
    import_fields9 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    InventoryLot = (0, import_core8.list)({
      db: {
        extendPrismaSchema: (schema) => schema.replace(
          /\n}$/,
          '\n  @@unique([shopId, lotNumber], map: "InventoryLot_shop_lotNumber_key")\n}'
        )
      },
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "product", delegate: "product" },
            { field: "supplier", delegate: "supplier" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "product", delegate: "product" },
            { field: "supplier", delegate: "supplier" }
          ])
        }
      },
      access: {
        operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["lotNumber", "product", "supplier", "status"] } },
      fields: {
        shop: (0, import_fields9.relationship)({ ref: "Shop.inventoryLots", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        lotNumber: (0, import_fields9.text)({ isIndexed: true, validation: { isRequired: true } }),
        product: (0, import_fields9.relationship)({ ref: "Product.inventoryLots" }),
        supplier: (0, import_fields9.relationship)({ ref: "Supplier" }),
        quantityReceived: (0, import_fields9.integer)({ defaultValue: 0, validation: { min: 0 }, access: { update: () => false } }),
        quantityRemaining: (0, import_fields9.integer)({ defaultValue: 0, validation: { min: 0 }, access: { update: () => false } }),
        unitCost: (0, import_fields9.integer)({ defaultValue: 0, validation: { min: 0 } }),
        receivedAt: (0, import_fields9.timestamp)(),
        expiresAt: (0, import_fields9.timestamp)(),
        status: (0, import_fields9.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Consumed", value: "consumed" }, { label: "Expired", value: "expired" }], defaultValue: "active" }),
        metadata: (0, import_fields9.json)(),
        movements: (0, import_fields9.relationship)({ ref: "InventoryMovement.inventoryLot", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Product.ts
var import_core9, import_fields10, Product;
var init_Product = __esm({
  "features/keystone/models/Product.ts"() {
    "use strict";
    import_core9 = require("@keystone-6/core");
    import_fields10 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    Product = (0, import_core9.list)({
      db: {
        extendPrismaSchema: (schema) => schema.replace(
          /\n}$/,
          '\n  @@unique([shopId, sku], map: "Product_shop_sku_key")\n}'
        )
      },
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: (args) => validateShopRelationships(args, [])
        }
      },
      access: {
        operation: { query: permissions.canAccessDashboard, create: permissions.canManageServices, update: permissions.canManageServices, delete: permissions.canManageServices },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["name", "sku", "status", "price"] } },
      fields: {
        shop: (0, import_fields10.relationship)({ ref: "Shop.products", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields10.text)({ validation: { isRequired: true } }),
        sku: (0, import_fields10.text)({ isIndexed: true }),
        status: (0, import_fields10.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Draft", value: "draft" }, { label: "Archived", value: "archived" }], defaultValue: "active" }),
        productType: (0, import_fields10.select)({ type: "enum", options: [{ label: "Pomade", value: "pomade" }, { label: "Beard Care", value: "beard_care" }, { label: "Shampoo", value: "shampoo" }, { label: "Tool", value: "tool" }, { label: "Other", value: "other" }], defaultValue: "other" }),
        price: (0, import_fields10.integer)({ defaultValue: 0, validation: { min: 0 } }),
        cost: (0, import_fields10.integer)({ defaultValue: 0, validation: { min: 0 } }),
        description: (0, import_fields10.text)({ ui: { displayMode: "textarea" } }),
        imagePath: (0, import_fields10.text)({ ui: { description: "Relative public retail product path, e.g. /images/barbershop/product-matte-clay.svg." } }),
        image: (0, import_fields10.image)({ storage: "my_images" }),
        inventoryTracked: (0, import_fields10.checkbox)({ defaultValue: true }),
        metadata: (0, import_fields10.json)(),
        inventoryLots: (0, import_fields10.relationship)({ ref: "InventoryLot.product", many: true }),
        inventoryMovements: (0, import_fields10.relationship)({ ref: "InventoryMovement.product", many: true }),
        saleLines: (0, import_fields10.relationship)({ ref: "ProductSaleLine.product", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/BarberChair.ts
var import_core10, import_fields11, BarberChair;
var init_BarberChair = __esm({
  "features/keystone/models/BarberChair.ts"() {
    "use strict";
    import_core10 = require("@keystone-6/core");
    import_fields11 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    BarberChair = (0, import_core10.list)({
      db: {
        extendPrismaSchema: (schema) => schema.replace(
          /\n}$/,
          '\n  @@unique([shopId, chairNumber], map: "BarberChair_shop_chairNumber_key")\n}'
        )
      },
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: (args) => validateShopRelationships(args, [])
        }
      },
      access: {
        operation: { query: permissions.canReadStaff, create: permissions.canManageStaff, update: permissions.canManageStaff, delete: permissions.canManageStaff },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["chairNumber", "stationName", "status", "assignedBarbers"] } },
      fields: {
        shop: (0, import_fields11.relationship)({ ref: "Shop.chairs", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        chairNumber: (0, import_fields11.text)({ isIndexed: true, validation: { isRequired: true } }),
        stationName: (0, import_fields11.text)(),
        status: (0, import_fields11.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Maintenance", value: "maintenance" }, { label: "Reserved", value: "reserved" }], defaultValue: "active" }),
        assignedBarbers: (0, import_fields11.relationship)({ ref: "Barber.chair", many: true }),
        scheduleExceptions: (0, import_fields11.relationship)({ ref: "ScheduleException.chair", many: true, access: { create: () => false, update: () => false } }),
        shifts: (0, import_fields11.relationship)({ ref: "StaffShift.chair", many: true, access: { create: () => false, update: () => false } }),
        // Appointment chair assignment is owned by the booking/seating commands
        // (capacity locks and history). The inverse is read-only here as well as in
        // the registry-wide relationship boundary wrapper.
        appointments: (0, import_fields11.relationship)({ ref: "Appointment.chair", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
        locationNote: (0, import_fields11.text)(),
        metadata: (0, import_fields11.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/strictPrisma.ts
function assertResult(result) {
  if (result instanceof Error) {
    if (result instanceof import_graphql.GraphQLError) {
      const original = result.extensions?.prisma;
      const error = new Error(result.message);
      if (original) Object.assign(error, original);
      throw error;
    }
    throw result;
  }
  return result;
}
function strictDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, { get(target, key) {
    const value = Reflect.get(target, key, target);
    if (typeof value !== "function") return value;
    return async (...args) => assertResult(await value.apply(target, args));
  } });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function strictPrisma(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, { get(target, key) {
    const value = Reflect.get(target, key, target);
    if (key === "$transaction" && typeof value === "function") {
      return async (operation, ...options) => {
        const work = typeof operation === "function" ? (tx) => operation(strictPrisma(tx)) : operation;
        return assertResult(await value.call(target, work, ...options));
      };
    }
    if (typeof value === "function") {
      if (typeof key === "string" && /^\$(?:queryRaw|executeRaw|connect|disconnect)/.test(key)) return async (...args) => assertResult(await value.apply(target, args));
      return value.bind(target);
    }
    if (value && typeof value === "object" && typeof Reflect.get(value, "findUnique") === "function") return strictDelegate(value);
    return value;
  } });
  clients.set(client, wrapped);
  return wrapped;
}
var import_graphql, clients, delegates;
var init_strictPrisma = __esm({
  "features/keystone/utils/strictPrisma.ts"() {
    "use strict";
    import_graphql = require("graphql");
    clients = /* @__PURE__ */ new WeakMap();
    delegates = /* @__PURE__ */ new WeakMap();
  }
});

// features/keystone/utils/domainPrisma.ts
function bindDomainPrisma(client) {
  canonicalClient = strictPrisma(client);
  return canonicalClient;
}
var canonicalClient, domainPrisma;
var init_domainPrisma = __esm({
  "features/keystone/utils/domainPrisma.ts"() {
    "use strict";
    init_strictPrisma();
    domainPrisma = new Proxy({}, {
      set(_target, key, value) {
        if (!canonicalClient) throw new Error("Initialize the Keystone context before using the domain database.");
        return Reflect.set(canonicalClient, key, value);
      },
      get(_target, key) {
        if (!canonicalClient) throw new Error("Initialize the Keystone context before using the domain database.");
        const value = Reflect.get(canonicalClient, key, canonicalClient);
        return typeof value === "function" ? value.bind(canonicalClient) : value;
      }
    });
  }
});

// features/keystone/utils/currentAuthorization.ts
async function assertCurrentShopAccess(session, shopId, client = domainPrisma, permission) {
  if (!session?.itemId) throw new Error("A signed-in dashboard user is required.");
  const locking = client;
  if (typeof locking.$queryRawUnsafe === "function") {
    await locking.$queryRawUnsafe(
      `SELECT 1 FROM "User" u JOIN "Role" r ON r.id = u."role" JOIN "ShopMembership" m ON m."user" = u.id
       WHERE u.id = $1 AND m."shop" = $2 FOR SHARE OF u, r, m`,
      session.itemId,
      shopId
    );
  }
  const current = await client.user.findUnique({
    where: { id: session.itemId },
    select: {
      role: { select: ROLE_PERMISSION_SELECT },
      shopMemberships: { where: { shopId, status: "active", shop: { status: "active" } }, take: 1, select: { id: true, membershipRole: true } }
    }
  });
  if (!current?.shopMemberships.length || !current.role) throw new Error("This shop session has been revoked. Sign in again.");
  const staleRole = session.data.role;
  for (const field of PERMISSION_FIELDS) {
    if (staleRole?.[field] && !current.role[field]) {
      throw new Error("Your role permissions changed. Sign in again.");
    }
  }
  if (permission) {
    if (!current.role[permission]) throw new Error("Your role no longer authorizes this operation. Sign in again.");
    if (!membershipRoleAllows(current.shopMemberships[0].membershipRole, permission)) throw new Error("Your role in this shop does not allow this operation.");
  }
}
async function assertCurrentRolePermission(session, permission, client = domainPrisma) {
  if (!session?.itemId) throw new Error("A signed-in dashboard user is required.");
  const user = await client.user.findUnique({ where: { id: session.itemId }, select: { role: { select: ROLE_PERMISSION_SELECT } } });
  if (!user?.role?.[permission]) throw new Error("Your role no longer authorizes this operation. Sign in again.");
}
async function hasCurrentRolePermission(session, permission, client = domainPrisma) {
  try {
    await assertCurrentRolePermission(session, permission, client);
    return true;
  } catch {
    return false;
  }
}
async function currentMembershipShopIds(session, client = domainPrisma) {
  if (!session?.itemId) return [];
  const sessionShopIds = membershipShopIds(session);
  if (!sessionShopIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: { userId: session.itemId, shopId: { in: sessionShopIds }, status: "active", shop: { status: "active" } },
    select: { shopId: true }
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}
async function currentManagedShopIds(session, client = domainPrisma) {
  if (!session?.itemId) return [];
  const sessionShopIds = managedShopIds(session);
  if (!sessionShopIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: {
      userId: session.itemId,
      shopId: { in: sessionShopIds },
      status: "active",
      membershipRole: { in: ["owner", "manager"] },
      shop: { status: "active" }
    },
    select: { shopId: true }
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}
async function currentActiveShopIds(session, client = domainPrisma) {
  if (!session?.itemId) return [];
  const selectedShopIds = activeShopIds(session);
  if (!selectedShopIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: { userId: session.itemId, shopId: { in: selectedShopIds }, status: "active", shop: { status: "active" } },
    select: { shopId: true }
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}
async function hasCurrentOwnerMembership(session, shopId, client = domainPrisma) {
  if (!session?.itemId || !activeShopIds(session).includes(shopId)) return false;
  const membership = await client.shopMembership.findFirst({
    where: { userId: session.itemId, shopId, status: "active", membershipRole: "owner", shop: { status: "active" } },
    select: { id: true }
  });
  return Boolean(membership);
}
async function currentManagedActiveShopIds(session, client = domainPrisma) {
  const activeIds = await currentActiveShopIds(session, client);
  if (!session?.itemId || !activeIds.length) return [];
  const memberships = await client.shopMembership.findMany({
    where: {
      userId: session.itemId,
      shopId: { in: activeIds },
      status: "active",
      membershipRole: { in: ["owner", "manager"] },
      shop: { status: "active" }
    },
    select: { shopId: true }
  });
  return Array.from(new Set(memberships.map(({ shopId }) => shopId))).sort();
}
async function requireCurrentShopPermission(session, permission, client = domainPrisma) {
  const shopId = requireSingleActiveShop(session);
  await assertCurrentShopAccess(session, shopId, client, permission);
  return shopId;
}
async function currentShopForPermission(session, permission, client = domainPrisma) {
  if (!session?.itemId || !session.data.role?.[permission]) return null;
  try {
    return await requireCurrentShopPermission(session, permission, client);
  } catch {
    return null;
  }
}
var PERMISSION_FIELDS, ROLE_PERMISSION_SELECT;
var init_currentAuthorization = __esm({
  "features/keystone/utils/currentAuthorization.ts"() {
    "use strict";
    init_access();
    init_access();
    init_domainPrisma();
    PERMISSION_FIELDS = [
      "canAccessDashboard",
      "canManageOnboarding",
      "canManageServices",
      "canManageStaff",
      "canManageSchedules",
      "canManageAppointments",
      "canManageQueue",
      "canManageCustomers",
      "canManageCustomerNotes",
      "canManageMemberships",
      "canManagePayments",
      "canViewReports",
      "canManagePeople",
      "canManageRoles",
      "canSeeOtherPeople",
      "canEditOtherPeople"
    ];
    ROLE_PERMISSION_SELECT = Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true]));
  }
});

// features/keystone/utils/peopleAccess.ts
function selfOnly(session) {
  return { id: { equals: session.itemId } };
}
function activeShopPeople(session, shopIds) {
  return {
    OR: [
      selfOnly(session),
      {
        shopMemberships: {
          some: {
            status: { equals: "active" },
            shop: { id: { in: shopIds }, status: { equals: "active" } }
          }
        }
      }
    ]
  };
}
async function canReadPeople({ session, context }) {
  if (!session?.itemId) return false;
  if (await hasCurrentRolePermission(session, "canManageRoles", context.prisma)) return true;
  if (!await hasCurrentRolePermission(session, "canSeeOtherPeople", context.prisma)) return selfOnly(session);
  const shopIds = await currentActiveShopIds(session, context.prisma);
  return shopIds.length ? activeShopPeople(session, shopIds) : selfOnly(session);
}
async function canUpdatePeople({ session, context }) {
  if (!session?.itemId) return false;
  if (await hasCurrentRolePermission(session, "canManageRoles", context.prisma)) return true;
  return selfOnly(session);
}
var init_peopleAccess = __esm({
  "features/keystone/utils/peopleAccess.ts"() {
    "use strict";
    init_currentAuthorization();
  }
});

// features/keystone/models/User.ts
var import_core11, import_access14, import_fields12, PUBLIC_USER_CREATE_FIELDS, User;
var init_User = __esm({
  "features/keystone/models/User.ts"() {
    "use strict";
    import_core11 = require("@keystone-6/core");
    import_access14 = require("@keystone-6/core/access");
    import_fields12 = require("@keystone-6/core/fields");
    init_trackingFields();
    init_access();
    init_currentAuthorization();
    init_peopleAccess();
    init_deleteHistoryGuard();
    PUBLIC_USER_CREATE_FIELDS = /* @__PURE__ */ new Set(["name", "email", "phone", "password", "role"]);
    User = (0, import_core11.list)({
      access: {
        operation: {
          ...(0, import_access14.allOperations)(isSignedIn),
          // Like E-commerce: public self-registration is always allowed, but a
          // non-administrator creator can only supply identity fields (see
          // resolveInput); role, memberships, shop and profile links stay locked.
          create: () => true,
          delete: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma)
        },
        filter: {
          query: canReadPeople,
          update: canUpdatePeople
        }
      },
      hooks: {
        validate: { delete: historyDeleteGuard("User") },
        resolveInput: async ({ operation, inputData, resolvedData, context }) => {
          if (operation !== "create") return resolvedData;
          if (await hasCurrentRolePermission(context.session, "canManageRoles", context.prisma)) return resolvedData;
          const restricted = { ...resolvedData };
          for (const key of Object.keys(inputData ?? {})) {
            if (!PUBLIC_USER_CREATE_FIELDS.has(key)) delete restricted[key];
          }
          return restricted;
        }
      },
      ui: {
        hideCreate: (args) => !permissions.canManageRoles(args),
        hideDelete: (args) => !permissions.canManageRoles(args),
        listView: {
          initialColumns: ["name", "email", "role", "barberProfile", "customerProfile"]
        },
        itemView: {
          defaultFieldMode: ({ session, item }) => {
            if (session?.itemId === item?.id || permissions.canManageRoles({ session })) return "edit";
            return "read";
          }
        }
      },
      fields: {
        name: (0, import_fields12.text)({
          validation: {
            isRequired: true
          }
        }),
        email: (0, import_fields12.text)({
          isFilterable: false,
          isOrderable: false,
          isIndexed: "unique",
          validation: {
            isRequired: true
          }
        }),
        phone: (0, import_fields12.text)({ isFilterable: false, isOrderable: false, ui: { description: "Used to fill in bookings." } }),
        password: (0, import_fields12.password)({
          access: {
            read: import_access14.denyAll,
            update: async ({ session, item, context }) => await hasCurrentRolePermission(session, "canManageRoles", context.prisma) || session?.itemId === item.id
          },
          validation: { isRequired: true }
        }),
        role: (0, import_fields12.relationship)({
          ref: "Role.assignedTo",
          access: {
            // Self may read its own role (dashboard gate/onboarding); other users' roles
            // stay limited to the current role administrator. Role list access still
            // filters what the relationship resolves to.
            read: async ({ session, item, context }) => Boolean(session?.itemId && session.itemId === item.id) || hasCurrentRolePermission(session, "canManageRoles", context.prisma),
            create: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma),
            update: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma)
          },
          ui: {
            itemView: {
              fieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read"
            }
          }
        }),
        barberProfile: (0, import_fields12.relationship)({
          ref: "Barber.user",
          access: { create: () => false, update: () => false },
          ui: {
            itemView: { fieldMode: (args) => permissions.canManageStaff(args) ? "edit" : "read" }
          }
        }),
        shopMemberships: (0, import_fields12.relationship)({
          ref: "ShopMembership.user",
          many: true,
          access: { create: () => false, update: () => false },
          ui: { itemView: { fieldMode: "read" } }
        }),
        activeShop: (0, import_fields12.relationship)({
          ref: "Shop.activeUsers",
          access: {
            read: async ({ session, item, context }) => {
              if (!session?.itemId) return false;
              if (session.itemId === item.id) return true;
              if (await hasCurrentRolePermission(session, "canManageRoles", context.prisma)) return true;
              const activeShopId = typeof item.activeShopId === "string" ? item.activeShopId : void 0;
              return Boolean(activeShopId && (await currentActiveShopIds(session, context.prisma)).includes(activeShopId));
            },
            create: () => false,
            update: () => false
          },
          ui: { itemView: { fieldMode: "read" } }
        }),
        customerProfile: (0, import_fields12.relationship)({
          ref: "Customer.user",
          access: { create: () => false, update: () => false },
          ui: {
            itemView: { fieldMode: (args) => permissions.canManageCustomers(args) ? "edit" : "read" }
          }
        }),
        bookings: (0, import_fields12.relationship)({ ref: "Appointment.account", many: true, access: { create: () => false, update: () => false } }),
        onboardingStatus: (0, import_fields12.select)({
          type: "enum",
          options: [
            { label: "Not Started", value: "not_started" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Dismissed", value: "dismissed" }
          ],
          defaultValue: "not_started"
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ShopSettings.ts
var import_core12, import_fields13, ShopSettings;
var init_ShopSettings = __esm({
  "features/keystone/models/ShopSettings.ts"() {
    "use strict";
    import_core12 = require("@keystone-6/core");
    import_fields13 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    ShopSettings = (0, import_core12.list)({
      isSingleton: true,
      graphql: { plural: "shopSettingsItems" },
      access: {
        operation: {
          query: permissions.canAccessDashboard,
          create: permissions.canManageOnboarding,
          update: permissions.canManageOnboarding,
          delete: permissions.canManageOnboarding
        }
      },
      ui: {
        isHidden: true,
        // The dashboard derives GraphQL names from this label; "Shop Settings"
        // would collapse to the list key and fail the whole admin meta load.
        plural: "Shop Settings Items",
        listView: { initialColumns: ["name", "tagline", "phone", "timezone"] }
      },
      fields: {
        key: (0, import_fields13.text)({
          isIndexed: "unique",
          defaultValue: "primary",
          validation: { isRequired: true }
        }),
        name: (0, import_fields13.text)({ validation: { isRequired: true } }),
        tagline: (0, import_fields13.text)(),
        address: (0, import_fields13.text)(),
        phone: (0, import_fields13.text)(),
        timezone: (0, import_fields13.text)({ defaultValue: "America/New_York" }),
        currencyCode: (0, import_fields13.text)({ defaultValue: "USD" }),
        hours: (0, import_fields13.json)({ defaultValue: {} }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Role.ts
async function currentRoleScope(session, prisma) {
  if (!session?.itemId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.itemId },
    select: { roleId: true, role: { select: { canManageRoles: true } } }
  });
  if (!user?.roleId || !user.role) return null;
  return user.role.canManageRoles ? "all" : { roleId: user.roleId };
}
var import_core13, import_fields14, Role;
var init_Role = __esm({
  "features/keystone/models/Role.ts"() {
    "use strict";
    import_core13 = require("@keystone-6/core");
    import_fields14 = require("@keystone-6/core/fields");
    init_trackingFields();
    init_access();
    init_currentAuthorization();
    init_deleteHistoryGuard();
    Role = (0, import_core13.list)({
      hooks: { validate: { delete: historyDeleteGuard("Role") } },
      access: {
        operation: {
          query: async ({ session, context }) => Boolean(await currentRoleScope(session, context.prisma)),
          create: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma),
          update: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma),
          delete: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma)
        },
        filter: {
          query: async ({ session, context }) => {
            const scope2 = await currentRoleScope(session, context.prisma);
            if (!scope2) return false;
            if (scope2 === "all") return true;
            return { id: { equals: scope2.roleId } };
          }
        }
      },
      ui: {
        hideCreate: (args) => !permissions.canManageRoles(args),
        hideDelete: (args) => !permissions.canManageRoles(args),
        listView: {
          initialColumns: ["name", "assignedTo"]
        },
        itemView: {
          defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read"
        }
      },
      fields: {
        name: (0, import_fields14.text)({ validation: { isRequired: true } }),
        canSeeOtherPeople: (0, import_fields14.checkbox)({ defaultValue: false }),
        canEditOtherPeople: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManagePeople: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageRoles: (0, import_fields14.checkbox)({ defaultValue: false }),
        canAccessDashboard: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageOnboarding: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageServices: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageStaff: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageSchedules: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageAppointments: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageQueue: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageCustomers: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageCustomerNotes: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManageMemberships: (0, import_fields14.checkbox)({ defaultValue: false }),
        canManagePayments: (0, import_fields14.checkbox)({ defaultValue: false }),
        canViewReports: (0, import_fields14.checkbox)({ defaultValue: false }),
        assignedTo: (0, import_fields14.relationship)({
          ref: "User.role",
          many: true,
          // Own-role visibility must not expose who else holds the role (across shops).
          access: {
            read: ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context.prisma)
          },
          ui: {
            itemView: { fieldMode: "read" }
          }
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ServiceCategory.ts
var import_core14, import_fields15, ServiceCategory;
var init_ServiceCategory = __esm({
  "features/keystone/models/ServiceCategory.ts"() {
    "use strict";
    import_core14 = require("@keystone-6/core");
    import_fields15 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    ServiceCategory = (0, import_core14.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: (args) => validateShopRelationships(args, [])
        }
      },
      access: {
        operation: {
          query: permissions.canReadServices,
          create: permissions.canManageServices,
          update: permissions.canManageServices,
          delete: permissions.canManageServices
        },
        filter: {
          query: rules.canAccessShopRecords,
          update: rules.canAccessShopRecords,
          delete: rules.canAccessShopRecords
        }
      },
      ui: {
        listView: {
          initialColumns: ["name", "status", "displayOrder", "services"]
        }
      },
      fields: {
        shop: (0, import_fields15.relationship)({ ref: "Shop.serviceCategories", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields15.text)({ validation: { isRequired: true } }),
        description: (0, import_fields15.text)({ ui: { displayMode: "textarea" } }),
        displayOrder: (0, import_fields15.integer)({ defaultValue: 0 }),
        status: (0, import_fields15.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Hidden", value: "hidden" }
          ],
          defaultValue: "active"
        }),
        services: (0, import_fields15.relationship)({ ref: "Service.category", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/publicAccessToken.ts
function hashPublicAccessToken(token) {
  return (0, import_node_crypto.createHash)("sha256").update(token, "utf8").digest("hex");
}
function createPublicAccessToken() {
  const token = (0, import_node_crypto.randomBytes)(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashPublicAccessToken(token) };
}
function publicAccessTokenMatches(token, expectedHash) {
  if (!token || !expectedHash) return false;
  const supplied = Buffer.from(hashPublicAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return supplied.length === expected.length && (0, import_node_crypto.timingSafeEqual)(supplied, expected);
}
var import_node_crypto, TOKEN_BYTES;
var init_publicAccessToken = __esm({
  "features/keystone/utils/publicAccessToken.ts"() {
    "use strict";
    import_node_crypto = require("node:crypto");
    TOKEN_BYTES = 32;
  }
});

// features/keystone/utils/waiverEvidence.ts
function hashWaiverText(text48) {
  return (0, import_node_crypto2.createHash)("sha256").update(text48).digest("hex");
}
async function getWaiverRequirement(client, serviceId) {
  const rows = await client.$queryRawUnsafe(`
    SELECT "waiverRequired", "waiverTemplateKey", "waiverTemplateVersion", "waiverTemplateText", "waiverTemplateHash"
    FROM "Service" WHERE id = $1 LIMIT 1
  `, serviceId);
  const row = rows[0];
  if (!row?.waiverRequired) return { required: false, templateKey: "", templateVersion: "", templateText: "", templateHash: "" };
  const computedHash = hashWaiverText(row.waiverTemplateText || "");
  if (!row.waiverTemplateKey || !row.waiverTemplateVersion || !row.waiverTemplateText || !row.waiverTemplateHash || computedHash !== row.waiverTemplateHash) {
    throw new Error("This service requires a valid immutable waiver template before it can be booked or started.");
  }
  return { required: true, templateKey: row.waiverTemplateKey, templateVersion: row.waiverTemplateVersion, templateText: row.waiverTemplateText, templateHash: row.waiverTemplateHash };
}
async function getAppointmentWaiverRequirement(client, appointmentId) {
  const rows = await client.$queryRawUnsafe('SELECT "waiverRequirementSnapshot" AS requirement FROM "Appointment" WHERE id = $1 LIMIT 1', appointmentId);
  const requirement = rows[0]?.requirement;
  if (!requirement || typeof requirement.required !== "boolean") throw new Error("Appointment waiver requirement evidence is missing.");
  if (requirement.required && (!requirement.templateKey || !requirement.templateVersion || !requirement.templateText || hashWaiverText(requirement.templateText) !== requirement.templateHash)) {
    throw new Error("Appointment waiver template evidence is invalid.");
  }
  return requirement;
}
async function requireSignedWaiver(client, input) {
  const rows = await client.$queryRawUnsafe(`
    SELECT id FROM "WaiverForm"
    WHERE "appointment" = $1 AND "service" = $2 AND "customer" = $3
      AND status = 'signed' AND "templateHash" = $4 AND "affirmationHash" IS NOT NULL
      AND "signedAt" IS NOT NULL
    ORDER BY "signedAt" DESC LIMIT 1
  `, input.appointmentId, input.serviceId, input.customerId, input.templateHash);
  if (!rows[0]) throw new Error("A signer-controlled waiver is required before this service can start.");
  return rows[0].id;
}
function assertWaiverSigner(input) {
  const signerName = input.signerName.trim();
  if (!input.affirmation || signerName.length < 2 || signerName.length > 160) throw new Error("Signer name and affirmative consent are required.");
  if (!["customer", "guardian"].includes(input.signerRole)) throw new Error("Signer role must be customer or guardian.");
  const guardianName = input.guardianName?.trim() || "";
  if (input.signerRole === "guardian" && guardianName.length < 2) throw new Error("Guardian authority name is required.");
  return { signerName, signerRole: input.signerRole, guardianName };
}
function canAccessAppointment(input) {
  if (input.accountId) return Boolean(input.sessionItemId) && input.sessionItemId === input.accountId;
  const token = input.token?.trim() || "";
  return Boolean(token) && publicAccessTokenMatches(token, input.storedHash);
}
function assertAppointmentAccess(input) {
  if (!canAccessAppointment(input)) throw new Error(input.accountId ? "Sign in to the account that made this booking to manage it." : "Appointment access proof is invalid.");
}
var import_node_crypto2;
var init_waiverEvidence = __esm({
  "features/keystone/utils/waiverEvidence.ts"() {
    "use strict";
    import_node_crypto2 = require("node:crypto");
    init_publicAccessToken();
  }
});

// features/keystone/models/Service.ts
function validateWaiverTemplate(args) {
  const required = args.resolvedData.waiverRequired ?? args.item?.waiverRequired;
  if (!required) return;
  const key = String(args.resolvedData.waiverTemplateKey ?? args.item?.waiverTemplateKey ?? "").trim();
  const version = String(args.resolvedData.waiverTemplateVersion ?? args.item?.waiverTemplateVersion ?? "").trim();
  const text48 = String(args.resolvedData.waiverTemplateText ?? args.item?.waiverTemplateText ?? "");
  const digest4 = String(args.resolvedData.waiverTemplateHash ?? args.item?.waiverTemplateHash ?? "").trim();
  if (!key || !version || !text48 || !digest4 || hashWaiverText(text48) !== digest4) {
    args.addValidationError("Waiver-required services need a key, version, exact text, and matching SHA-256 hash.");
  }
  const previousText = String(args.item?.waiverTemplateText ?? "");
  const previousHash = String(args.item?.waiverTemplateHash ?? "");
  const previousVersion = String(args.item?.waiverTemplateVersion ?? "");
  if (args.item && (text48 !== previousText || digest4 !== previousHash) && version === previousVersion) {
    args.addValidationError("Changing waiver text or hash requires a new template version.");
  }
}
function validateDeposit(args) {
  const data = { ...args.item, ...args.resolvedData };
  const price = Number(data.price ?? 0);
  const deposit = Number(data.depositAmount ?? 0);
  if (deposit > price) args.addValidationError("The deposit cannot be more than the service price.");
  if (data.depositRequired === true && !(deposit > 0)) args.addValidationError("Set a deposit amount above zero, or turn off the deposit requirement.");
}
var import_core15, import_fields16, formatCurrency, Service;
var init_Service = __esm({
  "features/keystone/models/Service.ts"() {
    "use strict";
    import_core15 = require("@keystone-6/core");
    import_fields16 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    init_waiverEvidence();
    formatCurrency = (cents2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents2 || 0) / 100);
    Service = (0, import_core15.list)({
      hooks: {
        validate: {
          create: async (args) => {
            validateWaiverTemplate(args);
            validateDeposit(args);
            await validateShopRelationships(args, [
              { field: "category", delegate: "serviceCategory" },
              { field: "specialists", delegate: "barber", many: true }
            ]);
          },
          update: async (args) => {
            validateWaiverTemplate(args);
            validateDeposit(args);
            await validateShopRelationships(args, [
              { field: "category", delegate: "serviceCategory" },
              { field: "specialists", delegate: "barber", many: true }
            ]);
          }
        }
      },
      access: {
        operation: {
          query: permissions.canReadServices,
          create: permissions.canManageServices,
          update: permissions.canManageServices,
          delete: permissions.canManageServices
        },
        filter: {
          query: rules.canAccessShopRecords,
          update: rules.canAccessShopRecords,
          delete: rules.canAccessShopRecords
        }
      },
      ui: {
        listView: {
          initialColumns: ["name", "category", "price", "durationMinutes", "status"]
        }
      },
      fields: {
        shop: (0, import_fields16.relationship)({ ref: "Shop.services", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields16.text)({ validation: { isRequired: true } }),
        description: (0, import_fields16.text)({ ui: { displayMode: "textarea" } }),
        imagePath: (0, import_fields16.text)({ ui: { description: "Relative public image path, e.g. /images/barbershop/service-classic-cut.svg." } }),
        image: (0, import_fields16.image)({ storage: "my_images" }),
        durationMinutes: (0, import_fields16.integer)({ validation: { isRequired: true, min: 5 }, defaultValue: 30 }),
        price: (0, import_fields16.integer)({ validation: { isRequired: true, min: 0 }, ui: { description: "Base price in cents." } }),
        depositRequired: (0, import_fields16.checkbox)({ defaultValue: false }),
        depositAmount: (0, import_fields16.integer)({ defaultValue: 0, validation: { min: 0 }, ui: { description: "Deposit amount in cents." } }),
        credentialRequired: (0, import_fields16.checkbox)({ defaultValue: false, ui: { description: "Only book, seat and complete this service with a barber who holds an active practitioner credential for it." } }),
        waiverRequired: (0, import_fields16.checkbox)({ defaultValue: false, ui: { description: "Fail-closed: public booking/start requires a complete immutable waiver template and signer evidence." } }),
        waiverTemplateKey: (0, import_fields16.text)({ ui: { description: "Stable merchant-controlled waiver template key." } }),
        waiverTemplateVersion: (0, import_fields16.text)({ ui: { description: "Immutable displayed template version." } }),
        waiverTemplateText: (0, import_fields16.text)({ ui: { displayMode: "textarea", description: "Exact text presented to the signer." } }),
        waiverTemplateHash: (0, import_fields16.text)({ ui: { description: "SHA-256 digest of the exact waiver text." } }),
        status: (0, import_fields16.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Hidden", value: "hidden" },
            { label: "Archived", value: "archived" }
          ],
          defaultValue: "active"
        }),
        bookingBufferMinutes: (0, import_fields16.integer)({ defaultValue: 10, validation: { min: 0, max: 240 } }),
        color: (0, import_fields16.text)({ defaultValue: "#111827", ui: { description: "Calendar color for this service." } }),
        category: (0, import_fields16.relationship)({ ref: "ServiceCategory.services" }),
        specialists: (0, import_fields16.relationship)({ ref: "Barber.specialties", many: true }),
        practitionerCredentials: (0, import_fields16.relationship)({ ref: "PractitionerCredential.service", many: true }),
        appointments: (0, import_fields16.relationship)({
          ref: "Appointment.service",
          many: true,
          access: { create: () => false, update: () => false }
        }),
        appointmentLineItems: (0, import_fields16.relationship)({
          ref: "AppointmentLineItem.service",
          many: true,
          access: { create: () => false, update: () => false }
        }),
        packageItems: (0, import_fields16.relationship)({ ref: "ServicePackageItem.service", many: true }),
        formattedPrice: (0, import_fields16.virtual)({
          field: import_core15.graphql.field({
            type: import_core15.graphql.String,
            resolve(item) {
              return formatCurrency(item.price);
            }
          })
        }),
        displayLabel: (0, import_fields16.virtual)({
          field: import_core15.graphql.field({
            type: import_core15.graphql.String,
            resolve(item) {
              return `${item.name} \xB7 ${item.durationMinutes} min \xB7 ${formatCurrency(item.price)}`;
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/childRecordValidation.ts
async function validateOwnedParents(args, parents) {
  const shops = [];
  for (const { field, delegate } of parents) {
    const id = args.resolvedData[field] === void 0 ? String(args.item?.[`${field}Id`] || "") : connectedRelationshipId(args.resolvedData[field]);
    if (!id) {
      args.addValidationError(`${field} is required.`);
      continue;
    }
    const parent = await args.context.prisma[delegate].findUnique({ where: { id }, select: { id: true, shopId: true } });
    if (!parent?.shopId) {
      args.addValidationError(`${field} is unavailable.`);
      continue;
    }
    shops.push(parent.shopId);
    if (args.context.session && !activeShopIds(args.context.session).includes(parent.shopId)) args.addValidationError("Not authorized to change this shop record.");
  }
  if (new Set(shops).size > 1) args.addValidationError("Related records must belong to the same shop.");
}
function scheduleWindowError(data) {
  for (const key of ["startMinute", "endMinute", "breakStartMinute", "breakEndMinute"]) {
    const value = data[key];
    if (value != null && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 1440)) return "Schedule minutes must be integers between 0 and 1440.";
  }
  if (!data.isWorking) return null;
  const start = Number(data.startMinute);
  const end = Number(data.endMinute);
  if (!(start < end)) return "A working schedule must end after it starts on the same shop day.";
  const a = data.breakStartMinute;
  const b = data.breakEndMinute;
  if (a == null !== (b == null)) return "Set both break times or neither.";
  if (a != null && b != null && !(Number(a) >= start && Number(a) < Number(b) && Number(b) <= end)) return "The break must fall inside the working window.";
  return null;
}
async function upcomingBarberAppointments(prisma, barberId) {
  const client = prisma;
  const [barber, appointments] = await Promise.all([
    client.barber.findUnique({ where: { id: barberId }, select: { shop: { select: { timezone: true } } } }),
    client.appointment.findMany({
      where: { barberId, status: { in: UPCOMING_APPOINTMENT_STATUSES }, OR: [{ startsAt: { gte: /* @__PURE__ */ new Date() } }, { status: "in_chair" }] },
      select: { startsAt: true, endsAt: true },
      take: 1e3
    })
  ]);
  return { timeZone: barber?.shop?.timezone || "America/New_York", appointments };
}
function shopWeekdayAndMinute(value, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value).map((part) => [part.type, part.value]));
  return { weekday: String(parts.weekday).toLowerCase(), minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
async function scheduleStrandsAppointments(args, data, removing) {
  const barberId = args.resolvedData.barber === void 0 ? String(args.item?.barberId || "") : connectedRelationshipId(args.resolvedData.barber);
  const dayOfWeek = String(data.dayOfWeek || "");
  if (!barberId || !dayOfWeek) return 0;
  const { timeZone, appointments } = await upcomingBarberAppointments(args.context.prisma, barberId);
  return appointments.filter((appointment) => {
    const start = shopWeekdayAndMinute(appointment.startsAt, timeZone);
    if (start.weekday !== dayOfWeek) return false;
    if (removing || !data.isWorking) return true;
    const endMinute = appointment.endsAt ? start.minute + Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 6e4) : start.minute;
    if (start.minute < Number(data.startMinute) || endMinute > Number(data.endMinute)) return true;
    const a = data.breakStartMinute;
    const b = data.breakEndMinute;
    return a != null && b != null && start.minute < Number(b) && endMinute > Number(a);
  }).length;
}
async function validateSchedule(args) {
  if (args.operation === "delete") {
    const stranded = await scheduleStrandsAppointments(args, { ...args.item }, true);
    if (stranded) args.addValidationError(`${stranded} upcoming appointment(s) rely on this working day. Reschedule or cancel them before removing it.`);
    return;
  }
  await validateOwnedParents(args, [{ field: "barber", delegate: "barber" }]);
  const data = { ...args.item, ...args.resolvedData };
  const error = scheduleWindowError(data);
  if (error) {
    args.addValidationError(error);
    return;
  }
  if (args.item) {
    const stranded = await scheduleStrandsAppointments(args, data, false);
    if (stranded) args.addValidationError(`${stranded} upcoming appointment(s) fall outside these hours. Reschedule or cancel them before changing this day.`);
  }
}
function validatePackageItem(args) {
  return validateOwnedParents(args, [{ field: "package", delegate: "servicePackage" }, { field: "service", delegate: "service" }]);
}
var UPCOMING_APPOINTMENT_STATUSES;
var init_childRecordValidation = __esm({
  "features/keystone/utils/childRecordValidation.ts"() {
    "use strict";
    init_access();
    init_shopRelationshipHooks();
    UPCOMING_APPOINTMENT_STATUSES = ["requested", "confirmed", "checked_in", "in_chair"];
  }
});

// features/keystone/models/Barber.ts
var import_core16, import_fields17, Barber;
var init_Barber = __esm({
  "features/keystone/models/Barber.ts"() {
    "use strict";
    import_core16 = require("@keystone-6/core");
    import_fields17 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    init_shopRelationshipHooks();
    init_childRecordValidation();
    Barber = (0, import_core16.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "chair", delegate: "barberChair" },
            { field: "specialties", delegate: "service", many: true }
          ]),
          update: async (args) => {
            await validateShopRelationships(args, [
              { field: "chair", delegate: "barberChair" },
              { field: "specialties", delegate: "service", many: true }
            ]);
            const chairChanged = args.resolvedData.chair !== void 0 && (connectedRelationshipId(args.resolvedData.chair) ?? null) !== (args.item.chairId ?? null);
            const leavesService = args.resolvedData.status !== void 0 && args.resolvedData.status !== "active" || args.resolvedData.bufferMinutes !== void 0 && Number(args.resolvedData.bufferMinutes) > Number(args.item.bufferMinutes ?? 0);
            if (chairChanged || leavesService) {
              const { appointments } = await upcomingBarberAppointments(args.context.prisma, String(args.item.id));
              if (appointments.length) args.addValidationError(`${appointments.length} upcoming appointment(s) are booked with this barber. Reassign, reschedule or cancel them before changing chair, status or buffer.`);
            }
          }
        }
      },
      access: {
        operation: {
          query: permissions.canReadStaff,
          create: permissions.canManageStaff,
          update: permissions.canManageStaff,
          delete: permissions.canManageStaff
        },
        filter: {
          query: rules.canAccessShopRecords,
          update: rules.canAccessShopRecords,
          delete: rules.canAccessShopRecords
        }
      },
      ui: {
        listView: {
          initialColumns: ["displayName", "chairNumber", "status", "bookingEnabled", "appointments"]
        }
      },
      fields: {
        shop: (0, import_fields17.relationship)({ ref: "Shop.barbers", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        chair: (0, import_fields17.relationship)({ ref: "BarberChair.assignedBarbers" }),
        displayName: (0, import_fields17.text)({ validation: { isRequired: true } }),
        legalName: (0, import_fields17.text)(),
        bio: (0, import_fields17.text)({ ui: { displayMode: "textarea" } }),
        imagePath: (0, import_fields17.text)({ ui: { description: "Relative public portrait path, e.g. /images/barbershop/barber-maya-brooks.svg." } }),
        photo: (0, import_fields17.image)({ storage: "my_images" }),
        phone: (0, import_fields17.text)(),
        email: (0, import_fields17.text)(),
        chairNumber: (0, import_fields17.text)({ ui: { description: "Chair or station shown on the shop floor." } }),
        status: (0, import_fields17.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Away", value: "away" },
            { label: "Inactive", value: "inactive" }
          ],
          defaultValue: "active"
        }),
        bookingEnabled: (0, import_fields17.checkbox)({ defaultValue: true }),
        bufferMinutes: (0, import_fields17.integer)({ defaultValue: 10, validation: { min: 0, max: 240 }, ui: { description: "Default cleanup/buffer after appointments." } }),
        serviceCommissionRateBps: (0, import_fields17.integer)({
          defaultValue: 0,
          validation: { min: 0, max: 1e4 },
          ui: { description: "Service commission in basis points (4500 = 45%)." }
        }),
        user: (0, import_fields17.relationship)({ ref: "User.barberProfile" }),
        specialties: (0, import_fields17.relationship)({ ref: "Service.specialists", many: true }),
        credentials: (0, import_fields17.relationship)({ ref: "PractitionerCredential.barber", many: true, access: { create: () => false, update: () => false } }),
        supervisedCredentials: (0, import_fields17.relationship)({ ref: "PractitionerCredential.supervisor", many: true, access: { create: () => false, update: () => false } }),
        schedules: (0, import_fields17.relationship)({ ref: "BarberSchedule.barber", many: true, access: { create: () => false, update: () => false } }),
        scheduleExceptions: (0, import_fields17.relationship)({ ref: "ScheduleException.barber", many: true, access: { create: () => false, update: () => false } }),
        shifts: (0, import_fields17.relationship)({ ref: "StaffShift.barber", many: true, access: { create: () => false, update: () => false } }),
        appointments: (0, import_fields17.relationship)({ ref: "Appointment.barber", many: true, access: { create: () => false, update: () => false } }),
        commissions: (0, import_fields17.relationship)({ ref: "Commission.barber", many: true, access: { create: () => false, update: () => false } }),
        queueEntries: (0, import_fields17.relationship)({ ref: "WalkInQueueEntry.requestedBarber", many: true, access: { create: () => false, update: () => false } }),
        label: (0, import_fields17.virtual)({
          field: import_core16.graphql.field({
            type: import_core16.graphql.String,
            resolve(item) {
              const displayName = typeof item.displayName === "string" ? item.displayName : "Barber";
              return item.chairNumber ? `${displayName} \xB7 Chair ${item.chairNumber}` : displayName;
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/BarberSchedule.ts
var import_core17, import_fields18, currentScheduleAccess, currentScheduleFilter, minutesToTime, BarberSchedule;
var init_BarberSchedule = __esm({
  "features/keystone/models/BarberSchedule.ts"() {
    "use strict";
    import_core17 = require("@keystone-6/core");
    import_fields18 = require("@keystone-6/core/fields");
    init_currentAuthorization();
    init_childRecordValidation();
    init_trackingFields();
    currentScheduleAccess = async ({ session }) => Boolean(await currentShopForPermission(session, "canManageSchedules"));
    currentScheduleFilter = async (session) => {
      const shopId = await currentShopForPermission(session, "canManageSchedules");
      return shopId ? { barber: { shop: { id: { equals: shopId } } } } : false;
    };
    minutesToTime = (minutes) => {
      const value = minutes ?? 0;
      const hours = Math.floor(value / 60).toString().padStart(2, "0");
      const mins = (value % 60).toString().padStart(2, "0");
      return `${hours}:${mins}`;
    };
    BarberSchedule = (0, import_core17.list)({
      db: { extendPrismaSchema: (schema) => schema.replace(/\n}$/, "\n  @@unique([barberId, dayOfWeek])\n}") },
      hooks: { validate: { create: validateSchedule, update: validateSchedule, delete: (args) => validateSchedule({ ...args, resolvedData: {}, operation: "delete" }) } },
      access: {
        operation: {
          query: currentScheduleAccess,
          create: currentScheduleAccess,
          update: currentScheduleAccess,
          delete: currentScheduleAccess
        },
        filter: {
          query: ({ session }) => currentScheduleFilter(session),
          update: ({ session }) => currentScheduleFilter(session),
          delete: ({ session }) => currentScheduleFilter(session)
        }
      },
      ui: {
        listView: {
          initialColumns: ["barber", "dayOfWeek", "startMinute", "endMinute", "isWorking"]
        }
      },
      fields: {
        barber: (0, import_fields18.relationship)({ ref: "Barber.schedules", many: false, access: { update: () => false } }),
        dayOfWeek: (0, import_fields18.select)({
          type: "enum",
          options: [
            { label: "Monday", value: "monday" },
            { label: "Tuesday", value: "tuesday" },
            { label: "Wednesday", value: "wednesday" },
            { label: "Thursday", value: "thursday" },
            { label: "Friday", value: "friday" },
            { label: "Saturday", value: "saturday" },
            { label: "Sunday", value: "sunday" }
          ],
          validation: { isRequired: true }
        }),
        isWorking: (0, import_fields18.checkbox)({ defaultValue: true }),
        startMinute: (0, import_fields18.integer)({ defaultValue: 540, validation: { min: 0, max: 1440 }, ui: { description: "Minutes after midnight. 540 = 9:00 AM." } }),
        endMinute: (0, import_fields18.integer)({ defaultValue: 1020, validation: { min: 0, max: 1440 }, ui: { description: "Minutes after midnight. 1020 = 5:00 PM." } }),
        breakStartMinute: (0, import_fields18.integer)({ ui: { description: "Optional break start in minutes after midnight." } }),
        breakEndMinute: (0, import_fields18.integer)({ ui: { description: "Optional break end in minutes after midnight." } }),
        notes: (0, import_fields18.text)({ ui: { displayMode: "textarea" } }),
        displayWindow: (0, import_fields18.virtual)({
          field: import_core17.graphql.field({
            type: import_core17.graphql.String,
            resolve(item) {
              if (!item.isWorking) return "Off";
              return `${minutesToTime(item.startMinute)}\u2013${minutesToTime(item.endMinute)}`;
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Customer.ts
var import_core18, import_fields19, currentCustomerAccess, currentCustomerFilter, Customer;
var init_Customer = __esm({
  "features/keystone/models/Customer.ts"() {
    "use strict";
    import_core18 = require("@keystone-6/core");
    import_fields19 = require("@keystone-6/core/fields");
    init_currentAuthorization();
    init_trackingFields();
    init_shopRelationshipHooks();
    currentCustomerAccess = async ({ session }) => Boolean(await currentShopForPermission(session, "canManageCustomers"));
    currentCustomerFilter = async (session) => {
      const shopId = await currentShopForPermission(session, "canManageCustomers");
      return shopId ? { shop: { id: { equals: shopId } } } : false;
    };
    Customer = (0, import_core18.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [{ field: "preferredBarber", delegate: "barber" }]),
          update: (args) => validateShopRelationships(args, [{ field: "preferredBarber", delegate: "barber" }])
        }
      },
      access: {
        operation: {
          query: currentCustomerAccess,
          create: currentCustomerAccess,
          update: currentCustomerAccess,
          delete: currentCustomerAccess
        },
        filter: {
          query: ({ session }) => currentCustomerFilter(session),
          update: ({ session }) => currentCustomerFilter(session),
          delete: ({ session }) => currentCustomerFilter(session)
        }
      },
      ui: {
        labelField: "fullName",
        listView: {
          initialColumns: ["fullName", "phone", "email", "status", "appointments"]
        }
      },
      fields: {
        shop: (0, import_fields19.relationship)({ ref: "Shop.customers", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        firstName: (0, import_fields19.text)({ validation: { isRequired: true } }),
        lastName: (0, import_fields19.text)(),
        phone: (0, import_fields19.text)({ validation: { isRequired: true } }),
        email: (0, import_fields19.text)(),
        status: (0, import_fields19.select)({
          access: { update: () => false },
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "VIP", value: "vip" },
            { label: "Needs Attention", value: "needs_attention" },
            { label: "Blocked", value: "blocked" }
          ],
          defaultValue: "active"
        }),
        preferredContactMethod: (0, import_fields19.select)({
          access: { update: () => false },
          type: "enum",
          options: [
            { label: "SMS", value: "sms" },
            { label: "Email", value: "email" },
            { label: "Phone", value: "phone" }
          ],
          defaultValue: "sms"
        }),
        // Only the marketing-preference command writes this, with recorded provenance.
        acceptsMarketing: (0, import_fields19.checkbox)({ defaultValue: false, access: { create: () => false, update: () => false } }),
        birthday: (0, import_fields19.timestamp)(),
        lastVisitAt: (0, import_fields19.timestamp)(),
        user: (0, import_fields19.relationship)({ ref: "User.customerProfile", access: { create: () => false, update: () => false } }),
        preferredBarber: (0, import_fields19.relationship)({ ref: "Barber" }),
        appointments: (0, import_fields19.relationship)({ ref: "Appointment.customer", many: true, access: { create: () => false, update: () => false } }),
        notes: (0, import_fields19.relationship)({ ref: "CustomerNote.customer", many: true }),
        packageBalances: (0, import_fields19.relationship)({ ref: "CustomerPackage.customer", many: true, access: { create: () => false, update: () => false } }),
        membershipEvents: (0, import_fields19.relationship)({ ref: "MembershipEvent.customer", many: true, access: { create: () => false, update: () => false } }),
        transactions: (0, import_fields19.relationship)({ ref: "CheckoutTransaction.customer", many: true, access: { create: () => false, update: () => false } }),
        fullName: (0, import_fields19.virtual)({
          field: import_core18.graphql.field({
            type: import_core18.graphql.String,
            resolve(item) {
              return [item.firstName, item.lastName].filter(Boolean).join(" ");
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CustomerNote.ts
var import_core19, import_fields20, CustomerNote;
var init_CustomerNote = __esm({
  "features/keystone/models/CustomerNote.ts"() {
    "use strict";
    import_core19 = require("@keystone-6/core");
    import_fields20 = require("@keystone-6/core/fields");
    init_access();
    init_shopRelationshipHooks();
    init_trackingFields();
    CustomerNote = (0, import_core19.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "customer", delegate: "customer" },
            { field: "appointment", delegate: "appointment" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "customer", delegate: "customer" },
            { field: "appointment", delegate: "appointment" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canReadCustomerNotes,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canReadCustomerNotes }
      },
      ui: {
        listView: {
          initialColumns: ["customer", "noteType", "visibility", "createdAt"]
        }
      },
      fields: {
        shop: (0, import_fields20.relationship)({ ref: "Shop.customerNotes", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        customer: (0, import_fields20.relationship)({ ref: "Customer.notes" }),
        noteType: (0, import_fields20.select)({
          type: "enum",
          options: [
            { label: "Preference", value: "preference" },
            { label: "Formula / Cut Detail", value: "formula" },
            { label: "Service Issue", value: "service_issue" },
            { label: "General", value: "general" }
          ],
          defaultValue: "general"
        }),
        body: (0, import_fields20.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
        visibility: (0, import_fields20.select)({
          type: "enum",
          options: [
            { label: "Staff", value: "staff" },
            { label: "Owner Only", value: "owner" }
          ],
          defaultValue: "staff"
        }),
        appointment: (0, import_fields20.relationship)({ ref: "Appointment" }),
        createdBy: (0, import_fields20.relationship)({ ref: "User" }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Appointment.ts
var import_core20, import_fields21, Appointment;
var init_Appointment = __esm({
  "features/keystone/models/Appointment.ts"() {
    "use strict";
    import_core20 = require("@keystone-6/core");
    import_fields21 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_settledEvidence();
    init_shopRelationshipHooks();
    Appointment = (0, import_core20.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "chair", delegate: "barberChair" },
            { field: "customer", delegate: "customer" },
            { field: "barber", delegate: "barber" },
            { field: "service", delegate: "service" },
            { field: "queueEntry", delegate: "walkInQueueEntry" }
          ]),
          update: async (args) => {
            const error = settledAppointmentMutationError(args.item, args.resolvedData, "update");
            if (error) args.addValidationError(error);
            await validateShopRelationships(args, [
              { field: "chair", delegate: "barberChair" },
              { field: "customer", delegate: "customer" },
              { field: "barber", delegate: "barber" },
              { field: "service", delegate: "service" },
              { field: "queueEntry", delegate: "walkInQueueEntry" }
            ]);
          },
          delete: ({ item, addValidationError }) => {
            const error = settledAppointmentMutationError(item, {}, "delete");
            if (error) addValidationError(error);
          }
        }
      },
      access: {
        operation: {
          query: permissions.canReadAppointments,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        labelField: "displaySummary",
        listView: {
          initialColumns: ["customer", "service", "barber", "startsAt", "status", "paymentStatus"]
        }
      },
      fields: {
        shop: (0, import_fields21.relationship)({ ref: "Shop.appointments", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        account: (0, import_fields21.relationship)({ ref: "User.bookings", access: { create: () => false, update: () => false }, db: { foreignKey: true } }),
        chair: (0, import_fields21.relationship)({ ref: "BarberChair.appointments", access: { update: () => false } }),
        customer: (0, import_fields21.relationship)({ ref: "Customer.appointments" }),
        barber: (0, import_fields21.relationship)({ ref: "Barber.appointments" }),
        service: (0, import_fields21.relationship)({ ref: "Service.appointments" }),
        startsAt: (0, import_fields21.timestamp)({ validation: { isRequired: true } }),
        endsAt: (0, import_fields21.timestamp)(),
        durationMinutes: (0, import_fields21.integer)({ defaultValue: 30 }),
        serviceTitleSnapshot: (0, import_fields21.text)({
          access: { update: () => false },
          ui: { description: "Immutable service title captured when the booking is created." }
        }),
        serviceImagePathSnapshot: (0, import_fields21.text)({
          access: { update: () => false },
          ui: { description: "Immutable relative service imagePath captured when the booking is created." }
        }),
        serviceModifiersSnapshot: (0, import_fields21.json)({
          defaultValue: [],
          access: { update: () => false },
          ui: { description: "Immutable service options captured when the booking is created." }
        }),
        barberNameSnapshot: (0, import_fields21.text)({
          access: { update: () => false },
          ui: { description: "Immutable barber display name captured when the booking is created." }
        }),
        barberChairNumberSnapshot: (0, import_fields21.text)({
          access: { update: () => false },
          ui: { description: "Immutable barber chair captured when the booking is created." }
        }),
        bookingAuthoritySnapshot: (0, import_fields21.json)({ access: { update: () => false }, ui: { description: "Credential, jurisdiction, service scope, and evidence captured at booking/assignment." } }),
        executionAuthoritySnapshot: (0, import_fields21.json)({ access: { update: () => false }, ui: { description: "Credential authority revalidated when service enters the chair." } }),
        bookingPolicySnapshot: (0, import_fields21.json)({ access: { update: () => false }, ui: { description: "Effective cancellation/reschedule terms captured at booking." } }),
        waiverRequirementSnapshot: (0, import_fields21.json)({ access: { update: () => false }, ui: { description: "Exact waiver template key/version/hash required for this occurrence." } }),
        serviceStartedAt: (0, import_fields21.timestamp)({ access: { update: () => false } }),
        serviceCompletedAt: (0, import_fields21.timestamp)({ access: { update: () => false } }),
        customerRescheduleCount: (0, import_fields21.integer)({ defaultValue: 0, access: { update: () => false } }),
        status: (0, import_fields21.select)({
          type: "enum",
          options: [
            { label: "Requested", value: "requested" },
            { label: "Confirmed", value: "confirmed" },
            { label: "Checked In", value: "checked_in" },
            { label: "In Chair", value: "in_chair" },
            { label: "Completed", value: "completed" },
            { label: "Cancelled", value: "cancelled" },
            { label: "No-show", value: "no_show" }
          ],
          defaultValue: "requested"
        }),
        source: (0, import_fields21.select)({
          type: "enum",
          options: [
            { label: "Online", value: "online" },
            { label: "Phone", value: "phone" },
            { label: "Walk-in", value: "walk_in" },
            { label: "Staff", value: "staff" }
          ],
          defaultValue: "online"
        }),
        paymentStatus: (0, import_fields21.select)({
          access: { update: () => false },
          type: "enum",
          options: [
            { label: "Not Required", value: "not_required" },
            { label: "Deposit Due", value: "deposit_due" },
            { label: "Deposit Paid", value: "deposit_paid" },
            { label: "Paid", value: "paid" },
            { label: "Refunded", value: "refunded" }
          ],
          defaultValue: "not_required"
        }),
        price: (0, import_fields21.integer)({ ui: { description: "Final service price in cents." } }),
        depositAmount: (0, import_fields21.integer)({ defaultValue: 0 }),
        cancellationReason: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
        customerNotes: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
        guestNameSnapshot: (0, import_fields21.text)({ access: { create: () => false, update: () => false }, ui: { description: "Unverified contact name supplied for this occurrence, not proof of customer identity." } }),
        internalNotes: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
        publicAccessTokenHash: (0, import_fields21.text)({
          access: { read: () => false, create: permissions.canManageAppointments, update: permissions.canManageAppointments },
          ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
        }),
        queueEntry: (0, import_fields21.relationship)({ ref: "WalkInQueueEntry.appointment" }),
        transaction: (0, import_fields21.relationship)({
          ref: "CheckoutTransaction.appointments",
          access: { create: () => false, update: () => false }
        }),
        lineItems: (0, import_fields21.relationship)({ ref: "AppointmentLineItem.appointment", many: true }),
        paymentSessions: (0, import_fields21.relationship)({ ref: "PaymentSession.appointment", many: true }),
        noShowEvents: (0, import_fields21.relationship)({ ref: "NoShowEvent.appointment", many: true }),
        changeEvents: (0, import_fields21.relationship)({ ref: "AppointmentChangeEvent.appointment", many: true }),
        packageUsages: (0, import_fields21.relationship)({ ref: "PackageUsage.appointment", many: true }),
        displaySummary: (0, import_fields21.virtual)({
          field: import_core20.graphql.field({
            type: import_core20.graphql.String,
            async resolve(item, args, context) {
              const appointment = await context.query.Appointment.findOne({
                where: { id: String(item.id) },
                query: "customer { firstName lastName } service { name } barber { displayName }"
              });
              const customer = appointment?.customer ? [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" ") : "Guest";
              return `${customer} \xB7 ${appointment?.service?.name || "Service"} \xB7 ${appointment?.barber?.displayName || "Any barber"}`;
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/GuestBookingCommand.ts
var import_core21, import_fields22, deny, sealed, rejectCrud, GuestBookingCommand;
var init_GuestBookingCommand = __esm({
  "features/keystone/models/GuestBookingCommand.ts"() {
    "use strict";
    import_core21 = require("@keystone-6/core");
    import_fields22 = require("@keystone-6/core/fields");
    init_trackingFields();
    deny = () => false;
    sealed = { read: deny, create: deny, update: deny };
    rejectCrud = ({ addValidationError }) => addValidationError("Guest booking evidence is command-owned.");
    GuestBookingCommand = (0, import_core21.list)({
      access: { operation: { query: deny, create: deny, update: deny, delete: deny } },
      hooks: { validate: { create: rejectCrud, update: rejectCrud, delete: rejectCrud } },
      ui: { isHidden: true },
      fields: {
        requestKey: (0, import_fields22.text)({ isIndexed: "unique", validation: { isRequired: true }, access: sealed }),
        purpose: (0, import_fields22.text)({ validation: { isRequired: true }, access: sealed }),
        actor: (0, import_fields22.text)({ validation: { isRequired: true }, access: sealed }),
        payloadHash: (0, import_fields22.text)({ validation: { isRequired: true }, access: sealed }),
        proofHash: (0, import_fields22.text)({ validation: { isRequired: true }, access: sealed }),
        shop: (0, import_fields22.relationship)({ ref: "Shop", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: sealed }),
        appointment: (0, import_fields22.relationship)({ ref: "Appointment", db: { foreignKey: true }, access: sealed }),
        receipt: (0, import_fields22.json)({ access: sealed }),
        expiresAt: (0, import_fields22.timestamp)({ access: sealed }),
        revokedAt: (0, import_fields22.timestamp)({ access: sealed }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/AppointmentLineItem.ts
var import_core22, import_fields23, immutableAfterCreate, AppointmentLineItem;
var init_AppointmentLineItem = __esm({
  "features/keystone/models/AppointmentLineItem.ts"() {
    "use strict";
    import_core22 = require("@keystone-6/core");
    import_fields23 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    immutableAfterCreate = {
      create: () => false,
      update: () => false
    };
    AppointmentLineItem = (0, import_core22.list)({
      hooks: {
        validate: {
          update: ({ addValidationError }) => {
            addValidationError("Appointment line item snapshots are immutable after checkout.");
          },
          delete: ({ addValidationError }) => {
            addValidationError("Appointment line item snapshots cannot be deleted.");
          }
        }
      },
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessTransactionShopRecords }
      },
      ui: {
        isHidden: true,
        listView: {
          initialColumns: ["title", "price", "durationMinutes", "appointment", "transaction"]
        }
      },
      fields: {
        appointment: (0, import_fields23.relationship)({
          ref: "Appointment.lineItems",
          access: immutableAfterCreate
        }),
        transaction: (0, import_fields23.relationship)({
          ref: "CheckoutTransaction.lineItems",
          access: immutableAfterCreate
        }),
        service: (0, import_fields23.relationship)({
          ref: "Service.appointmentLineItems",
          access: immutableAfterCreate,
          ui: { description: "Optional source reference. Receipt fields below are immutable snapshots." }
        }),
        title: (0, import_fields23.text)({
          validation: { isRequired: true },
          access: immutableAfterCreate,
          ui: { description: "Service title captured at checkout." }
        }),
        price: (0, import_fields23.integer)({
          validation: { isRequired: true, min: 0 },
          access: immutableAfterCreate,
          ui: { description: "Service price in cents captured at checkout." }
        }),
        durationMinutes: (0, import_fields23.integer)({
          validation: { isRequired: true, min: 0 },
          access: immutableAfterCreate,
          ui: { description: "Service duration captured at checkout." }
        }),
        imagePath: (0, import_fields23.text)({
          access: immutableAfterCreate,
          ui: { description: "Relative /images/... service image path captured at checkout." }
        }),
        modifiers: (0, import_fields23.json)({
          defaultValue: [],
          access: immutableAfterCreate,
          ui: { description: "Immutable selected service modifiers/options captured at checkout." }
        }),
        barberName: (0, import_fields23.text)({
          access: immutableAfterCreate,
          ui: { description: "Barber display name captured at checkout." }
        }),
        barberChairNumber: (0, import_fields23.text)({
          access: immutableAfterCreate,
          ui: { description: "Chair number captured at checkout." }
        }),
        packageBalanceId: (0, import_fields23.text)({
          access: immutableAfterCreate,
          ui: { description: "Consumed package or membership balance ID captured at checkout." }
        }),
        packageName: (0, import_fields23.text)({
          access: immutableAfterCreate,
          ui: { description: "Consumed package or membership name captured at checkout." }
        }),
        packageVisitsConsumed: (0, import_fields23.integer)({
          defaultValue: 0,
          validation: { min: 0 },
          access: immutableAfterCreate
        }),
        formattedPrice: (0, import_fields23.virtual)({
          field: import_core22.graphql.field({
            type: import_core22.graphql.String,
            resolve(item) {
              return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                Number(item.price || 0) / 100
              );
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/WalkInQueueEntry.ts
var import_core23, import_fields24, WalkInQueueEntry;
var init_WalkInQueueEntry = __esm({
  "features/keystone/models/WalkInQueueEntry.ts"() {
    "use strict";
    import_core23 = require("@keystone-6/core");
    import_fields24 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    WalkInQueueEntry = (0, import_core23.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "requestedService", delegate: "service" },
            { field: "requestedBarber", delegate: "barber" },
            { field: "customer", delegate: "customer" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "requestedService", delegate: "service" },
            { field: "requestedBarber", delegate: "barber" },
            { field: "customer", delegate: "customer" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canReadQueue,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["customerName", "status", "requestedBarber", "quotedWaitMinutes", "checkedInAt"]
        }
      },
      fields: {
        shop: (0, import_fields24.relationship)({ ref: "Shop.queueEntries", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        customerName: (0, import_fields24.text)({ validation: { isRequired: true } }),
        phone: (0, import_fields24.text)(),
        partySize: (0, import_fields24.integer)({ defaultValue: 1 }),
        status: (0, import_fields24.select)({
          type: "enum",
          options: [
            { label: "Waiting", value: "waiting" },
            { label: "Texted", value: "texted" },
            { label: "In Chair", value: "in_chair" },
            { label: "Served", value: "served" },
            { label: "Left", value: "left" }
          ],
          defaultValue: "waiting"
        }),
        requestedService: (0, import_fields24.relationship)({ ref: "Service" }),
        requestedBarber: (0, import_fields24.relationship)({ ref: "Barber.queueEntries" }),
        // No invented estimate: empty until staff actually quote a wait.
        quotedWaitMinutes: (0, import_fields24.integer)({ validation: { min: 0 } }),
        checkedInAt: (0, import_fields24.timestamp)({ defaultValue: { kind: "now" } }),
        seatedAt: (0, import_fields24.timestamp)(),
        notes: (0, import_fields24.text)({ ui: { displayMode: "textarea" } }),
        publicAccessTokenHash: (0, import_fields24.text)({
          access: { read: () => false, create: permissions.canManageQueue, update: permissions.canManageQueue },
          ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
        }),
        appointment: (0, import_fields24.relationship)({ ref: "Appointment.queueEntry" }),
        customer: (0, import_fields24.relationship)({ ref: "Customer" }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/MembershipPlan.ts
var import_core24, import_fields25, MembershipPlan;
var init_MembershipPlan = __esm({
  "features/keystone/models/MembershipPlan.ts"() {
    "use strict";
    import_core24 = require("@keystone-6/core");
    import_fields25 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    MembershipPlan = (0, import_core24.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: (args) => validateShopRelationships(args, [])
        }
      },
      access: {
        operation: {
          query: permissions.canReadMemberships,
          create: permissions.canManageMemberships,
          update: permissions.canManageMemberships,
          delete: permissions.canManageMemberships
        },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["name", "billingInterval", "price", "includedVisits", "status"]
        }
      },
      fields: {
        shop: (0, import_fields25.relationship)({ ref: "Shop.membershipPlans", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields25.text)({ validation: { isRequired: true } }),
        description: (0, import_fields25.text)({ ui: { displayMode: "textarea" } }),
        price: (0, import_fields25.integer)({ validation: { isRequired: true, min: 0 }, ui: { description: "Recurring price in cents." } }),
        billingInterval: (0, import_fields25.select)({
          type: "enum",
          options: [
            { label: "Monthly", value: "monthly" },
            { label: "Quarterly", value: "quarterly" },
            { label: "Annual", value: "annual" }
          ],
          defaultValue: "monthly"
        }),
        includedVisits: (0, import_fields25.integer)({ defaultValue: 1, validation: { min: 0 } }),
        discountPercent: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0, max: 100 } }),
        status: (0, import_fields25.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Archived", value: "archived" }
          ],
          defaultValue: "active"
        }),
        members: (0, import_fields25.relationship)({ ref: "CustomerPackage.membershipPlan", many: true, access: { create: () => false, update: () => false } }),
        events: (0, import_fields25.relationship)({ ref: "MembershipEvent.membershipPlan", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ServicePackage.ts
var import_core25, import_fields26, ServicePackage;
var init_ServicePackage = __esm({
  "features/keystone/models/ServicePackage.ts"() {
    "use strict";
    import_core25 = require("@keystone-6/core");
    import_fields26 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    ServicePackage = (0, import_core25.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: (args) => validateShopRelationships(args, [])
        }
      },
      access: {
        operation: {
          query: permissions.canReadMemberships,
          create: permissions.canManageMemberships,
          update: permissions.canManageMemberships,
          delete: permissions.canManageMemberships
        },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["name", "price", "status", "items"]
        }
      },
      fields: {
        shop: (0, import_fields26.relationship)({ ref: "Shop.servicePackages", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields26.text)({ validation: { isRequired: true } }),
        description: (0, import_fields26.text)({ ui: { displayMode: "textarea" } }),
        price: (0, import_fields26.integer)({ validation: { isRequired: true, min: 0 }, ui: { description: "Package price in cents." } }),
        status: (0, import_fields26.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Hidden", value: "hidden" },
            { label: "Archived", value: "archived" }
          ],
          defaultValue: "active"
        }),
        items: (0, import_fields26.relationship)({ ref: "ServicePackageItem.package", many: true }),
        customerBalances: (0, import_fields26.relationship)({ ref: "CustomerPackage.servicePackage", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ServicePackageItem.ts
var import_core26, import_fields27, currentPackageItemAccess, currentPackageItemFilter, ServicePackageItem;
var init_ServicePackageItem = __esm({
  "features/keystone/models/ServicePackageItem.ts"() {
    "use strict";
    import_core26 = require("@keystone-6/core");
    import_fields27 = require("@keystone-6/core/fields");
    init_currentAuthorization();
    init_childRecordValidation();
    init_trackingFields();
    currentPackageItemAccess = async ({ session }) => Boolean(await currentShopForPermission(session, "canManageMemberships"));
    currentPackageItemFilter = async (session) => {
      const shopId = await currentShopForPermission(session, "canManageMemberships");
      return shopId ? { package: { shop: { id: { equals: shopId } } } } : false;
    };
    ServicePackageItem = (0, import_core26.list)({
      hooks: { validate: { create: validatePackageItem, update: validatePackageItem } },
      access: {
        operation: {
          query: currentPackageItemAccess,
          create: currentPackageItemAccess,
          update: currentPackageItemAccess,
          delete: currentPackageItemAccess
        },
        filter: {
          query: ({ session }) => currentPackageItemFilter(session),
          update: ({ session }) => currentPackageItemFilter(session),
          delete: ({ session }) => currentPackageItemFilter(session)
        }
      },
      ui: {
        listView: {
          initialColumns: ["package", "service", "quantity"]
        }
      },
      fields: {
        package: (0, import_fields27.relationship)({ ref: "ServicePackage.items", access: { update: () => false } }),
        service: (0, import_fields27.relationship)({ ref: "Service.packageItems", access: { update: () => false } }),
        quantity: (0, import_fields27.integer)({ defaultValue: 1, validation: { min: 1 } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CustomerPackage.ts
var import_core27, import_fields28, CustomerPackage;
var init_CustomerPackage = __esm({
  "features/keystone/models/CustomerPackage.ts"() {
    "use strict";
    import_core27 = require("@keystone-6/core");
    import_fields28 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    CustomerPackage = (0, import_core27.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "customer", delegate: "customer" },
            { field: "servicePackage", delegate: "servicePackage" },
            { field: "membershipPlan", delegate: "membershipPlan" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "customer", delegate: "customer" },
            { field: "servicePackage", delegate: "servicePackage" },
            { field: "membershipPlan", delegate: "membershipPlan" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canReadMemberships,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["customer", "servicePackage", "membershipPlan", "remainingVisits", "status"]
        }
      },
      fields: {
        shop: (0, import_fields28.relationship)({ ref: "Shop.customerPackages", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        customer: (0, import_fields28.relationship)({ ref: "Customer.packageBalances" }),
        servicePackage: (0, import_fields28.relationship)({ ref: "ServicePackage.customerBalances" }),
        membershipPlan: (0, import_fields28.relationship)({ ref: "MembershipPlan.members" }),
        remainingVisits: (0, import_fields28.integer)({ defaultValue: 0, access: { update: () => false } }),
        status: (0, import_fields28.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Used Up", value: "used_up" },
            { label: "Expired", value: "expired" },
            { label: "Cancelled", value: "cancelled" }
          ],
          defaultValue: "active"
        }),
        startsAt: (0, import_fields28.timestamp)({ defaultValue: { kind: "now" } }),
        expiresAt: (0, import_fields28.timestamp)(),
        nextBillingAt: (0, import_fields28.timestamp)(),
        pausedAt: (0, import_fields28.timestamp)(),
        cancelledAt: (0, import_fields28.timestamp)(),
        autoRenew: (0, import_fields28.checkbox)({ defaultValue: false }),
        lastUsedAt: (0, import_fields28.timestamp)(),
        transactions: (0, import_fields28.relationship)({ ref: "CheckoutTransaction.packageBalance", many: true }),
        membershipEvents: (0, import_fields28.relationship)({ ref: "MembershipEvent.customerPackage", many: true }),
        usageLedger: (0, import_fields28.relationship)({ ref: "PackageUsage.customerPackage", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CheckoutTransaction.ts
var import_core28, import_fields29, formatCurrency2, CheckoutTransaction;
var init_CheckoutTransaction = __esm({
  "features/keystone/models/CheckoutTransaction.ts"() {
    "use strict";
    import_core28 = require("@keystone-6/core");
    import_fields29 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    formatCurrency2 = (cents2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents2 || 0) / 100);
    CheckoutTransaction = (0, import_core28.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "customer", delegate: "customer" },
            { field: "barber", delegate: "barber" },
            { field: "paymentSession", delegate: "paymentSession" },
            { field: "packageBalance", delegate: "customerPackage" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "customer", delegate: "customer" },
            { field: "barber", delegate: "barber" },
            { field: "paymentSession", delegate: "paymentSession" },
            { field: "packageBalance", delegate: "customerPackage" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["customer", "status", "total", "paymentMethod", "completedAt"]
        }
      },
      fields: {
        shop: (0, import_fields29.relationship)({ ref: "Shop.transactions", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        customer: (0, import_fields29.relationship)({ ref: "Customer.transactions" }),
        barber: (0, import_fields29.relationship)({ ref: "Barber" }),
        appointments: (0, import_fields29.relationship)({ ref: "Appointment.transaction", many: true }),
        lineItems: (0, import_fields29.relationship)({ ref: "AppointmentLineItem.transaction", many: true }),
        productLines: (0, import_fields29.relationship)({ ref: "ProductSaleLine.transaction", many: true }),
        paymentSession: (0, import_fields29.relationship)({ ref: "PaymentSession.transaction" }),
        cashRefund: (0, import_fields29.relationship)({ ref: "CashRefund.transaction", access: { create: () => false, update: () => false } }),
        packageUsages: (0, import_fields29.relationship)({ ref: "PackageUsage.transaction", many: true }),
        membershipEvents: (0, import_fields29.relationship)({ ref: "MembershipEvent.transaction", many: true }),
        packageBalance: (0, import_fields29.relationship)({ ref: "CustomerPackage.transactions" }),
        status: (0, import_fields29.select)({
          type: "enum",
          options: [
            { label: "Open", value: "open" },
            { label: "Paid", value: "paid" },
            { label: "Partially Refunded", value: "partially_refunded" },
            { label: "Refunded", value: "refunded" },
            { label: "Voided", value: "voided" }
          ],
          defaultValue: "open"
        }),
        subtotal: (0, import_fields29.integer)({ defaultValue: 0 }),
        tipAmount: (0, import_fields29.integer)({ defaultValue: 0 }),
        taxAmount: (0, import_fields29.integer)({ defaultValue: 0 }),
        discountAmount: (0, import_fields29.integer)({ defaultValue: 0 }),
        total: (0, import_fields29.integer)({ defaultValue: 0 }),
        paymentMethod: (0, import_fields29.select)({
          type: "enum",
          options: [
            { label: "Cash", value: "cash" },
            { label: "Card", value: "card" },
            { label: "Package", value: "package" },
            { label: "Gift Card", value: "gift_card" },
            { label: "Other", value: "other" }
          ],
          defaultValue: "card"
        }),
        currencyCode: (0, import_fields29.text)({ defaultValue: "USD", access: { create: () => false, update: () => false } }),
        merchantSnapshot: (0, import_fields29.json)({ access: { create: () => false, update: () => false } }),
        taxRuleSnapshot: (0, import_fields29.json)({ access: { create: () => false, update: () => false } }),
        providerPaymentId: (0, import_fields29.text)(),
        completedAt: (0, import_fields29.timestamp)(),
        notes: (0, import_fields29.text)({ ui: { displayMode: "textarea" } }),
        formattedTotal: (0, import_fields29.virtual)({
          field: import_core28.graphql.field({
            type: import_core28.graphql.String,
            resolve(item) {
              return formatCurrency2(item.total);
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PaymentProvider.ts
async function rejectAdapterChangeWithOpenSessions(args) {
  const changesAdapter = ADAPTER_IDENTITY_FIELDS.some(
    (field) => field in args.resolvedData && args.resolvedData[field] !== args.item?.[field]
  );
  if (!changesAdapter || typeof args.item?.id !== "string") return;
  const openSessions = await args.context.prisma.paymentSession.count({
    where: { paymentProviderId: args.item.id, status: { in: ["pending", "authorized", "captured", "partially_refunded"] } }
  });
  if (openSessions > 0) {
    args.addValidationError("This provider has open payment sessions. Close or reconcile them before changing its code or adapters.");
  }
}
var import_core29, import_access30, import_fields30, adapterDescription, ADAPTER_IDENTITY_FIELDS, PaymentProvider;
var init_PaymentProvider = __esm({
  "features/keystone/models/PaymentProvider.ts"() {
    "use strict";
    import_core29 = require("@keystone-6/core");
    import_access30 = require("@keystone-6/core/access");
    import_fields30 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    adapterDescription = "Name of the payment adapter module to use for this operation";
    ADAPTER_IDENTITY_FIELDS = [
      "code",
      "createPaymentFunction",
      "capturePaymentFunction",
      "refundPaymentFunction",
      "getPaymentStatusFunction",
      "generatePaymentLinkFunction",
      "handleWebhookFunction"
    ];
    PaymentProvider = (0, import_core29.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, []),
          update: async (args) => {
            await validateShopRelationships(args, []);
            await rejectAdapterChangeWithOpenSessions(args);
          }
        }
      },
      access: {
        operation: {
          query: ({ session }) => permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }),
          create: permissions.canManagePayments,
          update: permissions.canManagePayments,
          delete: permissions.canManagePayments
        },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords, delete: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["name", "code", "isInstalled"]
        }
      },
      fields: {
        shop: (0, import_fields30.relationship)({ ref: "Shop.paymentProviders", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields30.text)({
          validation: { isRequired: true }
        }),
        code: (0, import_fields30.text)({
          isIndexed: true,
          validation: {
            isRequired: true,
            match: {
              regex: /^pp_[a-zA-Z0-9-_]+$/,
              explanation: 'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores'
            }
          }
        }),
        isInstalled: (0, import_fields30.checkbox)({
          defaultValue: true
        }),
        credentials: (0, import_fields30.json)({
          defaultValue: {},
          access: {
            read: import_access30.denyAll,
            create: import_access30.denyAll,
            update: import_access30.denyAll
          },
          ui: {
            itemView: { fieldMode: "hidden" },
            createView: { fieldMode: "hidden" },
            listView: { fieldMode: "hidden" },
            description: "Provider-specific credentials or references. Values are write-only and never exposed through GraphQL."
          }
        }),
        metadata: (0, import_fields30.json)({
          defaultValue: {}
        }),
        createPaymentFunction: (0, import_fields30.text)({
          validation: { isRequired: true },
          defaultValue: "manual",
          ui: { description: adapterDescription }
        }),
        capturePaymentFunction: (0, import_fields30.text)({
          validation: { isRequired: true },
          defaultValue: "manual",
          ui: { description: adapterDescription }
        }),
        refundPaymentFunction: (0, import_fields30.text)({
          validation: { isRequired: true },
          defaultValue: "manual",
          ui: { description: adapterDescription }
        }),
        getPaymentStatusFunction: (0, import_fields30.text)({
          validation: { isRequired: true },
          defaultValue: "manual",
          ui: { description: adapterDescription }
        }),
        generatePaymentLinkFunction: (0, import_fields30.text)({
          validation: { isRequired: true },
          defaultValue: "manual",
          ui: { description: adapterDescription }
        }),
        paymentSessions: (0, import_fields30.relationship)({ ref: "PaymentSession.paymentProvider", many: true, access: { create: () => false, update: () => false } }),
        handleWebhookFunction: (0, import_fields30.text)({
          validation: { isRequired: true },
          defaultValue: "manual",
          ui: { description: adapterDescription }
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PaymentSession.ts
var import_core30, import_fields31, PaymentSession;
var init_PaymentSession = __esm({
  "features/keystone/models/PaymentSession.ts"() {
    "use strict";
    import_core30 = require("@keystone-6/core");
    import_fields31 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    PaymentSession = (0, import_core30.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "appointment", delegate: "appointment" },
            { field: "transaction", delegate: "checkoutTransaction" },
            { field: "paymentProvider", delegate: "paymentProvider" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "appointment", delegate: "appointment" },
            { field: "transaction", delegate: "checkoutTransaction" },
            { field: "paymentProvider", delegate: "paymentProvider" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        listView: {
          initialColumns: ["appointment", "status", "amountLabel", "currencyCode", "expiresAt"]
        }
      },
      fields: {
        shop: (0, import_fields31.relationship)({ ref: "Shop.paymentSessions", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        appointment: (0, import_fields31.relationship)({ ref: "Appointment.paymentSessions" }),
        transaction: (0, import_fields31.relationship)({ ref: "CheckoutTransaction.paymentSession" }),
        paymentProvider: (0, import_fields31.relationship)({ ref: "PaymentProvider.paymentSessions" }),
        reconciliations: (0, import_fields31.relationship)({ ref: "PaymentReconciliation.paymentSession", many: true }),
        idempotencyKeyHash: (0, import_fields31.text)({
          isIndexed: "unique",
          validation: { isRequired: true },
          access: { read: () => false, create: permissions.canManagePayments, update: () => false },
          ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
        }),
        status: (0, import_fields31.select)({
          type: "enum",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Authorized", value: "authorized" },
            { label: "Captured", value: "captured" },
            { label: "Failed", value: "failed" },
            { label: "Expired", value: "expired" },
            { label: "Cancelled", value: "cancelled" },
            { label: "Partially Refunded", value: "partially_refunded" },
            { label: "Refunded", value: "refunded" }
          ],
          defaultValue: "pending"
        }),
        amount: (0, import_fields31.integer)({ validation: { isRequired: true, min: 0 } }),
        amountLabel: (0, import_fields31.virtual)({
          field: import_core30.graphql.field({ type: import_core30.graphql.String, resolve: (item) => `$${(Number(item.amount || 0) / 100).toFixed(2)}` }),
          ui: { listView: { fieldMode: "read" } }
        }),
        currencyCode: (0, import_fields31.text)({ defaultValue: "USD", validation: { isRequired: true } }),
        providerPaymentId: (0, import_fields31.text)(),
        expiresAt: (0, import_fields31.timestamp)(),
        capturedAt: (0, import_fields31.timestamp)(),
        cancelledAt: (0, import_fields31.timestamp)(),
        refundedAmount: (0, import_fields31.integer)({ defaultValue: 0, validation: { min: 0 } }),
        metadata: (0, import_fields31.json)({ defaultValue: {} }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PaymentWebhookEvent.ts
var import_core31, import_fields32, PaymentWebhookEvent;
var init_PaymentWebhookEvent = __esm({
  "features/keystone/models/PaymentWebhookEvent.ts"() {
    "use strict";
    import_core31 = require("@keystone-6/core");
    import_fields32 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    PaymentWebhookEvent = (0, import_core31.list)({
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        // Inbox rows carry no shop ownership, so no shop operator may list them.
        // They are written and read only by the server-side webhook handler.
        filter: { query: () => false }
      },
      ui: {
        isHidden: true,
        listView: { initialColumns: ["providerCode", "providerEventId", "eventType", "processedAt"] }
      },
      fields: {
        replayKey: (0, import_fields32.text)({
          isIndexed: "unique",
          validation: { isRequired: true },
          access: { read: () => false },
          ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
        }),
        providerCode: (0, import_fields32.text)({ validation: { isRequired: true } }),
        providerEventId: (0, import_fields32.text)({ validation: { isRequired: true } }),
        eventType: (0, import_fields32.text)({ validation: { isRequired: true } }),
        payloadHash: (0, import_fields32.text)({
          validation: { isRequired: true },
          access: { read: () => false },
          ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
        }),
        processedAt: (0, import_fields32.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/InventoryMovement.ts
var import_core32, import_fields33, InventoryMovement;
var init_InventoryMovement = __esm({
  "features/keystone/models/InventoryMovement.ts"() {
    "use strict";
    import_core32 = require("@keystone-6/core");
    import_fields33 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    InventoryMovement = (0, import_core32.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "product", delegate: "product" },
            { field: "inventoryLot", delegate: "inventoryLot" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canAccessDashboard,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        isHidden: true,
        listView: { initialColumns: ["product", "inventoryLot", "movementType", "quantityDelta", "quantityAfter", "occurredAt"] }
      },
      fields: {
        shop: (0, import_fields33.relationship)({ ref: "Shop.inventoryMovements", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        product: (0, import_fields33.relationship)({ ref: "Product.inventoryMovements" }),
        inventoryLot: (0, import_fields33.relationship)({ ref: "InventoryLot.movements" }),
        productSaleLine: (0, import_fields33.relationship)({ ref: "ProductSaleLine.inventoryMovement" }),
        movementType: (0, import_fields33.select)({
          type: "enum",
          options: [
            { label: "Receive", value: "receive" },
            { label: "Sale", value: "sale" },
            { label: "Return", value: "return" },
            { label: "Waste", value: "waste" },
            { label: "Adjustment", value: "adjustment" }
          ],
          validation: { isRequired: true }
        }),
        quantityDelta: (0, import_fields33.integer)({ validation: { isRequired: true } }),
        quantityAfter: (0, import_fields33.integer)({ validation: { isRequired: true, min: 0 } }),
        reason: (0, import_fields33.text)({ validation: { isRequired: true } }),
        referenceKey: (0, import_fields33.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        occurredAt: (0, import_fields33.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PackageUsage.ts
var import_core33, import_fields34, PackageUsage;
var init_PackageUsage = __esm({
  "features/keystone/models/PackageUsage.ts"() {
    "use strict";
    import_core33 = require("@keystone-6/core");
    import_fields34 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    PackageUsage = (0, import_core33.list)({
      access: {
        operation: {
          query: permissions.canReadMemberships,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessCustomerPackageShopRecords }
      },
      ui: {
        isHidden: true,
        listView: { initialColumns: ["customerPackage", "usageType", "visitsDelta", "balanceAfter", "occurredAt"] }
      },
      fields: {
        customerPackage: (0, import_fields34.relationship)({ ref: "CustomerPackage.usageLedger" }),
        appointment: (0, import_fields34.relationship)({ ref: "Appointment.packageUsages" }),
        transaction: (0, import_fields34.relationship)({ ref: "CheckoutTransaction.packageUsages" }),
        usageType: (0, import_fields34.select)({
          type: "enum",
          options: [
            { label: "Grant", value: "grant" },
            { label: "Consume", value: "consume" },
            { label: "Restore", value: "restore" },
            { label: "Expire", value: "expire" },
            { label: "Adjustment", value: "adjustment" }
          ],
          validation: { isRequired: true }
        }),
        visitsDelta: (0, import_fields34.integer)({ validation: { isRequired: true } }),
        balanceAfter: (0, import_fields34.integer)({ validation: { isRequired: true, min: 0 } }),
        reason: (0, import_fields34.text)({ validation: { isRequired: true } }),
        referenceKey: (0, import_fields34.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        occurredAt: (0, import_fields34.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/supportedSettlementCurrency.ts
function assertUsdSettlementCurrency(currencyCode) {
  if (currencyCode !== "USD") throw new Error("This release supports USD settlement only.");
}
var init_supportedSettlementCurrency = __esm({
  "features/keystone/utils/supportedSettlementCurrency.ts"() {
    "use strict";
  }
});

// features/keystone/utils/storeLogo.ts
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) {
    return "";
  }
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) {
    return "";
  }
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}
var ALLOWED_ELEMENTS, ALLOWED_ATTRIBUTES, ATTRIBUTE_PATTERN, TAG_PATTERN;
var init_storeLogo = __esm({
  "features/keystone/utils/storeLogo.ts"() {
    "use strict";
    ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
      "svg",
      "g",
      "path",
      "defs",
      "lineargradient",
      "radialgradient",
      "stop",
      "clippath",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "title",
      "desc"
    ]);
    ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
      "xmlns",
      "fill",
      "fill-rule",
      "clip-rule",
      "height",
      "width",
      "viewbox",
      "d",
      "clip-path",
      "id",
      "x1",
      "x2",
      "y1",
      "y2",
      "gradientunits",
      "gradienttransform",
      "offset",
      "stop-color",
      "stop-opacity",
      "opacity",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "x",
      "y",
      "transform",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "points",
      "role",
      "aria-hidden",
      "aria-label",
      "preserveaspectratio"
    ]);
    ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
  }
});

// features/shared/sanitize-store-logo.ts
var init_sanitize_store_logo = __esm({
  "features/shared/sanitize-store-logo.ts"() {
    "use strict";
    init_storeLogo();
  }
});

// features/platform/store-settings/lib/store-logo.ts
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}
var DEFAULT_STORE_LOGO_ICON, DEFAULT_STORE_LOGO_COLOR;
var init_store_logo = __esm({
  "features/platform/store-settings/lib/store-logo.ts"() {
    "use strict";
    DEFAULT_STORE_LOGO_ICON = '<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>';
    DEFAULT_STORE_LOGO_COLOR = "0";
  }
});

// features/keystone/models/Shop.ts
var import_core34, import_fields35, currentShopReadAccess, currentShopCreateAccess, currentShopManageAccess, currentShopReadFilter, currentShopManageFilter, Shop;
var init_Shop = __esm({
  "features/keystone/models/Shop.ts"() {
    "use strict";
    import_core34 = require("@keystone-6/core");
    import_fields35 = require("@keystone-6/core/fields");
    init_access();
    init_currentAuthorization();
    init_trackingFields();
    init_supportedSettlementCurrency();
    init_sanitize_store_logo();
    init_store_logo();
    currentShopReadAccess = async ({ session }) => {
      if (!permissions.canAccessDashboard({ session })) return false;
      return hasCurrentRolePermission(session, "canAccessDashboard");
    };
    currentShopCreateAccess = async ({ session }) => {
      if (!permissions.canManageOnboarding({ session })) return false;
      return hasCurrentRolePermission(session, "canManageOnboarding");
    };
    currentShopManageAccess = async ({ session }) => {
      if (!permissions.canManageShops({ session })) return false;
      return (await currentManagedShopIds(session)).length > 0;
    };
    currentShopReadFilter = async (session) => {
      const shopIds = await currentMembershipShopIds(session);
      return shopIds.length ? { id: { in: shopIds } } : false;
    };
    currentShopManageFilter = async (session) => {
      const shopIds = await currentManagedShopIds(session);
      return shopIds.length ? { id: { in: shopIds } } : false;
    };
    Shop = (0, import_core34.list)({
      access: {
        operation: {
          query: currentShopReadAccess,
          create: currentShopCreateAccess,
          update: currentShopManageAccess,
          delete: currentShopManageAccess
        },
        filter: {
          query: ({ session }) => currentShopReadFilter(session),
          update: ({ session }) => currentShopManageFilter(session),
          delete: ({ session }) => currentShopManageFilter(session)
        }
      },
      ui: {
        listView: { initialColumns: ["name", "slug", "status", "phone", "timezone"] }
      },
      fields: {
        name: (0, import_fields35.text)({ validation: { isRequired: true } }),
        legalName: (0, import_fields35.text)({ validation: { isRequired: true } }),
        slug: (0, import_fields35.text)({
          isIndexed: "unique",
          validation: {
            isRequired: true,
            match: {
              regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
              explanation: "Use a lowercase URL-safe shop slug."
            }
          }
        }),
        status: (0, import_fields35.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Inactive", value: "inactive" }
          ],
          defaultValue: "active"
        }),
        logoIcon: (0, import_fields35.text)({
          defaultValue: DEFAULT_STORE_LOGO_ICON,
          hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
            const value = resolvedData[fieldKey];
            if (value === void 0) return void 0;
            const sanitized = typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
            if (!sanitized) throw new Error("Invalid SVG format.");
            return sanitized;
          } }
        }),
        logoColor: (0, import_fields35.text)({ defaultValue: "0", hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
        tagline: (0, import_fields35.text)(),
        address: (0, import_fields35.text)(),
        phone: (0, import_fields35.text)(),
        timezone: (0, import_fields35.text)({ defaultValue: "America/New_York", validation: { isRequired: true }, hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          if (value === void 0) return void 0;
          try {
            new Intl.DateTimeFormat("en", { timeZone: String(value) }).format();
          } catch {
            throw new Error("Timezone must be a valid IANA timezone.");
          }
          return value;
        } } }),
        currencyCode: (0, import_fields35.text)({ defaultValue: "USD", validation: { isRequired: true }, hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          if (value === void 0) return void 0;
          assertUsdSettlementCurrency(value);
          return value;
        } } }),
        jurisdictionCode: (0, import_fields35.text)({ ui: { description: "Merchant-reviewed operating jurisdiction, for example US-NY. Required before public booking." } }),
        hours: (0, import_fields35.json)({ defaultValue: {} }),
        brandColor: (0, import_fields35.select)({
          type: "enum",
          options: [
            { label: "Warm amber", value: "amber" },
            { label: "Indigo", value: "indigo" },
            { label: "Emerald", value: "emerald" },
            { label: "Rose", value: "rose" },
            { label: "Slate", value: "slate" }
          ],
          defaultValue: "amber",
          validation: { isRequired: true },
          ui: { description: "Constrained storefront brand palette." }
        }),
        isPublic: (0, import_fields35.checkbox)({ defaultValue: false }),
        memberships: (0, import_fields35.relationship)({ ref: "ShopMembership.shop", many: true, access: { create: () => false, update: () => false } }),
        activeUsers: (0, import_fields35.relationship)({ ref: "User.activeShop", many: true, access: { create: () => false, update: () => false } }),
        chairs: (0, import_fields35.relationship)({ ref: "BarberChair.shop", many: true, access: { create: () => false, update: () => false } }),
        barbers: (0, import_fields35.relationship)({ ref: "Barber.shop", many: true, access: { create: () => false, update: () => false } }),
        scheduleExceptions: (0, import_fields35.relationship)({ ref: "ScheduleException.shop", many: true, access: { create: () => false, update: () => false } }),
        staffShifts: (0, import_fields35.relationship)({ ref: "StaffShift.shop", many: true, access: { create: () => false, update: () => false } }),
        customers: (0, import_fields35.relationship)({ ref: "Customer.shop", many: true, access: { create: () => false, update: () => false } }),
        customerNotes: (0, import_fields35.relationship)({ ref: "CustomerNote.shop", many: true, access: { create: () => false, update: () => false } }),
        groomingNotes: (0, import_fields35.relationship)({ ref: "GroomingNote.shop", many: true, access: { create: () => false, update: () => false } }),
        waiverForms: (0, import_fields35.relationship)({ ref: "WaiverForm.shop", many: true, access: { create: () => false, update: () => false } }),
        serviceCategories: (0, import_fields35.relationship)({ ref: "ServiceCategory.shop", many: true, access: { create: () => false, update: () => false } }),
        services: (0, import_fields35.relationship)({ ref: "Service.shop", many: true, access: { create: () => false, update: () => false } }),
        products: (0, import_fields35.relationship)({ ref: "Product.shop", many: true, access: { create: () => false, update: () => false } }),
        servicePackages: (0, import_fields35.relationship)({ ref: "ServicePackage.shop", many: true, access: { create: () => false, update: () => false } }),
        membershipPlans: (0, import_fields35.relationship)({ ref: "MembershipPlan.shop", many: true, access: { create: () => false, update: () => false } }),
        customerPackages: (0, import_fields35.relationship)({ ref: "CustomerPackage.shop", many: true, access: { create: () => false, update: () => false } }),
        membershipEvents: (0, import_fields35.relationship)({ ref: "MembershipEvent.shop", many: true, access: { create: () => false, update: () => false } }),
        appointments: (0, import_fields35.relationship)({ ref: "Appointment.shop", many: true, access: { create: () => false, update: () => false } }),
        appointmentChangeEvents: (0, import_fields35.relationship)({ ref: "AppointmentChangeEvent.shop", many: true, access: { create: () => false, update: () => false } }),
        bookingPolicies: (0, import_fields35.relationship)({ ref: "BookingPolicy.shop", many: true, access: { create: () => false, update: () => false } }),
        practitionerCredentials: (0, import_fields35.relationship)({ ref: "PractitionerCredential.shop", many: true, access: { create: () => false, update: () => false } }),
        noShowPolicies: (0, import_fields35.relationship)({ ref: "NoShowPolicy.shop", many: true, access: { create: () => false, update: () => false } }),
        noShowEvents: (0, import_fields35.relationship)({ ref: "NoShowEvent.shop", many: true, access: { create: () => false, update: () => false } }),
        queueEntries: (0, import_fields35.relationship)({ ref: "WalkInQueueEntry.shop", many: true, access: { create: () => false, update: () => false } }),
        waitlistEntries: (0, import_fields35.relationship)({ ref: "WaitlistEntry.shop", many: true, access: { create: () => false, update: () => false } }),
        transactions: (0, import_fields35.relationship)({ ref: "CheckoutTransaction.shop", many: true, access: { create: () => false, update: () => false } }),
        paymentProviders: (0, import_fields35.relationship)({ ref: "PaymentProvider.shop", many: true, access: { create: () => false, update: () => false } }),
        paymentSessions: (0, import_fields35.relationship)({ ref: "PaymentSession.shop", many: true, access: { create: () => false, update: () => false } }),
        commissions: (0, import_fields35.relationship)({ ref: "Commission.shop", many: true, access: { create: () => false, update: () => false } }),
        commissionPayouts: (0, import_fields35.relationship)({ ref: "CommissionPayout.shop", many: true, access: { create: () => false, update: () => false } }),
        tips: (0, import_fields35.relationship)({ ref: "Tip.shop", many: true, access: { create: () => false, update: () => false } }),
        suppliers: (0, import_fields35.relationship)({ ref: "Supplier.shop", many: true, access: { create: () => false, update: () => false } }),
        inventoryLots: (0, import_fields35.relationship)({ ref: "InventoryLot.shop", many: true, access: { create: () => false, update: () => false } }),
        inventoryMovements: (0, import_fields35.relationship)({ ref: "InventoryMovement.shop", many: true, access: { create: () => false, update: () => false } }),
        productSaleLines: (0, import_fields35.relationship)({ ref: "ProductSaleLine.shop", many: true, access: { create: () => false, update: () => false } }),
        paymentReconciliations: (0, import_fields35.relationship)({ ref: "PaymentReconciliation.shop", many: true, access: { create: () => false, update: () => false } }),
        commandReceipts: (0, import_fields35.relationship)({ ref: "CommandReceipt.shop", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ShopMembership.ts
async function actorShopRole(context, shopId) {
  const session = context.session;
  if (!session?.itemId || !(await currentManagedActiveShopIds(session, context.prisma)).includes(shopId)) return null;
  const membership = await context.prisma.shopMembership.findFirst({
    where: { userId: session.itemId, shopId, status: "active", shop: { status: "active" } },
    select: { id: true, membershipRole: true }
  });
  return membership?.membershipRole === "owner" || membership?.membershipRole === "manager" ? membership.membershipRole : null;
}
async function canCreateMembership({ session, context }) {
  return (await currentManagedActiveShopIds(session, context.prisma)).length > 0;
}
async function canReadMemberships({ session, context }) {
  if (!session) return false;
  const shopIds = await currentManagedActiveShopIds(session, context.prisma);
  return {
    OR: [
      { user: { id: { equals: session.itemId } } },
      ...shopIds.length > 0 ? [{ shop: { id: { in: shopIds } } }] : []
    ]
  };
}
async function canManageMemberships({ session, context }) {
  const shopIds = await currentManagedActiveShopIds(session, context.prisma);
  return shopIds.length > 0 ? { shop: { id: { in: shopIds } } } : false;
}
var import_core35, import_fields36, MANAGER_GRANTABLE_ROLES, PRIVILEGED_ROLES, ShopMembership;
var init_ShopMembership = __esm({
  "features/keystone/models/ShopMembership.ts"() {
    "use strict";
    import_core35 = require("@keystone-6/core");
    import_fields36 = require("@keystone-6/core/fields");
    init_access();
    init_currentAuthorization();
    init_trackingFields();
    MANAGER_GRANTABLE_ROLES = /* @__PURE__ */ new Set(["front_desk", "barber", "viewer"]);
    PRIVILEGED_ROLES = /* @__PURE__ */ new Set(["owner", "manager"]);
    ShopMembership = (0, import_core35.list)({
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation !== "create") return resolvedData;
          const shopId = resolvedData.shop?.connect?.id;
          const userId = resolvedData.user?.connect?.id;
          return shopId && userId ? { ...resolvedData, membershipKey: `${shopId}:${userId}` } : resolvedData;
        },
        validate: {
          create: async ({ resolvedData, context, addValidationError }) => {
            const shopId = resolvedData.shop?.connect?.id;
            const actorRole = shopId ? await actorShopRole(context, shopId) : null;
            if (!shopId || !actorRole) {
              addValidationError("Not authorized to create a membership for this active shop.");
              return;
            }
            const role = String(resolvedData.membershipRole || "viewer");
            if (actorRole !== "owner" && !MANAGER_GRANTABLE_ROLES.has(role)) {
              addValidationError("Only a shop owner can grant owner or manager access.");
            }
          },
          update: async ({ resolvedData, item, context, addValidationError }) => {
            const membershipContext = context;
            const shopId = String(item.shopId || "");
            const actorRole = await actorShopRole(membershipContext, shopId);
            if (!actorRole) {
              addValidationError("Not authorized to change memberships for this shop.");
              return;
            }
            const currentRole = String(item.membershipRole || "viewer");
            const nextRole = String(resolvedData.membershipRole ?? currentRole);
            const nextStatus = String(resolvedData.status ?? item.status ?? "");
            if (actorRole !== "owner" && (PRIVILEGED_ROLES.has(currentRole) || PRIVILEGED_ROLES.has(nextRole))) {
              addValidationError("Only a shop owner can change owner or manager access.");
              return;
            }
            if (item.status === "revoked" && nextStatus !== "revoked" && actorRole !== "owner") {
              addValidationError("Only a shop owner can restore a revoked membership.");
              return;
            }
            const losesOwner = currentRole === "owner" && item.status === "active" && (nextRole !== "owner" || nextStatus !== "active");
            if (losesOwner) {
              const otherOwners = await membershipContext.prisma.shopMembership.count({
                where: { shopId, id: { not: String(item.id) }, membershipRole: "owner", status: "active" }
              });
              if (otherOwners < 1) addValidationError("A shop must keep at least one active owner. Grant another owner first.");
            }
          }
        }
      },
      access: {
        operation: {
          query: isSignedIn,
          create: canCreateMembership,
          update: isSignedIn,
          // Revoke instead of deleting so membership history is preserved.
          delete: () => false
        },
        filter: {
          query: canReadMemberships,
          update: canManageMemberships,
          delete: canManageMemberships
        }
      },
      ui: {
        listView: { initialColumns: ["shop", "user", "membershipRole", "status"] }
      },
      fields: {
        membershipKey: (0, import_fields36.text)({
          isIndexed: "unique",
          validation: { isRequired: true },
          access: { read: () => false, create: () => false, update: () => false },
          ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
        }),
        shop: (0, import_fields36.relationship)({ ref: "Shop.memberships", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        user: (0, import_fields36.relationship)({ ref: "User.shopMemberships", access: { update: () => false } }),
        membershipRole: (0, import_fields36.select)({
          type: "enum",
          options: [
            { label: "Owner", value: "owner" },
            { label: "Manager", value: "manager" },
            { label: "Front Desk", value: "front_desk" },
            { label: "Barber", value: "barber" },
            { label: "Viewer", value: "viewer" }
          ],
          defaultValue: "viewer"
        }),
        status: (0, import_fields36.select)({
          type: "enum",
          options: [
            { label: "Invited", value: "invited" },
            { label: "Active", value: "active" },
            { label: "Suspended", value: "suspended" },
            { label: "Revoked", value: "revoked" }
          ],
          defaultValue: "invited"
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CommandReceipt.ts
function canReadPayload({ session, item }) {
  const shopId = typeof item.shopId === "string" ? item.shopId : "";
  if (!shopId) return false;
  const current = session;
  return managedShopIds(current).includes(shopId) && activeShopIds(current).includes(shopId);
}
var import_core36, import_fields37, immutable, CommandReceipt;
var init_CommandReceipt = __esm({
  "features/keystone/models/CommandReceipt.ts"() {
    "use strict";
    import_core36 = require("@keystone-6/core");
    import_fields37 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    immutable = { update: () => false };
    CommandReceipt = (0, import_core36.list)({
      access: {
        operation: {
          query: permissions.canManageStaff,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        listView: { initialColumns: ["eventKey", "eventType", "aggregateType", "occurredAt"] }
      },
      fields: {
        eventKey: (0, import_fields37.text)({ validation: { isRequired: true }, isIndexed: "unique", access: immutable }),
        eventType: (0, import_fields37.text)({ validation: { isRequired: true }, access: immutable }),
        schemaVersion: (0, import_fields37.integer)({ validation: { isRequired: true }, defaultValue: 1, access: immutable }),
        aggregateType: (0, import_fields37.text)({ validation: { isRequired: true }, access: immutable }),
        aggregateId: (0, import_fields37.text)({ validation: { isRequired: true }, access: immutable }),
        shop: (0, import_fields37.relationship)({ ref: "Shop.commandReceipts", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: immutable }),
        payload: (0, import_fields37.json)({ access: { ...immutable, read: canReadPayload } }),
        actorId: (0, import_fields37.text)({ access: immutable, ui: { description: "User who performed the change, when recorded." } }),
        payloadHash: (0, import_fields37.text)({ validation: { isRequired: true }, access: immutable }),
        occurredAt: (0, import_fields37.timestamp)({ validation: { isRequired: true }, access: immutable }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/NoShowEvent.ts
var import_core37, import_fields38, NoShowEvent;
var init_NoShowEvent = __esm({
  "features/keystone/models/NoShowEvent.ts"() {
    "use strict";
    import_core37 = require("@keystone-6/core");
    import_fields38 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    NoShowEvent = (0, import_core37.list)({
      access: {
        operation: { query: permissions.canReadAppointments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { isHidden: true },
      fields: {
        shop: (0, import_fields38.relationship)({ ref: "Shop.noShowEvents", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        eventKey: (0, import_fields38.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        appointment: (0, import_fields38.relationship)({ ref: "Appointment.noShowEvents" }),
        customer: (0, import_fields38.relationship)({ ref: "Customer" }),
        policy: (0, import_fields38.relationship)({ ref: "NoShowPolicy.events" }),
        policyNameSnapshot: (0, import_fields38.text)({ validation: { isRequired: true } }),
        feeAmount: (0, import_fields38.integer)({ validation: { isRequired: true, min: 0 } }),
        graceMinutes: (0, import_fields38.integer)({ validation: { isRequired: true, min: 0 } }),
        feeWaived: (0, import_fields38.checkbox)({ defaultValue: false }),
        reason: (0, import_fields38.text)({ validation: { isRequired: true } }),
        markedAt: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CommissionPayout.ts
var import_core38, import_fields39, CommissionPayout;
var init_CommissionPayout = __esm({
  "features/keystone/models/CommissionPayout.ts"() {
    "use strict";
    import_core38 = require("@keystone-6/core");
    import_fields39 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    CommissionPayout = (0, import_core38.list)({
      access: {
        operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { isHidden: true },
      fields: {
        shop: (0, import_fields39.relationship)({ ref: "Shop.commissionPayouts", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        payoutNumber: (0, import_fields39.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        idempotencyKeyHash: (0, import_fields39.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: () => false } }),
        barber: (0, import_fields39.relationship)({ ref: "Barber" }),
        commissions: (0, import_fields39.relationship)({ ref: "Commission.payout", many: true }),
        status: (0, import_fields39.select)({ type: "enum", options: [{ label: "Paid", value: "paid" }, { label: "Voided", value: "voided" }], defaultValue: "paid" }),
        commissionCount: (0, import_fields39.integer)({ validation: { isRequired: true, min: 1 } }),
        totalAmount: (0, import_fields39.integer)({ validation: { isRequired: true, min: 0 } }),
        paidAt: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
        notes: (0, import_fields39.text)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ProductSaleLine.ts
var import_core39, import_fields40, ProductSaleLine;
var init_ProductSaleLine = __esm({
  "features/keystone/models/ProductSaleLine.ts"() {
    "use strict";
    import_core39 = require("@keystone-6/core");
    import_fields40 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    ProductSaleLine = (0, import_core39.list)({
      access: {
        operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { isHidden: true },
      fields: {
        shop: (0, import_fields40.relationship)({ ref: "Shop.productSaleLines", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        lineNumber: (0, import_fields40.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        transaction: (0, import_fields40.relationship)({ ref: "CheckoutTransaction.productLines" }),
        product: (0, import_fields40.relationship)({ ref: "Product.saleLines" }),
        inventoryMovement: (0, import_fields40.relationship)({ ref: "InventoryMovement.productSaleLine" }),
        originalLine: (0, import_fields40.relationship)({ ref: "ProductSaleLine.returnLines" }),
        returnLines: (0, import_fields40.relationship)({ ref: "ProductSaleLine.originalLine", many: true }),
        lineType: (0, import_fields40.select)({ type: "enum", options: [{ label: "Sale", value: "sale" }, { label: "Return", value: "return" }], defaultValue: "sale" }),
        productNameSnapshot: (0, import_fields40.text)({ validation: { isRequired: true } }),
        skuSnapshot: (0, import_fields40.text)({ validation: { isRequired: true } }),
        quantity: (0, import_fields40.integer)({ validation: { isRequired: true, min: 1 } }),
        unitPrice: (0, import_fields40.integer)({ validation: { isRequired: true, min: 0 } }),
        subtotal: (0, import_fields40.integer)({ validation: { isRequired: true } }),
        taxAmount: (0, import_fields40.integer)({ validation: { isRequired: true } }),
        total: (0, import_fields40.integer)({ validation: { isRequired: true } }),
        returnedQuantity: (0, import_fields40.integer)({ defaultValue: 0, validation: { min: 0 } }),
        occurredAt: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PaymentReconciliation.ts
var import_core40, import_fields41, PaymentReconciliation;
var init_PaymentReconciliation = __esm({
  "features/keystone/models/PaymentReconciliation.ts"() {
    "use strict";
    import_core40 = require("@keystone-6/core");
    import_fields41 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    PaymentReconciliation = (0, import_core40.list)({
      access: {
        operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { isHidden: true },
      fields: {
        shop: (0, import_fields41.relationship)({ ref: "Shop.paymentReconciliations", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        eventKey: (0, import_fields41.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        paymentSession: (0, import_fields41.relationship)({ ref: "PaymentSession.reconciliations" }),
        localStatusBefore: (0, import_fields41.text)({ validation: { isRequired: true } }),
        remoteStatus: (0, import_fields41.text)({ validation: { isRequired: true } }),
        localStatusAfter: (0, import_fields41.text)({ validation: { isRequired: true } }),
        changed: (0, import_fields41.checkbox)({ defaultValue: false }),
        amount: (0, import_fields41.integer)({ validation: { isRequired: true, min: 0 } }),
        providerPayloadHash: (0, import_fields41.text)({ validation: { isRequired: true }, access: { read: () => false } }),
        observedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/ScheduleException.ts
var import_core41, import_fields42, ScheduleException;
var init_ScheduleException = __esm({
  "features/keystone/models/ScheduleException.ts"() {
    "use strict";
    import_core41 = require("@keystone-6/core");
    import_fields42 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    ScheduleException = (0, import_core41.list)({
      hooks: {
        validate: {
          create: (args) => validateShopRelationships(args, [
            { field: "barber", delegate: "barber" },
            { field: "chair", delegate: "barberChair" }
          ]),
          update: (args) => validateShopRelationships(args, [
            { field: "barber", delegate: "barber" },
            { field: "chair", delegate: "barberChair" }
          ])
        }
      },
      access: {
        operation: {
          query: permissions.canReadSchedules,
          create: () => false,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["barber", "chair", "exceptionType", "startsAt", "endsAt", "status"] } },
      fields: {
        shop: (0, import_fields42.relationship)({ ref: "Shop.scheduleExceptions", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        barber: (0, import_fields42.relationship)({ ref: "Barber.scheduleExceptions" }),
        chair: (0, import_fields42.relationship)({ ref: "BarberChair.scheduleExceptions" }),
        idempotencyKeyHash: (0, import_fields42.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: () => false } }),
        exceptionType: (0, import_fields42.select)({
          type: "enum",
          options: [
            { label: "Time off", value: "time_off" },
            { label: "Shop closure", value: "shop_closure" },
            { label: "Chair unavailable", value: "chair_unavailable" },
            { label: "Working override", value: "working_override" }
          ],
          defaultValue: "time_off"
        }),
        status: (0, import_fields42.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "active" }),
        startsAt: (0, import_fields42.timestamp)({ validation: { isRequired: true } }),
        endsAt: (0, import_fields42.timestamp)({ validation: { isRequired: true } }),
        reason: (0, import_fields42.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/StaffShift.ts
var import_core42, import_fields43, StaffShift;
var init_StaffShift = __esm({
  "features/keystone/models/StaffShift.ts"() {
    "use strict";
    import_core42 = require("@keystone-6/core");
    import_fields43 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    StaffShift = (0, import_core42.list)({
      access: {
        operation: { query: permissions.canReadSchedules, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { isHidden: true },
      fields: {
        shop: (0, import_fields43.relationship)({ ref: "Shop.staffShifts", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        barber: (0, import_fields43.relationship)({ ref: "Barber.shifts" }),
        chair: (0, import_fields43.relationship)({ ref: "BarberChair.shifts" }),
        idempotencyKeyHash: (0, import_fields43.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: () => false } }),
        status: (0, import_fields43.select)({
          type: "enum",
          options: [
            { label: "Scheduled", value: "scheduled" },
            { label: "Clocked in", value: "clocked_in" },
            { label: "Completed", value: "completed" },
            { label: "Cancelled", value: "cancelled" }
          ],
          defaultValue: "scheduled"
        }),
        scheduledStart: (0, import_fields43.timestamp)({ validation: { isRequired: true } }),
        scheduledEnd: (0, import_fields43.timestamp)({ validation: { isRequired: true } }),
        clockedInAt: (0, import_fields43.timestamp)(),
        clockedOutAt: (0, import_fields43.timestamp)(),
        notes: (0, import_fields43.text)({ ui: { displayMode: "textarea" } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/MembershipEvent.ts
var import_core43, import_fields44, MembershipEvent;
var init_MembershipEvent = __esm({
  "features/keystone/models/MembershipEvent.ts"() {
    "use strict";
    import_core43 = require("@keystone-6/core");
    import_fields44 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    MembershipEvent = (0, import_core43.list)({
      access: {
        operation: { query: permissions.canReadMemberships, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { isHidden: true },
      fields: {
        shop: (0, import_fields44.relationship)({ ref: "Shop.membershipEvents", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        customer: (0, import_fields44.relationship)({ ref: "Customer.membershipEvents" }),
        membershipPlan: (0, import_fields44.relationship)({ ref: "MembershipPlan.events" }),
        customerPackage: (0, import_fields44.relationship)({ ref: "CustomerPackage.membershipEvents" }),
        transaction: (0, import_fields44.relationship)({ ref: "CheckoutTransaction.membershipEvents" }),
        idempotencyKeyHash: (0, import_fields44.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: () => false } }),
        eventType: (0, import_fields44.select)({
          type: "enum",
          options: [
            { label: "Purchased", value: "purchased" },
            { label: "Renewed", value: "renewed" },
            { label: "Paused", value: "paused" },
            { label: "Resumed", value: "resumed" },
            { label: "Cancelled", value: "cancelled" }
          ],
          validation: { isRequired: true }
        }),
        planNameSnapshot: (0, import_fields44.text)({ validation: { isRequired: true } }),
        amount: (0, import_fields44.integer)({ defaultValue: 0, validation: { min: 0 } }),
        visitsDelta: (0, import_fields44.integer)({ defaultValue: 0 }),
        resultingVisits: (0, import_fields44.integer)({ defaultValue: 0, validation: { min: 0 } }),
        occurredAt: (0, import_fields44.timestamp)({ validation: { isRequired: true } }),
        reason: (0, import_fields44.text)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/localFixtureAuthority.ts
function isSyntheticAuthority(row) {
  return /^DEMO-NOT-A-LICENSE-/i.test(row.credentialNumber) || /^DEMO ONLY/i.test(row.issuingAuthority) || /not (?:a licensing authority|legal credential proof)/i.test(row.scopeDescription);
}
function isLocalAuthorityFixture(row) {
  return /^DEMO-NOT-A-LICENSE-[A-F0-9]{12}$/.test(row.credentialNumber) && row.issuingAuthority === FIXTURE_ISSUER && /^DEMO ONLY — seeded authority for .+; not legal credential proof$/.test(row.scopeDescription) && /^[a-f0-9]{64}$/.test(row.evidenceHash);
}
function isDisposableLocalFixtureTarget(target) {
  return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(target.host) && /^runtime_barbershop_(?:verify|ephemeral)_[a-z0-9_]+$/.test(target.dbName);
}
function localOwnership() {
  try {
    const file = (0, import_node_path.resolve)(process.env.BARBERSHOP_FIXTURE_OWNERSHIP_PATH || "");
    const runtime = (0, import_node_fs.realpathSync)((0, import_node_path.join)(process.cwd(), ".runtime")) + import_node_path.sep;
    const stat2 = (0, import_node_fs.lstatSync)(file);
    if (!file.startsWith(runtime) || (0, import_node_fs.realpathSync)(file) !== file || !stat2.isFile() || stat2.uid !== process.getuid?.() || (stat2.mode & 511) !== 384 || stat2.size > 65536) return null;
    const value = JSON.parse((0, import_node_fs.readFileSync)(file, "utf8"));
    if (value.version !== 1 || value.root !== (0, import_node_path.dirname)(file) || value.datadir !== (0, import_node_path.join)(value.root, "pgdata") || typeof value.role !== "string" || !/^[a-z_][a-z0-9_]{0,62}$/.test(value.role) || !Array.isArray(value.databases) || value.databases.length === 0 || value.databases.length > 64 || !value.databases.every((name) => typeof name === "string" && /^[a-z0-9_]+$/.test(name))) return null;
    const data = (0, import_node_fs.lstatSync)(value.datadir);
    if (!data.isDirectory() || data.isSymbolicLink() || data.uid !== stat2.uid || (0, import_node_fs.realpathSync)(value.datadir) !== value.datadir) return null;
    return value;
  } catch {
    return null;
  }
}
function localFixtureScopeSql(shop) {
  const ownership = localOwnership();
  if (!ownership) return "FALSE";
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  return `(current_database() IN (${ownership.databases.map(literal).join(",")})
    AND current_user = ${literal(ownership.role)} AND session_user = ${literal(ownership.role)}
    AND (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) = current_user
    AND CASE WHEN (SELECT rolsuper OR pg_has_role(current_user, 'pg_read_all_settings', 'USAGE') FROM pg_roles WHERE rolname = current_user)
      THEN current_setting('data_directory', true) = ${literal(ownership.datadir)} ELSE false END
    AND current_database() ~ '^runtime_barbershop_(verify|ephemeral)_[a-z0-9_]+$'
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet)
    AND NOT EXISTS (SELECT 1 FROM "PaymentProvider" fixture_provider WHERE fixture_provider."shop" = ${shop}.id AND fixture_provider."isInstalled" = true AND fixture_provider.code <> 'pp_manual'))`;
}
function permittedAuthorityEvidenceSql(alias) {
  const synthetic = `(${alias}."credentialNumber" ILIKE 'DEMO-NOT-A-LICENSE-%' OR ${alias}."issuingAuthority" ILIKE 'DEMO ONLY%' OR ${alias}."scopeDescription" ~* 'not (a licensing authority|legal credential proof)')`;
  const fixture = `(${alias}."credentialNumber" ~ '^DEMO-NOT-A-LICENSE-[A-F0-9]{12}$' AND ${alias}."issuingAuthority" = '${FIXTURE_ISSUER}' AND ${alias}."scopeDescription" ~ '^DEMO ONLY \u2014 seeded authority for .+; not legal credential proof$' AND ${alias}."evidenceHash" ~ '^[a-f0-9]{64}$')`;
  return `(NOT ${synthetic} OR (${fixture} AND ${localFixtureScopeSql("shop")}))`;
}
async function isLocalFixtureShop(client, shopId) {
  const [row] = await client.$queryRawUnsafe(`SELECT ${localFixtureScopeSql("s")} AS allowed FROM "Shop" s WHERE s.id = $1`, shopId);
  return row?.allowed === true;
}
var import_node_fs, import_node_path, FIXTURE_ISSUER;
var init_localFixtureAuthority = __esm({
  "features/keystone/utils/localFixtureAuthority.ts"() {
    "use strict";
    import_node_fs = require("node:fs");
    import_node_path = require("node:path");
    FIXTURE_ISSUER = "DEMO ONLY \u2014 onboarding authority fixture; not a licensing authority";
  }
});

// features/keystone/models/PractitionerCredential.ts
var import_core44, import_fields45, PractitionerCredential;
var init_PractitionerCredential = __esm({
  "features/keystone/models/PractitionerCredential.ts"() {
    "use strict";
    import_core44 = require("@keystone-6/core");
    import_fields45 = require("@keystone-6/core/fields");
    init_access();
    init_localFixtureAuthority();
    init_shopRelationshipHooks();
    init_trackingFields();
    PractitionerCredential = (0, import_core44.list)({
      hooks: {
        validate: {
          create: async (args) => {
            await validateShopRelationships(args, [
              { field: "barber", delegate: "barber" },
              { field: "service", delegate: "service" },
              { field: "supervisor", delegate: "barber" }
            ]);
            const evidence = { credentialNumber: String(args.resolvedData.credentialNumber || ""), issuingAuthority: String(args.resolvedData.issuingAuthority || ""), scopeDescription: String(args.resolvedData.scopeDescription || ""), evidenceHash: String(args.resolvedData.evidenceHash || "") };
            if (isSyntheticAuthority(evidence) && (!isLocalAuthorityFixture(evidence) || !await isLocalFixtureShop(args.context.prisma, connectedRelationshipId(args.resolvedData.shop) || ""))) args.addValidationError("Synthetic evidence is limited to the disposable local/offline fixture contract.");
            const barberId = args.resolvedData.barber?.connect?.id;
            const serviceId = args.resolvedData.service?.connect?.id;
            if (!barberId || !serviceId) args.addValidationError("Practitioner and service scope are required.");
            const effectiveFrom = new Date(String(args.resolvedData.effectiveFrom || ""));
            const expiresAt = new Date(String(args.resolvedData.expiresAt || ""));
            const verifiedAt = new Date(String(args.resolvedData.verifiedAt || ""));
            if ([effectiveFrom, expiresAt, verifiedAt].some((date2) => Number.isNaN(date2.getTime())) || expiresAt <= effectiveFrom || verifiedAt > /* @__PURE__ */ new Date()) {
              args.addValidationError("Credential effective, expiry, and verification dates are invalid.");
            }
            const supervisionRequired = args.resolvedData.supervisionRequired === true;
            const supervisor = args.resolvedData.supervisor;
            if (supervisionRequired && !supervisor?.connect?.id) args.addValidationError("A supervisor is required for supervised authority.");
            if (supervisor?.connect?.id && supervisor.connect.id === barberId) args.addValidationError("A practitioner cannot supervise their own authority.");
          }
        }
      },
      access: {
        operation: {
          query: permissions.canReadStaff,
          create: permissions.canManageStaff,
          update: () => false,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["barber", "service", "credentialType", "jurisdictionCode", "status", "effectiveFrom", "expiresAt"] } },
      fields: {
        shop: (0, import_fields45.relationship)({ ref: "Shop.practitionerCredentials", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        barber: (0, import_fields45.relationship)({ ref: "Barber.credentials", access: { update: () => false } }),
        service: (0, import_fields45.relationship)({ ref: "Service.practitionerCredentials", access: { update: () => false } }),
        supervisor: (0, import_fields45.relationship)({ ref: "Barber.supervisedCredentials", access: { update: () => false } }),
        credentialType: (0, import_fields45.select)({
          type: "enum",
          options: [
            { label: "Barber", value: "barber" },
            { label: "Master Barber", value: "master_barber" },
            { label: "Apprentice", value: "apprentice" },
            { label: "Cosmetology", value: "cosmetology" },
            { label: "Other", value: "other" }
          ],
          validation: { isRequired: true }
        }),
        credentialNumber: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
        issuingAuthority: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
        jurisdictionCode: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false }, ui: { description: "Merchant-reviewed jurisdiction code, for example US-NY." } }),
        scopeDescription: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false }, ui: { displayMode: "textarea" } }),
        evidenceHash: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false }, ui: { description: "SHA-256 or stronger digest of the reviewed authority evidence; never a raw credential image." } }),
        status: (0, import_fields45.select)({
          type: "enum",
          options: [
            { label: "Active", value: "active" },
            { label: "Suspended", value: "suspended" },
            { label: "Revoked", value: "revoked" },
            { label: "Expired", value: "expired" }
          ],
          defaultValue: "active",
          validation: { isRequired: true }
        }),
        effectiveFrom: (0, import_fields45.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
        expiresAt: (0, import_fields45.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
        verifiedAt: (0, import_fields45.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
        supervisionRequired: (0, import_fields45.checkbox)({ defaultValue: false, access: { update: () => false } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/BookingPolicy.ts
async function assertPolicyAuthority(args, shopId) {
  try {
    const session = args.context.session;
    const permission = session?.data.role?.canManageAppointments ? "canManageAppointments" : "canManageOnboarding";
    await assertCurrentShopAccess(session, shopId, args.context.prisma, permission);
    return true;
  } catch {
    args.addValidationError("Current appointment-policy permission and active shop membership are required.");
    return false;
  }
}
var import_core45, import_fields46, BookingPolicy;
var init_BookingPolicy = __esm({
  "features/keystone/models/BookingPolicy.ts"() {
    "use strict";
    import_core45 = require("@keystone-6/core");
    import_fields46 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    init_shopRelationshipHooks();
    init_currentAuthorization();
    BookingPolicy = (0, import_core45.list)({
      hooks: { validate: {
        create: async (args) => {
          await validateShopRelationships(args, []);
          const shopId = connectedRelationshipId(args.resolvedData.shop);
          if (shopId) await assertPolicyAuthority(args, shopId);
          const start = new Date(String(args.resolvedData.effectiveFrom || ""));
          const end = args.resolvedData.effectiveUntil ? new Date(String(args.resolvedData.effectiveUntil)) : null;
          if (Number.isNaN(start.getTime()) || end && (Number.isNaN(end.getTime()) || end <= start)) {
            args.addValidationError("Booking policy effective dates are invalid.");
            return;
          }
          if (shopId && args.resolvedData.status !== "retired") {
            const overlapping = await args.context.prisma.bookingPolicy.findFirst({
              where: {
                shopId,
                status: "active",
                ...end ? { effectiveFrom: { lt: end } } : {},
                OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: start } }]
              },
              select: { id: true, version: true }
            });
            if (overlapping) args.addValidationError(`Policy version ${overlapping.version} is still effective in this window. Set its end date or retire it first.`);
          }
        },
        update: async (args) => {
          const allowed = /* @__PURE__ */ new Set(["effectiveUntil", "status"]);
          if (Object.keys(args.resolvedData).some((key) => !allowed.has(key))) {
            args.addValidationError("Only the end date and retirement of a booking policy can be changed.");
            return;
          }
          if (!await assertPolicyAuthority(args, String(args.item.shopId))) return;
          if (args.resolvedData.status !== void 0 && !(args.item.status === "active" && args.resolvedData.status === "retired") && args.resolvedData.status !== args.item.status) {
            args.addValidationError("A retired booking policy cannot be reactivated. Create a new version instead.");
          }
          if (args.resolvedData.effectiveUntil !== void 0) {
            if (args.item.effectiveUntil) {
              args.addValidationError("This policy already has an end date.");
              return;
            }
            const end = args.resolvedData.effectiveUntil ? new Date(String(args.resolvedData.effectiveUntil)) : null;
            const start = new Date(String(args.item.effectiveFrom));
            if (!end || Number.isNaN(end.getTime()) || end <= start) args.addValidationError("The end date must be after the policy start date.");
            else if (end.getTime() < Date.now() - 6e4) args.addValidationError("The end date cannot be in the past; policies already applied to bookings stay as they were.");
          }
        }
      } },
      access: {
        operation: {
          query: permissions.canReadAppointments,
          create: (args) => permissions.canManageAppointments(args) || permissions.canManageOnboarding(args),
          update: permissions.canManageAppointments,
          delete: () => false
        },
        filter: { query: rules.canAccessShopRecords, update: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["name", "version", "publicServiceEligibility", "jurisdictionCode", "status", "effectiveFrom", "effectiveUntil"] } },
      fields: {
        shop: (0, import_fields46.relationship)({ ref: "Shop.bookingPolicies", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") }, access: { update: () => false } }),
        name: (0, import_fields46.text)({ validation: { isRequired: true }, access: { update: () => false } }),
        version: (0, import_fields46.text)({ validation: { isRequired: true }, access: { update: () => false } }),
        jurisdictionCode: (0, import_fields46.text)({ validation: { isRequired: true }, access: { update: () => false } }),
        policyTextHash: (0, import_fields46.text)({ validation: { isRequired: true }, access: { update: () => false } }),
        status: (0, import_fields46.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Retired", value: "retired" }], defaultValue: "active" }),
        effectiveFrom: (0, import_fields46.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
        effectiveUntil: (0, import_fields46.timestamp)({ ui: { description: "Set once to close this version before creating the next one." } }),
        cancellationWindowMinutes: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 1440, access: { update: () => false } }),
        rescheduleWindowMinutes: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 1440, access: { update: () => false } }),
        lateCancellationFeeAmount: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0, access: { update: () => false } }),
        rescheduleFeeAmount: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0, access: { update: () => false } }),
        depositCancellationRule: (0, import_fields46.select)({
          type: "enum",
          options: [
            { label: "Refund", value: "refund" },
            { label: "Forfeit", value: "forfeit" },
            { label: "Manual Review", value: "manual_review" }
          ],
          defaultValue: "manual_review",
          access: { update: () => false }
        }),
        publicServiceEligibility: (0, import_fields46.select)({
          type: "enum",
          options: [
            { label: "Legacy: any active shop service may be requested directly", value: "legacy_active_service" },
            { label: "Active public catalog only", value: "active_catalog" }
          ],
          defaultValue: "legacy_active_service",
          db: { isNullable: false },
          validation: { isRequired: true },
          access: { update: () => false },
          ui: { description: "Immutable versioned eligibility. Catalog discovery always requires an active same-shop category. Legacy mode preserves direct booking of uncategorized/hidden-category active services; capacity and authority checks still apply." }
        }),
        maxCustomerReschedules: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0, max: 20 }, defaultValue: 2, access: { update: () => false } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/AppointmentChangeEvent.ts
var import_core46, import_fields47, AppointmentChangeEvent;
var init_AppointmentChangeEvent = __esm({
  "features/keystone/models/AppointmentChangeEvent.ts"() {
    "use strict";
    import_core46 = require("@keystone-6/core");
    import_fields47 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    AppointmentChangeEvent = (0, import_core46.list)({
      access: {
        operation: { query: permissions.canReadAppointments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { listView: { initialColumns: ["appointment", "action", "actorType", "occurredAt", "feeAmount", "depositConsequence"] } },
      fields: {
        shop: (0, import_fields47.relationship)({ ref: "Shop.appointmentChangeEvents", db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") } }),
        appointment: (0, import_fields47.relationship)({ ref: "Appointment.changeEvents" }),
        eventKey: (0, import_fields47.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: () => false } }),
        action: (0, import_fields47.select)({ type: "enum", options: [{ label: "Cancelled", value: "cancelled" }, { label: "Rescheduled", value: "rescheduled" }], validation: { isRequired: true } }),
        actorType: (0, import_fields47.select)({ type: "enum", options: [{ label: "Customer", value: "customer" }, { label: "Operator", value: "operator" }], validation: { isRequired: true } }),
        actorReferenceHash: (0, import_fields47.text)({ validation: { isRequired: true }, access: { read: () => false } }),
        reason: (0, import_fields47.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
        previousStartsAt: (0, import_fields47.timestamp)({ validation: { isRequired: true } }),
        previousEndsAt: (0, import_fields47.timestamp)(),
        nextStartsAt: (0, import_fields47.timestamp)(),
        nextEndsAt: (0, import_fields47.timestamp)(),
        policySnapshot: (0, import_fields47.json)(),
        authoritySnapshot: (0, import_fields47.json)(),
        feeAmount: (0, import_fields47.integer)({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
        depositConsequence: (0, import_fields47.select)({
          type: "enum",
          options: [
            { label: "None", value: "none" },
            { label: "Refund Required", value: "refund_required" },
            { label: "Forfeiture Pending", value: "forfeiture_pending" },
            { label: "Manual Review", value: "manual_review" }
          ],
          defaultValue: "none"
        }),
        occurredAt: (0, import_fields47.timestamp)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CashRefund.ts
var import_core47, import_fields48, CashRefund;
var init_CashRefund = __esm({
  "features/keystone/models/CashRefund.ts"() {
    "use strict";
    import_core47 = require("@keystone-6/core");
    import_fields48 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    CashRefund = (0, import_core47.list)({
      access: { operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false }, filter: { query: rules.canAccessShopRecords } },
      fields: {
        shop: (0, import_fields48.relationship)({ ref: "Shop", db: { foreignKey: true, extendPrismaSchema: (s) => s.replaceAll("?", "") } }),
        transaction: (0, import_fields48.relationship)({ ref: "CheckoutTransaction.cashRefund" }),
        eventKey: (0, import_fields48.text)({ isIndexed: "unique", access: { read: () => false } }),
        actorId: (0, import_fields48.text)(),
        reason: (0, import_fields48.text)(),
        amount: (0, import_fields48.integer)({ validation: { min: 0 } }),
        tipAmount: (0, import_fields48.integer)({ defaultValue: 0 }),
        taxAmount: (0, import_fields48.integer)({ defaultValue: 0 }),
        refundedAt: (0, import_fields48.timestamp)({ defaultValue: { kind: "now" } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/GiftCard.ts
var import_core48, import_fields49, GiftCard;
var init_GiftCard = __esm({
  "features/keystone/models/GiftCard.ts"() {
    "use strict";
    import_core48 = require("@keystone-6/core");
    import_fields49 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    GiftCard = (0, import_core48.list)({
      access: {
        operation: { query: permissions.canReadPayments, create: () => false, update: () => false, delete: () => false },
        filter: { query: rules.canAccessShopRecords }
      },
      ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["code", "status", "initialValue", "balance", "recipientName", "expiresAt"] } },
      fields: {
        shop: (0, import_fields49.relationship)({ ref: "Shop", db: { foreignKey: true, extendPrismaSchema: (s) => s.replaceAll("?", "") } }),
        code: (0, import_fields49.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        status: (0, import_fields49.select)({
          type: "enum",
          options: [
            { label: "Awaiting payment", value: "pending" },
            { label: "Active", value: "active" },
            { label: "Used up", value: "redeemed" },
            { label: "Cancelled", value: "cancelled" }
          ],
          defaultValue: "pending"
        }),
        initialValue: (0, import_fields49.integer)({ validation: { isRequired: true, min: 0 } }),
        balance: (0, import_fields49.integer)({ validation: { isRequired: true, min: 0 } }),
        purchaserName: (0, import_fields49.text)(),
        purchaserEmail: (0, import_fields49.text)(),
        recipientName: (0, import_fields49.text)(),
        recipientEmail: (0, import_fields49.text)(),
        message: (0, import_fields49.text)({ ui: { displayMode: "textarea" } }),
        paymentSession: (0, import_fields49.relationship)({ ref: "PaymentSession" }),
        expiresAt: (0, import_fields49.timestamp)(),
        activatedAt: (0, import_fields49.timestamp)(),
        emailedAt: (0, import_fields49.timestamp)(),
        ledger: (0, import_fields49.json)({ defaultValue: [] }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/utils/relationshipBoundaries.ts
async function canReadTarget(target, targetKey, args) {
  try {
    const strong = strongTargetGate[targetKey];
    if (strong && !await strong(args)) return false;
    const access = target?.access;
    const query = typeof access === "object" ? access?.operation : void 0;
    const gate = typeof query === "object" ? query?.query : query;
    const allowed = typeof gate === "function" ? await gate({ session: args.session, context: args.context, listKey: targetKey, operation: "query" }) : gate ?? true;
    if (!allowed) return false;
    const rowFilter = typeof access === "object" ? access?.filter?.query : void 0;
    if (typeof rowFilter === "function") return await rowFilter({ session: args.session, context: args.context, listKey: targetKey, operation: "query" }) !== false;
    return true;
  } catch {
    return false;
  }
}
async function canReadField(read, args) {
  if (read === void 0 || read === true) return true;
  if (typeof read !== "function") return Boolean(read);
  try {
    return await read({ session: args.session, context: args.context, listKey: args.listKey, fieldKey: args.fieldKey, operation: "read", item: {}, inputData: {} }) === true;
  } catch {
    return false;
  }
}
function once(args, key, compute) {
  const scope2 = args.context && typeof args.context === "object" ? args.context : args.session ?? decisions;
  let cache = decisions.get(scope2);
  if (!cache) decisions.set(scope2, cache = /* @__PURE__ */ new Map());
  const hit = cache.get(key);
  if (hit) return hit;
  const result = compute();
  cache.set(key, result);
  return result;
}
function gateFiltering(listKey, fieldKey, field, lists) {
  const relation = field.dbField;
  const check = relation.kind === "relation" ? async (args) => await canReadField(field.access?.read, args) && canReadTarget(lists[relation.list], relation.list, args) : (args) => canReadField(field.access?.read, args);
  const needsGate = relation.kind === "relation" || field.access && typeof field.access === "object" && field.access.read !== void 0 && field.access.read !== true;
  if (!needsGate) return field;
  const key = relation.kind === "relation" ? `list:${relation.list}` : `field:${listKey}.${fieldKey}`;
  return { ...field, isFilterable: both(field.isFilterable, key, check), isOrderable: both(field.isOrderable, key, check) };
}
function enforceRelationshipBoundaries(lists) {
  for (const [listKey, config2] of Object.entries(lists)) {
    for (const [fieldKey, factory] of Object.entries(config2.fields)) {
      config2.fields[fieldKey] = (meta) => {
        const field = gateFiltering(listKey, fieldKey, factory(meta), lists);
        const relation = field.dbField;
        if (relation.kind !== "relation") return field;
        const name = `${listKey}.${fieldKey}`;
        if (relation.mode === "many" && !editableCollections.has(name) || identityRelations.has(name)) {
          return { ...field, access: { ...typeof field.access === "object" ? field.access : {}, create: () => false, update: () => false }, ui: { ...field.ui, createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } };
        }
        return field;
      };
    }
    if (archivedRoots.has(listKey) && typeof config2.access === "object") {
      const previous = config2.access.operation;
      config2.access = { ...config2.access, operation: typeof previous === "function" ? (args) => args.operation === "delete" ? false : previous(args) : { ...previous, query: previous?.query ?? (() => false), create: previous?.create ?? (() => false), update: previous?.update ?? (() => false), delete: () => false } };
    }
  }
  return lists;
}
var editableCollections, identityRelations, archivedRoots, strongTargetGate, decisions, both;
var init_relationshipBoundaries = __esm({
  "features/keystone/utils/relationshipBoundaries.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    editableCollections = /* @__PURE__ */ new Set(["Service.specialists", "Barber.specialties"]);
    identityRelations = /* @__PURE__ */ new Set([
      "User.activeShop",
      "User.barberProfile",
      "User.customerProfile",
      "Barber.user",
      "Customer.user"
    ]);
    archivedRoots = /* @__PURE__ */ new Set([
      "Shop",
      "Service",
      "ServiceCategory",
      "Barber",
      "BarberChair",
      "Customer",
      "ServicePackage",
      "MembershipPlan",
      "Product",
      "Supplier",
      "PaymentProvider"
    ]);
    strongTargetGate = {
      User: async ({ session, context }) => Boolean(session?.itemId) && (await hasCurrentRolePermission(session, "canSeeOtherPeople", context?.prisma) || await hasCurrentRolePermission(session, "canManageRoles", context?.prisma)),
      Role: async ({ session, context }) => hasCurrentRolePermission(session, "canManageRoles", context?.prisma),
      ShopMembership: ({ session }) => managedShopIds(session).length > 0,
      CustomerNote: ({ session }) => activeMembershipRole(session) === "owner"
    };
    decisions = /* @__PURE__ */ new WeakMap();
    both = (existing, key, check) => existing === false ? false : async (args) => (typeof existing === "function" ? Boolean(await existing(args)) : existing !== false) && once(args, key, () => check(args));
  }
});

// features/keystone/models/index.ts
var allModels, narrowed, models;
var init_models = __esm({
  "features/keystone/models/index.ts"() {
    "use strict";
    init_WaiverForm();
    init_GroomingNote();
    init_WaitlistEntry();
    init_NoShowPolicy();
    init_Tip();
    init_Commission();
    init_Supplier();
    init_InventoryLot();
    init_Product();
    init_BarberChair();
    init_User();
    init_ShopSettings();
    init_Role();
    init_ServiceCategory();
    init_Service();
    init_Barber();
    init_BarberSchedule();
    init_Customer();
    init_CustomerNote();
    init_Appointment();
    init_GuestBookingCommand();
    init_AppointmentLineItem();
    init_WalkInQueueEntry();
    init_MembershipPlan();
    init_ServicePackage();
    init_ServicePackageItem();
    init_CustomerPackage();
    init_CheckoutTransaction();
    init_PaymentProvider();
    init_PaymentSession();
    init_PaymentWebhookEvent();
    init_InventoryMovement();
    init_PackageUsage();
    init_Shop();
    init_ShopMembership();
    init_CommandReceipt();
    init_NoShowEvent();
    init_CommissionPayout();
    init_ProductSaleLine();
    init_PaymentReconciliation();
    init_ScheduleException();
    init_StaffShift();
    init_MembershipEvent();
    init_PractitionerCredential();
    init_BookingPolicy();
    init_AppointmentChangeEvent();
    init_CashRefund();
    init_GiftCard();
    init_relationshipBoundaries();
    allModels = enforceRelationshipBoundaries({
      User,
      Role,
      Shop,
      ShopMembership,
      CommandReceipt,
      NoShowEvent,
      CommissionPayout,
      ProductSaleLine,
      PaymentReconciliation,
      ShopSettings,
      ServiceCategory,
      Service,
      Barber,
      BarberSchedule,
      ScheduleException,
      StaffShift,
      PractitionerCredential,
      BookingPolicy,
      AppointmentChangeEvent,
      Customer,
      CustomerNote,
      Appointment,
      GuestBookingCommand,
      AppointmentLineItem,
      WalkInQueueEntry,
      MembershipPlan,
      ServicePackage,
      ServicePackageItem,
      CustomerPackage,
      MembershipEvent,
      CheckoutTransaction,
      CashRefund,
      GiftCard,
      PaymentProvider,
      PaymentSession,
      PaymentWebhookEvent,
      InventoryMovement,
      PackageUsage,
      WaiverForm,
      GroomingNote,
      WaitlistEntry,
      NoShowPolicy,
      Tip,
      Commission,
      Supplier,
      InventoryLot,
      Product,
      BarberChair
    });
    narrowed = (config2) => {
      const operation = config2.access?.operation ?? {};
      const ui = config2.ui ?? {};
      const allowed = (gate, args) => typeof gate !== "function" || Boolean(gate(args));
      return {
        ...config2,
        ui: {
          ...ui,
          isHidden: ui.isHidden ?? ((args) => !allowed(operation.query, args)),
          hideCreate: ui.hideCreate ?? ((args) => !allowed(operation.create, args))
        }
      };
    };
    models = Object.fromEntries(Object.entries(allModels).map(([key, config2]) => [key, narrowed(config2)]));
  }
});

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(_root, _args, context) {
  const userCount = await context.sudo().query.User.count({});
  return userCount === 0;
}
var redirectToInit_default;
var init_redirectToInit = __esm({
  "features/keystone/mutations/redirectToInit.ts"() {
    "use strict";
    redirectToInit_default = redirectToInit;
  }
});

// features/shared/shop-time.ts
function shopDateParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function shopDateKey(value, timeZone) {
  const p2 = shopDateParts(value, timeZone);
  return `${p2.year}-${p2.month}-${p2.day}`;
}
function shopMinute(value, timeZone) {
  const p2 = shopDateParts(value, timeZone);
  return Number(p2.hour) * 60 + Number(p2.minute);
}
function shopWallTime(date2, minute, timeZone) {
  const [year, month, day] = date2.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, 0, minute);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p2 = shopDateParts(new Date(instant), timeZone);
    const represented = Date.UTC(Number(p2.year), Number(p2.month) - 1, Number(p2.day), Number(p2.hour), Number(p2.minute), Number(p2.second));
    const delta = target - represented;
    if (!delta) return new Date(instant);
    instant += delta;
  }
  throw new Error("This local time does not exist in the shop timezone. Choose another time.");
}
function shopDayRange(value, timeZone) {
  const key = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : shopDateKey(value, timeZone);
  const next = /* @__PURE__ */ new Date(`${key}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: shopWallTime(key, 0, timeZone), end: shopWallTime(next.toISOString().slice(0, 10), 0, timeZone) };
}
var init_shop_time = __esm({
  "features/shared/shop-time.ts"() {
    "use strict";
  }
});

// features/keystone/utils/availability.ts
function occupiedBufferMinutes(barberBufferMinutes, serviceBufferMinutes) {
  const value = (input) => Number.isFinite(input) ? Math.max(0, Math.floor(Number(input))) : 0;
  return Math.max(value(barberBufferMinutes), value(serviceBufferMinutes));
}
function appointmentOccupiedUntil(appointment, bufferMinutes = 0, now = Date.now()) {
  if (!appointment.endsAt) return Number.POSITIVE_INFINITY;
  const buffer = Math.max(0, bufferMinutes || 0) * 6e4;
  const plannedEnd = new Date(appointment.endsAt).getTime() + buffer;
  return appointment.status === "in_chair" ? Math.max(plannedEnd, now + buffer) : plannedEnd;
}
function minutesToDisplayTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;
}
function displayTimeToMinutes(time) {
  const [raw, period] = time.trim().split(/\s+/);
  const [hoursRaw, minutesRaw] = raw.split(":").map(Number);
  let hours = hoursRaw;
  if (period?.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (period?.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + (minutesRaw || 0);
}
function dayKeyForDate(date2, timeZone) {
  if (timeZone) {
    const key = typeof date2 === "string" ? date2 : shopDateKey(date2, timeZone);
    return dayKeys[(/* @__PURE__ */ new Date(`${key}T12:00:00Z`)).getUTCDay()];
  }
  const value = typeof date2 === "string" ? /* @__PURE__ */ new Date(`${date2}T00:00:00.000`) : date2;
  return dayKeys[value.getDay()];
}
function dayRange(date2, timeZone) {
  if (timeZone) return shopDayRange(date2, timeZone);
  const start = typeof date2 === "string" ? /* @__PURE__ */ new Date(`${date2}T00:00:00.000`) : new Date(date2);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function appointmentWindow(appointment) {
  if (!appointment.startsAt) return null;
  const startsAt = new Date(appointment.startsAt);
  const start = startsAt.getHours() * 60 + startsAt.getMinutes();
  if (appointment.endsAt) {
    const endsAt = new Date(appointment.endsAt);
    return { start, end: endsAt.getHours() * 60 + endsAt.getMinutes() };
  }
  return { start, end: start + (appointment.durationMinutes || 30) };
}
function buildSlotsForSchedule({
  schedule,
  appointments,
  serviceDuration,
  slotStep = 15,
  includeUnavailable = false,
  blockingWindows = [],
  date: date2,
  timeZone,
  now = /* @__PURE__ */ new Date(),
  occupiedAppointmentBufferMinutes = 0
}) {
  if (!schedule?.isWorking) return [];
  const startMinute = schedule.startMinute ?? 540;
  const endMinute = schedule.endMinute ?? 1020;
  const latestStart = endMinute - serviceDuration;
  const booked = appointments.map(appointmentWindow).filter(Boolean);
  const blocked = blockingWindows.map((window) => {
    const start = new Date(window.startsAt);
    const end = new Date(window.endsAt);
    return { start: start.getHours() * 60 + start.getMinutes(), end: end.getHours() * 60 + end.getMinutes(), reason: window.reason || "Schedule exception" };
  });
  const slots = [];
  for (let minute = startMinute; minute <= latestStart; minute += slotStep) {
    const slotEnd = minute + serviceDuration;
    const duringBreak = typeof schedule.breakStartMinute === "number" && typeof schedule.breakEndMinute === "number" ? overlaps(minute, slotEnd, schedule.breakStartMinute, schedule.breakEndMinute) : false;
    let instant;
    if (date2 && timeZone) {
      try {
        instant = shopWallTime(date2, minute, timeZone);
      } catch {
        continue;
      }
      if (instant <= now) continue;
    }
    const instantEnd = instant ? instant.getTime() + serviceDuration * 6e4 : 0;
    const hitsAppointment = instant ? appointments.some((item) => item.startsAt && overlaps(instant.getTime(), instantEnd, new Date(item.startsAt).getTime(), appointmentOccupiedUntil(item, occupiedAppointmentBufferMinutes, now.getTime()))) : booked.some((window) => overlaps(minute, slotEnd, window.start, window.end));
    const exception = instant ? blockingWindows.find((window) => overlaps(instant.getTime(), instantEnd, new Date(window.startsAt).getTime(), new Date(window.endsAt).getTime())) : blocked.find((window) => overlaps(minute, slotEnd, window.start, window.end));
    const blockedReason = duringBreak ? "Break time" : exception?.reason || (hitsAppointment ? "Already booked" : null);
    const available = !blockedReason;
    if (available || includeUnavailable) {
      slots.push({
        time: minutesToDisplayTime(minute),
        startsAt: instant ? instant.toISOString() : null,
        available,
        barberId: schedule.barber?.id || null,
        barberName: schedule.barber?.displayName || null,
        blockedReason
      });
    }
  }
  return slots;
}
function isSlotAvailable({
  startsAt,
  serviceDuration,
  schedule,
  appointments,
  blockingWindows = [],
  timeZone,
  occupiedAppointmentBufferMinutes = 0
}) {
  if (!schedule?.isWorking) return false;
  const slotStart = timeZone ? shopMinute(startsAt, timeZone) : startsAt.getHours() * 60 + startsAt.getMinutes();
  const slotEnd = slotStart + serviceDuration;
  const occupiedBufferMinutes2 = Math.max(0, occupiedAppointmentBufferMinutes || 0);
  const startMinute = schedule.startMinute ?? 540;
  const endMinute = schedule.endMinute ?? 1020;
  if (slotStart < startMinute || slotEnd > endMinute) return false;
  if (typeof schedule.breakStartMinute === "number" && typeof schedule.breakEndMinute === "number") {
    if (overlaps(slotStart, slotEnd, schedule.breakStartMinute, schedule.breakEndMinute)) return false;
  }
  if (blockingWindows.some((window) => {
    const blockedStart = new Date(window.startsAt).getTime();
    const blockedEnd = new Date(window.endsAt).getTime();
    const requestedStart = startsAt.getTime();
    return requestedStart < blockedEnd && blockedStart < requestedStart + serviceDuration * 6e4;
  })) return false;
  return !appointments.some((appointment) => {
    if (timeZone && appointment.startsAt) {
      const start = new Date(appointment.startsAt).getTime();
      const end = appointmentOccupiedUntil(appointment, occupiedBufferMinutes2);
      return overlaps(startsAt.getTime(), startsAt.getTime() + serviceDuration * 6e4, start, end);
    }
    const window = appointmentWindow(appointment);
    return window ? overlaps(slotStart, slotEnd, window.start, window.end + occupiedBufferMinutes2) : false;
  });
}
var dayKeys;
var init_availability = __esm({
  "features/keystone/utils/availability.ts"() {
    "use strict";
    init_shop_time();
    dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  }
});

// features/keystone/utils/serializableTransaction.ts
function isSerializableWriteConflict(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");
}
async function runSerializableTransaction(prisma, operation, maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        maxWait: 5e3,
        timeout: 1e4,
        isolationLevel: "Serializable"
      });
    } catch (error) {
      if (!isSerializableWriteConflict(error) || attempt === maxAttempts) throw error;
      const backoffMs = Math.min(100, 5 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 10);
      await new Promise((resolve2) => setTimeout(resolve2, backoffMs));
    }
  }
  throw new Error("Unable to serialize transaction.");
}
var init_serializableTransaction = __esm({
  "features/keystone/utils/serializableTransaction.ts"() {
    "use strict";
  }
});

// features/keystone/utils/bookingCapacity.ts
function shopDayAppointmentCandidateFilter(start, end, occupiedBufferMinutes2) {
  const bufferMinutes = Number.isFinite(occupiedBufferMinutes2) ? Math.max(0, occupiedBufferMinutes2) : 0;
  const earliestPriorEnd = new Date(start.getTime() - bufferMinutes * 6e4);
  return {
    startsAt: { lt: end },
    AND: [{
      OR: [
        { startsAt: { gte: start } },
        { endsAt: { gt: earliestPriorEnd } },
        { endsAt: null },
        // A guest still in the chair occupies it until completed.
        { status: "in_chair" }
      ]
    }]
  };
}
function assertAppointmentCandidateSetComplete(candidates) {
  if (candidates.length > MAX_BOOKING_CAPACITY_CANDIDATES) {
    throw new Error("Availability could not be verified safely because too many appointments match this barber or chair. Try another date or contact the shop.");
  }
}
function bookingResourceKeys(resources) {
  return [
    `service:${resources.serviceId}`,
    `staff:${resources.barberId}`,
    resources.chairNumber ? `chair:${resources.chairNumber}` : null
  ].filter((value) => Boolean(value)).sort();
}
async function lockBookingResources(transaction, resources) {
  for (const resource of bookingResourceKeys(resources)) {
    await transaction.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "barbershop-booking",
      resource
    );
  }
}
var MAX_BOOKING_CAPACITY_CANDIDATES, runSerializableBookingTransaction;
var init_bookingCapacity = __esm({
  "features/keystone/utils/bookingCapacity.ts"() {
    "use strict";
    init_serializableTransaction();
    MAX_BOOKING_CAPACITY_CANDIDATES = 100;
    runSerializableBookingTransaction = runSerializableTransaction;
  }
});

// features/keystone/utils/practitionerAuthority.ts
function hash(value) {
  return (0, import_node_crypto3.createHash)("sha256").update(value).digest("hex");
}
function authoritySnapshot(row) {
  const fixture = isSyntheticAuthority(row);
  const usesLocalFixture = fixture || row.supervisorUsesFixture === true;
  if (fixture && !isLocalAuthorityFixture(row) || usesLocalFixture && row.fixtureAuthorized !== true) {
    throw new Error("Synthetic onboarding records are not practitioner authority.");
  }
  if (!row.jurisdictionCode || !row.scopeDescription || !row.evidenceHash || !row.issuingAuthority) {
    throw new Error("Practitioner authority evidence is incomplete.");
  }
  if (row.supervisionRequired && row.supervisorId === row.barberId) throw new Error("This service requires a different authorized supervising practitioner.");
  if (row.supervisionRequired && (!row.supervisorId || !row.supervisorAuthorized)) {
    throw new Error("This service requires an authorized supervising practitioner.");
  }
  return {
    credentialId: row.id,
    barberId: row.barberId,
    serviceId: row.serviceId,
    shopId: row.shopId,
    credentialType: row.credentialType,
    credentialNumberHash: hash(row.credentialNumber),
    issuingAuthority: row.issuingAuthority,
    jurisdictionCode: row.jurisdictionCode,
    scopeDescription: row.scopeDescription,
    evidenceHash: row.evidenceHash,
    effectiveFrom: row.effectiveFrom.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    verifiedAt: row.verifiedAt.toISOString(),
    supervisionRequired: row.supervisionRequired,
    supervisorId: row.supervisorId,
    ...usesLocalFixture ? { isLocalFixture: true } : {}
  };
}
function notRequiredSnapshot(input) {
  return {
    credentialId: "",
    barberId: input.barberId,
    serviceId: input.serviceId,
    shopId: input.shopId,
    credentialType: "not_required",
    credentialNumberHash: "",
    issuingAuthority: "",
    jurisdictionCode: "",
    scopeDescription: "No practitioner credential required for this service",
    evidenceHash: "",
    effectiveFrom: (/* @__PURE__ */ new Date(0)).toISOString(),
    expiresAt: new Date(Date.UTC(9999, 11, 31)).toISOString(),
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
    supervisionRequired: false,
    supervisorId: null,
    notRequired: true
  };
}
async function requireEffectivePractitionerAuthority(client, input) {
  const [service] = await client.$queryRawUnsafe(
    'SELECT "credentialRequired" FROM "Service" WHERE id = $1 AND "shop" = $2',
    input.serviceId,
    input.shopId
  );
  if (!service) throw new Error("The selected service is not offered by this shop.");
  if (!service.credentialRequired) return notRequiredSnapshot(input);
  const supervisorEvidence = `FROM "PractitionerCredential" supervisor
    WHERE supervisor."shop" = pc."shop" AND supervisor."barber" = pc."supervisor" AND supervisor."service" = pc."service"
      AND supervisor.id <> pc.id AND supervisor."barber" <> pc."barber"
      AND supervisor.status = 'active' AND supervisor."jurisdictionCode" = pc."jurisdictionCode"
      AND ${permittedAuthorityEvidenceSql("supervisor")}
      AND supervisor."evidenceHash" <> '' AND supervisor."issuingAuthority" <> ''
      AND supervisor."verifiedAt" <= CURRENT_TIMESTAMP AND supervisor."effectiveFrom" <= $4 AND supervisor."expiresAt" > $4`;
  const rows = await client.$queryRawUnsafe(`
    SELECT pc.id, pc."barber" AS "barberId", pc."service" AS "serviceId", pc."shop" AS "shopId", pc."credentialType",
      pc."credentialNumber", pc."issuingAuthority", pc."jurisdictionCode", pc."scopeDescription",
      pc."evidenceHash", pc."effectiveFrom", pc."expiresAt", pc."verifiedAt",
      pc."supervisionRequired", pc."supervisor" AS "supervisorId",
      ${localFixtureScopeSql("shop")} AS "fixtureAuthorized",
      CASE WHEN pc."supervisionRequired" = false THEN true ELSE EXISTS (SELECT 1 ${supervisorEvidence}) END AS "supervisorAuthorized",
      CASE WHEN pc."supervisionRequired" = false THEN false ELSE EXISTS (SELECT 1 ${supervisorEvidence} AND supervisor."credentialNumber" LIKE 'DEMO-NOT-A-LICENSE-%') END AS "supervisorUsesFixture"
    FROM "PractitionerCredential" pc
    JOIN "Shop" shop ON shop.id = pc."shop" AND shop."jurisdictionCode" = pc."jurisdictionCode"
    WHERE pc."shop" = $1 AND pc."barber" = $2 AND pc."service" = $3
      AND pc.status = 'active' AND pc."effectiveFrom" <= $4 AND pc."expiresAt" > $4
      AND ${permittedAuthorityEvidenceSql("pc")}
      AND pc."evidenceHash" <> '' AND pc."issuingAuthority" <> ''
      AND pc."verifiedAt" <= CURRENT_TIMESTAMP
    ORDER BY pc."verifiedAt" DESC, pc."effectiveFrom" DESC
    LIMIT 2
  `, input.shopId, input.barberId, input.serviceId, input.at);
  const row = rows[0];
  if (!row) throw new Error("The selected practitioner has no effective credential for this service and shop jurisdiction.");
  if (rows.length > 1) throw new Error("Practitioner authority is ambiguous because multiple credentials are effective for this service time.");
  return authoritySnapshot(row);
}
function assertAuthorityMatches(snapshot, input) {
  if (snapshot.shopId !== input.shopId || snapshot.barberId !== input.barberId || snapshot.serviceId !== input.serviceId) {
    throw new Error("Practitioner authority evidence does not match this appointment.");
  }
  if (new Date(snapshot.effectiveFrom) > input.at || new Date(snapshot.expiresAt) <= input.at) {
    throw new Error("Practitioner authority evidence is not effective for this service time.");
  }
}
var import_node_crypto3;
var init_practitionerAuthority = __esm({
  "features/keystone/utils/practitionerAuthority.ts"() {
    "use strict";
    import_node_crypto3 = require("node:crypto");
    init_localFixtureAuthority();
  }
});

// features/keystone/utils/publicShop.ts
async function resolvePublishedShop(client, select38 = { id: true }) {
  const database = client;
  const shops = await database.shop.findMany({
    where: { status: "active", isPublic: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 2,
    select: select38
  });
  return shops.length === 1 ? shops[0] : null;
}
var init_publicShop = __esm({
  "features/keystone/utils/publicShop.ts"() {
    "use strict";
  }
});

// features/shared/shop-hours.ts
function toMinute(hour, minute, meridiem) {
  return (Number(hour) % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(minute || 0);
}
function parseHoursRange(text48) {
  if (/^\s*closed\s*$/i.test(text48)) return "closed";
  const match = RANGE.exec(text48);
  if (!match) return null;
  const startMinute = toMinute(match[1], match[2], match[3]);
  const close = toMinute(match[4], match[5], match[6]);
  const endMinute = close === 0 ? 1440 : close;
  return endMinute > startMinute ? { startMinute, endMinute } : null;
}
function postedDayWindow(hours, dayKey) {
  if (!hours || typeof hours !== "object") return null;
  const record = hours;
  const posted = SHOP_HOURS_DAYS.filter((day) => typeof record[day] === "string" && String(record[day]).trim());
  if (!posted.length) return null;
  const value = record[dayKey];
  if (typeof value !== "string" || !value.trim()) return "closed";
  return parseHoursRange(value);
}
function clipToPostedHours(schedule, hours, dayKey) {
  if (!schedule) return null;
  const window = postedDayWindow(hours, dayKey);
  if (window === null) return schedule;
  if (window === "closed") return null;
  const startMinute = Math.max(schedule.startMinute ?? 0, window.startMinute);
  const endMinute = Math.min(schedule.endMinute ?? 1440, window.endMinute);
  return endMinute > startMinute ? { ...schedule, startMinute, endMinute } : null;
}
function normalizeShopHours(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Enter hours for each day." };
  const record = input;
  const hours = {};
  for (const day of SHOP_HOURS_DAYS) {
    const text48 = typeof record[day] === "string" ? String(record[day]).trim() : "";
    const parsed = parseHoursRange(text48 || "Closed");
    if (!parsed) return { error: `Hours for ${day[0].toUpperCase()}${day.slice(1)} must look like 9:00 AM - 7:00 PM, or Closed.` };
    hours[day] = parsed === "closed" ? "Closed" : text48;
  }
  return { hours };
}
function nextPostedOpening(hours, todayKey, nowMinute) {
  const order = SHOP_HOURS_DAYS;
  const start = order.indexOf(todayKey);
  if (start < 0) return null;
  for (let offset = 0; offset < 8; offset += 1) {
    const day = order[(start + offset) % 7];
    const window = postedDayWindow(hours, day);
    if (window === null) return null;
    if (window === "closed" || offset === 0 && window.startMinute <= nowMinute) continue;
    const hour = Math.floor(window.startMinute / 60);
    const clock = `${hour % 12 || 12}:${pad(window.startMinute % 60)} ${hour >= 12 ? "PM" : "AM"}`;
    return offset === 0 ? `Opens ${clock}` : `Opens ${HOURS_DAY_LABELS[day]} ${clock}`;
  }
  return null;
}
var SHOP_HOURS_DAYS, RANGE, pad, HOURS_DAY_LABELS;
var init_shop_hours = __esm({
  "features/shared/shop-hours.ts"() {
    "use strict";
    SHOP_HOURS_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    RANGE = /^\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)\s*$/i;
    pad = (value) => String(value).padStart(2, "0");
    HOURS_DAY_LABELS = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction,
  stripeConfigured: () => stripeConfigured
});
function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Online card payments are not set up.");
  return key;
}
function form(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== void 0 && value !== "") body.append(key, String(value));
  return body;
}
async function stripe(path2, init = {}) {
  const response = await fetch(`${API}${path2}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
      ...init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}
    },
    body: init.body,
    redirect: "error"
  });
  const json22 = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json22.error?.message || `Stripe request failed (${response.status}).`);
  return json22;
}
function sessionStatus(session) {
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return "captured";
  if (session.status === "expired") return "expired";
  return "pending";
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
async function createPaymentFunction({ amount, currency, successUrl, cancelUrl, description, idempotencyKey, metadata, customerEmail }) {
  const cents2 = Math.round(Number(amount));
  if (!Number.isSafeInteger(cents2) || cents2 <= 0) throw new Error("Payment amount must be greater than zero.");
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const session = await stripe("/checkout/sessions", {
    method: "POST",
    idempotencyKey: asString(idempotencyKey) || void 0,
    body: form({
      mode: "payment",
      success_url: asString(successUrl),
      cancel_url: asString(cancelUrl),
      .../^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(customerEmail)) ? { customer_email: asString(customerEmail) } : {},
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": asString(currency || "usd").toLowerCase(),
      "line_items[0][price_data][unit_amount]": cents2,
      "line_items[0][price_data][product_data][name]": asString(description) || "Deposit",
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString(value)]))
    })
  });
  return { status: sessionStatus(session), id: session.id, url: session.url, data: { id: session.id, url: session.url, status: session.status, amount: session.amount_total, provider: "stripe" } };
}
async function getPaymentStatusFunction({ paymentId }) {
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(asString(paymentId))}`);
  return { status: sessionStatus(session), amount: session.amount_total, data: { id: session.id, status: session.status, paymentStatus: session.payment_status, paymentIntent: session.payment_intent, amount: session.amount_total } };
}
async function capturePaymentFunction(args) {
  return getPaymentStatusFunction(args);
}
async function refundPaymentFunction({ paymentId, amount, idempotencyKey }) {
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(asString(paymentId))}`);
  if (!session.payment_intent) throw new Error("This payment has nothing to refund.");
  const refund = await stripe("/refunds", {
    method: "POST",
    idempotencyKey: asString(idempotencyKey) || void 0,
    body: form({ payment_intent: session.payment_intent, amount: amount == null ? void 0 : Math.round(Number(amount)) })
  });
  return { status: refund.status === "succeeded" ? "refunded" : refund.status, amount: refund.amount, data: refund };
}
async function handleWebhookFunction() {
  throw new Error("Stripe payments are confirmed from the Checkout Session, not by webhook.");
}
var API, generatePaymentLinkFunction;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    API = "https://api.stripe.com/v1";
    generatePaymentLinkFunction = createPaymentFunction;
  }
});

// features/shared/trusted-origin.ts
function trustedOrigin(env = process.env) {
  const configured = env.APP_ORIGIN || env.NEXT_PUBLIC_APP_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : "");
  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("APP_ORIGIN must be an HTTP(S) origin without credentials or path.");
    if (env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("APP_ORIGIN must use HTTPS in production.");
    return url.origin;
  }
  if (env.NODE_ENV === "production") throw new Error("Set APP_ORIGIN (or RAILWAY_PUBLIC_DOMAIN) before starting production.");
  const port = env.PORT || "3000";
  if (!/^\d{1,5}$/.test(port)) throw new Error("Invalid local application port.");
  return `http://127.0.0.1:${port}`;
}
var init_trusted_origin = __esm({
  "features/shared/trusted-origin.ts"() {
    "use strict";
  }
});

// features/keystone/utils/commandReceipt.ts
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}
function buildCommandReceipt(input) {
  return {
    ...input,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString()
  };
}
function commandReceiptHash(envelope) {
  return (0, import_node_crypto4.createHash)("sha256").update(JSON.stringify(canonicalize(envelope))).digest("hex");
}
async function recordCommandReceipt(transaction, envelope) {
  const serialized = JSON.stringify(canonicalize(envelope));
  if (Buffer.byteLength(serialized) > 1e6) {
    throw new Error("Command receipt snapshot exceeds the supported size.");
  }
  await transaction.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    "barbershop-command-receipt",
    envelope.eventKey
  );
  const payloadHash = commandReceiptHash(envelope);
  const existing = await transaction.commandReceipt.findUnique({ where: { eventKey: envelope.eventKey } });
  if (existing) {
    if (existing.eventType !== envelope.eventType || existing.shopId !== envelope.shopId || existing.payloadHash !== payloadHash) {
      throw new Error("Command receipt idempotency key was reused with a different snapshot.");
    }
    return { id: existing.id, created: false };
  }
  const event = await transaction.commandReceipt.create({
    data: {
      eventKey: envelope.eventKey,
      eventType: envelope.eventType,
      schemaVersion: envelope.schemaVersion,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      shopId: envelope.shopId,
      ...envelope.actorId ? { actorId: envelope.actorId } : {},
      payload: envelope,
      payloadHash,
      occurredAt: new Date(envelope.occurredAt)
    }
  });
  return { id: event.id, created: true };
}
var import_node_crypto4;
var init_commandReceipt = __esm({
  "features/keystone/utils/commandReceipt.ts"() {
    "use strict";
    import_node_crypto4 = require("node:crypto");
  }
});

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundPaymentFunction: () => refundPaymentFunction2
});
function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function asString2(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
async function handleWebhookFunction2() {
  throw new Error("Pay-in-person payments do not accept webhooks.");
}
async function createPaymentFunction2({ amount, currency }) {
  return {
    status: "pending",
    data: {
      status: "pending",
      amount: asNumber(amount),
      currency: asString2(currency, "usd").toLowerCase(),
      provider: "manual",
      settlement: "offline"
    }
  };
}
async function capturePaymentFunction2() {
  throw new Error("Pay-in-person payments are not captured by a processor. Record the payment at checkout.");
}
async function refundPaymentFunction2() {
  throw new Error("Pay-in-person payments are not refunded by a processor. Record a cash refund from the checkout receipt.");
}
async function getPaymentStatusFunction2() {
  throw new Error("Pay-in-person payments have no processor status to check.");
}
async function generatePaymentLinkFunction2() {
  return null;
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// features/integrations/payment/index.ts
function isPaymentProviderAdapterCode(value) {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value);
}
function getPaymentProviderRegistration(code) {
  return isPaymentProviderAdapterCode(code) ? paymentProviderAdapters[code] : null;
}
var paymentProviderAdapters;
var init_payment = __esm({
  "features/integrations/payment/index.ts"() {
    "use strict";
    paymentProviderAdapters = {
      manual: {
        load: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
        settlement: "offline",
        allowsPublicSettlement: false,
        webhook: null
      },
      // Online deposits through Stripe Checkout; needs STRIPE_SECRET_KEY (as in E-commerce).
      stripe: {
        load: () => Promise.resolve().then(() => (init_stripe(), stripe_exports)),
        settlement: "processor",
        allowsPublicSettlement: true,
        webhook: null
      }
    };
  }
});

// features/keystone/utils/paymentProviderAdapter.ts
function adapterCodeForProvider(provider) {
  const code = provider.code.replace(/^pp_/, "");
  const registration = getPaymentProviderRegistration(code);
  if (!registration) {
    throw new Error(`Payment adapter ${code || provider.code} is not registered.`);
  }
  return code;
}
function paymentProviderSettlement(provider) {
  const registration = getPaymentProviderRegistration(provider.code.replace(/^pp_/, ""));
  return registration?.settlement === "processor" ? "processor" : "offline";
}
function isOfflinePaymentProvider(provider) {
  return paymentProviderSettlement(provider) === "offline";
}
async function executeAdapterFunction({ provider, functionName, args }) {
  const adapterCode = adapterCodeForProvider(provider);
  const configuredSelector = provider[functionName];
  if (typeof configuredSelector === "string" && configuredSelector !== adapterCode) {
    throw new Error(`Payment adapter selector for ${functionName} is not registered for ${adapterCode}.`);
  }
  const registration = getPaymentProviderRegistration(adapterCode);
  if (!registration) throw new Error(`Payment adapter ${adapterCode} is not registered.`);
  const adapter = await registration.load();
  const fn = adapter[functionName];
  if (!fn) {
    throw new Error(`Function ${functionName} is not available in payment adapter ${adapterCode}.`);
  }
  try {
    return await fn({ provider: { code: provider.code }, ...args });
  } catch (error) {
    throw new Error(
      `Error executing ${functionName} for payment adapter ${adapterCode}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
async function createPayment({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "createPaymentFunction", args });
}
async function capturePayment({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "capturePaymentFunction", args });
}
async function refundPayment({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "refundPaymentFunction", args });
}
async function getPaymentStatus({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "getPaymentStatusFunction", args });
}
var init_paymentProviderAdapter = __esm({
  "features/keystone/utils/paymentProviderAdapter.ts"() {
    "use strict";
    init_payment();
  }
});

// features/keystone/mutations/publicDeposits.ts
async function onlineDepositProvider(prisma, shopId) {
  if (!stripeConfigured()) return null;
  return prisma.paymentProvider.findFirst({ where: { shopId, code: STRIPE_CODE, isInstalled: true }, select: { id: true, code: true } });
}
async function getPublicPaymentOptions(_root, _args, context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  return { onlineDeposits: Boolean(shop && await onlineDepositProvider(prisma, shop.id)) };
}
async function loadAppointment(context, args) {
  const prisma = context.sudo().prisma;
  const appointment = await prisma.appointment.findUnique({
    where: { id: String(args.appointmentId || "") },
    select: { id: true, shopId: true, status: true, paymentStatus: true, depositAmount: true, serviceTitleSnapshot: true, publicAccessTokenHash: true, accountId: true, customer: { select: { email: true } } }
  });
  if (!appointment) throw new Error("Appointment not found.");
  assertAppointmentAccess({ token: args.accessToken?.trim() || "", storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId: context.session?.itemId || null });
  return { prisma, appointment };
}
async function startDepositCheckout(_root, args, context) {
  try {
    const { prisma, appointment } = await loadAppointment(context, args);
    if (!["requested", "confirmed"].includes(String(appointment.status)) || appointment.paymentStatus !== "deposit_due") throw new Error("This visit has no deposit to pay.");
    const amount = appointment.depositAmount || 0;
    if (amount <= 0) throw new Error("This visit has no deposit to pay.");
    const provider = await onlineDepositProvider(prisma, appointment.shopId);
    if (!provider) throw new Error("Online deposits are not available. Pay the deposit in the shop.");
    const open = (await prisma.paymentSession.findMany({ where: { appointmentId: appointment.id, paymentProviderId: provider.id, status: "pending", amount }, orderBy: { createdAt: "desc" }, take: 5 })).find((row) => row.metadata?.purpose !== "desk_card");
    const openUrl = open && typeof open.metadata?.checkoutUrl === "string" ? String(open.metadata.checkoutUrl) : "";
    if (open && openUrl && (!open.expiresAt || open.expiresAt > /* @__PURE__ */ new Date())) return { success: true, error: null, data: { url: openUrl } };
    const origin = trustedOrigin();
    const returnTo = `${origin}/appointment?id=${encodeURIComponent(appointment.id)}`;
    const key = (0, import_node_crypto5.randomUUID)();
    const result = await createPayment({
      provider: { code: provider.code },
      amount,
      currency: "usd",
      description: `Deposit \xB7 ${appointment.serviceTitleSnapshot || "Appointment"}`,
      successUrl: `${returnTo}&deposit=return`,
      cancelUrl: `${returnTo}&deposit=cancelled`,
      idempotencyKey: key,
      metadata: { appointmentId: appointment.id },
      customerEmail: appointment.customer?.email || ""
    });
    if (!result.id || !result.url) throw new Error("Stripe did not open a checkout.");
    await prisma.paymentSession.create({ data: {
      shopId: appointment.shopId,
      appointmentId: appointment.id,
      paymentProviderId: provider.id,
      idempotencyKeyHash: hashPublicAccessToken(`deposit:${key}`),
      status: "pending",
      amount,
      currencyCode: "USD",
      providerPaymentId: result.id,
      expiresAt: new Date(Date.now() + 23 * 36e5),
      metadata: { checkoutUrl: result.url, purpose: "deposit" }
    } });
    return { success: true, error: null, data: { url: result.url } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to open the deposit checkout.", data: null };
  }
}
async function confirmDepositCheckout(_root, args, context) {
  try {
    const { prisma, appointment } = await loadAppointment(context, args);
    if (appointment.paymentStatus === "deposit_paid") return { success: true, error: null, data: { paid: true } };
    const session = (await prisma.paymentSession.findMany({ where: { appointmentId: appointment.id, status: "pending", paymentProvider: { code: STRIPE_CODE } }, orderBy: { createdAt: "desc" }, take: 5, include: { paymentProvider: { select: { code: true } } } })).find((row) => row.metadata?.purpose !== "desk_card");
    if (!session || !session.paymentProvider) return { success: true, error: null, data: { paid: false } };
    const status = await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId });
    if (status.status === "expired") {
      await prisma.paymentSession.update({ where: { id: session.id }, data: { status: "expired" } });
      return { success: true, error: null, data: { paid: false } };
    }
    if (status.status !== "captured") return { success: true, error: null, data: { paid: false } };
    if (Number(status.amount) !== session.amount) throw new Error("The amount paid does not match the deposit. Contact the shop.");
    const capturedAt = /* @__PURE__ */ new Date();
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.paymentSession.updateMany({ where: { id: session.id, status: "pending" }, data: { status: "captured", capturedAt } });
      if (!claimed.count) return;
      await transaction.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: "deposit_paid" } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        eventKey: `payment-session:${session.id}:captured:v1`,
        eventType: "payment_session.captured",
        aggregateType: "payment_session",
        aggregateId: session.id,
        shopId: appointment.shopId,
        occurredAt: capturedAt,
        data: { paymentSession: { id: session.id, appointmentId: appointment.id, amount: session.amount, purpose: "deposit" } }
      }));
    });
    return { success: true, error: null, data: { paid: true } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to check the deposit.", data: null };
  }
}
var import_node_crypto5, STRIPE_CODE;
var init_publicDeposits = __esm({
  "features/keystone/mutations/publicDeposits.ts"() {
    "use strict";
    import_node_crypto5 = require("node:crypto");
    init_stripe();
    init_trusted_origin();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_publicShop();
    init_publicAccessToken();
    init_waiverEvidence();
    STRIPE_CODE = "pp_stripe";
  }
});

// features/keystone/queries/checkBarberAvailability.ts
async function checkBarberAvailability(_root, args, context) {
  const barberId = args.barberId?.trim();
  const serviceDuration = Math.min(480, Math.max(5, Math.floor(Number(args.serviceDuration || 30))));
  if (!barberId || !args.serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(args.date || "")) return [];
  const sudo = context.sudo();
  const [barber, publishedShop] = await Promise.all([
    sudo.prisma.barber.findUnique({ where: { id: barberId }, select: { id: true, status: true, bookingEnabled: true, bufferMinutes: true, chairId: true, chair: { select: { id: true, status: true } }, shop: { select: { id: true, status: true, isPublic: true, timezone: true, hours: true } } } }),
    resolvePublishedShop(sudo.prisma, { id: true })
  ]);
  const shop = barber?.shop;
  if (!barber || !publishedShop || barber.status !== "active" || !barber.bookingEnabled || !barber.chair || barber.chair.status !== "active" || shop?.id !== publishedShop.id || shop.status !== "active" || !shop.isPublic) return [];
  const service = await sudo.prisma.service.findFirst({ where: { id: args.serviceId, shopId: shop.id, status: "active" }, select: { id: true, durationMinutes: true, depositRequired: true, bookingBufferMinutes: true, specialists: { select: { id: true } } } });
  if (service?.depositRequired && !await onlineDepositProvider(sudo.prisma, shop.id)) return [];
  if (!service || service.durationMinutes !== serviceDuration || service.specialists.length && !service.specialists.some((item) => item.id === barberId)) return [];
  const timeZone = shop.timezone || "UTC";
  const dayOfWeek = dayKeyForDate(args.date, timeZone);
  const { start, end } = dayRange(args.date, timeZone);
  if (Number.isNaN(start.getTime()) || end <= /* @__PURE__ */ new Date() || start.getTime() > Date.now() + BOOKING_HORIZON_MS) return [];
  const minute = (value) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, service.bookingBufferMinutes);
  const [schedules, exceptions, appointments, shifts] = await Promise.all([
    sudo.query.BarberSchedule.findMany({ where: { barber: { id: { equals: barberId } }, isWorking: { equals: true } }, query: "id dayOfWeek isWorking startMinute endMinute breakStartMinute breakEndMinute barber { id displayName }", take: 7 }),
    sudo.prisma.scheduleException.findMany({ where: { shopId: shop.id, status: "active", startsAt: { lt: end }, endsAt: { gt: start }, OR: [{ barberId }, { exceptionType: "shop_closure", barberId: null, chairId: null }, ...barber.chairId ? [{ chairId: barber.chairId }] : []] }, select: { exceptionType: true, startsAt: true, endsAt: true, reason: true } }),
    sudo.prisma.appointment.findMany({ where: { shopId: shop.id, ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes), status: { in: ["requested", "confirmed", "checked_in", "in_chair"] }, OR: [{ barberId }, ...barber.chairId ? [{ chairId: barber.chairId }] : []] }, select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true, status: true }, take: MAX_BOOKING_CAPACITY_CANDIDATES + 1 }),
    sudo.prisma.staffShift.findMany({ where: { shopId: shop.id, barberId, status: { in: ["scheduled", "clocked_in"] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } }, select: { scheduledStart: true, scheduledEnd: true } })
  ]);
  assertAppointmentCandidateSetComplete(appointments);
  const weekly = schedules.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const override = exceptions.find((item) => item.exceptionType === "working_override");
  const schedule = clipToPostedHours(override ? { id: `override-${barberId}`, dayOfWeek, isWorking: true, startMinute: minute(override.startsAt), endMinute: minute(override.endsAt), barber: { id: barberId, displayName: "" } } : weekly, shop.hours, dayOfWeek);
  if (!schedule) return [];
  const orderedShifts = [...shifts].sort((left, right) => left.scheduledStart.getTime() - right.scheduledStart.getTime());
  const effectiveSchedule = orderedShifts.length ? { ...schedule, startMinute: Math.max(schedule.startMinute ?? 0, minute(orderedShifts[0].scheduledStart)), endMinute: Math.min(schedule.endMinute ?? 1440, minute(orderedShifts[orderedShifts.length - 1].scheduledEnd)) } : schedule;
  const shiftGaps = orderedShifts.slice(0, -1).map((shift, index) => ({ startsAt: shift.scheduledEnd, endsAt: orderedShifts[index + 1].scheduledStart, reason: "Outside scheduled shift" })).filter((gap) => gap.endsAt > gap.startsAt);
  const slots = buildSlotsForSchedule({
    schedule: effectiveSchedule,
    date: args.date,
    timeZone,
    appointments: appointments.map((item) => ({ id: item.id, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt ? item.endsAt.toISOString() : null, durationMinutes: item.durationMinutes, status: item.status || null, barber: item.barberId ? { id: item.barberId } : null })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    serviceDuration: serviceDuration + bufferMinutes,
    includeUnavailable: Boolean(args.includeUnavailable),
    blockingWindows: [...exceptions.filter((item) => item.exceptionType !== "working_override").map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason })), ...shiftGaps]
  });
  const checked = await Promise.all(slots.map(async (slot) => {
    if (!slot.available) return slot;
    try {
      await requireEffectivePractitionerAuthority(sudo.prisma, { shopId: shop.id, barberId, serviceId: service.id, at: slot.startsAt ? new Date(slot.startsAt) : shopWallTime(args.date, displayTimeToMinutes(slot.time), timeZone) });
      return slot;
    } catch {
      return { ...slot, available: false, blockedReason: "Practitioner authority unavailable" };
    }
  }));
  return checked.filter((slot) => slot.available || args.includeUnavailable);
}
var BOOKING_HORIZON_MS;
var init_checkBarberAvailability = __esm({
  "features/keystone/queries/checkBarberAvailability.ts"() {
    "use strict";
    init_availability();
    init_bookingCapacity();
    init_practitionerAuthority();
    init_availability();
    init_shop_time();
    init_publicShop();
    init_shop_hours();
    init_publicDeposits();
    BOOKING_HORIZON_MS = 90 * 864e5;
  }
});

// features/shared/guest-booking-command.ts
function guestBookingBody(input) {
  return {
    purpose: GUEST_BOOKING_PURPOSE,
    shopId: input.shopId.trim(),
    serviceId: input.serviceId.trim(),
    barberId: input.barberId?.trim() || null,
    startsAt: input.startsAt,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerEmail: input.customerEmail.trim(),
    notes: input.notes.trim(),
    ...input.reviewedPrice === void 0 ? {} : { reviewedPrice: input.reviewedPrice },
    ...input.reviewedDurationMinutes === void 0 ? {} : { reviewedDurationMinutes: input.reviewedDurationMinutes },
    ...input.reviewedPolicyVersion === void 0 ? {} : { reviewedPolicyVersion: input.reviewedPolicyVersion }
  };
}
function parseGuestBookingBody(bytes) {
  if (typeof bytes !== "string" || bytes.length > 12e3) throw new Error("Invalid booking command.");
  const value = JSON.parse(bytes);
  if (!value || value.purpose !== GUEST_BOOKING_PURPOSE || !["shopId", "serviceId", "startsAt", "customerName", "customerPhone", "customerEmail", "notes"].every((key) => typeof value[key] === "string") || !(value.barberId === null || typeof value.barberId === "string") || !isWholeNumber(value.reviewedPrice) || !isWholeNumber(value.reviewedDurationMinutes) || !(value.reviewedPolicyVersion === void 0 || typeof value.reviewedPolicyVersion === "string" && value.reviewedPolicyVersion.length <= 400)) throw new Error("Invalid booking command.");
  const body = guestBookingBody(value);
  if (!body.shopId || !body.serviceId || body.shopId.length > 200 || body.serviceId.length > 200 || body.barberId && body.barberId.length > 200 || body.customerName.length < 2 || body.customerName.length > 120 || body.customerPhone.replace(/\D/g, "").length < 7 || body.customerPhone.length > 40 || body.customerEmail.length > 254 || body.notes.length > 2e3 || !Number.isFinite(new Date(body.startsAt).getTime()) || new Date(body.startsAt).toISOString() !== body.startsAt || JSON.stringify(body) !== bytes) throw new Error("Invalid booking command.");
  return body;
}
function validateGuestBookingCommand(command) {
  if (!PRIVATE_COMMAND_PATTERN.test(command.requestKey) || !PRIVATE_COMMAND_PATTERN.test(command.guestProof)) throw new Error("Invalid booking command.");
  return parseGuestBookingBody(command.requestBody);
}
var GUEST_BOOKING_PURPOSE, PRIVATE_COMMAND_PATTERN, isWholeNumber;
var init_guest_booking_command = __esm({
  "features/shared/guest-booking-command.ts"() {
    "use strict";
    GUEST_BOOKING_PURPOSE = "guest_booking_v1";
    PRIVATE_COMMAND_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
    isWholeNumber = (value) => value === void 0 || typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1e8;
  }
});

// features/keystone/utils/guestBookingCommand.ts
async function lockGuestCommand(tx, key) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-guest-command", key);
}
async function readGuestCommand(tx, command, actor = "guest") {
  const body = validateGuestBookingCommand(command);
  const rows = await tx.$queryRawUnsafe(`SELECT "shop" AS "shopId", "appointment" AS "appointmentId", purpose, actor, "payloadHash", "proofHash", "expiresAt", "revokedAt" FROM "GuestBookingCommand" WHERE "requestKey" = $1 LIMIT 1`, command.requestKey);
  const row = rows[0];
  if (!row) return null;
  if (!publicAccessTokenMatches(command.guestProof, row.proofHash) || row.shopId !== body.shopId || row.purpose !== GUEST_BOOKING_PURPOSE || row.actor !== actor || row.payloadHash !== hash2(command.requestBody) || row.revokedAt || row.expiresAt && (!Number.isFinite(new Date(row.expiresAt).getTime()) || new Date(row.expiresAt).getTime() <= Date.now())) throw new Error("Unresolved booking.");
  if (row.appointmentId) {
    const appointment = await tx.appointment.findUnique({ where: { id: row.appointmentId }, select: { id: true, shopId: true, publicAccessTokenHash: true, accountId: true } });
    if (!appointment || appointment.shopId !== row.shopId || actor !== "guest" && actor !== `account:${appointment.accountId}` || !publicAccessTokenMatches(command.guestProof, appointment.publicAccessTokenHash)) throw new Error("Unresolved booking.");
  }
  const receipts = await tx.$queryRawUnsafe('SELECT receipt FROM "GuestBookingCommand" WHERE "requestKey" = $1 LIMIT 1', command.requestKey);
  if (!receipts[0]) throw new Error("Unresolved booking.");
  row.receipt = receipts[0].receipt;
  if (row.receipt?.version !== 1) throw new Error("Unresolved booking.");
  if (row.receipt.disposition === "closed" && !row.appointmentId && !row.receipt.appointment) {
    return { success: false, disposition: "closed", error: "That earlier request was not booked.", appointment: null, accessToken: null };
  }
  if (row.receipt.disposition !== "accepted" || !row.appointmentId || row.receipt.appointment?.id !== row.appointmentId) throw new Error("Unresolved booking.");
  const service = row.receipt.appointment.service;
  const barber = row.receipt.appointment.barber;
  if (service?.id !== body.serviceId || !barber?.id || body.barberId && barber.id !== body.barberId) throw new Error("Unresolved booking.");
  return { success: true, disposition: "accepted", error: null, appointment: row.receipt.appointment, accessToken: command.guestProof };
}
async function persistGuestCommand(tx, command, receipt, actor = "guest") {
  const body = validateGuestBookingCommand(command);
  await tx.$executeRawUnsafe(`INSERT INTO "GuestBookingCommand" (id, "requestKey", purpose, actor, "payloadHash", "proofHash", "shop", "appointment", receipt, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, (0, import_node_crypto6.randomUUID)(), command.requestKey, body.purpose, actor, hash2(command.requestBody), hashPublicAccessToken(command.guestProof), body.shopId, receipt.appointment?.id || null, JSON.stringify(receipt), /* @__PURE__ */ new Date());
}
async function runGuestCommand(operation) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runSerializableBookingTransaction(domainPrisma, (tx) => operation(tx));
    } catch (error) {
      const conflict = error;
      const raw = error;
      const commandCollision = conflict.code === "P2002" && String(conflict.meta?.target).includes("requestKey") || raw.code === "P2010" && raw.meta?.code === "23505" && raw.meta.message?.includes("GuestBookingCommand_requestKey_key");
      const knownTransactionAbort = raw.code === "P2010" && ["40001", "40P01"].includes(raw.meta?.code || "");
      if (!commandCollision && !knownTransactionAbort || attempt >= 2) throw error;
    }
  }
}
async function recoverGuestBooking(_root, args, context) {
  if (context.session) return unresolvedGuestCommand();
  try {
    validateGuestBookingCommand(args);
    return await runGuestCommand(async (tx) => {
      await lockGuestCommand(tx, args.requestKey);
      const original = await readGuestCommand(tx, args);
      if (original) return original;
      if (!args.closeIfAbsent) return unresolvedGuestCommand();
      await persistGuestCommand(tx, args, { version: 1, disposition: "closed", appointment: null });
      return { success: false, disposition: "closed", error: "That earlier request was not booked.", appointment: null, accessToken: null };
    });
  } catch {
    return unresolvedGuestCommand();
  }
}
var import_node_crypto6, unresolvedGuestCommand, hash2;
var init_guestBookingCommand = __esm({
  "features/keystone/utils/guestBookingCommand.ts"() {
    "use strict";
    import_node_crypto6 = require("node:crypto");
    init_guest_booking_command();
    init_publicAccessToken();
    init_bookingCapacity();
    init_domainPrisma();
    unresolvedGuestCommand = () => ({ success: false, disposition: "unresolved", error: "We couldn\u2019t confirm whether your booking request went through. Check again before booking another time.", appointment: null, accessToken: null });
    hash2 = (bytes) => (0, import_node_crypto6.createHash)("sha256").update(bytes, "utf8").digest("hex");
  }
});

// features/shared/public-booking-eligibility.ts
function parsePublicServiceEligibility(value) {
  if (value == null) return "legacy_active_service";
  if (value === "legacy_active_service" || value === "active_catalog") return value;
  throw new Error("Public service eligibility policy is invalid.");
}
function bookingEligibilityFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || !("policyId" in snapshot) || !("version" in snapshot) || typeof snapshot.policyId !== "string" || typeof snapshot.version !== "string") return null;
  try {
    return publicBookingEligibilityView({
      policyId: snapshot.policyId,
      version: snapshot.version,
      publicServiceEligibility: "publicServiceEligibility" in snapshot ? snapshot.publicServiceEligibility : null
    });
  } catch {
    return null;
  }
}
function publicBookingEligibilityView(policy) {
  const publicServiceEligibility = parsePublicServiceEligibility(policy.publicServiceEligibility);
  return {
    policyId: policy.policyId,
    version: policy.version,
    publicServiceEligibility,
    description: publicServiceEligibility === "active_catalog" ? "Open for services in an active category" : "Open for all active services"
  };
}
var init_public_booking_eligibility = __esm({
  "features/shared/public-booking-eligibility.ts"() {
    "use strict";
  }
});

// features/keystone/utils/bookingPolicy.ts
async function requireEffectiveBookingPolicy(client, input) {
  const rows = await client.$queryRawUnsafe(`
    SELECT policy.* FROM "BookingPolicy" policy
    JOIN "Shop" shop ON shop.id = policy."shop" AND shop."jurisdictionCode" = policy."jurisdictionCode"
    WHERE policy."shop" = $1 AND policy.status = 'active'
      AND policy."effectiveFrom" <= $2
      AND (policy."effectiveUntil" IS NULL OR policy."effectiveUntil" > $2)
    ORDER BY policy."effectiveFrom" DESC, policy."createdAt" DESC
    LIMIT 2
  `, input.shopId, input.at);
  const policy = rows[0];
  if (rows.length > 1) throw new Error("Multiple booking policies are effective; online requests and customer changes are disabled until the conflict is resolved.");
  if (!policy?.policyTextHash || !policy.jurisdictionCode || !policy.version) {
    throw new Error("An effective jurisdiction-matched booking policy is required.");
  }
  return {
    policyId: policy.id,
    name: policy.name,
    version: policy.version,
    jurisdictionCode: policy.jurisdictionCode,
    policyTextHash: policy.policyTextHash,
    publicServiceEligibility: parsePublicServiceEligibility(policy.publicServiceEligibility),
    cancellationWindowMinutes: Math.max(0, policy.cancellationWindowMinutes),
    rescheduleWindowMinutes: Math.max(0, policy.rescheduleWindowMinutes),
    lateCancellationFeeAmount: Math.max(0, policy.lateCancellationFeeAmount),
    rescheduleFeeAmount: Math.max(0, policy.rescheduleFeeAmount),
    depositCancellationRule: policy.depositCancellationRule,
    maxCustomerReschedules: Math.max(0, policy.maxCustomerReschedules),
    effectiveFrom: policy.effectiveFrom.toISOString(),
    effectiveUntil: policy.effectiveUntil?.toISOString() || null
  };
}
async function getBookingEligibilityProjection(client, shopId) {
  try {
    const policy = await requireEffectiveBookingPolicy(client, { shopId, at: /* @__PURE__ */ new Date() });
    return { success: true, error: null, data: publicBookingEligibilityView(policy) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const diagnostic = message.startsWith("Multiple booking policies are effective") ? "Multiple booking policies overlap. A single effective version is required. Contact the shop." : message === "Public service eligibility policy is invalid." ? "The booking eligibility option is invalid. Contact the shop." : message === "An effective jurisdiction-matched booking policy is required." ? "No effective jurisdiction-matched booking policy is configured. Contact the shop." : "Booking policy could not be loaded. Contact the shop.";
    return { success: false, error: diagnostic, data: null };
  }
}
function appointmentChangeConsequences(input) {
  const minutesUntilStart = Math.floor((input.startsAt.getTime() - input.now.getTime()) / 6e4);
  const windowMinutes = input.action === "cancel" ? input.policy.cancellationWindowMinutes : input.policy.rescheduleWindowMinutes;
  const isLate = minutesUntilStart < windowMinutes;
  if (input.action === "reschedule" && (input.priorReschedules || 0) >= input.policy.maxCustomerReschedules) {
    throw new Error("This appointment has reached the customer reschedule limit.");
  }
  const feeAmount = isLate ? input.action === "cancel" ? input.policy.lateCancellationFeeAmount : input.policy.rescheduleFeeAmount : 0;
  const hasDeposit = input.paymentStatus === "deposit_paid" && Number(input.depositAmount || 0) > 0;
  const depositConsequence = !hasDeposit ? "none" : input.action === "cancel" && !isLate ? "refund_required" : input.policy.depositCancellationRule === "refund" ? "refund_required" : input.policy.depositCancellationRule === "forfeit" ? "forfeiture_pending" : "manual_review";
  return { isLate, feeAmount, depositConsequence, minutesUntilStart };
}
var init_bookingPolicy = __esm({
  "features/keystone/utils/bookingPolicy.ts"() {
    "use strict";
    init_public_booking_eligibility();
  }
});

// features/keystone/utils/publicServiceEligibility.ts
function assertPublicServiceEligibility(service, publishedShopId, policy) {
  if (!publishedShopId || service.shopId !== publishedShopId || service.shop.id !== publishedShopId || service.shop.status !== "active" || !service.shop.isPublic || service.status !== "active") {
    throw new Error("Selected service is no longer available.");
  }
  if (service.category && service.category.shopId !== service.shopId || service.categoryId && service.category?.id !== service.categoryId) {
    throw new Error("Selected service category does not belong to this shop.");
  }
  if (parsePublicServiceEligibility(policy) === "active_catalog" && (!service.category || service.category.status !== "active")) {
    throw new Error("This shop accepts online requests only for services in its active public catalog.");
  }
}
var init_publicServiceEligibility = __esm({
  "features/keystone/utils/publicServiceEligibility.ts"() {
    "use strict";
    init_public_booking_eligibility();
  }
});

// features/keystone/utils/accountCustomer.ts
async function resolveBookingCustomer(client, contact, accountId) {
  if (accountId) {
    const linked = await client.customer.findFirst({ where: { shopId: contact.shopId, userId: accountId }, select: { id: true, userId: true } });
    if (linked) return { id: linked.id, reused: true };
    const previous = await client.appointment.findFirst({
      where: { shopId: contact.shopId, accountId, customerId: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { customerId: true }
    });
    if (previous?.customerId) {
      const owned = await client.customer.findFirst({ where: { id: previous.customerId, shopId: contact.shopId }, select: { id: true, userId: true } });
      if (owned) {
        if (!owned.userId && !await client.customer.findUnique({ where: { userId: accountId }, select: { id: true } })) {
          await client.customer.update({ where: { id: owned.id }, data: { userId: accountId } });
        }
        return { id: owned.id, reused: true };
      }
    }
  }
  const linkAccount = accountId && !await client.customer.findUnique({ where: { userId: accountId }, select: { id: true } });
  const created = await client.customer.create({
    data: {
      shopId: contact.shopId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      status: "active",
      ...linkAccount ? { userId: accountId } : {}
    }
  });
  return { id: created.id, reused: false };
}
var init_accountCustomer = __esm({
  "features/keystone/utils/accountCustomer.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/createOnlineBooking.ts
function clean(value) {
  return value?.trim() || "";
}
async function bookingCandidates(sudo, service, requestedBarberId) {
  const shopId = service.shop?.id;
  if (!shopId) return [];
  const bookable = { shop: { id: { equals: shopId } }, status: { equals: "active" }, bookingEnabled: { equals: true } };
  if (requestedBarberId) {
    return sudo.query.Barber.findMany({ where: { id: { equals: requestedBarberId }, ...bookable }, query: BARBER_QUERY, take: 1 });
  }
  const specialistIds = (service.specialists || []).map((specialist) => specialist.id);
  return sudo.query.Barber.findMany({
    where: { ...bookable, ...specialistIds.length ? { id: { in: specialistIds } } : {} },
    query: BARBER_QUERY,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: MAX_FIRST_AVAILABLE_CANDIDATES
  });
}
function isAdmissionRefusal(error) {
  if (error instanceof BookingRejected) return true;
  if (!(error instanceof Error)) return false;
  const known = error;
  return known.code === void 0 && !error.constructor.name.startsWith("PrismaClient");
}
async function createLockedAppointment({
  transaction,
  serviceId,
  barberId,
  expectedChairNumber,
  expectedShopId,
  startsAt,
  customerName,
  customerPhone,
  customerEmail,
  notes,
  publicAccess,
  accountId,
  reviewed
}) {
  await lockBookingResources(transaction, { serviceId, barberId });
  const [service, barber, publishedShop] = await Promise.all([
    transaction.service.findUnique({
      where: { id: serviceId },
      include: {
        shop: { select: { id: true, status: true, isPublic: true, timezone: true, hours: true } },
        category: { select: { id: true, shopId: true, status: true } },
        specialists: { select: { id: true } }
      }
    }),
    transaction.barber.findUnique({ where: { id: barberId }, include: { chair: { select: { id: true, shopId: true, status: true } } } }),
    resolvePublishedShop(transaction, { id: true })
  ]);
  if (!service || service.status !== "active" || !service.shopId || !publishedShop || service.shopId !== publishedShop.id || expectedShopId !== void 0 && service.shopId !== expectedShopId || service.shop.status !== "active" || !service.shop.isPublic) throw new BookingRejected("Selected service is no longer available.");
  if (service.depositRequired && !await onlineDepositProvider(transaction, publishedShop.id)) {
    throw new BookingRejected("Online booking for deposit-required services is unavailable until a customer payment provider is connected.");
  }
  if (!barber || barber.status !== "active" || !barber.bookingEnabled) {
    throw new BookingRejected("Selected barber is no longer available.");
  }
  if (!barber.chair) throw new BookingRejected("The selected barber does not have an assigned chair.");
  if (barber.shopId !== service.shopId || barber.chair.shopId !== service.shopId) {
    throw new BookingRejected("Selected service, barber, and chair must belong to the same shop.");
  }
  if (barber.chair.status !== "active") throw new BookingRejected("The selected barber chair is unavailable.");
  await lockBookingResources(transaction, { serviceId, barberId, chairNumber: `${service.shopId}:${barber.chair.id}` });
  if ((barber.chairNumber || "") !== expectedChairNumber) {
    throw new BookingRejected("The selected barber chair changed. Refresh availability and try again.");
  }
  if (service.specialists.length > 0 && !service.specialists.some((specialist) => specialist.id === barber.id)) {
    throw new BookingRejected("Selected barber does not provide this service.");
  }
  const bookingPolicy = await requireEffectiveBookingPolicy(transaction, { shopId: service.shopId, at: /* @__PURE__ */ new Date() });
  assertPublicServiceEligibility(service, publishedShop.id, bookingPolicy.publicServiceEligibility);
  if (reviewed) {
    if (reviewed.price !== void 0 && reviewed.price !== (service.price || 0)) throw new BookingRejected("The price of this service has changed. Review the updated price and book again.");
    if (reviewed.durationMinutes !== void 0 && reviewed.durationMinutes !== service.durationMinutes) throw new BookingRejected("The length of this service has changed. Review the updated details and book again.");
    if (reviewed.policyVersion !== void 0 && reviewed.policyVersion !== `${bookingPolicy.policyId}:${bookingPolicy.version}`) throw new BookingRejected("The shop\u2019s booking policy has changed. Review it and book again.");
  }
  const timeZone = service.shop.timezone;
  if (!timeZone) throw new BookingRejected("Shop timezone is unavailable.");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(startsAt);
  } catch {
    throw new BookingRejected("Shop timezone is unavailable.");
  }
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 1) throw new BookingRejected("Service duration is unavailable.");
  if (startsAt.getTime() < Date.now() + 5 * 6e4 || startsAt.getTime() > Date.now() + 90 * 864e5) throw new BookingRejected("Choose an appointment at least 5 minutes and no more than 90 days from now.");
  const { start, end } = dayRange(startsAt, timeZone);
  const minute = (value) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const durationMinutes = service.durationMinutes;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 6e4);
  const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, service.bookingBufferMinutes);
  const occupiedEndsAt = new Date(endsAt.getTime() + bufferMinutes * 6e4);
  const [weeklySchedule, exceptions, shifts] = await Promise.all([
    transaction.barberSchedule.findFirst({
      where: {
        barberId,
        dayOfWeek: dayKeyForDate(startsAt, timeZone),
        isWorking: true
      }
    }),
    transaction.scheduleException.findMany({
      where: {
        shopId: service.shopId,
        status: "active",
        startsAt: { lt: occupiedEndsAt },
        endsAt: { gt: startsAt },
        OR: [
          { barberId },
          { exceptionType: "shop_closure", barberId: null, chairId: null },
          ...barber.chairId ? [{ chairId: barber.chairId }] : []
        ]
      }
    }),
    transaction.staffShift.findMany({ where: { shopId: service.shopId, barberId, status: { in: ["scheduled", "clocked_in"] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } }, orderBy: { scheduledStart: "asc" } })
  ]);
  const blockingExceptions = exceptions.filter((item) => item.exceptionType !== "working_override");
  if (blockingExceptions.length) throw new BookingRejected(blockingExceptions[0].reason || "That time is blocked by a schedule exception.");
  const override = exceptions.find((item) => item.exceptionType === "working_override");
  const baseSchedule = override ? {
    id: override.id,
    barberId,
    dayOfWeek: dayKeyForDate(startsAt, timeZone),
    isWorking: true,
    startMinute: minute(override.startsAt),
    endMinute: minute(override.endsAt),
    breakStartMinute: null,
    breakEndMinute: null,
    notes: override.reason,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt
  } : weeklySchedule;
  if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && occupiedEndsAt <= shift.scheduledEnd)) throw new BookingRejected("That time is outside the barber\u2019s scheduled shift.");
  const schedule = clipToPostedHours(baseSchedule, service.shop.hours, dayKeyForDate(startsAt, timeZone));
  const appointments = await transaction.appointment.findMany({
    where: {
      shopId: service.shopId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes),
      OR: [
        { barberId },
        ...barber.chair?.id ? [{ chairId: barber.chair.id }] : []
      ]
    },
    select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true, status: true },
    take: MAX_BOOKING_CAPACITY_CANDIDATES + 1
  });
  assertAppointmentCandidateSetComplete(appointments);
  if (!isSlotAvailable({
    startsAt,
    timeZone,
    serviceDuration: durationMinutes + bufferMinutes,
    schedule: schedule ? {
      ...schedule,
      dayOfWeek: String(schedule.dayOfWeek),
      barber: { id: barber.id, displayName: barber.displayName }
    } : null,
    appointments: appointments.map((appointment2) => ({
      id: appointment2.id,
      startsAt: appointment2.startsAt.toISOString(),
      endsAt: appointment2.endsAt?.toISOString() || null,
      durationMinutes: appointment2.durationMinutes || 30,
      status: appointment2.status,
      barber: appointment2.barberId ? { id: appointment2.barberId } : null
    })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    blockingWindows: blockingExceptions.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason }))
  })) {
    throw new BookingRejected("That slot was just taken or is outside working hours. Choose another time.");
  }
  const [bookingAuthority, waiverRequirement] = await Promise.all([
    requireEffectivePractitionerAuthority(transaction, { shopId: service.shopId, barberId: barber.id, serviceId: service.id, at: startsAt }),
    getWaiverRequirement(transaction, service.id)
  ]);
  const [firstName, ...rest] = customerName.split(/\s+/);
  const customer = await resolveBookingCustomer(transaction, {
    shopId: service.shopId,
    firstName: firstName || customerName,
    lastName: rest.join(" "),
    phone: customerPhone,
    email: customerEmail
  }, accountId);
  const appointment = await transaction.appointment.create({
    data: {
      shopId: service.shopId,
      accountId,
      chairId: barber.chair?.id || null,
      startsAt,
      endsAt,
      durationMinutes,
      serviceTitleSnapshot: service.name || "Barbershop service",
      serviceImagePathSnapshot: service.imagePath || "",
      serviceModifiersSnapshot: [],
      barberNameSnapshot: barber.displayName || "",
      barberChairNumberSnapshot: barber.chairNumber || "",
      status: "requested",
      source: "online",
      paymentStatus: service.depositRequired ? "deposit_due" : "not_required",
      price: service.price || 0,
      depositAmount: service.depositAmount || 0,
      customerNotes: notes,
      guestNameSnapshot: customerName,
      publicAccessTokenHash: publicAccess.hash,
      serviceId: service.id,
      barberId: barber.id,
      customerId: customer.id
    },
    include: {
      service: { select: { id: true, name: true, durationMinutes: true, price: true, imagePath: true } },
      barber: { select: { id: true, displayName: true, chairNumber: true, imagePath: true } },
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } }
    }
  });
  await transaction.$executeRawUnsafe(`
    UPDATE "Appointment"
    SET "bookingAuthoritySnapshot" = $2::jsonb,
        "bookingPolicySnapshot" = $3::jsonb,
        "waiverRequirementSnapshot" = $4::jsonb
    WHERE id = $1
  `, appointment.id, JSON.stringify(bookingAuthority), JSON.stringify(bookingPolicy), JSON.stringify(waiverRequirement));
  await recordCommandReceipt(transaction, buildCommandReceipt({
    eventKey: `appointment:${appointment.id}:created:v1`,
    eventType: "appointment.created",
    aggregateType: "appointment",
    aggregateId: appointment.id,
    shopId: service.shopId,
    occurredAt: appointment.createdAt,
    data: {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt?.toISOString() || null,
        customerId: appointment.customerId,
        barberId: appointment.barberId,
        chairId: appointment.chairId,
        serviceId: appointment.serviceId,
        price: appointment.price,
        bookingAuthority,
        bookingPolicy,
        waiverRequirement
      }
    }
  }));
  return { ...appointment, bookingEligibility: publicBookingEligibilityView(bookingPolicy), bookingTimezone: timeZone };
}
async function createOnlineBooking(_root, args, context) {
  if (context.session) return unresolvedGuestCommand();
  return createBookingForActor(args, context);
}
async function createAccountBooking(_root, args, context) {
  if (!context.session?.itemId) return unresolvedGuestCommand();
  return createBookingForActor(args, context, context.session.itemId);
}
async function createBookingForActor(args, context, accountId) {
  const actor = accountId ? `account:${accountId}` : "guest";
  try {
    const body = validateGuestBookingCommand(args);
    const result = await runGuestCommand(async (transaction) => {
      await lockGuestCommand(transaction, args.requestKey);
      if (accountId && !await transaction.user.findUnique({ where: { id: accountId }, select: { id: true } })) throw new Error("Account unavailable.");
      const original = await readGuestCommand(transaction, args, actor);
      if (original) return original;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.customerEmail || "")) throw new BookingRejected("Enter an email so we can send your confirmation.");
      const startsAt = new Date(body.startsAt);
      if (startsAt.getTime() < Date.now() + 5 * 6e4 || startsAt.getTime() > Date.now() + 90 * 864e5) throw new BookingRejected("Choose an appointment at least 5 minutes and no more than 90 days from now.");
      const sudo = context.sudo();
      const [service, publishedShop] = await Promise.all([
        sudo.query.Service.findOne({
          where: { id: body.serviceId },
          query: "id name imagePath durationMinutes price depositRequired depositAmount status shop { id status isPublic } category { id status shop { id } } specialists(where: { status: { equals: active }, bookingEnabled: { equals: true } }) { id displayName }"
        }),
        resolvePublishedShop(transaction, { id: true, name: true })
      ]);
      if (!service || !publishedShop || publishedShop.id !== body.shopId || service.status !== "active" || service.shop?.id !== publishedShop.id || service.shop?.status !== "active" || !service.shop?.isPublic) throw new BookingRejected("This service is no longer available online.");
      if (service.depositRequired && !await onlineDepositProvider(transaction, publishedShop.id)) throw new BookingRejected("This service needs a deposit and can\u2019t be booked online. Contact the shop.");
      try {
        const policy = await requireEffectiveBookingPolicy(transaction, { shopId: publishedShop.id, at: /* @__PURE__ */ new Date() });
        assertPublicServiceEligibility({
          shopId: service.shop.id,
          status: service.status,
          shop: service.shop,
          category: service.category ? { id: service.category.id, status: service.category.status, shopId: service.category.shop?.id || "" } : null
        }, publishedShop.id, policy.publicServiceEligibility);
      } catch (error) {
        if (isAdmissionRefusal(error)) throw new BookingRejected(ONLINE_BOOKING_UNAVAILABLE);
        throw error;
      }
      if (body.reviewedPrice === void 0 || body.reviewedDurationMinutes === void 0 || body.reviewedPolicyVersion === void 0) {
        throw new BookingRejected("Review the service details and booking policy, then book again.");
      }
      const requestedBarberId = clean(body.barberId);
      const candidates = await bookingCandidates(sudo, service, requestedBarberId);
      if (!candidates.length) throw new BookingRejected(requestedBarberId ? "That barber is no longer taking online bookings for this service." : "No barber is taking online bookings for this service.");
      let appointment = null;
      let refusal = null;
      for (const barber of candidates) {
        try {
          appointment = await createLockedAppointment({
            transaction,
            accountId,
            serviceId: body.serviceId,
            barberId: barber.id,
            expectedChairNumber: barber.chairNumber || "",
            expectedShopId: body.shopId,
            startsAt,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            customerEmail: body.customerEmail,
            notes: body.notes,
            publicAccess: { token: args.guestProof, hash: hashPublicAccessToken(args.guestProof) },
            reviewed: { price: body.reviewedPrice, durationMinutes: body.reviewedDurationMinutes, policyVersion: body.reviewedPolicyVersion }
          });
          break;
        } catch (error) {
          if (!isAdmissionRefusal(error)) throw error;
          refusal = error instanceof BookingRejected ? error : new BookingRejected(ONLINE_BOOKING_UNAVAILABLE);
        }
      }
      if (!appointment) {
        if (candidates.length === 1 && refusal instanceof BookingRejected) throw refusal;
        throw new BookingRejected(requestedBarberId ? "That time is no longer available. Choose another time." : "No barber is free at that time anymore. Choose another time.");
      }
      const receipt = {
        id: appointment.id,
        bookingEligibility: appointment.bookingEligibility,
        bookingTimezone: appointment.bookingTimezone,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt?.toISOString() || null,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        price: appointment.price,
        depositAmount: appointment.depositAmount,
        service: { id: appointment.serviceId, name: appointment.serviceTitleSnapshot, imagePath: appointment.serviceImagePathSnapshot, durationMinutes: appointment.durationMinutes, price: appointment.price },
        barber: { id: appointment.barberId, displayName: appointment.barberNameSnapshot, chairNumber: appointment.barberChairNumberSnapshot }
      };
      await persistGuestCommand(transaction, args, { version: 1, disposition: "accepted", appointment: receipt }, actor);
      return { success: true, disposition: "accepted", error: null, appointment: receipt, accessToken: args.guestProof };
    });
    return result;
  } catch (error) {
    if (error instanceof BookingRejected) return { success: false, disposition: "rejected", error: error.message, appointment: null, accessToken: null };
    return unresolvedGuestCommand();
  }
}
var ACTIVE_APPOINTMENT_STATUSES, BookingRejected, MAX_FIRST_AVAILABLE_CANDIDATES, ONLINE_BOOKING_UNAVAILABLE, BARBER_QUERY;
var init_createOnlineBooking = __esm({
  "features/keystone/mutations/createOnlineBooking.ts"() {
    "use strict";
    init_shop_time();
    init_availability();
    init_shop_hours();
    init_publicDeposits();
    init_bookingCapacity();
    init_publicAccessToken();
    init_guest_booking_command();
    init_guestBookingCommand();
    init_commandReceipt();
    init_practitionerAuthority();
    init_bookingPolicy();
    init_publicShop();
    init_waiverEvidence();
    init_publicServiceEligibility();
    init_accountCustomer();
    init_public_booking_eligibility();
    ACTIVE_APPOINTMENT_STATUSES = ["requested", "confirmed", "checked_in", "in_chair"];
    BookingRejected = class extends Error {
    };
    MAX_FIRST_AVAILABLE_CANDIDATES = 50;
    ONLINE_BOOKING_UNAVAILABLE = "This time can\u2019t be booked online right now. Choose another time or contact the shop.";
    BARBER_QUERY = "id displayName chairNumber shop { id }";
  }
});

// features/keystone/queries/getAccountBookings.ts
async function currentAccountId(context) {
  const accountId = context.session?.itemId;
  if (!accountId || !await context.query.User.findOne({ where: { id: accountId }, query: "id" })) return null;
  return accountId;
}
async function acceptedTimezones(context, appointmentIds) {
  if (!appointmentIds.length) return /* @__PURE__ */ new Map();
  const rows = await context.prisma.$queryRawUnsafe(
    `SELECT "appointment" AS "appointmentId", receipt->'appointment'->>'bookingTimezone' AS "bookingTimezone" FROM "GuestBookingCommand" WHERE "appointment" = ANY($1::text[])`,
    appointmentIds
  );
  return new Map(rows.filter((row) => row.bookingTimezone).map((row) => [row.appointmentId, row.bookingTimezone]));
}
async function getAccountBookings(_root, args, context) {
  const accountId = await currentAccountId(context);
  if (!accountId) return { success: false, error: "Sign in to view bookings.", data: null };
  const page = Math.max(1, Math.floor(Number(args?.page) || 1));
  const [bookings, total] = await Promise.all([
    context.prisma.appointment.findMany({
      where: { accountId },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ACCOUNT_BOOKING_PAGE_SIZE,
      take: ACCOUNT_BOOKING_PAGE_SIZE,
      select: { id: true, startsAt: true, status: true, paymentStatus: true, price: true, serviceTitleSnapshot: true, serviceImagePathSnapshot: true, barberNameSnapshot: true, shop: { select: { timezone: true } } }
    }),
    context.prisma.appointment.count({ where: { accountId } })
  ]);
  const zones = await acceptedTimezones(context, bookings.map((booking) => booking.id));
  return {
    success: true,
    error: null,
    data: {
      bookings: bookings.map(({ shop, ...item }) => ({ ...item, timeZone: zones.get(item.id) || shop.timezone || null, startsAt: item.startsAt.toISOString() })),
      page,
      pageSize: ACCOUNT_BOOKING_PAGE_SIZE,
      total,
      hasMore: page * ACCOUNT_BOOKING_PAGE_SIZE < total
    }
  };
}
async function exportMyAccountData(_root, _args, context) {
  const accountId = await currentAccountId(context);
  if (!accountId) return { success: false, error: "Sign in to export your data.", data: null };
  const [user, appointments] = await Promise.all([
    context.prisma.user.findUnique({ where: { id: accountId }, select: { id: true, name: true, email: true, createdAt: true } }),
    context.prisma.appointment.findMany({
      where: { accountId },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: EXPORT_LIMIT + 1,
      select: { id: true, startsAt: true, endsAt: true, status: true, paymentStatus: true, price: true, depositAmount: true, serviceTitleSnapshot: true, barberNameSnapshot: true, customerNotes: true, guestNameSnapshot: true, createdAt: true }
    })
  ]);
  return {
    success: true,
    error: null,
    data: {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      account: user,
      appointments: appointments.slice(0, EXPORT_LIMIT),
      complete: appointments.length <= EXPORT_LIMIT,
      note: appointments.length > EXPORT_LIMIT ? `Latest ${EXPORT_LIMIT} bookings. Contact the shop for older records.` : null
    }
  };
}
async function recoverAccountBooking(_root, args, context) {
  const accountId = context.session?.itemId;
  if (!accountId) return unresolvedGuestCommand();
  try {
    validateGuestBookingCommand(args);
    return await runGuestCommand(async (tx) => {
      if (!await tx.user.findUnique({ where: { id: accountId }, select: { id: true } })) return unresolvedGuestCommand();
      await lockGuestCommand(tx, args.requestKey);
      const actor = `account:${accountId}`;
      const original = await readGuestCommand(tx, args, actor);
      if (original) return original;
      if (!args.closeIfAbsent) return unresolvedGuestCommand();
      await persistGuestCommand(tx, args, { version: 1, disposition: "closed", appointment: null }, actor);
      return { success: false, disposition: "closed", error: "That earlier request was not booked.", appointment: null, accessToken: null };
    });
  } catch {
    return unresolvedGuestCommand();
  }
}
async function getAccountBalances(_root, _args, context) {
  const accountId = await currentAccountId(context);
  if (!accountId) return { success: false, error: "Sign in to view balances.", data: null };
  const booked = await context.prisma.appointment.findMany({ where: { accountId, customerId: { not: null } }, select: { customerId: true }, distinct: ["customerId"], take: 200 });
  const customerIds = booked.map((row) => row.customerId).filter((id) => Boolean(id));
  const balances = await context.prisma.customerPackage.findMany({
    where: { status: { in: ["active", "paused"] }, customer: { OR: [{ userId: accountId }, ...customerIds.length ? [{ id: { in: customerIds } }] : []] } },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: { id: true, status: true, remainingVisits: true, expiresAt: true, nextBillingAt: true, servicePackage: { select: { name: true } }, membershipPlan: { select: { name: true, billingInterval: true } } }
  });
  return {
    success: true,
    error: null,
    data: balances.map((item) => ({
      id: item.id,
      status: item.status,
      remainingVisits: item.remainingVisits,
      name: item.membershipPlan?.name || item.servicePackage?.name || "Balance",
      kind: item.membershipPlan ? "membership" : "package",
      billingInterval: item.membershipPlan?.billingInterval || null,
      expiresAt: item.expiresAt?.toISOString() || null,
      nextBillingAt: item.nextBillingAt?.toISOString() || null
    }))
  };
}
var ACCOUNT_BOOKING_PAGE_SIZE, EXPORT_LIMIT;
var init_getAccountBookings = __esm({
  "features/keystone/queries/getAccountBookings.ts"() {
    "use strict";
    init_guestBookingCommand();
    init_guest_booking_command();
    ACCOUNT_BOOKING_PAGE_SIZE = 25;
    EXPORT_LIMIT = 1e3;
  }
});

// features/keystone/queries/getPublicOffers.ts
async function getPublicMembershipOffers(_root, _args, context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  if (!shop) return { packages: [], plans: [] };
  const [packages, plans] = await Promise.all([
    prisma.servicePackage.findMany({
      where: { shopId: shop.id, status: "active" },
      orderBy: [{ price: "asc" }],
      select: { id: true, name: true, description: true, price: true, items: { where: { service: { status: "active" } }, select: { quantity: true, service: { select: { id: true, name: true } } } } }
    }),
    prisma.membershipPlan.findMany({
      where: { shopId: shop.id, status: "active" },
      orderBy: [{ price: "asc" }],
      select: { id: true, name: true, description: true, price: true, billingInterval: true, includedVisits: true, discountPercent: true }
    })
  ]);
  return {
    packages: packages.map((item) => ({ ...item, price: item.price ?? 0, items: item.items.flatMap((line) => line.service ? [{ quantity: line.quantity ?? 1, serviceId: line.service.id, serviceName: line.service.name }] : []) })),
    plans: plans.map((plan) => ({ ...plan, price: plan.price ?? 0, billingInterval: plan.billingInterval ?? "monthly" }))
  };
}
async function getPublicBarberWeek(_root, args, context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true });
  if (!shop || !args.barberId) return [];
  const barber = await prisma.barber.findFirst({ where: { id: args.barberId, shopId: shop.id, status: "active", bookingEnabled: true }, select: { id: true } });
  if (!barber) return [];
  return prisma.barberSchedule.findMany({ where: { barberId: barber.id, isWorking: true }, select: { dayOfWeek: true, startMinute: true, endMinute: true } });
}
var init_getPublicOffers = __esm({
  "features/keystone/queries/getPublicOffers.ts"() {
    "use strict";
    init_publicShop();
  }
});

// features/keystone/utils/balanceLedgers.ts
function integer31(value, label) {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer.`);
  return value;
}
function applyInventoryDelta(current, delta) {
  const before = integer31(current, "Inventory balance");
  const normalizedDelta = integer31(delta, "Inventory movement");
  if (normalizedDelta === 0) throw new Error("Inventory movement must be non-zero.");
  const after = before + normalizedDelta;
  if (after < 0) throw new Error("Insufficient inventory for this movement.");
  return { before, delta: normalizedDelta, after };
}
function applyPackageDelta(current, delta) {
  const before = integer31(current, "Package balance");
  const normalizedDelta = integer31(delta, "Package usage");
  if (normalizedDelta === 0) throw new Error("Package usage must be non-zero.");
  const after = before + normalizedDelta;
  if (after < 0) throw new Error("Package has no visits remaining.");
  return { before, delta: normalizedDelta, after };
}
var init_balanceLedgers = __esm({
  "features/keystone/utils/balanceLedgers.ts"() {
    "use strict";
  }
});

// features/keystone/utils/packageUsageLedger.ts
function assertPackageRedeemableForService(balance, serviceId, at) {
  if (balance.status !== "active") throw new Error("Selected package balance is not active.");
  if (balance.startsAt && balance.startsAt > at) throw new Error("Selected package balance has not started yet.");
  if (balance.expiresAt && balance.expiresAt <= at) throw new Error("Selected package balance has expired.");
  if (balance.servicePackageId) {
    const included = (balance.servicePackage?.items ?? []).some((item) => item.serviceId && item.serviceId === serviceId);
    if (!included) throw new Error("This package does not include the service being checked out.");
  }
}
async function consumePackageVisitInTransaction(transaction, { customerPackageId, appointmentId, transactionId }) {
  const referenceKey = `checkout:${transactionId}:package:${customerPackageId}`;
  await transaction.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    "barbershop-package",
    `package:${customerPackageId}`
  );
  const replay = await transaction.packageUsage.findUnique({ where: { referenceKey } });
  if (replay) return replay;
  const [balance, appointment] = await Promise.all([
    transaction.customerPackage.findUnique({ where: { id: customerPackageId }, include: { servicePackage: { include: { items: { select: { serviceId: true } } } } } }),
    transaction.appointment.findUnique({ where: { id: appointmentId }, select: { serviceId: true } })
  ]);
  if (!balance) throw new Error("Selected package balance is not active.");
  assertPackageRedeemableForService(balance, appointment?.serviceId, /* @__PURE__ */ new Date());
  const next = applyPackageDelta(balance.remainingVisits || 0, -1);
  const usage = await transaction.packageUsage.create({
    data: {
      customerPackageId,
      appointmentId,
      transactionId,
      usageType: "consume",
      visitsDelta: -1,
      balanceAfter: next.after,
      reason: "Appointment checkout",
      referenceKey,
      occurredAt: /* @__PURE__ */ new Date()
    }
  });
  const finalizedAt = /* @__PURE__ */ new Date();
  await transaction.customerPackage.update({
    where: { id: customerPackageId },
    data: {
      remainingVisits: next.after,
      status: next.after === 0 ? "used_up" : "active",
      lastUsedAt: finalizedAt
    }
  });
  await transaction.checkoutTransaction.update({
    where: { id: transactionId },
    data: { status: "paid", completedAt: finalizedAt }
  });
  await transaction.appointment.update({
    where: { id: appointmentId },
    data: { status: "completed", paymentStatus: "paid", transactionId }
  });
  return usage;
}
var init_packageUsageLedger = __esm({
  "features/keystone/utils/packageUsageLedger.ts"() {
    "use strict";
    init_balanceLedgers();
    init_serializableTransaction();
  }
});

// features/keystone/utils/appointmentLineItemSnapshot.ts
function nonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}
function buildAppointmentLineItemSnapshot(appointment, packageBalance) {
  const service = appointment.service;
  const barber = appointment.barber;
  return {
    title: service?.name?.trim() || "Barbershop service",
    price: nonNegativeInteger(appointment.price ?? service?.price),
    durationMinutes: nonNegativeInteger(
      appointment.durationMinutes ?? service?.durationMinutes,
      30
    ),
    imagePath: service?.imagePath?.trim() || "",
    modifiers: [],
    barberName: barber?.displayName?.trim() || "",
    barberChairNumber: barber?.chairNumber?.trim() || "",
    packageBalanceId: packageBalance?.id?.trim() || "",
    packageName: packageBalance?.servicePackage?.name?.trim() || packageBalance?.membershipPlan?.name?.trim() || "",
    packageVisitsConsumed: packageBalance?.id ? 1 : 0
  };
}
var init_appointmentLineItemSnapshot = __esm({
  "features/keystone/utils/appointmentLineItemSnapshot.ts"() {
    "use strict";
  }
});

// features/keystone/utils/commissionAccrual.ts
function calculateServiceCommission(input) {
  const subtotal = Math.max(0, Math.floor(Number(input.subtotal) || 0));
  const discountAmount = Math.max(0, Math.floor(Number(input.discountAmount) || 0));
  const rateBps = Math.min(1e4, Math.max(0, Math.floor(Number(input.rateBps) || 0)));
  const serviceAmount = Math.max(0, subtotal - Math.min(subtotal, discountAmount));
  return {
    serviceAmount,
    commissionRate: String(rateBps / 100),
    commissionAmount: Math.floor(serviceAmount * rateBps / 1e4)
  };
}
var init_commissionAccrual = __esm({
  "features/keystone/utils/commissionAccrual.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/paymentSessionResult.ts
function serializePaymentSession(session) {
  if (!session) return session;
  const dateFields = ["expiresAt", "capturedAt", "cancelledAt", "createdAt", "updatedAt"];
  const serialized = { ...session };
  for (const field of dateFields) {
    const value = serialized[field];
    if (value instanceof Date) serialized[field] = value.toISOString();
  }
  return serialized;
}
async function lockAppointmentMoney(transaction, appointmentId) {
  if (!appointmentId) return;
  await transaction.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    "barbershop-checkout",
    appointmentId
  );
}
function recordOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function appointmentSettledElsewhere(paymentStatus) {
  return ["paid", "refunded"].includes(String(paymentStatus || ""));
}
var OPEN_PAYMENT_SESSION_STATUSES;
var init_paymentSessionResult = __esm({
  "features/keystone/mutations/paymentSessionResult.ts"() {
    "use strict";
    OPEN_PAYMENT_SESSION_STATUSES = ["pending", "authorized", "captured", "partially_refunded"];
  }
});

// features/keystone/mutations/giftCards.ts
function codeFor(key) {
  return (0, import_node_crypto7.createHash)("sha256").update(key).digest("hex").slice(0, 12).toUpperCase().match(/.{1,4}/g).join("-");
}
function normalizeGiftCode(code) {
  const raw = code.toUpperCase().replace(/[^0-9A-F]/g, "");
  return raw.length === 12 ? raw.match(/.{1,4}/g).join("-") : "";
}
function orderToken(giftCardId) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return (0, import_node_crypto7.createHmac)("sha256", secret).update(`barbershop-gift:${giftCardId}`).digest("hex");
}
function tokenOk(giftCardId, token) {
  if (!token || token.length !== 64) return false;
  const a = Buffer.from(orderToken(giftCardId));
  const b = Buffer.from(token);
  return a.length === b.length && (0, import_node_crypto7.timingSafeEqual)(a, b);
}
async function giftCardOptions(prisma) {
  const shop = await resolvePublishedShop(prisma, { id: true });
  return { online: Boolean(shop && await onlineDepositProvider(prisma, shop.id)), amounts: GIFT_CARD_AMOUNTS };
}
async function startGiftCardCheckout(_root, args, context) {
  const fail6 = (error) => ({ success: false, error, data: null });
  try {
    if (!GIFT_CARD_AMOUNTS.includes(args.amount)) return fail6("Choose one of the gift card amounts.");
    const purchaserName = (args.purchaserName || "").trim();
    const purchaserEmail = (args.purchaserEmail || "").trim().toLowerCase();
    const recipientEmail = (args.recipientEmail || "").trim().toLowerCase() || purchaserEmail;
    const recipientName = (args.recipientName || "").trim() || purchaserName;
    const message = (args.message || "").trim();
    if (!purchaserName || purchaserName.length > 120 || recipientName.length > 120) return fail6("Enter your name.");
    if (!EMAIL.test(purchaserEmail) || !EMAIL.test(recipientEmail)) return fail6("Enter a valid email address.");
    if (message.length > 500) return fail6("Keep the message under 500 characters.");
    const prisma = context.sudo().prisma;
    const shop = await resolvePublishedShop(prisma, { id: true, name: true });
    if (!shop) return fail6("Gift cards are unavailable right now.");
    const provider = await onlineDepositProvider(prisma, shop.id);
    if (!provider) return fail6("Online gift cards are unavailable right now. Buy one in the shop.");
    const key = (0, import_node_crypto7.randomUUID)();
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const card = await prisma.giftCard.create({ data: {
      shopId: shop.id,
      code: codeFor(`gift:${key}`),
      status: "pending",
      initialValue: args.amount,
      balance: args.amount,
      purchaserName,
      purchaserEmail,
      recipientName,
      recipientEmail,
      message,
      expiresAt
    } });
    const back = `${trustedOrigin()}/gift-cards/order?id=${encodeURIComponent(card.id)}&token=${orderToken(card.id)}`;
    try {
      const result = recordOf(await createPayment({
        provider: { code: provider.code },
        amount: args.amount,
        currency: "usd",
        description: `${shop.name} gift card \xB7 ${usd(args.amount)}`,
        successUrl: back,
        cancelUrl: `${back}&result=cancelled`,
        idempotencyKey: key,
        customerEmail: purchaserEmail,
        metadata: { purpose: "gift_card", giftCardId: card.id }
      }));
      if (!result.id || typeof result.url !== "string") throw new Error("Stripe did not open a checkout.");
      const session = await prisma.paymentSession.create({ data: {
        shopId: shop.id,
        paymentProviderId: provider.id,
        idempotencyKeyHash: hashPublicAccessToken(`gift-card:${key}`),
        status: "pending",
        amount: args.amount,
        currencyCode: "USD",
        providerPaymentId: String(result.id),
        expiresAt: new Date(Date.now() + 23 * 36e5),
        metadata: { purpose: "gift_card", giftCardId: card.id, checkoutUrl: result.url }
      } });
      await prisma.giftCard.update({ where: { id: card.id }, data: { paymentSessionId: session.id } });
      return { success: true, error: null, data: { url: result.url } };
    } catch (error) {
      console.error("Gift card checkout could not be opened:", error);
      await prisma.giftCard.update({ where: { id: card.id }, data: { status: "cancelled" } });
      return fail6("Online gift cards are unavailable right now. Buy one in the shop.");
    }
  } catch (error) {
    return fail6(error instanceof Error ? error.message : "Unable to start the gift card order.");
  }
}
async function settleGiftCard(prisma, giftCardId) {
  const card = await prisma.giftCard.findUnique({ where: { id: giftCardId }, include: { paymentSession: { include: { paymentProvider: { select: { code: true } } } } } });
  if (!card) throw new Error("Gift card order not found.");
  const session = card.paymentSession;
  if (card.status === "pending" && session?.paymentProvider && session.status === "pending") {
    const remote = recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }));
    if (remote.status === "expired") {
      await prisma.$transaction([
        prisma.paymentSession.update({ where: { id: session.id }, data: { status: "expired", cancelledAt: /* @__PURE__ */ new Date() } }),
        prisma.giftCard.update({ where: { id: card.id }, data: { status: "cancelled" } })
      ]);
      return { ...card, status: "cancelled" };
    }
    if (remote.status === "captured") {
      if (Number(remote.amount) !== session.amount) throw new Error("The amount paid does not match the gift card. Contact the shop.");
      const now = /* @__PURE__ */ new Date();
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.paymentSession.updateMany({ where: { id: session.id, status: "pending" }, data: { status: "captured", capturedAt: now } });
        if (!claimed.count) return;
        const ledger = [{ at: now.toISOString(), type: "purchase", amount: card.initialValue, balance: card.initialValue, ref: session.id }];
        await tx.giftCard.update({ where: { id: card.id }, data: { status: "active", activatedAt: now, ledger } });
        await recordCommandReceipt(tx, buildCommandReceipt({
          eventKey: `gift-card:${card.id}:sold:v1`,
          eventType: "gift_card.sold",
          aggregateType: "gift_card",
          aggregateId: card.id,
          shopId: card.shopId,
          occurredAt: now,
          data: { giftCard: { id: card.id, amount: card.initialValue, paymentSessionId: session.id } }
        }));
      });
    }
  }
  const fresh = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id } });
  return fresh;
}
async function confirmGiftCardOrder(_root, args, context) {
  if (!tokenOk(args.giftCardId, args.token)) return { success: false, error: "We could not find that gift card order.", data: null };
  try {
    const card = await settleGiftCard(context.sudo().prisma, args.giftCardId);
    return { success: true, error: null, data: {
      status: card.status,
      amount: card.initialValue,
      recipientEmail: card.recipientEmail,
      recipientName: card.recipientName,
      code: card.status === "active" || card.status === "redeemed" ? card.code : null,
      expiresAt: card.expiresAt?.toISOString() || null
    } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "We could not check the payment yet.", data: null };
  }
}
async function settleOpenGiftCards(prisma, shopId) {
  const open = await prisma.giftCard.findMany({ where: { shopId, status: "pending", paymentSession: { status: "pending" } }, select: { id: true }, take: 20 });
  for (const card of open) await settleGiftCard(prisma, card.id).catch(() => void 0);
}
async function lookupGiftCard(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized.", data: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const code = normalizeGiftCode(args.code || "");
    if (!code) return { success: false, error: "Enter the 12-character gift card code.", data: null };
    let card = await context.prisma.giftCard.findFirst({ where: { shopId, code } });
    if (card?.status === "pending") card = await settleGiftCard(context.prisma, card.id);
    if (!card) return { success: false, error: "No gift card with that code.", data: null };
    return { success: true, error: null, data: { id: card.id, code: card.code, status: card.status, balance: card.balance, expiresAt: card.expiresAt?.toISOString() || null, recipientName: card.recipientName } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to look up the gift card.", data: null };
  }
}
async function redeemGiftCardInTransaction(transaction, input) {
  const code = normalizeGiftCode(input.code);
  await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-gift-card", code);
  const card = await transaction.giftCard.findFirst({ where: { shopId: input.shopId, code } });
  if (!card || card.status !== "active") throw new Error("That gift card is not active.");
  if (card.expiresAt && card.expiresAt < input.now) throw new Error("That gift card has expired.");
  if (card.balance < input.amount) throw new Error(`That gift card has ${usd(card.balance)} left. Take the rest by card or cash first.`);
  const balance = card.balance - input.amount;
  const ledger = [...Array.isArray(card.ledger) ? card.ledger : [], { at: input.now.toISOString(), type: "redeem", amount: input.amount, balance, ref: input.transactionId }];
  await transaction.giftCard.update({ where: { id: card.id }, data: { balance, status: balance === 0 ? "redeemed" : "active", ledger } });
  return card;
}
async function returnGiftCardCheckout(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized.", data: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const reason = (args.reason || "").trim();
    if (reason.length < 3 || reason.length > 1e3) throw new Error("Give a reason for the return.");
    if (!args.idempotencyKey?.trim()) throw new Error("Request key is missing. Reload and try again.");
    const data = await context.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))", "barbershop-cash-refund", args.transactionId);
      const receipt = await tx.checkoutTransaction.findFirst({ where: { id: args.transactionId, shopId } });
      if (!receipt || String(receipt.paymentMethod) !== "gift_card") throw new Error("Only a gift card receipt can be returned to the card.");
      if (receipt.status === "refunded") {
        const card2 = await tx.giftCard.findFirst({ where: { shopId, ledger: { array_contains: [{ ref: `return:${receipt.id}` }] } } });
        return { giftCardId: card2?.id || null, amount: 0, balance: card2?.balance ?? null, replayed: true };
      }
      if (receipt.status !== "paid") throw new Error(`A ${receipt.status} receipt can't be returned.`);
      const paidCommission = await tx.commission.count({ where: { transactionId: receipt.id, status: "paid" } });
      if (paidCommission) throw new Error("A commission on this visit was already paid. Owner reconciliation is required first.");
      const card = await tx.giftCard.findFirst({ where: { shopId, ledger: { array_contains: [{ ref: receipt.id }] } } });
      if (!card) throw new Error("The gift card used on this receipt was not found.");
      const ledger = Array.isArray(card.ledger) ? card.ledger : [];
      const debit = ledger.filter((entry) => entry.type === "redeem" && entry.ref === receipt.id).reduce((sum, entry) => sum + entry.amount, 0);
      if (debit <= 0) throw new Error("Nothing was taken from a gift card on this receipt.");
      const now = /* @__PURE__ */ new Date();
      const balance = card.balance + debit;
      await tx.giftCard.update({ where: { id: card.id }, data: { balance, status: card.status === "redeemed" ? "active" : card.status, ledger: [...ledger, { at: now.toISOString(), type: "return", amount: debit, balance, ref: `return:${receipt.id}` }] } });
      await tx.checkoutTransaction.update({ where: { id: receipt.id }, data: { status: "refunded" } });
      await tx.appointment.updateMany({ where: { transactionId: receipt.id, shopId }, data: { paymentStatus: "refunded" } });
      await tx.commission.updateMany({ where: { transactionId: receipt.id, status: { in: ["projected", "approved"] } }, data: { status: "voided" } });
      await recordCommandReceipt(tx, buildCommandReceipt({ actorId: context.session?.itemId, eventKey: `gift-card-return:${receipt.id}`, eventType: "checkout.gift_card_returned", aggregateType: "checkout_transaction", aggregateId: receipt.id, shopId, occurredAt: now, data: { giftCardId: card.id, amount: debit, balance, reason } }));
      return { giftCardId: card.id, amount: debit, balance, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to return the gift card payment.", data: null };
  }
}
var import_node_crypto7, GIFT_CARD_AMOUNTS, EMAIL, usd;
var init_giftCards = __esm({
  "features/keystone/mutations/giftCards.ts"() {
    "use strict";
    import_node_crypto7 = require("node:crypto");
    init_access();
    init_trusted_origin();
    init_currentAuthorization();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_publicAccessToken();
    init_publicShop();
    init_publicDeposits();
    init_paymentSessionResult();
    GIFT_CARD_AMOUNTS = [2500, 5e3, 7500, 1e4, 15e3, 2e4];
    EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    usd = (cents2) => `$${(cents2 / 100).toFixed(cents2 % 100 ? 2 : 0)}`;
  }
});

// features/keystone/mutations/checkoutAppointment.ts
function money(value) {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2e9) throw new Error("Amounts must be non-negative whole cents within the supported limit.");
  return amount;
}
function clean2(value) {
  return value?.trim() || "";
}
function assertCheckoutReplay(transaction, expected) {
  if (String(transaction.paymentMethod) !== expected.paymentMethod || (transaction.tipAmount || 0) !== expected.tipAmount || (transaction.discountAmount || 0) !== expected.discountAmount || (transaction.taxAmount || 0) !== expected.taxAmount || (transaction.total || 0) !== expected.total || (transaction.packageBalanceId || "") !== expected.packageBalanceId || expected.paymentSessionId && (transaction.paymentSessionId || "") !== expected.paymentSessionId || (transaction.notes || "") !== expected.notes && !["Deposit ", "Gift card "].some((suffix) => (transaction.notes || "").startsWith(expected.notes ? `${expected.notes} \xB7 ${suffix}` : suffix))) throw new Error("This appointment was already checked out with different tender or totals.");
}
async function checkoutAppointment(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Not authorized to process checkout.", transaction: null, appointment: null };
  }
  if (!args.appointmentId?.trim()) {
    return { success: false, error: "Appointment is required.", transaction: null, appointment: null };
  }
  try {
    const activeShopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const preview = await context.prisma.appointment.findFirst({
      where: { id: args.appointmentId, shopId: activeShopId },
      include: checkoutInclude
    });
    if (!preview || !preview.shopId) throw new Error("Appointment not found.");
    if (["cancelled", "no_show"].includes(String(preview.status))) {
      throw new Error("Cancelled or no-show appointments cannot be checked out.");
    }
    const paymentMethod = clean2(args.paymentMethod) || "cash";
    const packageBalanceId = clean2(args.packageBalanceId);
    if (!["cash", "card", "package", "gift_card"].includes(paymentMethod)) throw new Error("Choose cash, card, gift card or a prepaid visit.");
    const giftCardCode = paymentMethod === "gift_card" ? normalizeGiftCode(clean2(args.giftCardCode)) : "";
    if (paymentMethod === "gift_card" && !giftCardCode) throw new Error("Enter the 12-character gift card code.");
    if (preview.shop.currencyCode !== "USD") throw new Error("This release supports USD settlement only.");
    if (preview.price == null) throw new Error("This legacy appointment has no agreed price. Resolve its commercial evidence before checkout.");
    const subtotal = paymentMethod === "package" ? 0 : money(preview.price);
    const tipAmount = money(args.tipAmount);
    const discountAmount = Math.min(money(args.discountAmount), subtotal);
    const taxAmount = money(args.taxAmount);
    const total = Math.max(0, subtotal + tipAmount + taxAmount - discountAmount);
    if (!Number.isSafeInteger(total) || total > 2e9) throw new Error("Checkout total exceeds the supported limit.");
    if (paymentMethod === "package" && total > 0) throw new Error("Package tender covers a visit only. Collect tips/tax separately; mixed tender is not supported.");
    if (clean2(args.paymentSessionId) && paymentMethod !== "card") throw new Error("A card payment session can only settle card tender.");
    const idempotencyKey = clean2(args.idempotencyKey);
    if (idempotencyKey.length > 200) throw new Error("Checkout request key is too long.");
    const commandKeyHash = idempotencyKey ? hashPublicAccessToken(idempotencyKey) : null;
    const replayInput = { paymentMethod, tipAmount, discountAmount, taxAmount, total, packageBalanceId, paymentSessionId: clean2(args.paymentSessionId), notes: clean2(args.notes) };
    if (preview.transactionId && preview.paymentStatus === "paid" && preview.transaction) {
      assertCheckoutReplay(preview.transaction, replayInput);
      return { success: true, error: null, transaction: preview.transaction, appointment: preview };
    }
    const result = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-checkout",
        preview.id
      );
      const shopId = await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      const appointment = await transaction.appointment.findFirst({
        where: { id: preview.id, shopId },
        include: checkoutInclude
      });
      if (!appointment || !appointment.shopId) throw new Error("Appointment not found.");
      if (appointment.price !== preview.price || appointment.shop.currencyCode !== "USD") throw new Error("The agreed price or currency changed. Refresh before checkout.");
      if (appointment.transactionId && appointment.paymentStatus === "paid") {
        const replayTransaction = await transaction.checkoutTransaction.findUniqueOrThrow({ where: { id: appointment.transactionId }, include: { lineItems: true } });
        assertCheckoutReplay(replayTransaction, replayInput);
        if (commandKeyHash) {
          const event = await transaction.commandReceipt.findUnique({ where: { eventKey: `checkout:${replayTransaction.id}:paid:v1` } });
          const saved = event?.payload?.data?.command?.keyHash;
          if (saved && saved !== commandKeyHash) throw new Error("This appointment was already checked out by another request.");
        }
        return { appointment, transaction: replayTransaction };
      }
      if (appointment.status !== "in_chair") {
        throw new Error("Only an in-chair appointment can be completed at checkout.");
      }
      if (!appointment.barberId || !appointment.serviceId || !appointment.customerId) throw new Error("Completion authority linkage is incomplete.");
      const executionRows = await transaction.$queryRawUnsafe('SELECT "executionAuthoritySnapshot", "serviceStartedAt" FROM "Appointment" WHERE id = $1 LIMIT 1', appointment.id);
      if (!executionRows[0]?.executionAuthoritySnapshot || !executionRows[0].serviceStartedAt) throw new Error("Recorded execution authority is required before completion.");
      assertAuthorityMatches(executionRows[0].executionAuthoritySnapshot, { shopId: appointment.shopId, barberId: appointment.barberId, serviceId: appointment.serviceId, at: executionRows[0].serviceStartedAt });
      const completionAuthority = await requireEffectivePractitionerAuthority(transaction, { shopId: appointment.shopId, barberId: appointment.barberId, serviceId: appointment.serviceId, at: /* @__PURE__ */ new Date() });
      const waiver = await getAppointmentWaiverRequirement(transaction, appointment.id);
      if (waiver.required) await requireSignedWaiver(transaction, { appointmentId: appointment.id, serviceId: appointment.serviceId, customerId: appointment.customerId, templateHash: waiver.templateHash });
      let packageBalance = null;
      if (paymentMethod === "package") {
        if (!packageBalanceId) throw new Error("Select an active package or membership balance before using package tender.");
        packageBalance = await transaction.customerPackage.findUnique({
          where: { id: packageBalanceId },
          include: { servicePackage: { include: { items: { select: { serviceId: true } } } }, membershipPlan: true }
        });
        if (!packageBalance || packageBalance.shopId !== appointment.shopId || packageBalance.status !== "active") {
          throw new Error("Selected package balance is not active for this shop.");
        }
        if (packageBalance.customerId !== appointment.customerId || Number(packageBalance.remainingVisits || 0) < 1) {
          throw new Error("Selected package does not belong to this customer or has no visits remaining.");
        }
        assertPackageRedeemableForService(packageBalance, appointment.serviceId, /* @__PURE__ */ new Date());
      }
      let paymentSession = null;
      if (clean2(args.paymentSessionId)) {
        paymentSession = await transaction.paymentSession.findUnique({ where: { id: clean2(args.paymentSessionId) } });
        if (!paymentSession || paymentSession.shopId !== appointment.shopId || paymentSession.appointmentId !== appointment.id) {
          throw new Error("Selected payment session does not belong to this appointment and shop.");
        }
        const paidDeposit = appointment.paymentStatus === "deposit_paid" ? Math.min(appointment.depositAmount || 0, total) : 0;
        if (paymentSession.status !== "captured" || Number(paymentSession.amount) !== total - paidDeposit) {
          throw new Error("Payment session must be captured for the exact checkout total.");
        }
      }
      const completedAt = /* @__PURE__ */ new Date();
      const depositSession = appointment.paymentStatus === "deposit_paid" ? (await transaction.paymentSession.findMany({ where: { appointmentId: appointment.id, status: "captured", transaction: null, ...paymentSession ? { id: { not: paymentSession.id } } : {} }, orderBy: { capturedAt: "desc" }, take: 5 })).find((row) => row.metadata?.purpose !== "desk_card") || null : null;
      const depositNote = depositSession ? `Deposit ${(depositSession.amount / 100).toFixed(2)} paid online` : "";
      const checkout = await transaction.checkoutTransaction.create({
        data: {
          shopId: appointment.shopId,
          customerId: appointment.customerId,
          barberId: appointment.barberId,
          appointments: { connect: { id: appointment.id } },
          status: "paid",
          subtotal,
          tipAmount,
          taxAmount,
          discountAmount,
          total,
          paymentMethod,
          providerPaymentId: paymentSession?.providerPaymentId || depositSession?.providerPaymentId || "",
          packageBalanceId: packageBalance?.id,
          paymentSessionId: paymentSession?.id || depositSession?.id,
          completedAt,
          currencyCode: "USD",
          merchantSnapshot: { name: appointment.shop.name, legalName: appointment.shop.legalName, address: appointment.shop.address, phone: appointment.shop.phone, timezone: appointment.shop.timezone },
          taxRuleSnapshot: { mode: "operator_entered", amount: taxAmount },
          notes: [clean2(args.notes), depositNote, giftCardCode ? `Gift card ${giftCardCode.slice(-4)}` : ""].filter(Boolean).join(" \xB7 ")
        }
      });
      if (giftCardCode) {
        const owed = total - (depositSession ? Math.min(depositSession.amount, total) : 0);
        if (owed > 0) await redeemGiftCardInTransaction(transaction, { shopId: appointment.shopId, code: giftCardCode, amount: owed, transactionId: checkout.id, now: completedAt });
      }
      const snapshot = buildAppointmentLineItemSnapshot(appointment, packageBalance);
      const lineItem = await transaction.appointmentLineItem.create({
        data: {
          appointmentId: appointment.id,
          transactionId: checkout.id,
          serviceId: appointment.serviceId,
          ...snapshot,
          modifiers: snapshot.modifiers
        }
      });
      if (packageBalance) {
        await consumePackageVisitInTransaction(transaction, {
          customerPackageId: packageBalance.id,
          appointmentId: appointment.id,
          transactionId: checkout.id
        });
      } else {
        await transaction.appointment.update({
          where: { id: appointment.id },
          data: { status: "completed", paymentStatus: "paid", transactionId: checkout.id }
        });
      }
      await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "serviceCompletedAt" = $2 WHERE id = $1', appointment.id, completedAt);
      if (tipAmount > 0 && appointment.barberId) {
        await transaction.tip.create({
          data: {
            shopId: appointment.shopId,
            tipNumber: `tip-${checkout.id}`,
            barberId: appointment.barberId,
            customerId: appointment.customerId,
            transactionId: checkout.id,
            appointmentId: appointment.id,
            amount: tipAmount,
            paymentMethod: paymentMethod === "cash" ? "cash" : "card",
            paidAt: completedAt,
            metadata: { source: "checkoutAppointment" }
          }
        });
      }
      const commission = calculateServiceCommission({
        subtotal,
        discountAmount,
        rateBps: appointment.barber?.serviceCommissionRateBps || 0
      });
      if (commission.commissionAmount > 0 && appointment.barberId) {
        await transaction.commission.create({
          data: {
            shopId: appointment.shopId,
            commissionNumber: `commission-${checkout.id}`,
            barberId: appointment.barberId,
            transactionId: checkout.id,
            appointmentId: appointment.id,
            status: "projected",
            serviceAmount: commission.serviceAmount,
            productAmount: 0,
            commissionRate: commission.commissionRate,
            commissionAmount: commission.commissionAmount,
            metadata: { source: "checkoutAppointment" }
          }
        });
      }
      if (appointment.queueEntry?.id) {
        await transaction.walkInQueueEntry.update({
          where: { id: appointment.queueEntry.id },
          data: { status: "served" }
        });
      }
      if (appointment.customerId) {
        await transaction.customer.update({ where: { id: appointment.customerId }, data: { lastVisitAt: completedAt } });
      }
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `checkout:${checkout.id}:paid:v1`,
        eventType: "checkout.paid",
        aggregateType: "checkout_transaction",
        aggregateId: checkout.id,
        shopId: appointment.shopId,
        occurredAt: completedAt,
        data: {
          checkout: { id: checkout.id, subtotal, tipAmount, taxAmount, discountAmount, total, paymentMethod },
          appointment: { id: appointment.id, serviceId: appointment.serviceId, barberId: appointment.barberId, completionAuthority },
          lineItem: { id: lineItem.id, ...snapshot },
          settlement: { providerPaymentId: paymentSession?.providerPaymentId || "" },
          command: { keyHash: commandKeyHash, actorId: context.session?.itemId ?? null }
        }
      }));
      const updatedAppointment = await transaction.appointment.findUnique({
        where: { id: appointment.id },
        include: { customer: true, barber: true, service: true, transaction: { include: { lineItems: true } } }
      });
      return { appointment: updatedAppointment, transaction: { ...checkout, lineItems: [lineItem] } };
    });
    return { success: true, error: null, transaction: result.transaction, appointment: result.appointment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to checkout appointment.",
      transaction: null,
      appointment: null
    };
  }
}
var checkoutInclude;
var init_checkoutAppointment = __esm({
  "features/keystone/mutations/checkoutAppointment.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_publicAccessToken();
    init_packageUsageLedger();
    init_appointmentLineItemSnapshot();
    init_commissionAccrual();
    init_commandReceipt();
    init_packageUsageLedger();
    init_serializableTransaction();
    init_practitionerAuthority();
    init_giftCards();
    init_waiverEvidence();
    checkoutInclude = {
      shop: true,
      customer: true,
      barber: true,
      service: true,
      transaction: { include: { lineItems: true } },
      queueEntry: true,
      chair: true
    };
  }
});

// features/keystone/utils/defaultPaymentProvider.ts
async function ensureDefaultManualPaymentProvider(context, shopId) {
  return runSerializableTransaction(context.prisma, async (client) => {
    const transaction = client;
    await transaction.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "barbershop-payment-provider",
      shopId
    );
    const existing = await transaction.paymentProvider.findFirst({
      where: { shopId, code: DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    if (existing) return existing;
    const { shop: _shop, ...data } = defaultManualPaymentProviderInput;
    return transaction.paymentProvider.create({
      data: {
        ...data,
        credentials: data.credentials,
        metadata: data.metadata,
        shopId
      }
    });
  });
}
var DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE, defaultManualPaymentProviderInput;
var init_defaultPaymentProvider = __esm({
  "features/keystone/utils/defaultPaymentProvider.ts"() {
    "use strict";
    init_serializableTransaction();
    DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE = "pp_manual";
    defaultManualPaymentProviderInput = {
      name: "Manual Payments",
      code: DEFAULT_MANUAL_PAYMENT_PROVIDER_CODE,
      isInstalled: true,
      credentials: {},
      metadata: {
        adapter: "manual",
        settlement: "offline",
        description: "Pay in person. Staff record cash and prepaid payments at checkout; nothing is charged online."
      },
      createPaymentFunction: "manual",
      capturePaymentFunction: "manual",
      refundPaymentFunction: "manual",
      getPaymentStatusFunction: "manual",
      generatePaymentLinkFunction: "manual",
      handleWebhookFunction: "manual"
    };
  }
});

// features/keystone/mutations/ensureDefaultPaymentProvider.ts
async function ensureDefaultPaymentProvider(root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Not authorized to manage payment providers.", provider: null };
  }
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const provider = await ensureDefaultManualPaymentProvider(context, shopId);
    return { success: true, error: null, provider };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to ensure default payment provider.",
      provider: null
    };
  }
}
var init_ensureDefaultPaymentProvider = __esm({
  "features/keystone/mutations/ensureDefaultPaymentProvider.ts"() {
    "use strict";
    init_access();
    init_defaultPaymentProvider();
    init_currentAuthorization();
  }
});

// features/keystone/queries/getPublicAppointment.ts
function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function formatCurrency3(cents2) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents2 || 0) / 100);
}
async function getPublicAppointment(_root, args, context) {
  const appointmentId = args.appointmentId?.trim();
  const accessToken = args.accessToken?.trim() || "";
  const sessionItemId = context.session?.itemId || null;
  if (!appointmentId || !accessToken && !sessionItemId) return null;
  const prisma = context.sudo().prisma;
  const credential = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, shopId: true, publicAccessTokenHash: true, accountId: true }
  });
  if (!credential?.shopId || !canAccessAppointment({ token: accessToken, storedHash: credential.publicAccessTokenHash, accountId: credential.accountId, sessionItemId })) return null;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      shopId: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      serviceTitleSnapshot: true,
      serviceImagePathSnapshot: true,
      serviceModifiersSnapshot: true,
      barberNameSnapshot: true,
      barberChairNumberSnapshot: true,
      status: true,
      source: true,
      paymentStatus: true,
      price: true,
      depositAmount: true,
      customerNotes: true,
      guestNameSnapshot: true,
      customerId: true,
      barberId: true,
      serviceId: true,
      transactionId: true,
      publicAccessTokenHash: true,
      accountId: true
    }
  });
  if (!appointment?.customerId || appointment.shopId !== credential.shopId || !canAccessAppointment({ token: accessToken, storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId })) {
    return null;
  }
  const [barber, service, transaction, lineItems, waiverRows] = await Promise.all([
    appointment.barberId ? prisma.barber.findFirst({
      where: { id: appointment.barberId, shopId: appointment.shopId },
      select: { id: true, displayName: true, imagePath: true, chairNumber: true }
    }) : null,
    appointment.serviceId ? prisma.service.findFirst({
      where: { id: appointment.serviceId, shopId: appointment.shopId },
      select: { id: true, name: true, description: true, imagePath: true }
    }) : null,
    appointment.transactionId ? prisma.checkoutTransaction.findFirst({
      where: {
        id: appointment.transactionId,
        shopId: appointment.shopId,
        customerId: appointment.customerId,
        lineItems: { some: { appointmentId: appointment.id } },
        appointments: { every: { id: appointment.id } }
      },
      select: { id: true, status: true, total: true, paymentMethod: true, completedAt: true, cashRefund: { select: { amount: true, refundedAt: true } } }
    }) : null,
    prisma.appointmentLineItem.findMany({
      where: {
        appointmentId: appointment.id,
        transactionId: appointment.transactionId || null,
        ...appointment.transactionId ? { transaction: {
          shopId: appointment.shopId,
          customerId: appointment.customerId,
          appointments: { every: { id: appointment.id } }
        } } : {}
      },
      select: {
        id: true,
        title: true,
        price: true,
        durationMinutes: true,
        imagePath: true,
        modifiers: true,
        barberName: true,
        barberChairNumber: true,
        packageBalanceId: true,
        packageName: true,
        packageVisitsConsumed: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.$queryRawUnsafe(`
      SELECT a."waiverRequirementSnapshot" AS requirement, a."bookingPolicySnapshot",
        command.receipt->'appointment'->>'bookingTimezone' AS "bookingTimezone",
        EXISTS (SELECT 1 FROM "WaiverForm" waiver WHERE waiver."appointment" = a.id AND waiver."shop" = a."shop" AND waiver."customer" = a."customer" AND waiver."service" = a."service" AND waiver.status = 'signed' AND waiver."templateHash" = a."waiverRequirementSnapshot"->>'templateHash' AND waiver."affirmationHash" IS NOT NULL AND waiver."signedAt" IS NOT NULL) AS signed
      FROM "Appointment" a LEFT JOIN "GuestBookingCommand" command ON command."appointment" = a.id AND command."shop" = a."shop"
      WHERE a.id = $1 AND a."shop" = $2 LIMIT 1
    `, appointment.id, appointment.shopId)
  ]);
  const waiver = waiverRows[0];
  const requirement = waiver?.requirement || null;
  return {
    id: appointment.id,
    startsAt: toIsoString(appointment.startsAt),
    endsAt: toIsoString(appointment.endsAt),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    source: appointment.source,
    paymentStatus: appointment.paymentStatus,
    price: appointment.price,
    depositAmount: appointment.depositAmount,
    customerNotes: appointment.customerNotes,
    bookingEligibility: bookingEligibilityFromSnapshot(waiver?.bookingPolicySnapshot),
    bookingTimezone: waiver?.bookingTimezone || null,
    waiverRequired: requirement?.required === true,
    waiverTemplateKey: requirement?.templateKey || null,
    waiverTemplateVersion: requirement?.templateVersion || null,
    waiverTemplateText: requirement?.templateText || null,
    waiverTemplateHash: requirement?.templateHash || null,
    waiverSigned: waiver?.signed || false,
    // A booking token authorizes this occurrence, never a customer account.
    // Legacy occurrences without a supplied-name snapshot intentionally show Guest.
    customer: { id: `guest:${appointment.id}`, firstName: appointment.guestNameSnapshot || "Guest", lastName: "", packageBalances: [] },
    // Accepted snapshots are the receipt; current rows only supply a photo.
    barber: appointment.barberId ? {
      id: appointment.barberId,
      displayName: appointment.barberNameSnapshot || String(barber?.displayName || ""),
      chairNumber: appointment.barberChairNumberSnapshot || String(barber?.chairNumber || ""),
      imagePath: barber?.imagePath || null
    } : null,
    service: appointment.serviceId ? {
      id: appointment.serviceId,
      name: appointment.serviceTitleSnapshot || String(service?.name || ""),
      description: service?.description || null,
      imagePath: appointment.serviceImagePathSnapshot || String(service?.imagePath || ""),
      durationMinutes: appointment.durationMinutes,
      price: appointment.price,
      // Deposit facts come from this booking, not the service's current settings.
      depositRequired: appointment.paymentStatus === "deposit_due" || appointment.paymentStatus === "deposit_paid",
      depositAmount: appointment.depositAmount
    } : null,
    lineItems: lineItems.length ? lineItems : [{
      id: `booking:${appointment.id}`,
      title: appointment.serviceTitleSnapshot || String(service?.name || "Barbershop service"),
      price: appointment.price ?? 0,
      durationMinutes: appointment.durationMinutes ?? null,
      imagePath: appointment.serviceImagePathSnapshot || String(service?.imagePath || ""),
      modifiers: appointment.serviceModifiersSnapshot || [],
      barberName: appointment.barberNameSnapshot || String(barber?.displayName || ""),
      barberChairNumber: appointment.barberChairNumberSnapshot || String(barber?.chairNumber || ""),
      packageBalanceId: "",
      packageName: "",
      packageVisitsConsumed: 0
    }],
    transaction: transaction ? (() => {
      const { cashRefund, ...receipt } = transaction;
      return {
        ...receipt,
        formattedTotal: formatCurrency3(receipt.total),
        completedAt: toIsoString(receipt.completedAt),
        refundedAmount: cashRefund ? Number(cashRefund.amount || 0) : null,
        formattedRefundedAmount: cashRefund ? formatCurrency3(cashRefund.amount) : null,
        refundedAt: cashRefund ? toIsoString(cashRefund.refundedAt || null) : null
      };
    })() : null
  };
}
var init_getPublicAppointment = __esm({
  "features/keystone/queries/getPublicAppointment.ts"() {
    "use strict";
    init_waiverEvidence();
    init_public_booking_eligibility();
  }
});

// features/keystone/queries/getPublicBookingEligibility.ts
async function getPublicBookingEligibility(_root, _args, context) {
  const shop = await resolvePublishedShop(context.prisma, { id: true });
  if (!shop) return { success: false, error: "Public booking is unavailable.", data: null };
  return getBookingEligibilityProjection(context.prisma, shop.id);
}
var init_getPublicBookingEligibility = __esm({
  "features/keystone/queries/getPublicBookingEligibility.ts"() {
    "use strict";
    init_bookingPolicy();
    init_publicShop();
  }
});

// features/keystone/mutations/reconcilePaymentSession.ts
function reconciliationResult(row) {
  return {
    id: row.id,
    paymentSessionId: row.paymentSessionId,
    localStatusBefore: row.localStatusBefore,
    remoteStatus: row.remoteStatus,
    localStatusAfter: row.localStatusAfter,
    changed: row.changed,
    observedAt: row.observedAt.toISOString()
  };
}
async function reconcileSessionInTransaction(transaction, input) {
  const { shopId, paymentSessionId, eventKey, actorId } = input;
  await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-payment-session", paymentSessionId);
  const replay = await transaction.paymentReconciliation.findUnique({ where: { eventKey } });
  if (replay) {
    if (replay.shopId !== shopId || replay.paymentSessionId !== paymentSessionId) throw new Error("Reconciliation idempotency key was already used.");
    return replay;
  }
  const paymentSession = await transaction.paymentSession.findFirst({
    where: { id: paymentSessionId, shopId },
    include: { paymentProvider: true, transaction: true }
  });
  if (!paymentSession || !paymentSession.paymentProvider) throw new Error("Payment session or provider was not found.");
  if (isOfflinePaymentProvider(paymentSession.paymentProvider)) {
    throw new Error("Pay-in-person sessions have no processor status to reconcile. Record payment at checkout.");
  }
  if (!paymentSession.providerPaymentId) throw new Error("This session has no processor payment reference to reconcile.");
  const providerResult = recordOf(await getPaymentStatus({
    provider: paymentSession.paymentProvider,
    paymentId: paymentSession.providerPaymentId,
    amount: paymentSession.amount,
    currency: paymentSession.currencyCode.toLowerCase(),
    paymentSessionId: paymentSession.id,
    appointmentId: paymentSession.appointmentId
  }));
  const remoteStatus = String(providerResult.status || "").toLowerCase();
  const observed = REMOTE_STATUS[remoteStatus];
  if (!observed) throw new Error("The provider returned a payment status that cannot be reconciled automatically.");
  if (providerResult.amount != null && Number(providerResult.amount) !== paymentSession.amount) {
    throw new Error("The provider reported a different amount. Review this payment with the provider.");
  }
  if (typeof providerResult.currency === "string" && providerResult.currency.toUpperCase() !== paymentSession.currencyCode.toUpperCase()) {
    throw new Error("The provider reported a different currency. Review this payment with the provider.");
  }
  const before = String(paymentSession.status);
  const reportedRefund = Number(providerResult.refundedAmount);
  const refundKnown = Number.isSafeInteger(reportedRefund) && reportedRefund >= 0 && reportedRefund <= paymentSession.amount;
  let next = before;
  let refundedAmount = paymentSession.refundedAmount ?? 0;
  if (observed !== before && ALLOWED[before]?.includes(observed)) {
    if (observed === "refunded" || observed === "partially_refunded") {
      if (refundKnown && reportedRefund > refundedAmount) {
        refundedAmount = reportedRefund;
        next = reportedRefund >= paymentSession.amount ? "refunded" : "partially_refunded";
      }
    } else {
      next = observed;
    }
  } else if (before === "partially_refunded" && observed === "partially_refunded" && refundKnown && reportedRefund > refundedAmount) {
    refundedAmount = reportedRefund;
  }
  const changed = next !== before || refundedAmount !== (paymentSession.refundedAmount ?? 0);
  const observedAt = /* @__PURE__ */ new Date();
  if (changed) {
    await lockAppointmentMoney(transaction, paymentSession.appointmentId);
    await transaction.paymentSession.update({
      where: { id: paymentSession.id },
      data: {
        status: next,
        refundedAmount,
        ...next === "captured" && !paymentSession.capturedAt ? { capturedAt: observedAt } : {}
      }
    });
    const appointment = paymentSession.appointmentId ? await transaction.appointment.findFirst({ where: { id: paymentSession.appointmentId, shopId }, select: { id: true, paymentStatus: true, transactionId: true } }) : null;
    if (appointment && recordOf(paymentSession.metadata).purpose !== "desk_card" && !appointmentSettledElsewhere(appointment.paymentStatus) && next === "captured") {
      await transaction.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: "deposit_paid" } });
    }
    if (appointment && next === "refunded" && appointment.paymentStatus === "deposit_paid" && !appointment.transactionId) {
      await transaction.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: "refunded" } });
    }
    if (paymentSession.transaction?.id && ["partially_refunded", "refunded"].includes(next)) {
      await transaction.checkoutTransaction.update({ where: { id: paymentSession.transaction.id }, data: { status: next } });
    }
  }
  const providerPayloadHash = (0, import_node_crypto8.createHash)("sha256").update(canonicalJson(providerResult)).digest("hex");
  const created = await transaction.paymentReconciliation.create({ data: {
    shopId,
    eventKey,
    paymentSessionId: paymentSession.id,
    localStatusBefore: before,
    remoteStatus,
    localStatusAfter: next,
    changed,
    amount: paymentSession.amount,
    providerPayloadHash,
    observedAt
  } });
  await recordCommandReceipt(transaction, buildCommandReceipt({
    actorId: actorId || void 0,
    eventKey: `${eventKey}:receipt`,
    eventType: "payment_session.reconciled",
    aggregateType: "payment_session",
    aggregateId: paymentSession.id,
    shopId,
    occurredAt: observedAt,
    data: { reconciliation: { id: created.id, localStatusBefore: before, remoteStatus, localStatusAfter: next, changed, amount: paymentSession.amount, refundedAmount } }
  }));
  return created;
}
async function reconcilePaymentSession(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized to reconcile payments.", reconciliation: null };
  const idempotencyKey = args.idempotencyKey?.trim() || "";
  if (!args.paymentSessionId?.trim() || !idempotencyKey || idempotencyKey.length > 200) return { success: false, error: "Payment session and idempotency key are required.", reconciliation: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const commandHash = hashPublicAccessToken(idempotencyKey);
    const reconciliation = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      const eventKey = `payment-reconciliation:${commandHash}:v1`;
      return reconcileSessionInTransaction(transaction, { shopId, paymentSessionId: args.paymentSessionId, eventKey, actorId: context.session?.itemId });
    });
    return { success: true, error: null, reconciliation: reconciliationResult(reconciliation) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to reconcile payment.", reconciliation: null };
  }
}
var import_node_crypto8, REMOTE_STATUS, ALLOWED;
var init_reconcilePaymentSession = __esm({
  "features/keystone/mutations/reconcilePaymentSession.ts"() {
    "use strict";
    import_node_crypto8 = require("node:crypto");
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_publicAccessToken();
    init_serializableTransaction();
    init_paymentSessionResult();
    REMOTE_STATUS = {
      pending: "pending",
      authorized: "authorized",
      captured: "captured",
      paid: "captured",
      succeeded: "captured",
      partially_refunded: "partially_refunded",
      refunded: "refunded",
      cancelled: "cancelled",
      canceled: "cancelled",
      expired: "expired",
      failed: "failed"
    };
    ALLOWED = {
      pending: ["authorized", "captured", "failed", "cancelled", "expired"],
      authorized: ["captured", "failed", "cancelled", "expired"],
      captured: ["partially_refunded", "refunded"],
      partially_refunded: ["partially_refunded", "refunded"]
    };
  }
});

// features/keystone/utils/expireStalePaymentSessions.ts
async function expireAtStripe(checkoutId) {
  if (!checkoutId || !process.env.STRIPE_SECRET_KEY) return;
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutId)}/expire`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    redirect: "error"
  }).catch(() => void 0);
}
async function closeOpenDepositSessions(tx, appointmentId) {
  const open = await tx.paymentSession.findMany({ where: { appointmentId, status: "pending" }, include: { paymentProvider: true } });
  const online = open.filter((row) => row.metadata?.purpose !== "desk_card" && row.paymentProvider && !isOfflinePaymentProvider(row.paymentProvider));
  if (!online.length) return [];
  await tx.paymentSession.updateMany({ where: { id: { in: online.map((row) => row.id) }, status: "pending" }, data: { status: "expired", cancelledAt: /* @__PURE__ */ new Date() } });
  return online.map((row) => row.providerPaymentId).filter((id) => Boolean(id));
}
function triggerPaymentSweep(prisma, shopId) {
  if (!shopId || process.env.NODE_ENV === "test") return;
  const last = lastSweep.get(shopId) || 0;
  if (Date.now() - last < SWEEP_EVERY_MS || running.has(shopId)) return;
  void expireStalePaymentSessions(prisma, shopId).catch((error) => console.error("Payment sweep failed:", error));
}
async function expireStalePaymentSessions(prisma, shopId, now = /* @__PURE__ */ new Date(), options = {}) {
  return (await sweepStalePaymentSessions(prisma, shopId, now, options)).expired;
}
async function sweepStalePaymentSessions(prisma, shopId, now = /* @__PURE__ */ new Date(), options = {}) {
  const result = { expired: 0, reconciled: 0, checked: 0 };
  const last = lastSweep.get(shopId) || 0;
  if (!options.force && now.getTime() - last < SWEEP_EVERY_MS) return result;
  if (running.has(shopId)) return result;
  lastSweep.set(shopId, now.getTime());
  running.add(shopId);
  try {
    const stale = await prisma.paymentSession.findMany({
      where: { shopId, status: { in: ["pending", "authorized"] }, OR: [{ expiresAt: { lt: now } }, { expiresAt: null, createdAt: { lt: new Date(now.getTime() - DEFAULT_LIFETIME_MS) } }] },
      include: { paymentProvider: { select: { code: true } } },
      take: 50,
      orderBy: { createdAt: "asc" }
    });
    for (const session of stale) {
      if (!session.paymentProvider || isOfflinePaymentProvider(session.paymentProvider)) continue;
      result.checked += 1;
      try {
        if (session.providerPaymentId) {
          const remote = await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId });
          if (remote.status === "captured" || remote.status === "paid" || remote.status === "succeeded") {
            if ("$transaction" in prisma) {
              const row = await runSerializableTransaction(prisma, (client) => reconcileSessionInTransaction(client, {
                shopId,
                paymentSessionId: session.id,
                eventKey: `payment-reconciliation:auto:${session.id}:captured:v1`,
                actorId: null
              }));
              if (row.changed) result.reconciled += 1;
            }
            continue;
          }
          if (remote.status !== "expired") await expireAtStripe(session.providerPaymentId);
        }
        const updated = await prisma.paymentSession.updateMany({ where: { id: session.id, status: { in: ["pending", "authorized"] } }, data: { status: "expired", cancelledAt: now } });
        result.expired += updated.count;
      } catch {
      }
    }
  } finally {
    running.delete(shopId);
  }
  return result;
}
var lastSweep, SWEEP_EVERY_MS, DEFAULT_LIFETIME_MS, running;
var init_expireStalePaymentSessions = __esm({
  "features/keystone/utils/expireStalePaymentSessions.ts"() {
    "use strict";
    init_reconcilePaymentSession();
    init_paymentProviderAdapter();
    init_serializableTransaction();
    lastSweep = /* @__PURE__ */ new Map();
    SWEEP_EVERY_MS = 5 * 6e4;
    DEFAULT_LIFETIME_MS = 24 * 36e5;
    running = /* @__PURE__ */ new Set();
  }
});

// features/keystone/queries/getPublicServices.ts
async function applyUploadedImages(context, list49, field, rows) {
  const ids = [...new Set(rows.map((row) => String(row.id || "")).filter(Boolean))];
  if (!ids.length) return;
  const found = await context.sudo().query[list49].findMany({ where: { id: { in: ids } }, query: `id ${field} { url }` });
  const urls = new Map(found.flatMap((item) => {
    const url = item[field]?.url;
    return url ? [[item.id, url]] : [];
  }));
  for (const row of rows) {
    const url = urls.get(String(row.id || ""));
    if (url) row.imagePath = url;
  }
}
async function canonicalPublicShopId(context) {
  const shop = await resolvePublishedShop(context.sudo().prisma, { id: true });
  return shop?.id || "";
}
async function getPublicServiceCatalog(_root, _args, context) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  triggerPaymentSweep(context.sudo().prisma, shopId);
  const categories = await context.sudo().prisma.serviceCategory.findMany({
    where: { shopId, status: "active" },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      services: {
        where: { shopId, status: "active" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          imagePath: true,
          durationMinutes: true,
          price: true,
          depositRequired: true,
          depositAmount: true,
          color: true,
          specialists: {
            where: { shopId, status: "active", bookingEnabled: true },
            orderBy: { displayName: "asc" },
            select: { id: true, displayName: true, imagePath: true, chairNumber: true, bookingEnabled: true }
          }
        }
      }
    }
  });
  const services = categories.flatMap((category) => category.services || []);
  await Promise.all([
    applyUploadedImages(context, "Service", "image", services),
    applyUploadedImages(context, "Barber", "photo", services.flatMap((service) => service.specialists || []))
  ]);
  return categories;
}
async function getPublicBarbers(_root, _args, context) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  const barbers = await context.sudo().prisma.barber.findMany({
    where: { shopId, status: "active", bookingEnabled: true },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      bio: true,
      imagePath: true,
      chairNumber: true,
      bookingEnabled: true,
      specialties: {
        where: { shopId, status: "active" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          imagePath: true,
          durationMinutes: true,
          price: true,
          depositRequired: true,
          depositAmount: true,
          color: true
        }
      }
    }
  });
  await Promise.all([
    applyUploadedImages(context, "Barber", "photo", barbers),
    applyUploadedImages(context, "Service", "image", barbers.flatMap((barber) => barber.specialties || []))
  ]);
  return barbers;
}
async function getPublicProducts(_root, _args, context) {
  const shopId = await canonicalPublicShopId(context);
  if (!shopId) return [];
  const products = await context.sudo().prisma.product.findMany({
    where: { shopId, status: "active" },
    orderBy: { name: "asc" },
    take: 24,
    select: {
      id: true,
      name: true,
      sku: true,
      productType: true,
      price: true,
      description: true,
      imagePath: true
    }
  });
  await applyUploadedImages(context, "Product", "image", products);
  return products;
}
var init_getPublicServices = __esm({
  "features/keystone/queries/getPublicServices.ts"() {
    "use strict";
    init_expireStalePaymentSessions();
    init_publicShop();
  }
});

// features/shared/storefront-settings.ts
function isStorefrontBrandColor(value) {
  return typeof value === "string" && Object.hasOwn(STOREFRONT_BRAND_PRESETS, value);
}
function requireStorefrontBrandColor(value) {
  if (!isStorefrontBrandColor(value)) {
    throw new Error("Choose one of the supported storefront brand colors.");
  }
  return value;
}
var STOREFRONT_BRAND_PRESETS, STOREFRONT_BRAND_COLOR_OPTIONS;
var init_storefront_settings = __esm({
  "features/shared/storefront-settings.ts"() {
    "use strict";
    STOREFRONT_BRAND_PRESETS = {
      amber: {
        label: "Cobalt",
        swatch: "#155eef",
        variables: {
          "--color-accent": "oklch(50% 0.2 263)",
          "--color-accent-hover": "oklch(43% 0.19 263)",
          "--color-accent-ink": "oklch(98% 0.01 263)",
          "--color-accent-soft": "oklch(92% 0.04 263)",
          "--color-focus": "oklch(60% 0.2 263)"
        }
      },
      indigo: {
        label: "Indigo",
        swatch: "#4f46e5",
        variables: {
          "--color-accent": "oklch(66% 0.17 275)",
          "--color-accent-hover": "oklch(57% 0.2 275)",
          "--color-accent-ink": "oklch(98% 0.01 275)",
          "--color-accent-soft": "oklch(91% 0.04 275)",
          "--color-focus": "oklch(70% 0.18 275)"
        }
      },
      emerald: {
        label: "Emerald",
        swatch: "#059669",
        variables: {
          "--color-accent": "oklch(68% 0.14 160)",
          "--color-accent-hover": "oklch(58% 0.15 160)",
          "--color-accent-ink": "oklch(16% 0.025 160)",
          "--color-accent-soft": "oklch(91% 0.045 160)",
          "--color-focus": "oklch(72% 0.16 160)"
        }
      },
      rose: {
        label: "Rose",
        swatch: "#e11d48",
        variables: {
          "--color-accent": "oklch(67% 0.18 20)",
          "--color-accent-hover": "oklch(57% 0.21 20)",
          "--color-accent-ink": "oklch(98% 0.01 20)",
          "--color-accent-soft": "oklch(92% 0.045 20)",
          "--color-focus": "oklch(72% 0.18 20)"
        }
      },
      slate: {
        label: "Slate",
        swatch: "#475569",
        variables: {
          "--color-accent": "oklch(63% 0.035 255)",
          "--color-accent-hover": "oklch(50% 0.04 255)",
          "--color-accent-ink": "oklch(98% 0.005 255)",
          "--color-accent-soft": "oklch(91% 0.015 255)",
          "--color-focus": "oklch(70% 0.08 255)"
        }
      }
    };
    STOREFRONT_BRAND_COLOR_OPTIONS = Object.entries(STOREFRONT_BRAND_PRESETS).map(
      ([value, preset]) => ({ value, label: preset.label, swatch: preset.swatch })
    );
  }
});

// features/keystone/queries/getStorefrontSettings.ts
async function getPublicStorefrontSettings(_root, _args, context) {
  const shop = await resolvePublishedShop(context.sudo().prisma, {
    id: true,
    name: true,
    tagline: true,
    address: true,
    phone: true,
    timezone: true,
    currencyCode: true,
    hours: true,
    brandColor: true,
    logoIcon: true,
    logoColor: true
  });
  if (!shop?.id || !shop.name || !shop.timezone || !shop.currencyCode || !isStorefrontBrandColor(shop.brandColor)) {
    return null;
  }
  return {
    id: shop.id,
    name: shop.name,
    tagline: shop.tagline || null,
    address: shop.address || null,
    phone: shop.phone || null,
    timezone: shop.timezone,
    currencyCode: shop.currencyCode,
    hours: shop.hours && typeof shop.hours === "object" ? shop.hours : null,
    brandColor: shop.brandColor,
    logoIcon: sanitizeStoreLogoSvg(shop.logoIcon || "") || DEFAULT_STORE_LOGO_ICON,
    logoColor: normalizeStoreLogoColor(shop.logoColor)
  };
}
var init_getStorefrontSettings = __esm({
  "features/keystone/queries/getStorefrontSettings.ts"() {
    "use strict";
    init_sanitize_store_logo();
    init_store_logo();
    init_storefront_settings();
    init_publicShop();
  }
});

// features/keystone/utils/walkInCapacity.ts
async function walkInStatus(client, shop, now = /* @__PURE__ */ new Date()) {
  const prisma = client;
  const timeZone = shop.timezone || "UTC";
  const today = dayKeyForDate(shopDateKey(now, timeZone), timeZone);
  const minute = shopMinute(now, timeZone);
  const opensAt = nextPostedOpening(shop.hours, today, minute);
  const window = postedDayWindow(shop.hours, today);
  if (window === "closed" || window && (minute < window.startMinute || minute >= window.endMinute)) return { open: false, barbersOnNow: 0, opensAt, onNowIds: [] };
  const [barbers, exceptions] = await Promise.all([
    prisma.barber.findMany({ where: { shopId: shop.id, status: "active", bookingEnabled: true }, select: { id: true, schedules: { where: { dayOfWeek: today, isWorking: true }, select: { dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } } } }),
    prisma.scheduleException.findMany({ where: { shopId: shop.id, status: "active", startsAt: { lte: now }, endsAt: { gt: now }, exceptionType: { in: ["shop_closure", "time_off"] } }, select: { exceptionType: true, barberId: true, chairId: true } })
  ]);
  if (exceptions.some((item) => item.exceptionType === "shop_closure" && !item.barberId && !item.chairId)) return { open: false, barbersOnNow: 0, opensAt, onNowIds: [] };
  const away = new Set(exceptions.filter((item) => item.exceptionType === "time_off" && item.barberId).map((item) => item.barberId));
  const onNowIds = barbers.filter((barber) => !away.has(barber.id) && barber.schedules.some((schedule) => (schedule.startMinute ?? 0) <= minute && minute < (schedule.endMinute ?? 0) && !(schedule.breakStartMinute != null && schedule.breakEndMinute != null && minute >= schedule.breakStartMinute && minute < schedule.breakEndMinute))).map((barber) => barber.id);
  return { open: onNowIds.length > 0, barbersOnNow: onNowIds.length, opensAt, onNowIds };
}
var init_walkInCapacity = __esm({
  "features/keystone/utils/walkInCapacity.ts"() {
    "use strict";
    init_shop_hours();
    init_shop_time();
    init_availability();
  }
});

// features/keystone/queries/getPublicQueue.ts
function toIsoString2(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
function publicQueueItem(item) {
  return {
    id: item.id,
    status: item.status,
    partySize: item.partySize,
    quotedWaitMinutes: item.quotedWaitMinutes,
    checkedInAt: toIsoString2(item.checkedInAt),
    seatedAt: toIsoString2(item.seatedAt),
    requestedService: item.requestedService ?? null,
    requestedBarber: item.requestedBarber ?? null
  };
}
async function getPublicQueue(_root, _args, context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true, timezone: true });
  if (!shop) return [];
  const { start } = shopDayRange(/* @__PURE__ */ new Date(), shop.timezone || "UTC");
  const items = await prisma.walkInQueueEntry.findMany({
    where: { shopId: shop.id, status: { in: ["waiting", "texted", "in_chair"] }, checkedInAt: { gte: start } },
    orderBy: { checkedInAt: "asc" },
    take: 100,
    select: {
      id: true,
      status: true,
      partySize: true,
      quotedWaitMinutes: true,
      checkedInAt: true,
      seatedAt: true,
      requestedService: {
        select: { id: true, name: true, imagePath: true, durationMinutes: true }
      },
      requestedBarber: {
        select: { id: true, displayName: true, imagePath: true, chairNumber: true }
      }
    }
  });
  return items.map(publicQueueItem);
}
async function getPublicQueueEntry(_root, args, context) {
  const queueEntryId = args.queueEntryId?.trim();
  const accessToken = args.accessToken?.trim();
  if (!queueEntryId || !accessToken) return null;
  const item = await context.sudo().prisma.walkInQueueEntry.findUnique({
    where: { id: queueEntryId },
    select: {
      id: true,
      publicAccessTokenHash: true,
      status: true,
      partySize: true,
      quotedWaitMinutes: true,
      checkedInAt: true,
      seatedAt: true,
      requestedService: {
        select: { id: true, name: true, imagePath: true, durationMinutes: true }
      },
      requestedBarber: {
        select: { id: true, displayName: true, imagePath: true, chairNumber: true }
      }
    }
  });
  if (!item || !publicAccessTokenMatches(accessToken, String(item.publicAccessTokenHash || ""))) {
    return null;
  }
  return publicQueueItem(item);
}
async function getPublicWalkInStatus(_root, _args, context) {
  const prisma = context.sudo().prisma;
  const shop = await resolvePublishedShop(prisma, { id: true, timezone: true, hours: true });
  if (!shop) return { open: false, barbersOnNow: 0, opensAt: null, onNowIds: [] };
  return walkInStatus(prisma, shop);
}
var init_getPublicQueue = __esm({
  "features/keystone/queries/getPublicQueue.ts"() {
    "use strict";
    init_publicAccessToken();
    init_publicShop();
    init_shop_time();
    init_walkInCapacity();
  }
});

// features/keystone/mutations/createPublicQueueEntry.ts
function clean3(value) {
  return value?.trim() || "";
}
function rejected(error) {
  return { success: false, error, queueEntry: null, accessToken: null };
}
async function createPublicQueueEntry(_root, args, context) {
  const customerName = clean3(args.customerName);
  const phone = clean3(args.phone);
  const phoneKey2 = phone.replace(/\D/g, "");
  const requestedServiceId = clean3(args.requestedServiceId);
  const requestedBarberId = clean3(args.requestedBarberId);
  const partySize = args.partySize == null ? 1 : Number(args.partySize);
  const clientToken = clean3(args.accessToken);
  if (customerName.length < 2 || customerName.length > 120) return rejected("Enter a valid name.");
  if (phoneKey2.length < 7 || phone.length > 40) return rejected("Enter a valid phone number.");
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) return rejected("Party size must be between 1 and 8.");
  if (clientToken && !CLIENT_TOKEN_PATTERN.test(clientToken)) return rejected("Unable to join the queue. Reload the page and try again.");
  const prisma = context.prisma;
  const access = clientToken ? { token: clientToken, hash: hashPublicAccessToken(clientToken) } : createPublicAccessToken();
  try {
    const queueEntry = await runSerializableTransaction(prisma, async (client) => {
      const transaction = client;
      const publishedShop = await resolvePublishedShop(transaction, { id: true, timezone: true, hours: true });
      if (!publishedShop) throw new QueueRejected("The walk-in queue is not open online right now. Contact the shop.");
      const shopId = publishedShop.id;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-public-queue", `${shopId}:${phoneKey2}`);
      if (clientToken) {
        const original = await transaction.walkInQueueEntry.findFirst({ where: { shopId, publicAccessTokenHash: access.hash }, select: QUEUE_ENTRY_SELECT });
        if (original) {
          if (original.customerName !== customerName || original.phone !== phone || original.partySize !== partySize || (original.requestedServiceId || "") !== requestedServiceId || (original.requestedBarberId || "") !== requestedBarberId) {
            throw new QueueRejected("This request was already sent with different details. Reload the page to start a new request.");
          }
          return original;
        }
      }
      if (!clientToken || !await transaction.walkInQueueEntry.findFirst({ where: { shopId, publicAccessTokenHash: access.hash }, select: { id: true } })) {
        const status = await walkInStatus(transaction, publishedShop);
        if (!status.open) throw new QueueRejected(`Walk-ins are closed right now.${status.opensAt ? ` ${status.opensAt}.` : ""}`);
      }
      const [service, barber] = await Promise.all([
        requestedServiceId ? transaction.service.findUnique({ where: { id: requestedServiceId }, select: { id: true, status: true, shopId: true, specialists: { select: { id: true } } } }) : null,
        requestedBarberId ? transaction.barber.findUnique({ where: { id: requestedBarberId }, select: { id: true, status: true, bookingEnabled: true, shopId: true } }) : null
      ]);
      if (requestedServiceId && (!service || service.status !== "active" || service.shopId !== shopId)) throw new QueueRejected("Selected service is no longer available.");
      if (requestedBarberId && (!barber || barber.status !== "active" || !barber.bookingEnabled || barber.shopId !== shopId)) throw new QueueRejected("Selected barber is no longer available.");
      if (service?.specialists.length && requestedBarberId && !service.specialists.some((specialist) => specialist.id === requestedBarberId)) {
        throw new QueueRejected("That barber does not offer the selected service.");
      }
      const duplicates = await transaction.$queryRawUnsafe(
        `SELECT id FROM "WalkInQueueEntry" WHERE "shop" = $1 AND status::text = ANY($2::text[]) AND regexp_replace(phone, '[^0-9]', '', 'g') = $3 LIMIT 1`,
        shopId,
        [...ACTIVE_QUEUE_STATUSES],
        phoneKey2
      );
      if (duplicates.length) throw new QueueRejected("This phone number is already in the queue. Contact the shop if you need help.");
      const created = await transaction.walkInQueueEntry.create({
        data: {
          shopId,
          customerName,
          phone,
          partySize,
          status: "waiting",
          // No estimate until staff provide one; never invent a wait time.
          quotedWaitMinutes: null,
          publicAccessTokenHash: access.hash,
          requestedServiceId: requestedServiceId || null,
          requestedBarberId: requestedBarberId || null
        },
        select: QUEUE_ENTRY_SELECT
      });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        eventKey: `queue:${created.id}:checked_in:v1`,
        eventType: "queue.checked_in",
        aggregateType: "walk_in_queue_entry",
        aggregateId: created.id,
        shopId,
        occurredAt: created.createdAt,
        data: {
          queueEntry: {
            id: created.id,
            status: created.status,
            requestedServiceId: requestedServiceId || null,
            requestedBarberId: requestedBarberId || null,
            partySize
          }
        }
      }));
      return created;
    });
    return {
      success: true,
      error: null,
      accessToken: access.token,
      queueEntry: {
        id: queueEntry.id,
        status: queueEntry.status,
        partySize: queueEntry.partySize,
        quotedWaitMinutes: queueEntry.quotedWaitMinutes,
        requestedService: queueEntry.requestedService,
        requestedBarber: queueEntry.requestedBarber,
        checkedInAt: queueEntry.checkedInAt instanceof Date ? queueEntry.checkedInAt.toISOString() : queueEntry.checkedInAt
      }
    };
  } catch (error) {
    return rejected(error instanceof QueueRejected ? error.message : "We couldn\u2019t confirm your place in the queue. Try again in a moment, or contact the shop.");
  }
}
var ACTIVE_QUEUE_STATUSES, CLIENT_TOKEN_PATTERN, QueueRejected, QUEUE_ENTRY_SELECT;
var init_createPublicQueueEntry = __esm({
  "features/keystone/mutations/createPublicQueueEntry.ts"() {
    "use strict";
    init_publicAccessToken();
    init_commandReceipt();
    init_publicShop();
    init_serializableTransaction();
    init_walkInCapacity();
    ACTIVE_QUEUE_STATUSES = ["waiting", "texted", "in_chair"];
    CLIENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
    QueueRejected = class extends Error {
    };
    QUEUE_ENTRY_SELECT = {
      id: true,
      status: true,
      partySize: true,
      quotedWaitMinutes: true,
      checkedInAt: true,
      createdAt: true,
      customerName: true,
      phone: true,
      requestedServiceId: true,
      requestedBarberId: true,
      requestedService: { select: { id: true, name: true, imagePath: true, durationMinutes: true } },
      requestedBarber: { select: { id: true, displayName: true, imagePath: true, chairNumber: true } }
    };
  }
});

// features/keystone/context.ts
var context_exports = {};
__export(context_exports, {
  keystoneContext: () => keystoneContext
});
var import_context, PrismaModule, keystoneContext;
var init_context = __esm({
  "features/keystone/context.ts"() {
    "use strict";
    import_context = require("@keystone-6/core/context");
    init_keystone();
    PrismaModule = __toESM(require("@prisma/client"));
    keystoneContext = globalThis.keystoneContext ?? (0, import_context.getContext)(keystone_default, PrismaModule);
    globalThis.keystoneContext = keystoneContext;
  }
});

// features/platform/onboarding/scripts/seedBarbershopDemo.ts
function describeSeedDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before onboarding can save shop setup.");
  }
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`Barbershop onboarding requires PostgreSQL, not ${parsed.protocol}.`);
  }
  if (!dbName) throw new Error("DATABASE_URL must include a database name.");
  return { host: parsed.hostname, port: parsed.port || "5432", dbName };
}
function assertSafeLocalSeedDatabase(databaseUrl = process.env.DATABASE_URL) {
  const target = describeSeedDatabase(databaseUrl);
  if (!SAFE_LOCAL_DB_HOSTS.has(target.host)) {
    throw new Error(`Refusing local seed CLI against non-local database host ${target.host}.`);
  }
  const isDisposableRuntime = /^runtime_barbershop_(?:verify|ephemeral)_[a-z0-9_]+$/.test(target.dbName);
  if (target.dbName !== REQUIRED_LOCAL_RUNTIME_DATABASE && !isDisposableRuntime) {
    throw new Error(`Refusing local seed CLI against ${target.dbName}; expected ${REQUIRED_LOCAL_RUNTIME_DATABASE} or a disposable verify/ephemeral runtime.`);
  }
  return target;
}
function loadSeed() {
  return JSON.parse(import_node_fs2.default.readFileSync(seedPath, "utf8"));
}
function selectSeedMode(seed, mode) {
  if (mode === "full") return seed;
  const categories = (seed.serviceCategories ?? []).slice(0, 2);
  const categoryNames = new Set(categories.map((item) => text47(item.name)));
  const services = (seed.services ?? []).filter((item) => categoryNames.has(text47(item.category))).slice(0, 3);
  const serviceNames = new Set(services.map((item) => text47(item.name)));
  const barbers = (seed.barbers ?? []).slice(0, 1).map((item) => ({
    ...item,
    specialties: Array.isArray(item.specialties) ? item.specialties.filter((name) => serviceNames.has(text47(name))) : []
  }));
  const barberNames = new Set(barbers.map((item) => text47(item.displayName)));
  return {
    shop: seed.shop,
    paymentProviders: (seed.paymentProviders ?? []).slice(0, 1),
    bookingPolicies: (seed.bookingPolicies ?? []).slice(0, 1),
    noShowPolicies: [],
    serviceCategories: categories,
    services,
    barbers,
    products: (seed.products ?? []).slice(0, 1),
    suppliers: (seed.suppliers ?? []).slice(0, 1),
    schedules: (seed.schedules ?? []).filter((item) => barberNames.has(text47(item.barber))),
    servicePackages: [],
    membershipPlans: []
  };
}
function stat(stats, key, field = "created") {
  stats[key] ??= { created: 0, reused: 0, skipped: 0 };
  stats[key][field] = (stats[key][field] ?? 0) + 1;
}
function text47(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function buildDemoPractitionerCredentialSeeds(barbers, jurisdictionCode) {
  const jurisdiction = text47(jurisdictionCode, "US-NY");
  return barbers.flatMap((barber) => {
    const barberName = text47(barber.displayName);
    const specialties = Array.isArray(barber.specialties) ? barber.specialties.map((service) => text47(service)).filter(Boolean) : [];
    return specialties.map((serviceName) => {
      const seedKey = `${jurisdiction}:${barberName}:${serviceName}`;
      const keyHash = (0, import_node_crypto9.createHash)("sha256").update(seedKey).digest("hex");
      return {
        barberName,
        serviceName,
        credentialType: "barber",
        credentialNumber: `DEMO-NOT-A-LICENSE-${keyHash.slice(0, 12).toUpperCase()}`,
        issuingAuthority: "DEMO ONLY \u2014 onboarding authority fixture; not a licensing authority",
        jurisdictionCode: jurisdiction,
        scopeDescription: `DEMO ONLY \u2014 seeded authority for ${barberName} to provide ${serviceName}; not legal credential proof`,
        evidenceHash: (0, import_node_crypto9.createHash)("sha256").update(`demo-practitioner-authority:${seedKey}:v1`).digest("hex"),
        status: "active",
        effectiveFrom: "2020-01-01T00:00:00.000Z",
        expiresAt: "2099-12-31T23:59:59.000Z",
        verifiedAt: "2020-01-01T00:00:00.000Z",
        supervisionRequired: false
      };
    });
  });
}
function demoCredentialRerunAction(existing) {
  if (!existing) return "create";
  return existing.status === "active" ? "reuse" : "skip";
}
function optionalConnect(id) {
  return id ? { connect: { id } } : void 0;
}
function getSudoContext() {
  const context = seedContextStorage.getStore();
  if (!context) throw new Error("Barbershop seed context is required.");
  return context.sudo();
}
function getPrismaClient() {
  return seedContextStorage.getStore()?.prisma;
}
function getSeedSessionUserId() {
  return seedContextStorage.getStore()?.session?.itemId || void 0;
}
function getSeedSessionActiveShopId() {
  const data = seedContextStorage.getStore()?.session?.data;
  return data?.activeShop?.id || void 0;
}
function hasPrismaDelegate(delegateName) {
  return Boolean(getPrismaClient()?.[delegateName]);
}
async function findFirst(listKey, where, query = "id") {
  const sudo = getSudoContext();
  const items = await sudo.query[listKey].findMany({ where, take: 1, query });
  return items[0] ?? null;
}
async function findOrCreate(stats, listKey, where, data, query = "id") {
  const existing = await findFirst(listKey, where, query);
  if (existing) {
    stat(stats, listKey, "reused");
    return existing;
  }
  const sudo = getSudoContext();
  const created = await sudo.query[listKey].createOne({ data, query });
  stat(stats, listKey, "created");
  return created;
}
function slugify(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "barbershop";
}
function seedShopData(shop) {
  const timezone = text47(shop.timezone, "America/New_York");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }
  const currencyCode = text47(shop.currencyCode, "USD");
  assertUsdSettlementCurrency(currencyCode);
  const logoIcon = sanitizeStoreLogoSvg(typeof shop.logoIcon === "string" && shop.logoIcon.trim() ? shop.logoIcon : DEFAULT_STORE_LOGO_ICON);
  if (!logoIcon) throw new Error("Invalid SVG format.");
  return {
    name: text47(shop.name, "Barbershop"),
    legalName: text47(shop.legalName, text47(shop.name, "Barbershop")),
    status: "active",
    tagline: text47(shop.tagline),
    address: text47(shop.address),
    phone: text47(shop.phone),
    timezone,
    currencyCode,
    jurisdictionCode: text47(shop.jurisdictionCode, "US-NY"),
    hours: shop.hours ?? {},
    brandColor: text47(shop.brandColor, "amber"),
    logoIcon,
    logoColor: normalizeStoreLogoColor(shop.logoColor ?? DEFAULT_STORE_LOGO_COLOR)
  };
}
function applyShopDetails(shop, details) {
  const name = text47(details?.name).trim();
  const address = text47(details?.address).trim();
  const phone = text47(details?.phone).trim();
  const timezone = text47(details?.timezone).trim();
  if (name.length > 120 || address.length > 200 || phone.length > 40) throw new Error("Shop details are too long.");
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      throw new Error("Choose a valid timezone.");
    }
  }
  if (!name) return { ...shop, ...address ? { address } : {}, ...phone ? { phone } : {}, ...timezone ? { timezone } : {} };
  const rest = { ...shop };
  delete rest.slug;
  delete rest.tagline;
  return { ...rest, name, legalName: name, address, phone, ...timezone ? { timezone } : {} };
}
async function resolveCallerShop(stats, userId, shopSeed) {
  const client = getPrismaClient();
  if (!client) throw new Error("Shop setup requires the database client.");
  const prisma = strictPrisma(client);
  const activeShopId = getSeedSessionActiveShopId();
  return runSerializableTransaction(prisma, async (client2) => {
    const transaction = client2;
    const owned = await transaction.shopMembership.findMany({
      where: { userId, status: "active", membershipRole: "owner", shop: { status: "active" } },
      select: { shopId: true, shop: { select: { id: true, jurisdictionCode: true } } },
      orderBy: { createdAt: "asc" }
    });
    if (owned.length) {
      const selected = owned.find((membership) => membership.shopId === activeShopId) ?? (owned.length === 1 ? owned[0] : null);
      if (!selected) throw new Error("Select the shop you want to set up, then run setup again.");
      return { id: selected.shop.id, jurisdictionCode: selected.shop.jurisdictionCode, created: false };
    }
    const data = seedShopData(shopSeed);
    const baseSlug = slugify(text47(shopSeed.slug, data.name));
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5 && await transaction.shop.findUnique({ where: { slug }, select: { id: true } }); attempt += 1) {
      slug = `${baseSlug}-${(0, import_node_crypto9.randomBytes)(3).toString("hex")}`;
    }
    const otherPublicShop = await transaction.shop.findFirst({ where: { status: "active", isPublic: true }, select: { id: true } });
    const shop = await transaction.shop.create({
      data: { ...data, slug, isPublic: !otherPublicShop },
      select: { id: true, jurisdictionCode: true }
    });
    await transaction.shopMembership.create({
      data: { membershipKey: `${shop.id}:${userId}`, shopId: shop.id, userId, membershipRole: "owner", status: "active" }
    });
    await transaction.user.update({ where: { id: userId }, data: { activeShopId: shop.id } });
    return { id: shop.id, jurisdictionCode: shop.jurisdictionCode, created: true };
  }).then((shop) => {
    stat(stats, "Shop", shop.created ? "created" : "reused");
    if (shop.created) stat(stats, "ShopMembership", "created");
    return shop;
  });
}
async function resolveCliShop(stats, shopSeed) {
  const data = seedShopData(shopSeed);
  const slug = slugify(text47(shopSeed.slug, data.name));
  const shop = await findOrCreate(stats, "Shop", { slug: { equals: slug } }, { ...data, slug, isPublic: true }, "id jurisdictionCode");
  return { id: shop.id, jurisdictionCode: text47(shop.jurisdictionCode, data.jurisdictionCode), created: false };
}
async function refreshedSeedSession(userId) {
  const context = seedContextStorage.getStore();
  if (!context?.withSession) return void 0;
  const [current] = await getSudoContext().query.User.findMany({
    where: { id: { equals: userId } },
    take: 1,
    query: `id name activeShop { id slug status } shopMemberships { id status membershipRole shop { id slug status } } role { id name canSeeOtherPeople canEditOtherPeople canManagePeople canManageRoles canAccessDashboard canManageOnboarding canManageServices canManageStaff canManageSchedules canManageAppointments canManageQueue canManageCustomers canManageCustomerNotes canManageMemberships canManagePayments canViewReports }`
  });
  if (!current) throw new Error("Onboarding account is unavailable.");
  return context.withSession({ itemId: userId, listKey: "User", data: current });
}
async function runBarbershopSeed({
  mode = "full",
  apply = false,
  context,
  requireLocalDatabase = false,
  shopDetails = null
}) {
  return seedContextStorage.run(context, async () => {
    const runtime = requireLocalDatabase ? assertSafeLocalSeedDatabase() : describeSeedDatabase();
    const seed = selectSeedMode(loadSeed(), mode);
    const shouldDryRun = !apply;
    const summary = {
      shops: seed.shop ? 1 : 0,
      paymentProviders: seed.paymentProviders?.length ?? 0,
      noShowPolicies: seed.noShowPolicies?.length ?? 0,
      bookingPolicies: seed.bookingPolicies?.length ?? 0,
      practitionerCredentials: 0,
      serviceCategories: seed.serviceCategories?.length ?? 0,
      services: seed.services?.length ?? 0,
      barbers: seed.barbers?.length ?? 0,
      products: seed.products?.length ?? 0,
      suppliers: seed.suppliers?.length ?? 0,
      scheduleTemplates: seed.schedules?.length ?? 0,
      servicePackages: seed.servicePackages?.length ?? 0,
      membershipPlans: seed.membershipPlans?.length ?? 0
    };
    if (shouldDryRun) {
      return { mode, runtime, summary, stats: {}, dryRun: true };
    }
    if (!seed.shop) throw new Error("Shop setup data is missing.");
    const stats = {};
    const categoryIds = {};
    const serviceIds = {};
    const barberIds = {};
    const productIdsBySku = {};
    const userId = getSeedSessionUserId();
    const shopSeed = applyShopDetails(seed.shop, shopDetails);
    const shop = userId ? await resolveCallerShop(stats, userId, shopSeed) : await resolveCliShop(stats, shopSeed);
    const shopId = shop.id;
    const shopJurisdictionCode = text47(shop.jurisdictionCode, text47(seed.shop.jurisdictionCode, "US-NY"));
    if (userId) {
      const refreshed = await refreshedSeedSession(userId);
      if (refreshed) seedContextStorage.enterWith(refreshed);
    }
    for (const policy of seed.bookingPolicies ?? []) {
      const existing = await findFirst("BookingPolicy", { shop: { id: { equals: shopId } } }, "id status");
      if (existing) {
        stat(stats, "BookingPolicy", "reused");
        continue;
      }
      await findOrCreate(
        stats,
        "BookingPolicy",
        { shop: { id: { equals: shopId } }, version: { equals: text47(policy.version, "v1") } },
        {
          shop: optionalConnect(shopId),
          name: text47(policy.name, "Standard booking policy"),
          version: text47(policy.version, "v1"),
          jurisdictionCode: shopJurisdictionCode,
          policyTextHash: text47(policy.policyTextHash),
          status: "active",
          effectiveFrom: text47(policy.effectiveFrom, (/* @__PURE__ */ new Date()).toISOString()),
          effectiveUntil: policy.effectiveUntil || null,
          cancellationWindowMinutes: numberValue(policy.cancellationWindowMinutes, 1440),
          rescheduleWindowMinutes: numberValue(policy.rescheduleWindowMinutes, 1440),
          lateCancellationFeeAmount: numberValue(policy.lateCancellationFeeAmount),
          rescheduleFeeAmount: numberValue(policy.rescheduleFeeAmount),
          depositCancellationRule: text47(policy.depositCancellationRule, "manual_review"),
          maxCustomerReschedules: numberValue(policy.maxCustomerReschedules, 2)
        },
        "id status"
      );
    }
    if (hasPrismaDelegate("paymentProvider")) {
      for (const provider of seed.paymentProviders ?? []) {
        const code = text47(provider.code);
        if (!code) continue;
        await findOrCreate(
          stats,
          "PaymentProvider",
          { shop: { id: { equals: shopId } }, code: { equals: code } },
          {
            shop: optionalConnect(shopId),
            name: text47(provider.name, code),
            code,
            isInstalled: provider.isInstalled ?? true,
            credentials: provider.credentials ?? {},
            metadata: provider.metadata ?? {},
            createPaymentFunction: text47(provider.createPaymentFunction, "manual"),
            capturePaymentFunction: text47(provider.capturePaymentFunction, "manual"),
            refundPaymentFunction: text47(provider.refundPaymentFunction, "manual"),
            getPaymentStatusFunction: text47(provider.getPaymentStatusFunction, "manual"),
            generatePaymentLinkFunction: text47(provider.generatePaymentLinkFunction, "manual"),
            handleWebhookFunction: text47(provider.handleWebhookFunction, "manual")
          },
          "id code"
        );
      }
    } else {
      stat(stats, "PaymentProvider", "skipped");
    }
    for (const policy of seed.noShowPolicies ?? []) {
      const name = text47(policy.name);
      if (!name) continue;
      await findOrCreate(
        stats,
        "NoShowPolicy",
        { shop: { id: { equals: shopId } }, name: { equals: name } },
        {
          shop: optionalConnect(shopId),
          name,
          status: text47(policy.status, "active"),
          feeAmount: numberValue(policy.feeAmount),
          graceMinutes: numberValue(policy.graceMinutes, 10),
          appliesToMemberships: Boolean(policy.appliesToMemberships),
          description: text47(policy.description)
        }
      );
    }
    for (const category of seed.serviceCategories ?? []) {
      const name = text47(category.name);
      if (!name) continue;
      const item = await findOrCreate(
        stats,
        "ServiceCategory",
        { shop: { id: { equals: shopId } }, name: { equals: name } },
        {
          shop: optionalConnect(shopId),
          name,
          description: text47(category.description),
          displayOrder: numberValue(category.displayOrder),
          status: text47(category.status, "active")
        }
      );
      categoryIds[name] = item.id;
    }
    for (const service of seed.services ?? []) {
      const name = text47(service.name);
      if (!name) continue;
      const item = await findOrCreate(
        stats,
        "Service",
        { shop: { id: { equals: shopId } }, name: { equals: name } },
        {
          shop: optionalConnect(shopId),
          name,
          description: text47(service.description),
          imagePath: text47(service.imagePath),
          durationMinutes: numberValue(service.durationMinutes, 30),
          price: numberValue(service.price),
          depositRequired: Boolean(service.depositRequired),
          depositAmount: numberValue(service.depositAmount),
          status: text47(service.status, "active"),
          bookingBufferMinutes: numberValue(service.bookingBufferMinutes, 10),
          color: text47(service.color, "#111827"),
          category: optionalConnect(categoryIds[text47(service.category)])
        }
      );
      serviceIds[name] = item.id;
    }
    for (const barber of seed.barbers ?? []) {
      const displayName = text47(barber.displayName);
      if (!displayName) continue;
      const specialties = Array.isArray(barber.specialties) ? barber.specialties.map((name) => serviceIds[text47(name)]).filter(Boolean).map((id) => ({ id })) : [];
      const chairNumber = text47(barber.chairNumber);
      const chair = chairNumber ? await findOrCreate(
        stats,
        "BarberChair",
        { shop: { id: { equals: shopId } }, chairNumber: { equals: chairNumber } },
        { shop: optionalConnect(shopId), chairNumber, stationName: `Chair ${chairNumber}`, status: "active" }
      ) : null;
      const item = await findOrCreate(
        stats,
        "Barber",
        { shop: { id: { equals: shopId } }, displayName: { equals: displayName } },
        {
          shop: optionalConnect(shopId),
          chair: optionalConnect(chair?.id),
          displayName,
          legalName: text47(barber.legalName),
          bio: text47(barber.bio),
          imagePath: text47(barber.imagePath),
          phone: text47(barber.phone),
          email: text47(barber.email),
          chairNumber,
          status: text47(barber.status, "active"),
          bookingEnabled: barber.bookingEnabled ?? true,
          bufferMinutes: numberValue(barber.bufferMinutes, 10),
          serviceCommissionRateBps: numberValue(barber.serviceCommissionRateBps),
          specialties: specialties.length ? { connect: specialties } : void 0
        }
      );
      barberIds[displayName] = item.id;
    }
    const fixtureClient = getPrismaClient();
    const fixtureScope = !!(isDisposableLocalFixtureTarget(runtime) && fixtureClient && typeof fixtureClient.$queryRawUnsafe === "function" && await isLocalFixtureShop(fixtureClient, shopId));
    const localCredentials = fixtureScope ? buildDemoPractitionerCredentialSeeds(seed.barbers ?? [], shopJurisdictionCode) : [];
    summary.practitionerCredentials = localCredentials.length;
    for (const credential of localCredentials) {
      const barberId = barberIds[credential.barberName];
      const serviceId = serviceIds[credential.serviceName];
      if (!barberId || !serviceId) {
        stat(stats, "PractitionerCredential", "skipped");
        continue;
      }
      const existing = await findFirst(
        "PractitionerCredential",
        { shop: { id: { equals: shopId } }, barber: { id: { equals: barberId } }, service: { id: { equals: serviceId } } },
        "id status"
      );
      const action = demoCredentialRerunAction(existing ? { status: existing.status } : null);
      if (action !== "create") {
        stat(stats, "PractitionerCredential", action === "reuse" ? "reused" : "skipped");
        continue;
      }
      await findOrCreate(
        stats,
        "PractitionerCredential",
        { credentialNumber: { equals: credential.credentialNumber }, shop: { id: { equals: shopId } }, barber: { id: { equals: barberId } }, service: { id: { equals: serviceId } } },
        {
          shop: optionalConnect(shopId),
          barber: optionalConnect(barberId),
          service: optionalConnect(serviceId),
          credentialType: credential.credentialType,
          credentialNumber: credential.credentialNumber,
          issuingAuthority: credential.issuingAuthority,
          jurisdictionCode: credential.jurisdictionCode,
          scopeDescription: credential.scopeDescription,
          evidenceHash: credential.evidenceHash,
          status: credential.status,
          effectiveFrom: credential.effectiveFrom,
          expiresAt: credential.expiresAt,
          verifiedAt: credential.verifiedAt,
          supervisionRequired: credential.supervisionRequired
        }
      );
    }
    for (const product of seed.products ?? []) {
      const sku = text47(product.sku);
      const name = text47(product.name);
      if (!sku || !name) continue;
      const item = await findOrCreate(
        stats,
        "Product",
        { shop: { id: { equals: shopId } }, sku: { equals: sku } },
        {
          shop: optionalConnect(shopId),
          name,
          sku,
          status: text47(product.status, "active"),
          productType: text47(product.productType, "other"),
          price: numberValue(product.price),
          cost: numberValue(product.cost),
          description: text47(product.description),
          imagePath: text47(product.imagePath),
          inventoryTracked: product.inventoryTracked ?? true,
          metadata: product.metadata ?? {}
        }
      );
      productIdsBySku[sku] = item.id;
    }
    for (const supplier of seed.suppliers ?? []) {
      const name = text47(supplier.name);
      if (!name) continue;
      await findOrCreate(
        stats,
        "Supplier",
        { shop: { id: { equals: shopId } }, name: { equals: name } },
        {
          shop: optionalConnect(shopId),
          name,
          status: text47(supplier.status, "active"),
          contactName: text47(supplier.contactName),
          email: text47(supplier.email),
          phone: text47(supplier.phone),
          website: text47(supplier.website),
          notes: text47(supplier.notes),
          metadata: supplier.metadata ?? {}
        }
      );
    }
    for (const schedule of seed.schedules ?? []) {
      const barberId = barberIds[text47(schedule.barber)];
      const days = Array.isArray(schedule.days) ? schedule.days.map((day) => text47(day)).filter(Boolean) : [];
      if (!barberId || days.length === 0) continue;
      for (const dayOfWeek of days) {
        await findOrCreate(
          stats,
          "BarberSchedule",
          { barber: { id: { equals: barberId } }, dayOfWeek: { equals: dayOfWeek } },
          {
            barber: { connect: { id: barberId } },
            dayOfWeek,
            isWorking: schedule.isWorking ?? true,
            startMinute: numberValue(schedule.startMinute, 540),
            endMinute: numberValue(schedule.endMinute, 1020),
            breakStartMinute: numberValue(schedule.breakStartMinute, 0),
            breakEndMinute: numberValue(schedule.breakEndMinute, 0),
            notes: text47(schedule.notes)
          }
        );
      }
    }
    for (const pack of seed.servicePackages ?? []) {
      const name = text47(pack.name);
      if (!name) continue;
      const item = await findOrCreate(
        stats,
        "ServicePackage",
        { shop: { id: { equals: shopId } }, name: { equals: name } },
        {
          shop: optionalConnect(shopId),
          name,
          description: text47(pack.description),
          price: numberValue(pack.price),
          status: text47(pack.status, "active")
        }
      );
      const items = Array.isArray(pack.items) ? pack.items : [];
      for (const packItem of items) {
        const serviceId = serviceIds[text47(packItem.service)];
        if (!serviceId) continue;
        await findOrCreate(
          stats,
          "ServicePackageItem",
          { package: { id: { equals: item.id } }, service: { id: { equals: serviceId } } },
          {
            package: { connect: { id: item.id } },
            service: { connect: { id: serviceId } },
            quantity: numberValue(packItem.quantity, 1)
          }
        );
      }
    }
    for (const plan of seed.membershipPlans ?? []) {
      const name = text47(plan.name);
      if (!name) continue;
      await findOrCreate(
        stats,
        "MembershipPlan",
        { shop: { id: { equals: shopId } }, name: { equals: name } },
        {
          shop: optionalConnect(shopId),
          name,
          description: text47(plan.description),
          price: numberValue(plan.price),
          billingInterval: text47(plan.billingInterval, "monthly"),
          includedVisits: numberValue(plan.includedVisits, 1),
          discountPercent: numberValue(plan.discountPercent),
          status: text47(plan.status, "active")
        }
      );
    }
    return { mode, runtime, summary, stats, dryRun: false };
  });
}
var import_node_async_hooks, import_node_crypto9, import_node_fs2, import_node_path2, REQUIRED_LOCAL_RUNTIME_DATABASE, SAFE_LOCAL_DB_HOSTS, seedPath, isDirectExecution, seedContextStorage;
var init_seedBarbershopDemo = __esm({
  "features/platform/onboarding/scripts/seedBarbershopDemo.ts"() {
    "use strict";
    import_node_async_hooks = require("node:async_hooks");
    import_node_crypto9 = require("node:crypto");
    import_node_fs2 = __toESM(require("node:fs"));
    import_node_path2 = __toESM(require("node:path"));
    init_localFixtureAuthority();
    init_serializableTransaction();
    init_strictPrisma();
    init_supportedSettlementCurrency();
    init_sanitize_store_logo();
    init_store_logo();
    REQUIRED_LOCAL_RUNTIME_DATABASE = "runtime_barbershop";
    SAFE_LOCAL_DB_HOSTS = /* @__PURE__ */ new Set(["127.0.0.1", "localhost"]);
    seedPath = import_node_path2.default.resolve(process.cwd(), "features/platform/onboarding/lib/seed.json");
    isDirectExecution = process.argv[1] ? import_node_path2.default.resolve(process.argv[1]) === import_node_path2.default.resolve(process.cwd(), "features/platform/onboarding/scripts/seedBarbershopDemo.ts") : false;
    seedContextStorage = new import_node_async_hooks.AsyncLocalStorage();
    if (isDirectExecution) {
      const apply = process.argv.includes("--apply");
      const mode = process.argv.includes("--minimal") ? "minimal" : "full";
      let cliContext = null;
      Promise.resolve().then(() => (init_context(), context_exports)).then(({ keystoneContext: keystoneContext2 }) => {
        cliContext = keystoneContext2;
        return runBarbershopSeed({ mode, apply, context: cliContext, requireLocalDatabase: true });
      }).then((result) => {
        process.stdout.write(`${JSON.stringify({ mode: result.mode, dryRun: result.dryRun, summary: result.summary, stats: result.stats }, null, 2)}
`);
      }).catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`);
        process.exitCode = 1;
      }).finally(async () => {
        await cliContext?.prisma?.$disconnect?.();
      });
    }
  }
});

// features/keystone/mutations/runBarbershopOnboarding.ts
function normalizeMode(value) {
  if (value === "minimal" || value === "full") return value;
  return null;
}
async function runBarbershopOnboarding(_root, args, context) {
  if (!permissions.canManageOnboarding({ session: context.session })) {
    return { success: false, error: "Not authorized to run onboarding.", result: null };
  }
  const mode = normalizeMode(args.mode);
  if (!mode) {
    return { success: false, error: "Onboarding mode must be minimal or full.", result: null };
  }
  const userId = context.session?.itemId;
  if (!userId) {
    return { success: false, error: "A signed-in dashboard user is required.", result: null };
  }
  const sudo = context.sudo();
  try {
    await assertCurrentRolePermission(context.session, "canManageOnboarding");
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Not authorized to run onboarding.", result: null };
  }
  const [currentUser] = await sudo.query.User.findMany({ where: { id: { equals: userId } }, take: 1, query: "id onboardingStatus" });
  const previousStatus = currentUser?.onboardingStatus || "not_started";
  try {
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: "in_progress" }
    });
    const result = await runBarbershopSeed({ mode, apply: true, context, shopDetails: { name: args.shopName, address: args.shopAddress, phone: args.shopPhone, timezone: args.shopTimezone } });
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: "completed" }
    });
    return { success: true, error: null, result };
  } catch (error) {
    await sudo.db.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: previousStatus === "in_progress" ? "not_started" : previousStatus }
    }).catch(() => void 0);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to save shop setup.",
      result: null
    };
  }
}
var init_runBarbershopOnboarding = __esm({
  "features/keystone/mutations/runBarbershopOnboarding.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_seedBarbershopDemo();
  }
});

// features/keystone/mutations/initiateAppointmentPaymentSession.ts
function clean4(value) {
  return value?.trim() || "";
}
function statusOf(value) {
  return String(recordOf(value).status || "").toLowerCase();
}
function sameRequest(stored, request) {
  const original = recordOf(recordOf(stored).request);
  if (!Object.keys(original).length) return null;
  return original.appointmentId === request.appointmentId && (original.amount ?? null) === request.amount && (original.currencyCode ?? null) === request.currencyCode;
}
async function initiateAppointmentPaymentSession(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Not authorized to initiate payment sessions.", paymentSession: null };
  }
  const appointmentId = clean4(args.appointmentId);
  const idempotencyKey = clean4(args.idempotencyKey);
  if (!appointmentId || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return { success: false, error: "Appointment and a valid idempotency key are required.", paymentSession: null };
  }
  const requestedCurrency = clean4(args.currencyCode).toUpperCase() || null;
  if (requestedCurrency && !/^[A-Z]{3}$/.test(requestedCurrency)) {
    return { success: false, error: "Currency code must be a three-letter ISO code.", paymentSession: null };
  }
  if (args.amount != null && (!Number.isSafeInteger(args.amount) || args.amount <= 0)) {
    return { success: false, error: "Payment session amount must be a whole number of cents greater than zero.", paymentSession: null };
  }
  const request = { appointmentId, amount: args.amount ?? null, currencyCode: requestedCurrency };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const idempotencyKeyHash = hashPublicAccessToken(idempotencyKey);
    const paymentSession = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-payment-initiation",
        idempotencyKeyHash
      );
      await lockAppointmentMoney(transaction, appointmentId);
      const existing = await transaction.paymentSession.findUnique({
        where: { idempotencyKeyHash },
        select: { id: true, shopId: true, appointmentId: true, metadata: true }
      });
      if (existing) {
        if (existing.shopId !== shopId || existing.appointmentId !== appointmentId || sameRequest(existing.metadata, request) === false) {
          throw new Error("This idempotency key was already used for a different payment request.");
        }
        return transaction.paymentSession.findUniqueOrThrow({
          where: { id: existing.id },
          include: { appointment: true, paymentProvider: true }
        });
      }
      const appointment = await transaction.appointment.findFirst({
        where: { id: appointmentId, shopId },
        include: { shop: { select: { currencyCode: true } } }
      });
      if (!appointment) throw new Error("Appointment not found.");
      if (appointment.transactionId || ["paid", "refunded"].includes(String(appointment.paymentStatus))) {
        throw new Error("This appointment is already settled and cannot start another payment session.");
      }
      if (["cancelled", "no_show"].includes(String(appointment.status))) {
        throw new Error("Cancelled or no-show appointments cannot start payment sessions.");
      }
      const currencyCode = appointment.shop.currencyCode;
      assertUsdSettlementCurrency(currencyCode);
      if (requestedCurrency && requestedCurrency !== currencyCode) {
        throw new Error(`Payments for this shop are taken in ${currencyCode}.`);
      }
      if (appointment.price == null) {
        throw new Error("This appointment has no agreed price. Set its price before taking payment.");
      }
      const openSession = await transaction.paymentSession.findFirst({
        where: { appointmentId, shopId, status: { in: [...OPEN_PAYMENT_SESSION_STATUSES] } },
        select: { id: true }
      });
      if (openSession) {
        throw new Error("This appointment already has an open payment session. Cancel it before starting another.");
      }
      const defaultAmount = appointment.depositAmount && appointment.depositAmount > 0 ? appointment.depositAmount : appointment.price;
      const amount = request.amount ?? defaultAmount;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Payment session amount must be greater than zero.");
      }
      if (amount > appointment.price) {
        throw new Error("Payment session amount cannot exceed the appointment price.");
      }
      const provider = await transaction.paymentProvider.findFirst({
        where: { shopId, isInstalled: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });
      if (!provider) throw new Error("No payment provider is set up for this shop.");
      const settlement = paymentProviderSettlement(provider);
      const expiresAt = new Date(Date.now() + 30 * 6e4);
      const created = await transaction.paymentSession.create({
        data: {
          shopId,
          appointmentId,
          paymentProviderId: provider.id,
          idempotencyKeyHash,
          status: "pending",
          amount,
          currencyCode,
          expiresAt,
          metadata: { request, providerCode: provider.code, settlement }
        }
      });
      const adapterResult = await createPayment({
        provider,
        amount,
        currency: currencyCode.toLowerCase(),
        appointmentId,
        paymentSessionId: created.id,
        idempotencyKey
      });
      const adapterStatus = statusOf(adapterResult);
      const adapterData = recordOf(recordOf(adapterResult).data);
      const externalId = settlement === "processor" ? [recordOf(adapterResult).id, adapterData.id].find((value) => typeof value === "string" && value.length > 0) ?? null : null;
      const status = settlement === "processor" && adapterStatus === "authorized" ? "authorized" : "pending";
      const updated = await transaction.paymentSession.update({
        where: { id: created.id },
        data: { providerPaymentId: externalId ?? "", status, metadata: { request, providerCode: provider.code, settlement, adapterStatus } },
        include: { appointment: true, paymentProvider: true }
      });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `payment-session:${created.id}:initiated:v1`,
        eventType: "payment_session.initiated",
        aggregateType: "payment_session",
        aggregateId: created.id,
        shopId,
        occurredAt: updated.createdAt,
        data: {
          paymentSession: {
            id: created.id,
            appointmentId,
            paymentProviderId: provider.id,
            amount,
            currencyCode,
            settlement,
            providerPaymentId: externalId,
            expiresAt: expiresAt.toISOString()
          }
        }
      }));
      return updated;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(paymentSession) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to start the payment session.",
      paymentSession: null
    };
  }
}
var init_initiateAppointmentPaymentSession = __esm({
  "features/keystone/mutations/initiateAppointmentPaymentSession.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_publicAccessToken();
    init_serializableTransaction();
    init_supportedSettlementCurrency();
    init_paymentSessionResult();
  }
});

// features/keystone/mutations/captureAppointmentPaymentSession.ts
async function captureAppointmentPaymentSession(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Not authorized to capture payment sessions.", paymentSession: null };
  }
  if (!args.paymentSessionId?.trim()) {
    return { success: false, error: "Payment session is required.", paymentSession: null };
  }
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const updated = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-payment-session",
        args.paymentSessionId
      );
      const paymentSession = await transaction.paymentSession.findFirst({
        where: { id: args.paymentSessionId, shopId },
        include: { appointment: true, paymentProvider: true }
      });
      if (!paymentSession) throw new Error("Payment session not found.");
      const provider = paymentSession.paymentProvider;
      if (!provider) throw new Error("Payment provider is missing.");
      if (isOfflinePaymentProvider(provider)) {
        throw new Error("Pay-in-person sessions are not captured by a processor. Record the payment at checkout.");
      }
      if (paymentSession.status === "captured") return paymentSession;
      if (!provider.isInstalled) throw new Error("This payment provider is disabled and cannot capture new payments.");
      const metadata = recordOf(paymentSession.metadata);
      if (typeof metadata.providerCode === "string" && metadata.providerCode !== provider.code) {
        throw new Error("The payment provider changed after this session started. Reconcile it before capturing.");
      }
      if (!paymentSession.providerPaymentId) throw new Error("This session has no processor payment reference to capture.");
      if (!["pending", "authorized"].includes(String(paymentSession.status))) {
        throw new Error(`Payment session in ${paymentSession.status} state cannot be captured.`);
      }
      if (paymentSession.expiresAt && paymentSession.expiresAt <= /* @__PURE__ */ new Date()) {
        throw new Error("Payment session has expired.");
      }
      await lockAppointmentMoney(transaction, paymentSession.appointmentId);
      const appointment = paymentSession.appointmentId ? await transaction.appointment.findFirst({ where: { id: paymentSession.appointmentId, shopId }, select: { id: true, paymentStatus: true } }) : null;
      if (appointment && appointmentSettledElsewhere(appointment.paymentStatus)) {
        throw new Error("This appointment was already settled at checkout. Cancel this session instead.");
      }
      const result = recordOf(await capturePayment({
        provider,
        paymentId: paymentSession.providerPaymentId,
        amount: paymentSession.amount,
        currency: paymentSession.currencyCode.toLowerCase(),
        paymentSessionId: paymentSession.id,
        appointmentId: paymentSession.appointmentId
      }));
      const status = String(result.status || "").toLowerCase();
      if (!["captured", "paid", "succeeded"].includes(status)) {
        throw new Error("Payment provider did not capture the session.");
      }
      if (result.amount != null && Number(result.amount) !== paymentSession.amount) {
        throw new Error("Payment provider reported a different captured amount. Reconcile this session.");
      }
      if (typeof result.currency === "string" && result.currency.toUpperCase() !== paymentSession.currencyCode.toUpperCase()) {
        throw new Error("Payment provider reported a different currency. Reconcile this session.");
      }
      const capturedAt = /* @__PURE__ */ new Date();
      const captured = await transaction.paymentSession.update({
        where: { id: paymentSession.id },
        data: { status: "captured", capturedAt },
        include: { appointment: true, paymentProvider: true }
      });
      if (appointment) {
        await transaction.appointment.update({
          where: { id: appointment.id },
          data: { paymentStatus: "deposit_paid" }
        });
      }
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `payment-session:${paymentSession.id}:captured:v1`,
        eventType: "payment_session.captured",
        aggregateType: "payment_session",
        aggregateId: paymentSession.id,
        shopId,
        occurredAt: capturedAt,
        data: {
          paymentSession: {
            id: paymentSession.id,
            appointmentId: paymentSession.appointmentId,
            amount: paymentSession.amount,
            currencyCode: paymentSession.currencyCode,
            providerPaymentId: paymentSession.providerPaymentId
          }
        }
      }));
      return captured;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(updated) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to capture payment session.",
      paymentSession: null
    };
  }
}
var init_captureAppointmentPaymentSession = __esm({
  "features/keystone/mutations/captureAppointmentPaymentSession.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_paymentProviderAdapter();
    init_commandReceipt();
    init_serializableTransaction();
    init_paymentSessionResult();
  }
});

// features/keystone/mutations/refundAppointmentPaymentSession.ts
async function refundAppointmentPaymentSession(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Not authorized to refund payment sessions.", paymentSession: null };
  }
  const idempotencyKey = args.idempotencyKey?.trim() || "";
  if (!args.paymentSessionId?.trim() || !idempotencyKey || idempotencyKey.length > 200) {
    return { success: false, error: "Payment session and a refund idempotency key are required.", paymentSession: null };
  }
  if (args.amount != null && (!Number.isSafeInteger(args.amount) || args.amount <= 0)) {
    return { success: false, error: "Refund amount must be a whole number of cents greater than zero.", paymentSession: null };
  }
  const requestedAmount = args.amount ?? void 0;
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const updated = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-payment-session",
        args.paymentSessionId
      );
      const paymentSession = await transaction.paymentSession.findFirst({
        where: { id: args.paymentSessionId, shopId },
        include: { appointment: true, transaction: true, paymentProvider: true }
      });
      if (!paymentSession) throw new Error("Payment session not found.");
      const provider = paymentSession.paymentProvider;
      if (!provider) throw new Error("Payment provider is missing.");
      if (isOfflinePaymentProvider(provider)) {
        throw new Error("Pay-in-person payments are not refunded by a processor. Record a cash refund from the checkout receipt.");
      }
      const eventKey = `payment-refund:${shopId}:${hashPublicAccessToken(idempotencyKey)}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = recordOf(replay.payload);
        const refund = recordOf(recordOf(payload.data).refund);
        if (replay.shopId !== shopId || payload.aggregateId !== paymentSession.id || refund.requestedAmount !== requestedAmount) {
          throw new Error("Refund idempotency key was reused for a different refund.");
        }
        return paymentSession;
      }
      if (!["captured", "partially_refunded"].includes(String(paymentSession.status))) {
        throw new Error(`Payment session in ${paymentSession.status} state cannot be refunded.`);
      }
      const metadata = recordOf(paymentSession.metadata);
      if (typeof metadata.providerCode === "string" && metadata.providerCode !== provider.code) {
        throw new Error("The payment provider changed after this session started. Reconcile it before refunding.");
      }
      if (!paymentSession.providerPaymentId) throw new Error("This session has no processor payment reference to refund.");
      if (metadata.purpose === "gift_card") {
        const card = await transaction.giftCard.findFirst({ where: { paymentSessionId: paymentSession.id, shopId } });
        if (card && card.balance < card.initialValue) throw new Error("This gift card has been used. Only an unused gift card can be refunded.");
        if (requestedAmount != null && requestedAmount < paymentSession.amount) throw new Error("Gift cards are refunded in full.");
      }
      const capturedAmount = Math.max(0, paymentSession.amount);
      const alreadyRefunded = Math.max(0, paymentSession.refundedAmount || 0);
      const remaining = Math.max(0, capturedAmount - alreadyRefunded);
      const refundAmount = requestedAmount ?? remaining;
      if (refundAmount <= 0 || refundAmount > remaining) {
        throw new Error("Refund amount must be positive and no greater than the remaining captured amount.");
      }
      await lockAppointmentMoney(transaction, paymentSession.appointmentId);
      if (paymentSession.transaction?.id) {
        const paidCommission = await transaction.commission.count({ where: { transactionId: paymentSession.transaction.id, status: "paid" } });
        if (paidCommission) throw new Error("A commission on this sale was already paid. Owner reconciliation is required before refunding it.");
      }
      const result = recordOf(await refundPayment({
        provider,
        paymentId: paymentSession.providerPaymentId,
        amount: refundAmount,
        currency: paymentSession.currencyCode.toLowerCase(),
        paymentSessionId: paymentSession.id,
        appointmentId: paymentSession.appointmentId,
        idempotencyKey
      }));
      const status = String(result.status || "").toLowerCase();
      if (!["refunded", "succeeded"].includes(status)) throw new Error("Payment provider did not refund the session.");
      if (result.amount != null && Number(result.amount) !== refundAmount) {
        throw new Error("Payment provider reported a different refund amount. Reconcile this session.");
      }
      const refundedAmount = alreadyRefunded + refundAmount;
      const fullyRefunded = refundedAmount >= capturedAmount;
      const refundedAt = /* @__PURE__ */ new Date();
      const refunded = await transaction.paymentSession.update({
        where: { id: paymentSession.id },
        data: { status: fullyRefunded ? "refunded" : "partially_refunded", refundedAmount },
        include: { appointment: true, transaction: true, paymentProvider: true }
      });
      if (paymentSession.appointmentId && fullyRefunded) {
        await transaction.appointment.updateMany({
          where: { id: paymentSession.appointmentId, shopId, paymentStatus: "deposit_paid", transactionId: null },
          data: { paymentStatus: "refunded" }
        });
        await transaction.appointment.updateMany({
          where: { id: paymentSession.appointmentId, shopId, paymentStatus: "refunded", transactionId: null, status: { in: ["requested", "confirmed"] } },
          data: { status: "cancelled", cancellationReason: "Deposit refunded" }
        });
      }
      if (fullyRefunded && recordOf(paymentSession.metadata).purpose === "gift_card") {
        await transaction.giftCard.updateMany({ where: { paymentSessionId: paymentSession.id, shopId }, data: { status: "cancelled", balance: 0 } });
      }
      if (paymentSession.transaction?.id) {
        await transaction.checkoutTransaction.update({
          where: { id: paymentSession.transaction.id },
          data: { status: fullyRefunded ? "refunded" : "partially_refunded" }
        });
        if (fullyRefunded) {
          await transaction.appointment.updateMany({ where: { transactionId: paymentSession.transaction.id, shopId }, data: { paymentStatus: "refunded" } });
          await transaction.commission.updateMany({ where: { transactionId: paymentSession.transaction.id, status: { in: ["projected", "approved"] } }, data: { status: "voided" } });
        }
      }
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: fullyRefunded ? "payment_session.refunded" : "payment_session.partially_refunded",
        aggregateType: "payment_session",
        aggregateId: paymentSession.id,
        shopId,
        occurredAt: refundedAt,
        data: {
          refund: {
            requestedAmount,
            amount: refundAmount,
            refundedAmount,
            capturedAmount
          },
          settlement: {
            appointmentId: paymentSession.appointmentId,
            transactionId: paymentSession.transaction?.id,
            providerPaymentId: paymentSession.providerPaymentId
          }
        }
      }));
      return refunded;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(updated) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to refund payment session.",
      paymentSession: null
    };
  }
}
var init_refundAppointmentPaymentSession = __esm({
  "features/keystone/mutations/refundAppointmentPaymentSession.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_publicAccessToken();
    init_serializableTransaction();
    init_paymentSessionResult();
  }
});

// features/keystone/mutations/cancelAppointmentPaymentSession.ts
async function cancelAppointmentPaymentSession(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Not authorized to cancel payment sessions.", paymentSession: null };
  }
  if (!args.paymentSessionId?.trim()) {
    return { success: false, error: "Payment session is required.", paymentSession: null };
  }
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const updated = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-payment-session",
        args.paymentSessionId
      );
      const paymentSession = await transaction.paymentSession.findFirst({
        where: { id: args.paymentSessionId, shopId },
        include: { appointment: true, paymentProvider: true }
      });
      if (!paymentSession) throw new Error("Payment session not found.");
      if (paymentSession.status === "cancelled") return paymentSession;
      if (!["pending", "authorized"].includes(String(paymentSession.status))) {
        throw new Error(`Payment session in ${paymentSession.status} state cannot be cancelled.`);
      }
      if (!paymentSession.paymentProvider || !isOfflinePaymentProvider(paymentSession.paymentProvider)) {
        throw new Error("This payment provider does not support cancelling a payment here. Reconcile the session with the provider.");
      }
      const cancelledAt = /* @__PURE__ */ new Date();
      const cancelled = await transaction.paymentSession.update({
        where: { id: paymentSession.id },
        data: { status: "cancelled", cancelledAt },
        include: { appointment: true, paymentProvider: true }
      });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `payment-session:${paymentSession.id}:cancelled:v1`,
        eventType: "payment_session.cancelled",
        aggregateType: "payment_session",
        aggregateId: paymentSession.id,
        shopId,
        occurredAt: cancelledAt,
        data: { paymentSession: { id: paymentSession.id, appointmentId: paymentSession.appointmentId, settlement: "offline" } }
      }));
      return cancelled;
    });
    return { success: true, error: null, paymentSession: serializePaymentSession(updated) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to cancel payment session.",
      paymentSession: null
    };
  }
}
var init_cancelAppointmentPaymentSession = __esm({
  "features/keystone/mutations/cancelAppointmentPaymentSession.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_serializableTransaction();
    init_paymentSessionResult();
  }
});

// features/keystone/mutations/recordInventoryMovement.ts
async function recordInventoryMovement(_root, args, context) {
  if (!permissions.canManageServices({ session: context.session })) {
    return { success: false, error: "Not authorized to manage inventory.", movement: null };
  }
  const inventoryLotId = args.inventoryLotId?.trim();
  const reason = args.reason?.trim();
  const referenceKey = args.referenceKey?.trim();
  const quantityDelta = Number(args.quantityDelta);
  if (!inventoryLotId || !reason || reason.length > 500 || !referenceKey || referenceKey.length > 200) {
    return { success: false, error: "Lot, reason, and reference key are required.", movement: null };
  }
  if (!MOVEMENT_TYPES.has(args.movementType)) {
    return { success: false, error: "Inventory movement type is invalid.", movement: null };
  }
  if (["receive", "return"].includes(args.movementType) && quantityDelta <= 0) {
    return { success: false, error: "Receive and return movements must increase inventory.", movement: null };
  }
  if (["sale", "waste"].includes(args.movementType) && quantityDelta >= 0) {
    return { success: false, error: "Sale and waste movements must decrease inventory.", movement: null };
  }
  try {
    const movement = await runSerializableTransaction(
      context.prisma,
      async (client) => {
        const transaction = client;
        const shopId = await requireCurrentShopPermission(context.session, "canManageServices", transaction);
        await transaction.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
          "barbershop-inventory",
          `lot:${inventoryLotId}`
        );
        const lot = await transaction.inventoryLot.findFirst({ where: { id: inventoryLotId, shopId } });
        if (!lot || !lot.productId || !lot.shopId) throw new Error("Inventory lot was not found.");
        const replay = await transaction.inventoryMovement.findUnique({ where: { referenceKey } });
        if (replay) {
          if (replay.shopId !== lot.shopId || replay.inventoryLotId !== lot.id || replay.movementType !== args.movementType || replay.quantityDelta !== quantityDelta || replay.reason !== reason) {
            throw new Error("Inventory idempotency key was reused for a different movement.");
          }
          return replay;
        }
        const now = /* @__PURE__ */ new Date();
        const expired = lot.status === "expired" || Boolean(lot.expiresAt && lot.expiresAt <= now);
        if (quantityDelta > 0 && expired) throw new Error("This lot has expired. Receive new stock as a new lot instead of adding to it.");
        const balance = applyInventoryDelta(lot.quantityRemaining || 0, quantityDelta);
        const created = await transaction.inventoryMovement.create({
          data: {
            shopId: lot.shopId,
            productId: lot.productId,
            inventoryLotId: lot.id,
            movementType: args.movementType,
            quantityDelta: balance.delta,
            quantityAfter: balance.after,
            reason,
            referenceKey,
            occurredAt: /* @__PURE__ */ new Date()
          }
        });
        await transaction.inventoryLot.update({
          where: { id: lot.id },
          data: {
            quantityRemaining: balance.after,
            quantityReceived: args.movementType === "receive" ? (lot.quantityReceived || 0) + balance.delta : lot.quantityReceived,
            // Quantity changes never revive an expired lot.
            status: expired ? "expired" : balance.after === 0 ? "consumed" : "active"
          }
        });
        await recordCommandReceipt(transaction, buildCommandReceipt({
          actorId: context.session?.itemId,
          eventKey: `inventory:${created.id}:${referenceKey}:v1`,
          eventType: "inventory.moved",
          aggregateType: "inventory_movement",
          aggregateId: created.id,
          shopId: lot.shopId,
          occurredAt: created.occurredAt,
          data: {
            movement: {
              id: created.id,
              inventoryLotId: lot.id,
              productId: lot.productId,
              movementType: created.movementType,
              quantityDelta: created.quantityDelta,
              quantityAfter: created.quantityAfter,
              referenceKey,
              reason,
              actorId: context.session?.itemId ?? null
            }
          }
        }));
        return created;
      }
    );
    return { success: true, error: null, movement };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to record inventory movement.", movement: null };
  }
}
var MOVEMENT_TYPES;
var init_recordInventoryMovement = __esm({
  "features/keystone/mutations/recordInventoryMovement.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_balanceLedgers();
    init_serializableTransaction();
    init_commandReceipt();
    MOVEMENT_TYPES = /* @__PURE__ */ new Set(["receive", "sale", "return", "waste", "adjustment"]);
  }
});

// features/keystone/mutations/receiveInventoryLot.ts
async function receiveInventoryLot(_root, args, context) {
  if (!permissions.canManageServices({ session: context.session })) return { success: false, error: "Not authorized to receive inventory.", received: null };
  const lotNumber = args.lotNumber?.trim();
  const key = args.idempotencyKey?.trim();
  const quantity = Math.floor(Number(args.quantity));
  const unitCost = Math.floor(Number(args.unitCost || 0));
  if (!args.productId || !lotNumber || lotNumber.length > 120 || !key || key.length > 200 || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0) return { success: false, error: "Product, lot number, positive quantity, non-negative cost, and idempotency key are required.", received: null };
  try {
    const received = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const referenceKey = `inventory-receipt:${hash3(key)}`;
      const shopId = await requireCurrentShopPermission(context.session, "canManageServices", transaction);
      const receivedAt = optionalDate(args.receivedAt) || /* @__PURE__ */ new Date();
      const expiresAt = optionalDate(args.expiresAt);
      if (receivedAt.getTime() > Date.now() + 5 * 6e4) throw new Error("Received date cannot be in the future.");
      if (expiresAt && expiresAt <= receivedAt) throw new Error("Expiry date must be after the received date.");
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-inventory-receipt", referenceKey);
      const replay = await transaction.inventoryMovement.findUnique({ where: { referenceKey }, include: { inventoryLot: true } });
      if (replay) {
        if (replay.shopId !== shopId || !replay.inventoryLot || replay.productId !== args.productId || replay.inventoryLot.supplierId !== (args.supplierId || null) || replay.inventoryLot.lotNumber !== lotNumber || replay.quantityDelta !== quantity || replay.inventoryLot.unitCost !== unitCost || (args.receivedAt ? replay.inventoryLot.receivedAt?.getTime() !== receivedAt.getTime() : false) || (replay.inventoryLot.expiresAt?.getTime() ?? null) !== (expiresAt?.getTime() ?? null)) throw new Error("Inventory receipt idempotency key was reused with different input.");
        return replay.inventoryLot;
      }
      const product = await transaction.product.findFirst({ where: { id: args.productId, shopId } });
      if (!product) throw new Error("Product was not found.");
      if (product.inventoryTracked === false) throw new Error("This product is not stock-tracked. Turn on inventory tracking before receiving stock.");
      const supplier = args.supplierId ? await transaction.supplier.findUnique({ where: { id: args.supplierId } }) : null;
      if (args.supplierId && (!supplier || supplier.shopId !== product.shopId || supplier.status !== "active")) throw new Error("Supplier is unavailable in the active shop.");
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-inventory-lot", `${product.shopId}:${lotNumber}`);
      const lot = await transaction.inventoryLot.create({ data: { shopId: product.shopId, productId: product.id, supplierId: supplier?.id || null, lotNumber, quantityReceived: quantity, quantityRemaining: quantity, unitCost, receivedAt, expiresAt, status: expiresAt && expiresAt <= /* @__PURE__ */ new Date() ? "expired" : "active", metadata: { source: "operator_receipt" } } });
      const movement = await transaction.inventoryMovement.create({ data: { shopId: product.shopId, productId: product.id, inventoryLotId: lot.id, movementType: "receive", quantityDelta: quantity, quantityAfter: quantity, reason: `Received lot ${lotNumber}`, referenceKey, occurredAt: receivedAt } });
      await recordCommandReceipt(transaction, buildCommandReceipt({ actorId: context.session?.itemId, eventKey: `inventory-receipt:${movement.id}:recorded:v1`, eventType: "inventory.received", aggregateType: "inventory_lot", aggregateId: lot.id, shopId: product.shopId, occurredAt: receivedAt, data: { receipt: { lotId: lot.id, productId: product.id, supplierId: supplier?.id || null, lotNumber, quantity, unitCost, receivedAt: receivedAt.toISOString(), expiresAt: expiresAt?.toISOString() ?? null, actorId: context.session?.itemId ?? null } } }));
      return lot;
    });
    return { success: true, error: null, received: { id: received.id, lotNumber: received.lotNumber, quantityReceived: received.quantityReceived, quantityRemaining: received.quantityRemaining, status: received.status } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to receive inventory.", received: null };
  }
}
var import_node_crypto10, hash3, optionalDate;
var init_receiveInventoryLot = __esm({
  "features/keystone/mutations/receiveInventoryLot.ts"() {
    "use strict";
    import_node_crypto10 = require("node:crypto");
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_serializableTransaction();
    hash3 = (value) => (0, import_node_crypto10.createHash)("sha256").update(value).digest("hex");
    optionalDate = (value) => {
      if (!value) return null;
      const result = new Date(value);
      if (Number.isNaN(result.getTime())) throw new Error("Inventory date is invalid.");
      return result;
    };
  }
});

// features/keystone/mutations/seatWalkInQueueEntry.ts
async function seatWalkInQueueEntry(_root, args, context) {
  if (!permissions.canManageQueue({ session: context.session })) {
    return { success: false, error: "Not authorized to seat walk-ins.", seated: null };
  }
  const queueEntryId = args.queueEntryId?.trim();
  if (!queueEntryId) {
    return { success: false, error: "Queue entry is required.", seated: null };
  }
  try {
    const seated = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageQueue", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-walk-in",
        `queue:${queueEntryId}`
      );
      const entry = await transaction.walkInQueueEntry.findFirst({
        where: { id: queueEntryId, shopId },
        include: {
          shop: { select: { id: true, timezone: true } },
          requestedService: { include: { specialists: { select: { id: true } } } },
          requestedBarber: { include: { chair: { select: { id: true, shopId: true, status: true } } } },
          appointment: { select: { id: true } },
          customer: { select: { id: true } }
        }
      });
      if (!entry) throw new Error("Walk-in not found.");
      if (!entry.shopId || !entry.requestedService) throw new Error("Walk-in needs a shop and active requested service.");
      if (!["waiting", "texted"].includes(entry.status || "") || entry.appointment) {
        throw new Error("Walk-in has already been seated or is no longer waiting.");
      }
      if (entry.requestedService.status !== "active") throw new Error("Requested service is no longer active.");
      const specialistIds = entry.requestedService.specialists.map((barber2) => barber2.id);
      const requestedService = entry.requestedService;
      const shopIdForEntry = entry.shopId;
      const candidates = entry.requestedBarber ? [entry.requestedBarber] : await transaction.barber.findMany({
        where: {
          shopId: entry.shopId,
          status: "active",
          bookingEnabled: true,
          ...specialistIds.length > 0 ? { id: { in: specialistIds } } : {}
        },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        take: 50,
        include: { chair: { select: { id: true, shopId: true, status: true } } }
      });
      if (!candidates.length) throw new Error("No active barber is available for this walk-in.");
      const evaluate = async (barber2) => {
        if (!barber2 || barber2.status !== "active" || !barber2.bookingEnabled || barber2.shopId !== shopIdForEntry) {
          throw new Error("No active barber is available for this walk-in.");
        }
        if (!barber2.chair) throw new Error("The requested barber does not have an assigned chair.");
        if (requestedService.shopId !== shopIdForEntry || barber2.chair.shopId !== shopIdForEntry) {
          throw new Error("Walk-in service, barber, and chair must belong to the same shop.");
        }
        if (barber2.chair.status !== "active") throw new Error("The requested chair is unavailable.");
        if (specialistIds.length > 0 && !specialistIds.includes(barber2.id)) {
          throw new Error("Requested barber does not provide this service.");
        }
        await lockBookingResources(transaction, {
          serviceId: requestedService.id,
          barberId: barber2.id,
          chairNumber: `${shopIdForEntry}:${barber2.chair.id}`
        });
        const startsAt2 = /* @__PURE__ */ new Date();
        const timeZone = entry.shop?.timezone || "";
        try {
          new Intl.DateTimeFormat("en", { timeZone }).format(startsAt2);
        } catch {
          throw new Error("Shop timezone is unavailable.");
        }
        const durationMinutes2 = requestedService.durationMinutes || 30;
        const bufferMinutes = occupiedBufferMinutes(barber2.bufferMinutes, requestedService.bookingBufferMinutes);
        const endsAt2 = new Date(startsAt2.getTime() + durationMinutes2 * 6e4);
        const capacityEndsAt = new Date(endsAt2.getTime() + bufferMinutes * 6e4);
        const capacityStartsAt = new Date(startsAt2.getTime() - bufferMinutes * 6e4);
        const { start: shiftDayStart, end: shiftDayEnd } = dayRange(startsAt2, timeZone);
        const [conflict, exceptions, shifts, weeklySchedule] = await Promise.all([
          transaction.appointment.findFirst({
            where: {
              shopId: shopIdForEntry,
              status: { in: [...ACTIVE_APPOINTMENT_STATUSES2] },
              AND: [
                { OR: [{ barberId: barber2.id }, { chairId: barber2.chair.id }] },
                {
                  OR: [
                    // A guest still in the chair occupies it until the service is completed.
                    { status: "in_chair" },
                    { startsAt: { lt: capacityEndsAt }, endsAt: { gt: capacityStartsAt } },
                    // Legacy rows without an end are never treated as free capacity.
                    { startsAt: { lt: capacityEndsAt }, endsAt: null }
                  ]
                }
              ]
            },
            select: { id: true }
          }),
          transaction.scheduleException.findMany({
            where: {
              shopId: shopIdForEntry,
              status: "active",
              startsAt: { lt: capacityEndsAt },
              endsAt: { gt: startsAt2 },
              OR: [
                { barberId: barber2.id },
                { exceptionType: "shop_closure", barberId: null, chairId: null },
                ...barber2.chair?.id ? [{ chairId: barber2.chair.id }] : []
              ]
            },
            select: { reason: true, exceptionType: true, startsAt: true, endsAt: true }
          }),
          transaction.staffShift.findMany({ where: { shopId: shopIdForEntry, barberId: barber2.id, status: { in: ["scheduled", "clocked_in"] }, scheduledStart: { lt: shiftDayEnd }, scheduledEnd: { gt: shiftDayStart } }, select: { scheduledStart: true, scheduledEnd: true } }),
          transaction.barberSchedule.findFirst({
            where: { barberId: barber2.id, dayOfWeek: dayKeyForDate(startsAt2, timeZone), isWorking: true },
            select: { startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true }
          })
        ]);
        if (conflict) throw new Error("The requested barber or chair is currently occupied.");
        const blocking = exceptions.find((item) => item.exceptionType !== "working_override");
        if (blocking) throw new Error(blocking.reason || "The requested barber or chair is unavailable.");
        const override = exceptions.find((item) => item.exceptionType === "working_override" && item.startsAt <= startsAt2 && item.endsAt >= capacityEndsAt);
        if (!override) {
          const startMinute = shopMinute(startsAt2, timeZone);
          const endMinute = startMinute + durationMinutes2 + bufferMinutes;
          if (!weeklySchedule || startMinute < (weeklySchedule.startMinute ?? 0) || endMinute > (weeklySchedule.endMinute ?? 0)) {
            throw new Error("The barber is outside working hours for this service.");
          }
          const breakStart = weeklySchedule.breakStartMinute;
          const breakEnd = weeklySchedule.breakEndMinute;
          if (breakStart != null && breakEnd != null && startMinute < breakEnd && endMinute > breakStart) throw new Error("The barber is on a scheduled break.");
        }
        if (shifts.length && !shifts.some((shift) => startsAt2 >= shift.scheduledStart && capacityEndsAt <= shift.scheduledEnd)) throw new Error("The barber is outside the scheduled shift.");
        const [authority2, waiver2] = await Promise.all([
          requireEffectivePractitionerAuthority(transaction, { shopId: shopIdForEntry, barberId: barber2.id, serviceId: requestedService.id, at: startsAt2 }),
          getWaiverRequirement(transaction, requestedService.id)
        ]);
        return { barber: { ...barber2, chair: barber2.chair }, startsAt: startsAt2, endsAt: endsAt2, durationMinutes: durationMinutes2, authority: authority2, waiver: waiver2 };
      };
      let chosen = null;
      let lastError = null;
      for (const candidate of candidates) {
        try {
          chosen = await evaluate(candidate);
          break;
        } catch (error) {
          lastError = error;
          if (entry.requestedBarber) throw error;
        }
      }
      if (!chosen) throw lastError instanceof Error ? lastError : new Error("No active barber is available for this walk-in.");
      const { barber, startsAt, endsAt, durationMinutes, authority, waiver } = chosen;
      if (waiver.required) throw new Error("Waiver-required walk-ins must be booked and signed before seating.");
      const customerName = entry.customerName.trim() || "Walk-in guest";
      const [firstName, ...lastName] = customerName.split(/\s+/);
      const customer = entry.customer ?? await transaction.customer.create({
        data: {
          shopId: entry.shopId,
          firstName,
          lastName: lastName.join(" "),
          phone: entry.phone || `walk-in-${entry.id}`,
          status: "active"
        },
        select: { id: true }
      });
      const appointment = await transaction.appointment.create({
        data: {
          shopId: entry.shopId,
          chairId: barber.chair.id,
          customerId: customer.id,
          barberId: barber.id,
          serviceId: entry.requestedService.id,
          queueEntryId: entry.id,
          startsAt,
          endsAt,
          durationMinutes,
          serviceTitleSnapshot: entry.requestedService.name,
          serviceImagePathSnapshot: entry.requestedService.imagePath,
          serviceModifiersSnapshot: [],
          barberNameSnapshot: barber.displayName,
          barberChairNumberSnapshot: barber.chairNumber,
          status: "in_chair",
          source: "walk_in",
          paymentStatus: entry.requestedService.depositRequired ? "deposit_due" : "not_required",
          price: entry.requestedService.price,
          depositAmount: entry.requestedService.depositAmount || 0,
          customerNotes: entry.notes
        }
      });
      await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "bookingAuthoritySnapshot" = $2::jsonb, "executionAuthoritySnapshot" = $2::jsonb, "waiverRequirementSnapshot" = $3::jsonb, "serviceStartedAt" = $4 WHERE id = $1', appointment.id, JSON.stringify(authority), JSON.stringify(waiver), startsAt);
      const updatedQueue = await transaction.walkInQueueEntry.update({
        where: { id: entry.id },
        data: {
          status: "in_chair",
          seatedAt: startsAt,
          customerId: customer.id,
          requestedBarberId: barber.id
        }
      });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `queue:${entry.id}:seated:${appointment.id}:v1`,
        eventType: "queue.seated",
        aggregateType: "walk_in_queue_entry",
        aggregateId: entry.id,
        shopId: entry.shopId,
        occurredAt: updatedQueue.updatedAt,
        data: {
          queueEntry: { id: entry.id, status: updatedQueue.status, actorId: context.session?.itemId ?? null },
          appointment: { id: appointment.id, barberId: barber.id, chairId: barber.chair.id, authority, waiverRequirement: waiver }
        }
      }));
      return {
        queueEntryId: entry.id,
        appointmentId: appointment.id,
        status: "in_chair",
        startsAt: startsAt.toISOString(),
        barberId: barber.id,
        chairNumber: barber.chairNumber
      };
    });
    return { success: true, error: null, seated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to seat this walk-in.",
      seated: null
    };
  }
}
var ACTIVE_APPOINTMENT_STATUSES2;
var init_seatWalkInQueueEntry = __esm({
  "features/keystone/mutations/seatWalkInQueueEntry.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_availability();
    init_shop_time();
    init_bookingCapacity();
    init_serializableTransaction();
    init_commandReceipt();
    init_practitionerAuthority();
    init_waiverEvidence();
    ACTIVE_APPOINTMENT_STATUSES2 = ["requested", "confirmed", "checked_in", "in_chair"];
  }
});

// features/keystone/utils/lifecycleState.ts
function assertAppointmentTransition(currentStatus, nextStatus, context = {}) {
  if (currentStatus === nextStatus) return;
  const allowed = APPOINTMENT_TRANSITIONS[currentStatus];
  if (!allowed) throw new Error("Appointment status is invalid.");
  if (allowed.length === 0) throw new Error("Terminal appointments cannot transition.");
  if (!allowed.includes(nextStatus)) throw new Error(`Appointment cannot transition from ${currentStatus} to ${nextStatus}.`);
  if (nextStatus === "completed" && context.paymentStatus !== "paid") {
    throw new Error("Appointments are completed by paid checkout, not by a raw status change.");
  }
  if (nextStatus === "no_show" && context.startsAt && (context.now || /* @__PURE__ */ new Date()) < context.startsAt) {
    throw new Error("An appointment cannot be marked no-show before its start time.");
  }
}
function assertQueueTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  const allowed = QUEUE_TRANSITIONS[currentStatus];
  if (!allowed) throw new Error("Queue status is invalid.");
  if (allowed.length === 0) throw new Error("Terminal queue entries cannot transition.");
  if (nextStatus === "in_chair") throw new Error("Use the seat walk-in command to enter a chair.");
  if (!allowed.includes(nextStatus)) throw new Error(`Queue entry cannot transition from ${currentStatus} to ${nextStatus}.`);
}
var APPOINTMENT_TRANSITIONS, QUEUE_TRANSITIONS;
var init_lifecycleState = __esm({
  "features/keystone/utils/lifecycleState.ts"() {
    "use strict";
    APPOINTMENT_TRANSITIONS = {
      requested: ["confirmed", "cancelled"],
      confirmed: ["checked_in", "cancelled", "no_show"],
      checked_in: ["in_chair", "cancelled", "no_show"],
      in_chair: ["completed"],
      completed: [],
      cancelled: [],
      no_show: []
    };
    QUEUE_TRANSITIONS = {
      waiting: ["texted", "left"],
      texted: ["waiting", "left"],
      in_chair: ["served", "left"],
      served: [],
      left: []
    };
  }
});

// features/keystone/mutations/transitionAppointment.ts
async function transitionAppointment(_root, args, context) {
  if (!permissions.canManageAppointments({ session: context.session })) {
    return { success: false, error: "Not authorized to transition appointments.", appointment: null };
  }
  const appointmentId = args.appointmentId?.trim();
  const toStatus = args.toStatus?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  if (!appointmentId || !STATUSES.has(toStatus) || !idempotencyKey || idempotencyKey.length > 200) {
    return { success: false, error: "Appointment, target status, and idempotency key are required.", appointment: null };
  }
  if (toStatus === "no_show") {
    return { success: false, error: "Use Mark no-show so the grace period and no-show policy are applied.", appointment: null };
  }
  let confirmedNow = false;
  try {
    const appointment = await runSerializableTransaction(context.prisma, async (client) => {
      confirmedNow = false;
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageAppointments", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-appointment-transition",
        appointmentId
      );
      const current = await transaction.appointment.findFirst({ where: { id: appointmentId, shopId } });
      if (!current || !current.shopId) throw new Error("Appointment not found.");
      const commandHash = hashPublicAccessToken(idempotencyKey);
      const eventKey = `appointment-command:${commandHash}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (payload?.aggregateId !== appointmentId || payload.shopId !== shopId || payload.data?.transition?.toStatus !== toStatus || payload.data.transition.actorId !== void 0 && payload.data.transition.actorId !== (context.session?.itemId ?? null)) {
          throw new Error("Appointment idempotency key was reused for a different command.");
        }
        return current;
      }
      if (current.status === toStatus) return current;
      if (toStatus === "cancelled" && current.status !== "checked_in") {
        throw new Error("Use Cancel appointment so the booking policy, fees and deposit rules are applied.");
      }
      assertAppointmentTransition(String(current.status), toStatus, {
        paymentStatus: current.paymentStatus,
        startsAt: current.startsAt
      });
      if (toStatus === "checked_in" || toStatus === "in_chair") {
        const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
        const timeZone = shop?.timezone || "UTC";
        if (current.startsAt && shopDateKey(current.startsAt, timeZone) !== shopDateKey(/* @__PURE__ */ new Date(), timeZone)) {
          throw new Error("Check-in and seating happen on the appointment\u2019s day.");
        }
      }
      if (toStatus === "in_chair") {
        if (!current.barberId || !current.serviceId) throw new Error("Appointment practitioner and service are required.");
        await lockBookingResources(transaction, { serviceId: current.serviceId, barberId: current.barberId, chairNumber: current.barberChairNumberSnapshot || null });
        if (current.chairId) {
          const chair = await transaction.barberChair.findFirst({ where: { id: current.chairId, shopId }, select: { status: true } });
          if (!chair || chair.status !== "active") throw new Error("The assigned chair is not available. Reassign the appointment before starting service.");
        }
        const barber = await transaction.barber.findFirst({ where: { id: current.barberId, shopId }, select: { status: true } });
        if (!barber || barber.status !== "active") throw new Error("The assigned barber is not active.");
        const occupied = await transaction.appointment.findFirst({
          where: {
            shopId,
            status: "in_chair",
            id: { not: current.id },
            OR: [{ barberId: current.barberId }, ...current.chairId ? [{ chairId: current.chairId }] : []]
          },
          select: { id: true }
        });
        if (occupied) throw new Error("This barber or chair is still serving another guest. Complete that service first.");
      }
      let authorityEvidence = null;
      if (toStatus === "confirmed" || toStatus === "in_chair" || toStatus === "completed") {
        if (!current.barberId || !current.serviceId || !current.customerId) throw new Error("Appointment practitioner, service, and customer linkage is required.");
        authorityEvidence = await requireEffectivePractitionerAuthority(transaction, {
          shopId: current.shopId,
          barberId: current.barberId,
          serviceId: current.serviceId,
          at: toStatus === "confirmed" ? current.startsAt : /* @__PURE__ */ new Date()
        });
        if (toStatus === "completed") {
          const executionRows = await transaction.$queryRawUnsafe('SELECT "executionAuthoritySnapshot", "serviceStartedAt" FROM "Appointment" WHERE id = $1 LIMIT 1', current.id);
          if (!executionRows[0]?.executionAuthoritySnapshot || !executionRows[0].serviceStartedAt) throw new Error("Recorded execution authority is required before completion.");
          assertAuthorityMatches(executionRows[0].executionAuthoritySnapshot, { shopId: current.shopId, barberId: current.barberId, serviceId: current.serviceId, at: executionRows[0].serviceStartedAt });
        }
        if (toStatus === "in_chair" || toStatus === "completed") {
          const waiver = await getAppointmentWaiverRequirement(transaction, current.id);
          if (waiver.required) await requireSignedWaiver(transaction, { appointmentId: current.id, serviceId: current.serviceId, customerId: current.customerId, templateHash: waiver.templateHash });
        }
      }
      const updated = await transaction.appointment.update({
        where: { id: current.id },
        data: {
          status: toStatus,
          ...toStatus === "cancelled" ? { cancellationReason: "Cancelled by staff after check-in" } : {}
        }
      });
      if (toStatus === "confirmed") {
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "bookingAuthoritySnapshot" = $2::jsonb WHERE id = $1', current.id, JSON.stringify(authorityEvidence));
        confirmedNow = true;
      }
      if (toStatus === "in_chair") {
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "executionAuthoritySnapshot" = $2::jsonb, "serviceStartedAt" = $3 WHERE id = $1', current.id, JSON.stringify(authorityEvidence), updated.updatedAt);
      }
      if (toStatus === "completed") {
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "serviceCompletedAt" = $2 WHERE id = $1', current.id, updated.updatedAt);
      }
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: `appointment.${toStatus}`,
        aggregateType: "appointment",
        aggregateId: current.id,
        shopId: current.shopId,
        occurredAt: updated.updatedAt,
        data: {
          transition: { fromStatus: current.status, toStatus, actorId: context.session?.itemId ?? null },
          appointment: { id: current.id, startsAt: current.startsAt.toISOString(), paymentStatus: current.paymentStatus },
          authorityEvidence
        }
      }));
      return updated;
    });
    return {
      success: true,
      error: null,
      appointment: {
        id: appointment.id,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        updatedAt: appointment.updatedAt.toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to transition appointment.", appointment: null };
  }
}
var STATUSES;
var init_transitionAppointment = __esm({
  "features/keystone/mutations/transitionAppointment.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_bookingCapacity();
    init_commandReceipt();
    init_lifecycleState();
    init_publicAccessToken();
    init_serializableTransaction();
    init_practitionerAuthority();
    init_waiverEvidence();
    init_shop_time();
    STATUSES = /* @__PURE__ */ new Set(["requested", "confirmed", "checked_in", "in_chair", "completed", "cancelled", "no_show"]);
  }
});

// features/keystone/mutations/transitionQueueEntry.ts
async function transitionQueueEntry(_root, args, context) {
  if (!permissions.canManageQueue({ session: context.session })) {
    return { success: false, error: "Not authorized to transition queue entries.", queueEntry: null };
  }
  const queueEntryId = args.queueEntryId?.trim();
  const toStatus = args.toStatus?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  if (!queueEntryId || !STATUSES2.has(toStatus) || !idempotencyKey || idempotencyKey.length > 200) {
    return { success: false, error: "Queue entry, target status, and idempotency key are required.", queueEntry: null };
  }
  try {
    const queueEntry = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageQueue", transaction);
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "barbershop-queue-transition",
        queueEntryId
      );
      const current = await transaction.walkInQueueEntry.findFirst({ where: { id: queueEntryId, shopId } });
      if (!current || !current.shopId) throw new Error("Queue entry not found.");
      const commandHash = hashPublicAccessToken(idempotencyKey);
      const eventKey = `queue-command:${commandHash}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (payload?.aggregateId !== queueEntryId || payload.data?.transition?.toStatus !== toStatus) {
          throw new Error("Queue idempotency key was reused for a different command.");
        }
        return current;
      }
      if (current.status === toStatus) return current;
      if (current.status === "in_chair" && ["served", "left"].includes(toStatus)) {
        throw new Error("This guest has an active appointment. Complete it through POS; queue completion follows settlement.");
      }
      assertQueueTransition(String(current.status), toStatus);
      const updated = await transaction.walkInQueueEntry.update({
        where: { id: current.id },
        data: { status: toStatus }
      });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: `queue.${toStatus}`,
        aggregateType: "walk_in_queue_entry",
        aggregateId: current.id,
        shopId: current.shopId,
        occurredAt: updated.updatedAt,
        data: { transition: { fromStatus: current.status, toStatus, actorId: context.session?.itemId ?? null }, queueEntry: { id: current.id } }
      }));
      return updated;
    });
    return {
      success: true,
      error: null,
      queueEntry: {
        id: queueEntry.id,
        status: queueEntry.status,
        updatedAt: queueEntry.updatedAt.toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to transition queue entry.", queueEntry: null };
  }
}
var STATUSES2;
var init_transitionQueueEntry = __esm({
  "features/keystone/mutations/transitionQueueEntry.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_lifecycleState();
    init_publicAccessToken();
    init_serializableTransaction();
    STATUSES2 = /* @__PURE__ */ new Set(["waiting", "texted", "in_chair", "served", "left"]);
  }
});

// features/keystone/mutations/selectActiveShop.ts
async function selectActiveShop(_root, args, context) {
  const userId = context.session?.itemId;
  const shopId = args.shopId?.trim();
  if (!userId || !shopId) return { success: false, error: "A signed-in user and shop are required.", shop: null };
  try {
    const shop = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const membership = await transaction.shopMembership.findFirst({
        where: { userId, shopId, status: "active", shop: { status: "active" } },
        include: { shop: true }
      });
      if (!membership) throw new Error("Not authorized to select this shop.");
      const user = await transaction.user.findUnique({ where: { id: userId }, select: { activeShopId: true } });
      if (user?.activeShopId === shopId) return membership.shop;
      const selectedAt = /* @__PURE__ */ new Date();
      await transaction.user.update({ where: { id: userId }, data: { activeShopId: shopId } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `user:${userId}:active-shop:${shopId}:${(0, import_node_crypto11.randomUUID)()}:v1`,
        eventType: "user.active_shop_selected",
        aggregateType: "user",
        aggregateId: userId,
        shopId,
        occurredAt: selectedAt,
        data: { selection: { userId, shopId, membershipId: membership.id } }
      }));
      return membership.shop;
    });
    return { success: true, error: null, shop: { id: shop.id, name: shop.name, slug: shop.slug } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to select active shop.",
      shop: null
    };
  }
}
var import_node_crypto11;
var init_selectActiveShop = __esm({
  "features/keystone/mutations/selectActiveShop.ts"() {
    "use strict";
    import_node_crypto11 = require("node:crypto");
    init_commandReceipt();
    init_serializableTransaction();
  }
});

// features/keystone/mutations/claimShopOwnership.ts
async function isInstanceAdmin(context) {
  const session = context.session;
  if (!session?.itemId) return false;
  const [people, roles] = await Promise.all([
    hasCurrentRolePermission(session, "canManagePeople", context.prisma),
    hasCurrentRolePermission(session, "canManageRoles", context.prisma)
  ]);
  return people && roles;
}
async function claimableShops(_root, _args, context) {
  if (!await isInstanceAdmin(context)) return [];
  const userId = context.session.itemId;
  return context.prisma.shop.findMany({
    where: { status: "active", memberships: { none: { userId, status: "active" } } },
    orderBy: [{ isPublic: "desc" }, { createdAt: "asc" }],
    take: 25,
    select: { id: true, name: true, slug: true, isPublic: true }
  });
}
async function claimShopOwnership(_root, args, context) {
  const userId = context.session?.itemId;
  const shopId = args.shopId?.trim();
  if (!userId || !shopId) return { success: false, error: "A signed-in user and shop are required.", shop: null };
  if (!await isInstanceAdmin(context)) return { success: false, error: "Only an administrator who manages people and roles can take over a shop.", shop: null };
  try {
    const shop = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const target = await transaction.shop.findFirst({ where: { id: shopId, status: "active" }, select: { id: true, name: true, slug: true } });
      if (!target) throw new Error("That shop is not active.");
      const membershipKey = `${shopId}:${userId}`;
      const membership = await transaction.shopMembership.upsert({
        where: { membershipKey },
        create: { membershipKey, shopId, userId, membershipRole: "owner", status: "active" },
        update: { membershipRole: "owner", status: "active" },
        select: { id: true }
      });
      const [services, barbers] = await Promise.all([
        transaction.service.count({ where: { shopId } }),
        transaction.barber.count({ where: { shopId } })
      ]);
      await transaction.user.update({ where: { id: userId }, data: { activeShopId: shopId, ...services && barbers ? { onboardingStatus: "completed" } : {} } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: userId,
        eventKey: `shop:${shopId}:owner-claimed:${userId}:${(0, import_node_crypto12.randomUUID)()}:v1`,
        eventType: "shop.owner_claimed",
        aggregateType: "shop",
        aggregateId: shopId,
        shopId,
        occurredAt: /* @__PURE__ */ new Date(),
        data: { claim: { userId, shopId, membershipId: membership.id } }
      }));
      return target;
    });
    return { success: true, error: null, shop };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to take over this shop.", shop: null };
  }
}
var import_node_crypto12;
var init_claimShopOwnership = __esm({
  "features/keystone/mutations/claimShopOwnership.ts"() {
    "use strict";
    import_node_crypto12 = require("node:crypto");
    init_currentAuthorization();
    init_commandReceipt();
    init_serializableTransaction();
  }
});

// features/keystone/mutations/manageTeam.ts
async function ensureStaffRole(prisma, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: { select: { canAccessDashboard: true } } } });
  if (user?.role) return;
  const role = await prisma.role.findFirst({ where: { name: STAFF_ROLE_NAME } }) || await prisma.role.create({ data: { name: STAFF_ROLE_NAME, ...STAFF_ROLE_FLAGS } });
  await prisma.user.update({ where: { id: userId }, data: { roleId: role.id } });
}
async function managedShop(context) {
  const shopId = requireSingleActiveShop(context.session);
  const managed = await currentManagedActiveShopIds(context.session, context.prisma);
  if (!managed.includes(shopId)) throw new Error("Only a shop owner or manager can manage the team.");
  return shopId;
}
async function platformTeam(_root, _args, context) {
  try {
    const shopId = await managedShop(context);
    const memberships = await context.sudo().prisma.shopMembership.findMany({
      where: { shopId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: { id: true, membershipRole: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true, barberProfile: { select: { id: true, displayName: true } } } } }
    });
    return { success: true, error: null, data: { selfId: context.session?.itemId || null, memberships } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to load the team.", data: null };
  }
}
async function addShopMemberByEmail(_root, args, context) {
  try {
    const shopId = await managedShop(context);
    const email = String(args.email || "").trim().toLowerCase();
    const membershipRole = String(args.membershipRole || "viewer");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email.");
    if (!ROLES.has(membershipRole)) throw new Error("Choose a role.");
    let user = await context.sudo().prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    let invited = false;
    if (!user) {
      user = await context.sudo().db.User.createOne({ data: { name: email.split("@")[0], email, password: (0, import_node_crypto13.randomBytes)(32).toString("base64url") } });
      invited = true;
    }
    const existing = await context.sudo().prisma.shopMembership.findFirst({ where: { shopId, userId: user.id }, select: { id: true, status: true } });
    if (existing) throw new Error(existing.status === "active" ? "They are already on the team." : "They already have a membership here. Restore it from the team list.");
    const created = await context.db.ShopMembership.createOne({ data: { shop: { connect: { id: shopId } }, user: { connect: { id: user.id } }, membershipRole, status: "active" } });
    await ensureStaffRole(context.sudo().prisma, user.id);
    let emailed = false;
    if (invited) {
      try {
        await context.sudo().graphql.run({ query: "mutation($email: String!) { sendUserPasswordResetLink(email: $email) }", variables: { email } });
        emailed = true;
      } catch {
        emailed = false;
      }
    }
    return { success: true, error: null, data: { id: created.id, invited, emailed } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const readable = message.includes("You provided invalid data") ? message.split("\n").slice(1).map((line) => line.replace(/^\s*-\s*[\w.]+:\s*/, "")).join(" ") : message;
    return { success: false, error: readable || "Unable to add this member.", data: null };
  }
}
var import_node_crypto13, ROLES, STAFF_ROLE_NAME, STAFF_ROLE_FLAGS;
var init_manageTeam = __esm({
  "features/keystone/mutations/manageTeam.ts"() {
    "use strict";
    import_node_crypto13 = require("node:crypto");
    init_access();
    init_currentAuthorization();
    ROLES = /* @__PURE__ */ new Set(["owner", "manager", "front_desk", "barber", "viewer"]);
    STAFF_ROLE_NAME = "Shop staff";
    STAFF_ROLE_FLAGS = {
      canAccessDashboard: true,
      canManageOnboarding: true,
      canManageServices: true,
      canManageStaff: true,
      canManageSchedules: true,
      canManageAppointments: true,
      canManageQueue: true,
      canManageCustomers: true,
      canManageCustomerNotes: true,
      canManageMemberships: true,
      canManagePayments: true,
      canViewReports: true
    };
  }
});

// features/keystone/utils/remainingLifecycle.ts
function calculateNoShowEvidence(policy, customer) {
  const feeWaived = customer.hasMembership && !policy.appliesToMemberships;
  return {
    feeAmount: feeWaived ? 0 : Math.max(0, Math.floor(Number(policy.feeAmount || 0))),
    graceMinutes: Math.max(0, Math.floor(Number(policy.graceMinutes || 0))),
    feeWaived
  };
}
function assertCommissionTransition(current, next) {
  if (current === next) return;
  if (["paid", "voided"].includes(current)) throw new Error("Terminal commissions cannot transition.");
  const allowed = {
    projected: ["approved", "voided"],
    // approved -> paid happens only through the payout command with a reference.
    approved: ["voided"]
  };
  if (!allowed[current]?.includes(next)) {
    throw new Error(next === "paid" ? "Record commission payment with Create payout." : `Commission cannot transition from ${current} to ${next}.`);
  }
}
function calculateProductSale(input) {
  const unitPrice = Math.max(0, Math.floor(Number(input.unitPrice || 0)));
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) throw new Error("Product quantity must be between 1 and 100.");
  const taxRateBps = Math.min(1e4, Math.max(0, Math.floor(Number(input.taxRateBps || 0))));
  const subtotal = unitPrice * quantity;
  const taxAmount = Math.round(subtotal * taxRateBps / 1e4);
  return { unitPrice, quantity, subtotal, taxAmount, total: subtotal + taxAmount };
}
var init_remainingLifecycle = __esm({
  "features/keystone/utils/remainingLifecycle.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/manageProductSales.ts
function lockLot(transaction, lotId) {
  return transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-inventory", `lot:${lotId}`);
}
function sellableLotWhere(shopId, productId, now) {
  return { shopId, productId, status: "active", quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}
function allocatedReturnTax(originalTax, originalQuantity, returnedBefore, quantity) {
  const tax = Math.abs(originalTax);
  const cumulative = (units) => Math.round(tax * units / originalQuantity);
  return cumulative(returnedBefore + quantity) - cumulative(returnedBefore);
}
async function createProductSaleInTransaction(transaction, input) {
  const { shopId, lineNumber, actorId } = input;
  const product = await transaction.product.findFirst({ where: { id: input.productId, shopId } });
  if (!product || product.status !== "active") throw new Error("Product is not available.");
  const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
  assertUsdSettlementCurrency(shop?.currencyCode);
  const totals = calculateProductSale({ unitPrice: product.price || 0, quantity: input.quantity, taxRateBps: input.taxRateBps || 0 });
  const occurredAt = /* @__PURE__ */ new Date();
  const allocations = [];
  if (product.inventoryTracked !== false) {
    const candidates = await transaction.inventoryLot.findMany({
      where: sellableLotWhere(shopId, product.id, occurredAt),
      orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }, { id: "asc" }],
      take: MAX_ALLOCATION_LOTS,
      select: { id: true }
    });
    for (const lotId of candidates.map((lot) => lot.id).sort()) await lockLot(transaction, lotId);
    const lots = await transaction.inventoryLot.findMany({
      where: { ...sellableLotWhere(shopId, product.id, occurredAt), id: { in: candidates.map((lot) => lot.id) } },
      orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }, { id: "asc" }]
    });
    let remaining = totals.quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.quantityRemaining || 0);
      if (take <= 0) continue;
      const quantityAfter = (lot.quantityRemaining || 0) - take;
      allocations.push({ lotId: lot.id, quantity: take, quantityAfter, becomesConsumed: quantityAfter === 0 });
      remaining -= take;
    }
    if (remaining > 0 && !input.online) throw new Error("Insufficient sellable inventory for this product sale.");
  }
  const checkout = await transaction.checkoutTransaction.create({ data: {
    shopId,
    status: "paid",
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    currencyCode: "USD",
    paymentMethod: input.paymentMethod,
    paymentSessionId: input.paymentSessionId ?? void 0,
    completedAt: occurredAt,
    notes: `Retail sale \xB7 ${product.name} (${product.sku}) \xD7 ${totals.quantity}`
  } });
  const created = await transaction.productSaleLine.create({ data: {
    shopId,
    lineNumber,
    transactionId: checkout.id,
    productId: product.id,
    lineType: "sale",
    productNameSnapshot: product.name,
    skuSnapshot: product.sku ?? "",
    quantity: totals.quantity,
    unitPrice: totals.unitPrice,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    occurredAt
  }, include: { transaction: true } });
  for (const [index, allocation] of allocations.entries()) {
    await transaction.inventoryMovement.create({ data: {
      shopId,
      productId: product.id,
      inventoryLotId: allocation.lotId,
      // The first lot links 1:1 to the sale line; further lots share its reference prefix.
      ...index === 0 ? { productSaleLineId: created.id } : {},
      movementType: "sale",
      quantityDelta: -allocation.quantity,
      quantityAfter: allocation.quantityAfter,
      reason: "Product POS sale",
      referenceKey: index === 0 ? `product-sale:${created.id}` : `product-sale:${created.id}:lot:${allocation.lotId}`,
      occurredAt
    } });
    await transaction.inventoryLot.update({ where: { id: allocation.lotId }, data: { quantityRemaining: allocation.quantityAfter, ...allocation.becomesConsumed ? { status: "consumed" } : {} } });
  }
  await recordCommandReceipt(transaction, buildCommandReceipt({
    actorId: actorId ?? void 0,
    eventKey: `product-sale:${created.id}:paid:v1`,
    eventType: "product_sale.paid",
    aggregateType: "product_sale_line",
    aggregateId: created.id,
    shopId,
    occurredAt,
    data: { sale: { lineId: created.id, transactionId: checkout.id, productId: product.id, productName: product.name, sku: product.sku, ...totals, paymentMethod: input.paymentMethod, lots: allocations.map(({ lotId, quantity }) => ({ lotId, quantity })), actorId: actorId ?? null } }
  }));
  return created;
}
async function recordProductSale(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized to record product sales.", sale: null };
  if (!args.productId || !args.idempotencyKey?.trim() || !METHODS.has(args.paymentMethod)) return { success: false, error: "Choose a product and cash or card.", sale: null };
  try {
    const hash9 = hashPublicAccessToken(args.idempotencyKey.trim());
    const line = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-product-sale", args.productId);
      const lineNumber = `product-sale-${hash9.slice(0, 24)}`;
      const replay = await transaction.productSaleLine.findUnique({ where: { lineNumber }, include: { transaction: true } });
      if (replay) {
        if (replay.shopId !== shopId) throw new Error("Product sale idempotency key was reused with different input.");
        assertUsdSettlementCurrency(replay.transaction?.currencyCode);
        const replayTotals = calculateProductSale({ unitPrice: replay.unitPrice, quantity: args.quantity, taxRateBps: args.taxRateBps || 0 });
        if (replay.productId !== args.productId || replay.quantity !== replayTotals.quantity || replay.taxAmount !== replayTotals.taxAmount || replay.transaction?.paymentMethod !== args.paymentMethod) throw new Error("Product sale idempotency key was reused with different input.");
        return replay;
      }
      return createProductSaleInTransaction(transaction, { shopId, productId: args.productId, quantity: args.quantity, taxRateBps: args.taxRateBps, paymentMethod: args.paymentMethod, lineNumber, actorId: context.session?.itemId });
    });
    return { success: true, error: null, sale: { id: line.id, transactionId: line.transactionId, productName: line.productNameSnapshot, quantity: line.quantity, subtotal: line.subtotal, taxAmount: line.taxAmount, total: line.total } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to record product sale.", returned: null, sale: null };
  }
}
async function returnProductSaleLine(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized to return product sales.", returned: null };
  if (!args.saleLineId || !args.idempotencyKey?.trim() || !args.reason?.trim()) return { success: false, error: "Sale line, reason, and idempotency key are required.", returned: null };
  if (args.cashReturned !== true) return { success: false, error: "Confirm the cash refund was handed to the customer before recording the return.", returned: null };
  const restock = args.restock === true;
  try {
    const hash9 = hashPublicAccessToken(args.idempotencyKey.trim());
    const returned = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-product-return", args.saleLineId);
      const lineNumber = `product-return-${hash9.slice(0, 24)}`;
      const replay = await transaction.productSaleLine.findUnique({ where: { lineNumber }, include: { transaction: true } });
      if (replay) {
        if (replay.shopId !== shopId) throw new Error("Product return idempotency key was reused with different input.");
        assertUsdSettlementCurrency(replay.transaction?.currencyCode);
        if (replay.originalLineId !== args.saleLineId || replay.quantity !== Math.floor(Number(args.quantity)) || replay.transaction?.notes !== args.reason.trim()) throw new Error("Product return idempotency key was reused with different input.");
        return replay;
      }
      const original = await transaction.productSaleLine.findFirst({ where: { id: args.saleLineId, shopId }, include: { inventoryMovement: true, transaction: true, product: { select: { inventoryTracked: true } } } });
      if (!original || original.lineType !== "sale" || !original.productId) throw new Error("Original product sale was not found.");
      assertUsdSettlementCurrency(original.transaction?.currencyCode);
      const quantity = Math.floor(Number(args.quantity));
      const returnedBefore = original.returnedQuantity || 0;
      const available = original.quantity - returnedBefore;
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > available) throw new Error("Return quantity exceeds the unreturned sale quantity.");
      const occurredAt = /* @__PURE__ */ new Date();
      let restockLot = null;
      if (restock) {
        if (original.product?.inventoryTracked === false) throw new Error("This product is not stock-tracked, so it cannot be restocked.");
        const saleMovements = await transaction.inventoryMovement.findMany({
          where: { shopId, OR: [{ productSaleLineId: original.id }, { referenceKey: { startsWith: `product-sale:${original.id}:lot:` } }] },
          select: { inventoryLotId: true }
        });
        const lotIds = Array.from(new Set(saleMovements.map((movement) => movement.inventoryLotId).filter((id) => Boolean(id)))).sort();
        if (!lotIds.length) throw new Error("Original inventory evidence is missing.");
        for (const lotId of lotIds) await lockLot(transaction, lotId);
        restockLot = await transaction.inventoryLot.findFirst({
          where: { id: { in: lotIds }, shopId, status: { in: ["active", "consumed"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: occurredAt } }] },
          orderBy: [{ expiresAt: { sort: "desc", nulls: "first" } }, { id: "asc" }],
          select: { id: true, quantityRemaining: true, status: true }
        });
        if (!restockLot) throw new Error("The original stock lot has expired or is unavailable. Record the return without restocking.");
      }
      const subtotal = -original.unitPrice * quantity;
      const taxAmount = -allocatedReturnTax(original.taxAmount, original.quantity, returnedBefore, quantity);
      const total = subtotal + taxAmount;
      const checkout = await transaction.checkoutTransaction.create({ data: {
        shopId,
        status: "refunded",
        subtotal,
        taxAmount,
        total,
        currencyCode: "USD",
        paymentMethod: original.transaction?.paymentMethod || "other",
        completedAt: occurredAt,
        notes: args.reason.trim()
      } });
      const created = await transaction.productSaleLine.create({ data: {
        shopId,
        lineNumber,
        transactionId: checkout.id,
        productId: original.productId,
        originalLineId: original.id,
        lineType: "return",
        productNameSnapshot: original.productNameSnapshot,
        skuSnapshot: original.skuSnapshot,
        quantity,
        unitPrice: original.unitPrice,
        subtotal,
        taxAmount,
        total,
        occurredAt
      } });
      if (restockLot) {
        const quantityAfter = (restockLot.quantityRemaining || 0) + quantity;
        await transaction.inventoryMovement.create({ data: {
          shopId,
          productId: original.productId,
          inventoryLotId: restockLot.id,
          productSaleLineId: created.id,
          movementType: "return",
          quantityDelta: quantity,
          quantityAfter,
          reason: `Restocked return: ${args.reason.trim()}`,
          referenceKey: `product-return:${created.id}`,
          occurredAt
        } });
        await transaction.inventoryLot.update({ where: { id: restockLot.id }, data: { quantityRemaining: quantityAfter, ...restockLot.status === "consumed" ? { status: "active" } : {} } });
      }
      await transaction.productSaleLine.update({ where: { id: original.id }, data: { returnedQuantity: returnedBefore + quantity } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `product-return:${created.id}:refunded:v1`,
        eventType: "product_sale.returned",
        aggregateType: "product_sale_line",
        aggregateId: created.id,
        shopId,
        occurredAt,
        data: { return: { lineId: created.id, originalLineId: original.id, transactionId: checkout.id, productId: original.productId, quantity, subtotal, taxAmount, total, reason: args.reason.trim(), cashReturned: true, restocked: Boolean(restockLot), restockLotId: restockLot?.id ?? null, actorId: context.session?.itemId ?? null } }
      }));
      return created;
    });
    return { success: true, error: null, returned: { id: returned.id, originalLineId: returned.originalLineId, quantity: returned.quantity, subtotal: returned.subtotal, taxAmount: returned.taxAmount, total: returned.total } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to return product sale.", returned: null };
  }
}
var METHODS, MAX_ALLOCATION_LOTS;
var init_manageProductSales = __esm({
  "features/keystone/mutations/manageProductSales.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_remainingLifecycle();
    init_publicAccessToken();
    init_serializableTransaction();
    init_supportedSettlementCurrency();
    METHODS = /* @__PURE__ */ new Set(["cash", "card"]);
    MAX_ALLOCATION_LOTS = 50;
  }
});

// features/keystone/mutations/productOrders.ts
function orderToken2(sessionId) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return (0, import_node_crypto14.createHmac)("sha256", secret).update(`barbershop-product:${sessionId}`).digest("hex");
}
function tokenOk2(sessionId, token) {
  if (!token || token.length !== 64) return false;
  const a = Buffer.from(orderToken2(sessionId));
  const b = Buffer.from(token);
  return a.length === b.length && (0, import_node_crypto14.timingSafeEqual)(a, b);
}
async function startProductCheckout(_root, args, context) {
  const fail6 = (error) => ({ success: false, error, data: null });
  try {
    const buyerName = (args.buyerName || "").trim();
    const buyerEmail = (args.buyerEmail || "").trim().toLowerCase();
    if (!buyerName || buyerName.length > 120) return fail6("Enter your name.");
    if (!EMAIL2.test(buyerEmail)) return fail6("Enter a valid email address.");
    const prisma = context.sudo().prisma;
    const shop = await resolvePublishedShop(prisma, { id: true, name: true });
    if (!shop) return fail6("The shop is unavailable right now.");
    const product = await prisma.product.findFirst({ where: { id: String(args.productId || ""), shopId: shop.id, status: "active" } });
    if (!product || !(product.price && product.price > 0)) return fail6("That product is not available.");
    const provider = await onlineDepositProvider(prisma, shop.id);
    if (!provider) return fail6("Online checkout is unavailable right now. Try again in a moment.");
    const key = (0, import_node_crypto14.randomUUID)();
    const amount = product.price;
    const sessionId = (0, import_node_crypto14.randomUUID)().replace(/-/g, "");
    const back = `${trustedOrigin()}/shop/order?id=${sessionId}&token=${orderToken2(sessionId)}`;
    const result = recordOf(await createPayment({
      provider: { code: provider.code },
      amount,
      currency: "usd",
      description: `${shop.name} \xB7 ${product.name} \xB7 ${usd2(amount)}`,
      successUrl: back,
      cancelUrl: `${back}&result=cancelled`,
      idempotencyKey: key,
      customerEmail: buyerEmail,
      metadata: { purpose: "product_order", productId: product.id }
    }));
    if (!result.id || typeof result.url !== "string") throw new Error("Stripe did not open a checkout.");
    await prisma.paymentSession.create({ data: {
      id: sessionId,
      shopId: shop.id,
      paymentProviderId: provider.id,
      idempotencyKeyHash: hashPublicAccessToken(`product-order:${key}`),
      status: "pending",
      amount,
      currencyCode: "USD",
      providerPaymentId: String(result.id),
      expiresAt: new Date(Date.now() + 23 * 36e5),
      metadata: { purpose: "product_order", productId: product.id, productName: product.name, quantity: 1, buyerName, buyerEmail, checkoutUrl: result.url }
    } });
    return { success: true, error: null, data: { url: result.url } };
  } catch (error) {
    console.error("Product checkout could not be opened:", error);
    return fail6("Online checkout is unavailable right now. Try again in a moment.");
  }
}
async function settleProductOrder(prisma, sessionId) {
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId }, include: { paymentProvider: { select: { code: true } }, transaction: { select: { id: true } } } });
  const meta = recordOf(session?.metadata);
  if (!session || meta.purpose !== "product_order") throw new Error("Order not found.");
  if (session.status === "pending" && session.paymentProvider) {
    const remote = recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }));
    if (remote.status === "expired") {
      await prisma.paymentSession.updateMany({ where: { id: session.id, status: "pending" }, data: { status: "expired", cancelledAt: /* @__PURE__ */ new Date() } });
    } else if (remote.status === "captured") {
      if (Number(remote.amount) !== session.amount) throw new Error("The amount paid does not match the order. Contact the shop.");
      await prisma.paymentSession.updateMany({ where: { id: session.id, status: "pending" }, data: { status: "captured", capturedAt: /* @__PURE__ */ new Date() } });
    }
  }
  const fresh = await prisma.paymentSession.findUniqueOrThrow({ where: { id: session.id }, include: { transaction: { select: { id: true } } } });
  if (["captured", "partially_refunded", "refunded"].includes(String(fresh.status)) && !fresh.transaction) {
    await runSerializableTransaction(prisma, async (client) => {
      const tx = client;
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-product-order", fresh.id);
      const done = await tx.checkoutTransaction.findUnique({ where: { paymentSessionId: fresh.id }, select: { id: true } });
      if (done) return;
      await createProductSaleInTransaction(tx, {
        shopId: fresh.shopId,
        productId: String(meta.productId),
        quantity: 1,
        taxRateBps: 0,
        paymentMethod: "card",
        lineNumber: `product-order-${fresh.id}`,
        paymentSessionId: fresh.id,
        online: true
      });
    });
  }
  return { status: String(fresh.status), name: String(meta.productName || "Product"), amount: fresh.amount, buyerEmail: String(meta.buyerEmail || "") };
}
async function confirmProductOrder(_root, args, context) {
  if (!tokenOk2(args.orderId, args.token)) return { success: false, error: "We could not find that order.", data: null };
  try {
    return { success: true, error: null, data: await settleProductOrder(context.sudo().prisma, args.orderId) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "We could not check the payment yet.", data: null };
  }
}
async function settleOpenProductOrders(prisma, shopId) {
  const open = await prisma.paymentSession.findMany({ where: { shopId, OR: [{ status: "pending" }, { status: "captured", transaction: null }], metadata: { path: ["purpose"], equals: "product_order" } }, select: { id: true }, take: 20 });
  for (const row of open) await settleProductOrder(prisma, row.id).catch(() => void 0);
}
var import_node_crypto14, EMAIL2, usd2;
var init_productOrders = __esm({
  "features/keystone/mutations/productOrders.ts"() {
    "use strict";
    import_node_crypto14 = require("node:crypto");
    init_trusted_origin();
    init_paymentProviderAdapter();
    init_publicAccessToken();
    init_publicShop();
    init_serializableTransaction();
    init_manageProductSales();
    init_publicDeposits();
    init_paymentSessionResult();
    EMAIL2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    usd2 = (cents2) => `$${(cents2 / 100).toFixed(cents2 % 100 ? 2 : 0)}`;
  }
});

// features/keystone/mutations/deskCardPayment.ts
function deskData(session) {
  return recordOf(session.metadata);
}
async function ticketTotal(prisma, shopId, appointmentId, ticket) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, shopId }, select: { id: true, status: true, price: true, paymentStatus: true, depositAmount: true, transactionId: true, serviceTitleSnapshot: true, customer: { select: { email: true } } } });
  if (!appointment) throw new Error("Appointment not found.");
  if (appointment.transactionId || appointment.paymentStatus === "paid") throw new Error("This visit is already paid.");
  if (appointment.status !== "in_chair") throw new Error("Seat this visit before taking payment.");
  if (appointment.price == null) throw new Error("This appointment has no agreed price.");
  const subtotal = appointment.price;
  const discount = Math.min(ticket.discountAmount, subtotal);
  const total = subtotal + ticket.tipAmount + ticket.taxAmount - discount;
  const deposit = appointment.paymentStatus === "deposit_paid" ? Math.min(appointment.depositAmount || 0, total) : 0;
  return { appointment, total, collect: total - deposit };
}
async function startDeskCardPayment(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return fail("Not authorized to take payments.");
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const ticket = { tipAmount: cents(args.tipAmount), discountAmount: cents(args.discountAmount), taxAmount: cents(args.taxAmount), notes: (args.notes || "").trim().slice(0, 500) };
    const { appointment, collect } = await ticketTotal(context.prisma, shopId, args.appointmentId, ticket);
    if (collect <= 0) return fail("Nothing to collect by card. Record the visit with cash tender.");
    const provider = await onlineDepositProvider(context.prisma, shopId);
    if (!provider) return fail("Card payments need Stripe connected. Use Card terminal to record a payment taken elsewhere.");
    const open = await context.prisma.paymentSession.findMany({ where: { shopId, appointmentId: appointment.id, status: "pending", paymentProviderId: provider.id }, orderBy: { createdAt: "desc" } });
    for (const session2 of open) {
      const data = deskData(session2);
      if (data.purpose !== "desk_card") continue;
      const same = session2.amount === collect && JSON.stringify(data.ticket) === JSON.stringify(ticket);
      if (same && typeof data.checkoutUrl === "string" && (!session2.expiresAt || session2.expiresAt > /* @__PURE__ */ new Date())) {
        return { success: true, error: null, data: { sessionId: session2.id, url: data.checkoutUrl, amount: session2.amount, status: "pending", recorded: false } };
      }
      const status = recordOf(await getPaymentStatus({ provider: { code: provider.code }, paymentId: session2.providerPaymentId }));
      if (status.status === "captured") return fail("A card payment for this visit was already taken. Press Check payment to record it.");
      await expireCheckout(session2.providerPaymentId);
      await context.prisma.paymentSession.update({ where: { id: session2.id }, data: { status: "cancelled", cancelledAt: /* @__PURE__ */ new Date() } });
    }
    const key = (0, import_node_crypto15.randomUUID)();
    const back = `${trustedOrigin()}/pay`;
    const result = recordOf(await createPayment({
      provider: { code: provider.code },
      amount: collect,
      currency: "usd",
      description: `${appointment.serviceTitleSnapshot || "Visit"}`,
      successUrl: `${back}?result=paid`,
      cancelUrl: `${back}?result=cancelled`,
      idempotencyKey: key,
      metadata: { appointmentId: appointment.id, purpose: "desk_card" },
      customerEmail: appointment.customer?.email || ""
    }));
    const url = typeof result.url === "string" ? result.url : "";
    if (!result.id || !url) throw new Error("Stripe did not open a card page.");
    const session = await context.prisma.paymentSession.create({ data: {
      shopId,
      appointmentId: appointment.id,
      paymentProviderId: provider.id,
      idempotencyKeyHash: hashPublicAccessToken(`desk-card:${key}`),
      status: "pending",
      amount: collect,
      currencyCode: "USD",
      providerPaymentId: String(result.id),
      expiresAt: new Date(Date.now() + 23 * 36e5),
      metadata: { purpose: "desk_card", checkoutUrl: url, ticket, operatorId: context.session?.itemId || null }
    } });
    return { success: true, error: null, data: { sessionId: session.id, url, amount: collect, status: "pending", recorded: false } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to open a card payment.");
  }
}
async function expireCheckout(checkoutId) {
  if (!checkoutId || !process.env.STRIPE_SECRET_KEY) return;
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutId)}/expire`, { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, redirect: "error" }).catch(() => void 0);
}
async function checkDeskCardPayment(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return fail("Not authorized to take payments.");
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    let session = await context.prisma.paymentSession.findFirst({ where: { id: args.paymentSessionId, shopId }, include: { paymentProvider: { select: { code: true } }, transaction: { select: { id: true } } } });
    const data = session ? deskData(session) : {};
    if (!session || data.purpose !== "desk_card" || !session.appointmentId || !session.paymentProvider) return fail("Card payment not found.");
    if (session.transaction) return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: "captured", recorded: true, transactionId: session.transaction.id } };
    if (session.status === "pending") {
      const status = recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId }));
      if (status.status === "expired") {
        await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: "expired", cancelledAt: /* @__PURE__ */ new Date() } });
        return { success: true, error: "The card page expired without payment.", data: { sessionId: session.id, url: null, amount: session.amount, status: "expired", recorded: false } };
      }
      if (status.status !== "captured") return { success: true, error: null, data: { sessionId: session.id, url: String(data.checkoutUrl || ""), amount: session.amount, status: "pending", recorded: false } };
      if (Number(status.amount) !== session.amount) return fail("Stripe reports a different amount. Check this payment in Stripe.");
      const capturedAt = /* @__PURE__ */ new Date();
      await context.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.paymentSession.updateMany({ where: { id: session.id, status: "pending" }, data: { status: "captured", capturedAt } });
        if (!claimed.count) return;
        await recordCommandReceipt(transaction, buildCommandReceipt({
          actorId: context.session?.itemId,
          eventKey: `payment-session:${session.id}:captured:v1`,
          eventType: "payment_session.captured",
          aggregateType: "payment_session",
          aggregateId: session.id,
          shopId,
          occurredAt: capturedAt,
          data: { paymentSession: { id: session.id, appointmentId: session.appointmentId, amount: session.amount, purpose: "desk_card" } }
        }));
      });
      session = { ...session, status: "captured" };
    }
    if (session.status !== "captured") return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: String(session.status), recorded: false } };
    const ticket = recordOf(data.ticket);
    const result = await checkoutAppointment(null, {
      appointmentId: session.appointmentId,
      paymentMethod: "card",
      tipAmount: Number(ticket.tipAmount || 0),
      discountAmount: Number(ticket.discountAmount || 0),
      taxAmount: Number(ticket.taxAmount || 0),
      notes: String(ticket.notes || ""),
      paymentSessionId: session.id,
      idempotencyKey: `desk-card-checkout:${session.id}`
    }, context);
    if (!result.success) return { success: false, error: `Card paid, but checkout was not recorded: ${result.error}`, data: { sessionId: session.id, url: null, amount: session.amount, status: "captured", recorded: false } };
    return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: "captured", recorded: true, transactionId: result.transaction?.id || null } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to check the card payment.");
  }
}
async function cancelDeskCardPayment(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return fail("Not authorized to take payments.");
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const session = await context.prisma.paymentSession.findFirst({ where: { id: args.paymentSessionId, shopId }, include: { paymentProvider: { select: { code: true } }, transaction: { select: { id: true } } } });
    if (!session || deskData(session).purpose !== "desk_card" || !session.paymentProvider) return fail("Card payment not found.");
    if (session.transaction) return fail("This card payment is on a receipt. Refund it from Payments.");
    const status = session.status === "pending" ? recordOf(await getPaymentStatus({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId })) : { status: session.status };
    if (status.status === "captured") {
      await refundPayment({ provider: { code: session.paymentProvider.code }, paymentId: session.providerPaymentId, amount: session.amount, idempotencyKey: `desk-card-refund:${session.id}` });
      await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: "refunded", refundedAmount: session.amount, capturedAt: session.capturedAt || /* @__PURE__ */ new Date() } });
      return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: "refunded", recorded: false } };
    }
    await expireCheckout(session.providerPaymentId);
    await context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: "cancelled", cancelledAt: /* @__PURE__ */ new Date() } });
    return { success: true, error: null, data: { sessionId: session.id, url: null, amount: session.amount, status: "cancelled", recorded: false } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to cancel the card payment.");
  }
}
async function openDeskCardPayment(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return fail("Not authorized to take payments.");
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const rows = await context.prisma.paymentSession.findMany({ where: { shopId, appointmentId: args.appointmentId, status: { in: ["pending", "captured"] }, transaction: null }, orderBy: { createdAt: "desc" }, take: 5 });
    const session = rows.find((row) => deskData(row).purpose === "desk_card");
    if (!session) return { success: true, error: null, data: null };
    return { success: true, error: null, data: { sessionId: session.id, url: String(deskData(session).checkoutUrl || ""), amount: session.amount, status: String(session.status), recorded: false } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to read card payments.");
  }
}
var import_node_crypto15, fail, cents;
var init_deskCardPayment = __esm({
  "features/keystone/mutations/deskCardPayment.ts"() {
    "use strict";
    import_node_crypto15 = require("node:crypto");
    init_access();
    init_trusted_origin();
    init_currentAuthorization();
    init_commandReceipt();
    init_paymentProviderAdapter();
    init_publicAccessToken();
    init_publicDeposits();
    init_paymentSessionResult();
    init_checkoutAppointment();
    fail = (error) => ({ success: false, error, data: null });
    cents = (value) => {
      const amount = Number(value ?? 0);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2e9) throw new Error("Amounts must be whole cents.");
      return amount;
    };
  }
});

// features/keystone/mutations/markAppointmentNoShow.ts
async function markAppointmentNoShow(_root, args, context) {
  if (!permissions.canManageAppointments({ session: context.session })) {
    return { success: false, error: "Not authorized to mark no-shows.", evidence: null };
  }
  const appointmentId = args.appointmentId?.trim();
  const reason = args.reason?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  if (!appointmentId || !reason || reason.length > 500 || !idempotencyKey) {
    return { success: false, error: "Appointment, reason, and idempotency key are required.", evidence: null };
  }
  try {
    const evidence = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageAppointments", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-no-show", appointmentId);
      const now = /* @__PURE__ */ new Date();
      const appointment = await transaction.appointment.findFirst({
        where: { id: appointmentId, shopId },
        include: { customer: { include: { packageBalances: {
          where: { status: "active", membershipPlanId: { not: null }, startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          take: 1
        } } } }
      });
      if (!appointment) throw new Error("Appointment not found.");
      const commandHash = hashPublicAccessToken(idempotencyKey);
      const eventKey = `appointment-no-show:${commandHash}:v1`;
      const replay = await transaction.noShowEvent.findUnique({ where: { eventKey } });
      if (replay) {
        if (replay.appointmentId !== appointmentId || replay.reason !== reason || args.policyId && replay.policyId !== args.policyId) throw new Error("No-show idempotency key was reused with different input.");
        return replay;
      }
      if (!["confirmed", "checked_in"].includes(String(appointment.status))) {
        throw new Error(`Appointment in ${appointment.status} state cannot be marked no-show.`);
      }
      const policy = args.policyId ? await transaction.noShowPolicy.findFirst({ where: { id: args.policyId, shopId: appointment.shopId, status: "active" } }) : await transaction.noShowPolicy.findFirst({ where: { shopId: appointment.shopId, status: "active" }, orderBy: { createdAt: "asc" } });
      if (!policy) throw new Error("An active no-show policy is required.");
      const snapshot = calculateNoShowEvidence(policy, { hasMembership: Boolean(appointment.customer?.packageBalances.length) });
      const eligibleAt = new Date(appointment.startsAt.getTime() + snapshot.graceMinutes * 6e4);
      if (/* @__PURE__ */ new Date() < eligibleAt) throw new Error(`No-show can be recorded after the ${snapshot.graceMinutes}-minute grace period.`);
      const markedAt = /* @__PURE__ */ new Date();
      const created = await transaction.noShowEvent.create({
        data: {
          shopId: appointment.shopId,
          eventKey,
          appointmentId,
          customerId: appointment.customerId,
          policyId: policy.id,
          policyNameSnapshot: policy.name,
          feeAmount: snapshot.feeAmount,
          graceMinutes: snapshot.graceMinutes,
          feeWaived: snapshot.feeWaived,
          reason,
          markedAt
        }
      });
      await transaction.appointment.update({ where: { id: appointmentId }, data: { status: "no_show", cancellationReason: reason } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `${eventKey}:receipt`,
        eventType: "appointment.no_show",
        aggregateType: "appointment",
        aggregateId: appointmentId,
        shopId: appointment.shopId,
        occurredAt: markedAt,
        data: { noShow: { evidenceId: created.id, policyId: policy.id, policyName: policy.name, ...snapshot, reason, actorId: context.session?.itemId ?? null } }
      }));
      return created;
    });
    return { success: true, error: null, evidence: { id: evidence.id, appointmentId: evidence.appointmentId, feeAmount: evidence.feeAmount, feeWaived: evidence.feeWaived, markedAt: evidence.markedAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to mark no-show.", evidence: null };
  }
}
var init_markAppointmentNoShow = __esm({
  "features/keystone/mutations/markAppointmentNoShow.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_remainingLifecycle();
    init_publicAccessToken();
    init_serializableTransaction();
  }
});

// features/keystone/mutations/manageCommissions.ts
async function transitionCommission(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized to manage commissions.", commission: null };
  try {
    const commandHash = hashPublicAccessToken(args.idempotencyKey?.trim() || "");
    if (!args.commissionId || !args.idempotencyKey?.trim()) throw new Error("Commission and idempotency key are required.");
    if (!["approved", "voided"].includes(args.toStatus)) throw new Error("Commissions can be approved or voided here. Record payment with Create payout.");
    const result = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-commission", args.commissionId);
      const commission = await transaction.commission.findFirst({ where: { id: args.commissionId, shopId } });
      if (!commission) throw new Error("Commission not found.");
      const eventKey = `commission-command:${commandHash}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (payload?.data?.transition?.commissionId !== commission.id || payload.data.transition.toStatus !== args.toStatus || String(payload.data.transition.reason || "") !== (args.reason?.trim() || "")) throw new Error("Commission idempotency key was reused for a different command.");
        return commission;
      }
      assertCommissionTransition(String(commission.status), args.toStatus);
      const updated = await transaction.commission.update({ where: { id: commission.id }, data: { status: args.toStatus } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: `commission.${args.toStatus}`,
        aggregateType: "commission",
        aggregateId: commission.id,
        shopId: commission.shopId,
        occurredAt: updated.updatedAt,
        data: { transition: { commissionId: commission.id, fromStatus: commission.status, toStatus: args.toStatus, reason: args.reason?.trim() || "", actorId: context.session?.itemId ?? null }, amount: commission.commissionAmount }
      }));
      return updated;
    });
    return { success: true, error: null, commission: { id: result.id, status: result.status, commissionAmount: result.commissionAmount } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to transition commission.", commission: null };
  }
}
async function createCommissionPayout(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) return { success: false, error: "Not authorized to create payouts.", payout: null };
  const ids = Array.from(new Set(args.commissionIds || [])).filter(Boolean);
  if (ids.length < 1 || ids.length > 100 || !args.notes?.trim() || args.notes.trim().length > 500 || !args.idempotencyKey?.trim()) return { success: false, error: "Choose 1\u2013100 commissions and provide a payout method/reference plus idempotency key.", payout: null };
  try {
    const hash9 = hashPublicAccessToken(args.idempotencyKey.trim());
    const payout = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-payout", hash9);
      const activeShopId = await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      const replay = await transaction.commissionPayout.findUnique({ where: { idempotencyKeyHash: hash9 }, include: { commissions: { select: { id: true } } } });
      if (replay) {
        if (replay.shopId !== activeShopId) throw new Error("Payout idempotency key was reused with different input.");
        const replayIds = replay.commissions.map((item) => item.id).sort();
        if (replayIds.join(",") !== [...ids].sort().join(",") || replay.notes !== (args.notes?.trim() || "")) {
          throw new Error("Payout idempotency key was reused with different input.");
        }
        return replay;
      }
      const commissions = await transaction.commission.findMany({ where: { id: { in: ids }, shopId: activeShopId }, orderBy: { id: "asc" } });
      if (commissions.length !== ids.length) throw new Error("One or more commissions were not found.");
      const shopId = activeShopId;
      if (commissions.some((item) => item.shopId !== shopId)) throw new Error("Payout commissions must belong to one shop.");
      if (commissions.some((item) => item.status !== "approved")) throw new Error("Only approved commissions can be paid.");
      const barberId = commissions[0].barberId;
      if (!barberId || commissions.some((item) => item.barberId !== barberId)) throw new Error("A payout must contain commissions for one barber.");
      const paidAt = /* @__PURE__ */ new Date();
      const totalAmount = commissions.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
      const created = await transaction.commissionPayout.create({
        data: { shopId, payoutNumber: `payout-${hash9.slice(0, 20)}`, idempotencyKeyHash: hash9, barberId, commissionCount: commissions.length, totalAmount, paidAt, notes: args.notes?.trim() || "" }
      });
      await transaction.commission.updateMany({ where: { id: { in: ids }, status: "approved" }, data: { status: "paid", paidAt, payoutId: created.id } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `commission-payout:${created.id}:paid:v1`,
        eventType: "commission_payout.paid",
        aggregateType: "commission_payout",
        aggregateId: created.id,
        shopId,
        occurredAt: paidAt,
        data: { payout: { id: created.id, barberId, commissionIds: ids.sort(), commissionCount: commissions.length, totalAmount, payoutReference: args.notes.trim(), actorId: context.session?.itemId ?? null } }
      }));
      return created;
    });
    return { success: true, error: null, payout: { id: payout.id, payoutNumber: payout.payoutNumber, commissionCount: payout.commissionCount, totalAmount: payout.totalAmount, paidAt: payout.paidAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to create payout.", payout: null };
  }
}
var init_manageCommissions = __esm({
  "features/keystone/mutations/manageCommissions.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_remainingLifecycle();
    init_publicAccessToken();
    init_serializableTransaction();
  }
});

// features/keystone/utils/customerMerge.ts
function mergedCustomerFields(kept, duplicate) {
  const data = {};
  if (!kept.email && duplicate.email) data.email = duplicate.email;
  if (!kept.phone && duplicate.phone) data.phone = duplicate.phone;
  if (!kept.birthday && duplicate.birthday) data.birthday = duplicate.birthday;
  if (!kept.preferredBarberId && duplicate.preferredBarberId) data.preferredBarberId = duplicate.preferredBarberId;
  if (duplicate.lastVisitAt && (!kept.lastVisitAt || duplicate.lastVisitAt > kept.lastVisitAt)) data.lastVisitAt = duplicate.lastVisitAt;
  if (kept.acceptsMarketing && !duplicate.acceptsMarketing) data.acceptsMarketing = false;
  if (!kept.userId && duplicate.userId) data.userId = duplicate.userId;
  return data;
}
function mergeRefusal(kept, duplicate, shopId) {
  if (!kept || !duplicate || kept.shopId !== shopId || duplicate.shopId !== shopId) return "Customer not found.";
  if (kept.id === duplicate.id) return "Choose a different customer to merge into.";
  if (kept.userId && duplicate.userId && kept.userId !== duplicate.userId) return "These customers belong to two different online accounts and can\u2019t be merged.";
  return null;
}
var init_customerMerge = __esm({
  "features/keystone/utils/customerMerge.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/manageCustomers.ts
async function addCustomerNote(_root, args, context) {
  if (!permissions.canManageCustomerNotes({ session: context.session })) return { success: false, error: "Not authorized to add customer notes.", note: null };
  const body = args.body?.trim();
  if (!args.customerId || !body || body.length > 4e3 || !args.idempotencyKey?.trim()) return { success: false, error: "Customer, note body, and idempotency key are required.", note: null };
  try {
    const hash9 = hashPublicAccessToken(args.idempotencyKey.trim());
    const note = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageCustomerNotes", transaction);
      const visibility = args.visibility || "staff";
      const isOwner = await hasCurrentOwnerMembership(context.session, shopId, transaction);
      if (visibility === "owner" && !isOwner) throw new Error("Only a shop owner can add owner-only notes.");
      const eventKey = `customer-note:${hash9}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (replay.shopId !== shopId || payload?.data?.note?.customerId !== args.customerId || payload.data.note.createdById !== context.session?.itemId) throw new Error("Customer note idempotency key was reused.");
        const existing = await transaction.customerNote.findFirst({ where: { id: String(payload.data.note.id), shopId } });
        if (!existing || String(existing.visibility) === "owner" && !isOwner) throw new Error("Customer note idempotency key was reused.");
        if (existing.body !== body || String(existing.noteType) !== (args.noteType || "general") || String(existing.visibility) !== visibility || (existing.appointmentId || null) !== (args.appointmentId || null)) throw new Error("Customer note idempotency key was reused with different input.");
        return existing;
      }
      const customer = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!customer) throw new Error("Customer not found.");
      const actorId = context.session?.itemId;
      if (!actorId) throw new Error("A signed-in dashboard user is required.");
      if (args.appointmentId) {
        const appointment = await transaction.appointment.findFirst({ where: { id: args.appointmentId, shopId: customer.shopId, customerId: customer.id } });
        if (!appointment) throw new Error("Appointment does not belong to this customer and shop.");
      }
      const created = await transaction.customerNote.create({ data: {
        shopId: customer.shopId,
        customerId: customer.id,
        appointmentId: args.appointmentId || null,
        createdById: actorId,
        noteType: args.noteType || "general",
        visibility,
        body
      } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: "customer_note.created",
        aggregateType: "customer_note",
        aggregateId: created.id,
        shopId: customer.shopId,
        occurredAt: created.createdAt,
        data: { note: { id: created.id, customerId: customer.id, appointmentId: args.appointmentId || null, createdById: actorId, noteType: created.noteType, visibility: created.visibility } }
      }));
      return created;
    });
    return { success: true, error: null, note: { id: note.id, noteType: note.noteType, visibility: note.visibility, body: note.body, createdAt: note.createdAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to add customer note.", note: null };
  }
}
async function setCustomerStatus(_root, args, context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: "Not authorized to update customers.", customer: null };
  if (!["active", "vip", "needs_attention", "blocked"].includes(args.status) || !args.idempotencyKey?.trim()) return { success: false, error: "Customer, valid status, and idempotency key are required.", customer: null };
  try {
    const hash9 = hashPublicAccessToken(args.idempotencyKey.trim());
    const customer = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageCustomers", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-customer", args.customerId);
      const current = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!current) throw new Error("Customer not found.");
      const eventKey = `customer-status:${hash9}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (replay.shopId !== shopId || payload?.aggregateId !== current.id || payload?.data?.transition?.toStatus !== args.status || String(payload.data.transition.reason || "") !== (args.reason?.trim() || "")) {
          throw new Error("Customer status idempotency key was reused with different input.");
        }
        return current;
      }
      const updated = await transaction.customer.update({ where: { id: current.id }, data: { status: args.status } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: "customer.status_changed",
        aggregateType: "customer",
        aggregateId: current.id,
        shopId: current.shopId,
        occurredAt: updated.updatedAt,
        data: { transition: { fromStatus: current.status, toStatus: args.status, reason: args.reason?.trim() || "", actorId: context.session?.itemId ?? null } }
      }));
      return updated;
    });
    return { success: true, error: null, customer: { id: customer.id, status: customer.status } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update customer.", customer: null };
  }
}
async function setCustomerConsent(_root, args, context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: "Not authorized to update marketing preferences.", customer: null };
  const contact = args.preferredContactMethod || "sms";
  if (!args.customerId || !["sms", "email", "phone"].includes(contact) || !args.idempotencyKey?.trim()) return { success: false, error: "Customer, consent choice, contact method, and idempotency key are required.", customer: null };
  try {
    const commandHash = hashPublicAccessToken(args.idempotencyKey.trim());
    const customer = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const eventKey = `customer-consent:${commandHash}:v1`;
      const shopId = await requireCurrentShopPermission(context.session, "canManageCustomers", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-customer", args.customerId);
      const current = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!current) throw new Error("Customer not found.");
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (replay.shopId !== shopId || payload?.data?.preference?.customerId !== current.id || payload.data.preference.acceptsMarketing !== args.acceptsMarketing || payload.data.preference.preferredContactMethod !== contact) throw new Error("Customer-consent idempotency key was reused with different input.");
        return current;
      }
      const updated = await transaction.customer.update({ where: { id: current.id }, data: { acceptsMarketing: args.acceptsMarketing, preferredContactMethod: contact } });
      await recordCommandReceipt(transaction, buildCommandReceipt({ actorId: context.session?.itemId, eventKey, eventType: "customer.marketing_preference_recorded", aggregateType: "customer", aggregateId: current.id, shopId: current.shopId, occurredAt: updated.updatedAt, data: { preference: { customerId: current.id, acceptsMarketing: args.acceptsMarketing, preferredContactMethod: contact, previousAcceptsMarketing: current.acceptsMarketing, source: "staff_attestation", recordedById: context.session?.itemId ?? null, customerAssentEvidence: null } } }));
      return updated;
    });
    return { success: true, error: null, customer: { id: customer.id, acceptsMarketing: customer.acceptsMarketing, preferredContactMethod: customer.preferredContactMethod } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update customer consent.", customer: null };
  }
}
async function issueCustomerWaiver(_root, args, context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: "Not authorized to issue waivers.", waiver: null };
  const title = args.title?.trim();
  const type = args.waiverType || "general";
  const requestedDelivery = args.deliveryStatus || "draft";
  if (!args.customerId || !title || title.length > 200 || !["chemical_service", "minor_consent", "photo_release", "general"].includes(type) || !["draft", "sent"].includes(requestedDelivery) || !args.idempotencyKey?.trim()) return { success: false, error: "Customer, title, valid waiver type, draft/sent status, and idempotency key are required.", waiver: null };
  try {
    const commandHash = hashPublicAccessToken(args.idempotencyKey.trim());
    const waiver = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const eventKey = `customer-waiver:${commandHash}:v1`;
      const shopId = await requireCurrentShopPermission(context.session, "canManageCustomers", transaction);
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        const saved = payload?.data?.waiver;
        if (replay.shopId !== shopId || !saved?.id || saved.customerId !== args.customerId || saved.title !== title || saved.type !== type || saved.deliveryRequested !== requestedDelivery || (saved.appointmentId || null) !== (args.appointmentId || null)) throw new Error("Waiver idempotency key was reused with different input.");
        return transaction.waiverForm.findFirstOrThrow({ where: { id: saved.id, shopId } });
      }
      const customer = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!customer) throw new Error("Customer not found.");
      if (args.appointmentId && !await transaction.appointment.findFirst({ where: { id: args.appointmentId, shopId: customer.shopId, customerId: customer.id } })) throw new Error("Appointment does not belong to this customer and shop.");
      const created = await transaction.waiverForm.create({ data: { shopId: customer.shopId, customerId: customer.id, appointmentId: args.appointmentId || null, title, waiverType: type, status: "draft", signatureKeyHash: hashPublicAccessToken(`draft:${eventKey}`), metadata: { source: "operator_issue", signatureRequired: true, deliveryRequested: requestedDelivery, delivered: false, issuedById: context.session?.itemId ?? null } } });
      await recordCommandReceipt(transaction, buildCommandReceipt({ actorId: context.session?.itemId, eventKey, eventType: "waiver.issued", aggregateType: "waiver_form", aggregateId: created.id, shopId: customer.shopId, occurredAt: created.createdAt, data: { waiver: { id: created.id, customerId: customer.id, appointmentId: args.appointmentId || null, title, type, status: "draft", deliveryRequested: requestedDelivery, issuedById: context.session?.itemId ?? null } } }));
      return created;
    });
    return { success: true, error: null, waiver: { id: waiver.id, title: waiver.title, waiverType: waiver.waiverType, status: waiver.status } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to issue waiver.", waiver: null };
  }
}
async function mergeCustomers(_root, args, context) {
  if (!permissions.canManageCustomers({ session: context.session })) return { success: false, error: "Not authorized to merge customers.", customer: null };
  if (!args.keepCustomerId || !args.duplicateCustomerId || !args.idempotencyKey?.trim()) return { success: false, error: "Both customers and an idempotency key are required.", customer: null };
  try {
    const hash9 = hashPublicAccessToken(args.idempotencyKey.trim());
    const result = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageCustomers", transaction);
      for (const id of [args.keepCustomerId, args.duplicateCustomerId].sort()) {
        await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-customer", id);
      }
      const eventKey = `customer-merge:${hash9}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (replay.shopId !== shopId || payload?.aggregateId !== args.keepCustomerId || payload?.data?.merge?.duplicateCustomerId !== args.duplicateCustomerId) throw new Error("Merge idempotency key was reused with different customers.");
        return { id: args.keepCustomerId, moved: payload.data.merge.moved || {} };
      }
      const fields = { id: true, shopId: true, userId: true, lastVisitAt: true, email: true, phone: true, acceptsMarketing: true, birthday: true, preferredBarberId: true };
      const [kept, duplicate] = await Promise.all([
        transaction.customer.findFirst({ where: { id: args.keepCustomerId, shopId }, select: fields }),
        transaction.customer.findFirst({ where: { id: args.duplicateCustomerId, shopId }, select: fields })
      ]);
      const refusal = mergeRefusal(kept, duplicate, shopId);
      if (refusal) throw new Error(refusal);
      const moved = {};
      const where = { customerId: duplicate.id };
      const data = { customerId: kept.id };
      moved.appointment = (await transaction.appointment.updateMany({ where, data })).count;
      moved.customerNote = (await transaction.customerNote.updateMany({ where, data })).count;
      moved.checkoutTransaction = (await transaction.checkoutTransaction.updateMany({ where, data })).count;
      moved.customerPackage = (await transaction.customerPackage.updateMany({ where, data })).count;
      moved.membershipEvent = (await transaction.membershipEvent.updateMany({ where, data })).count;
      moved.noShowEvent = (await transaction.noShowEvent.updateMany({ where, data })).count;
      moved.walkInQueueEntry = (await transaction.walkInQueueEntry.updateMany({ where, data })).count;
      moved.waiverForm = (await transaction.waiverForm.updateMany({ where, data })).count;
      moved.groomingNote = (await transaction.groomingNote.updateMany({ where, data })).count;
      moved.waitlistEntry = (await transaction.waitlistEntry.updateMany({ where, data })).count;
      moved.tip = (await transaction.tip.updateMany({ where, data })).count;
      const merged = mergedCustomerFields(kept, duplicate);
      await transaction.customer.delete({ where: { id: duplicate.id } });
      const updated = Object.keys(merged).length ? await transaction.customer.update({ where: { id: kept.id }, data: merged }) : await transaction.customer.findUniqueOrThrow({ where: { id: kept.id } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: "customer.merged",
        aggregateType: "customer",
        aggregateId: kept.id,
        shopId,
        occurredAt: updated.updatedAt,
        data: { merge: { duplicateCustomerId: duplicate.id, moved, filled: Object.keys(merged), actorId: context.session?.itemId ?? null } }
      }));
      return { id: kept.id, moved };
    });
    return { success: true, error: null, customer: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to merge customers.", customer: null };
  }
}
var init_manageCustomers = __esm({
  "features/keystone/mutations/manageCustomers.ts"() {
    "use strict";
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_publicAccessToken();
    init_serializableTransaction();
    init_customerMerge();
  }
});

// features/keystone/mutations/manageMemberships.ts
function hash4(value) {
  return (0, import_node_crypto16.createHash)("sha256").update(value).digest("hex");
}
function membershipEventType(action) {
  return action === "purchase" || action === "purchase_package" ? "purchased" : action === "renew" ? "renewed" : action === "pause" ? "paused" : action === "resume" ? "resumed" : "cancelled";
}
function addCalendarMonths(from, months) {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(from.getUTCDate(), lastDay), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}
function termEnd(from, interval) {
  return addCalendarMonths(from, interval === "annual" ? 12 : interval === "quarterly" ? 3 : 1);
}
async function manageMembership(_root, args, context) {
  if (!permissions.canManageMemberships({ session: context.session })) {
    return { success: false, error: "Not authorized to manage memberships.", membership: null };
  }
  const action = args.action?.trim();
  const idempotencyKey = args.idempotencyKey?.trim();
  const targetMissing = action === "purchase" ? !args.membershipPlanId : action === "purchase_package" ? !args.servicePackageId : !args.customerPackageId;
  if (!ACTIONS.has(action) || !idempotencyKey || idempotencyKey.length > 200 || !args.customerId || targetMissing) {
    return { success: false, error: "Customer, target membership, valid action, and idempotency key are required.", membership: null };
  }
  const paid = PAID_ACTIONS.has(action);
  if (paid && !permissions.canManagePayments({ session: context.session })) {
    return { success: false, error: "Taking payment for a membership or package requires payment permission.", membership: null };
  }
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManageMemberships");
    const result = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue;
      await requireCurrentShopPermission(context.session, "canManageMemberships", transaction);
      if (paid) await requireCurrentShopPermission(context.session, "canManagePayments", transaction);
      const commandHash = hash4(idempotencyKey);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-membership", commandHash);
      const replay = await transaction.membershipEvent.findUnique({ where: { idempotencyKeyHash: commandHash }, include: { customerPackage: true, transaction: true } });
      if (replay) {
        const expectedPaymentMethod = paid ? args.paymentMethod || "cash" : null;
        if (expectedPaymentMethod) assertUsdSettlementCurrency(replay.transaction?.currencyCode);
        if (replay.shopId !== shopId || replay.eventType !== membershipEventType(action) || replay.customerId !== args.customerId || action === "purchase" && replay.membershipPlanId !== args.membershipPlanId || action === "purchase_package" && replay.customerPackage?.servicePackageId !== args.servicePackageId || !action.startsWith("purchase") && replay.customerPackageId !== args.customerPackageId || expectedPaymentMethod && replay.transaction?.paymentMethod !== expectedPaymentMethod || replay.reason !== (args.reason?.trim() || "")) {
          throw new Error("Membership idempotency key was reused for a different command.");
        }
        return replay.customerPackage;
      }
      const customer = await transaction.customer.findFirst({ where: { id: args.customerId, shopId } });
      if (!customer) throw new Error("Customer was not found in the active shop.");
      const now = /* @__PURE__ */ new Date();
      if (action === "purchase_package") {
        const paymentMethod = args.paymentMethod || "cash";
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error("Package card and gift-card tenders require captured provider or ledger evidence; record cash or use a connected adapter.");
        const servicePackage = await transaction.servicePackage.findFirst({ where: { id: args.servicePackageId, shopId }, include: { items: { include: { service: { select: { id: true, name: true, shopId: true } } } } } });
        if (!servicePackage) throw new Error("Service package was not found in the active shop.");
        if (servicePackage.status !== "active") throw new Error("Only active service packages can be sold.");
        const items = servicePackage.items.filter((item) => item.service?.shopId === shopId);
        const visits = items.reduce((total, item) => total + Math.max(0, item.quantity || 0), 0);
        if (!items.length || visits < 1) throw new Error("This package has no included services.");
        const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
        assertUsdSettlementCurrency(shop?.currencyCode);
        await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-membership-balance", `${customer.id}:package:${servicePackage.id}`);
        const amount2 = servicePackage.price;
        const sale = await transaction.checkoutTransaction.create({ data: {
          shopId,
          customerId: customer.id,
          status: "paid",
          subtotal: amount2,
          total: amount2,
          currencyCode: "USD",
          paymentMethod,
          completedAt: now,
          notes: `Package purchase \xB7 ${servicePackage.name} \xB7 ${items.map((item) => `${item.quantity}\xD7 ${item.service?.name ?? "service"}`).join(", ")}`
        } });
        const balance = await transaction.customerPackage.create({ data: {
          shopId,
          customerId: customer.id,
          servicePackageId: servicePackage.id,
          remainingVisits: visits,
          status: "active",
          startsAt: now,
          autoRenew: false
        } });
        await transaction.packageUsage.create({ data: {
          customerPackageId: balance.id,
          transactionId: sale.id,
          usageType: "grant",
          visitsDelta: visits,
          balanceAfter: visits,
          reason: `purchase \xB7 ${servicePackage.name}`,
          referenceKey: `membership:${commandHash}:grant`,
          occurredAt: now
        } });
        const event2 = await transaction.membershipEvent.create({ data: {
          shopId,
          customerId: customer.id,
          customerPackageId: balance.id,
          transactionId: sale.id,
          idempotencyKeyHash: commandHash,
          eventType: "purchased",
          planNameSnapshot: servicePackage.name,
          amount: amount2,
          visitsDelta: visits,
          resultingVisits: visits,
          occurredAt: now,
          reason: args.reason?.trim() || ""
        } });
        await recordCommandReceipt(transaction, buildCommandReceipt({
          actorId: context.session?.itemId,
          eventKey: `membership:${event2.id}:purchased:v1`,
          eventType: "service_package.purchased",
          aggregateType: "customer_package",
          aggregateId: balance.id,
          shopId,
          occurredAt: now,
          data: { servicePackage: { id: balance.id, packageId: servicePackage.id, amount: amount2, visits, actorId: context.session?.itemId ?? null } }
        }));
        return balance;
      }
      let membership = args.customerPackageId ? await transaction.customerPackage.findFirst({ where: { id: args.customerPackageId, shopId }, include: { membershipPlan: true } }) : null;
      if (args.customerPackageId && !membership) throw new Error("Membership was not found in the active shop.");
      const plan = args.membershipPlanId ? await transaction.membershipPlan.findFirst({ where: { id: args.membershipPlanId, shopId } }) : membership?.membershipPlan ?? null;
      if (!plan || plan.shopId !== shopId) throw new Error("Membership plan was not found in the active shop.");
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-membership-balance", membership?.id || `${customer.id}:${plan.id}`);
      if (action === "purchase") {
        if (plan.status !== "active") throw new Error("Only active membership plans can be purchased.");
        const existingMembership = await transaction.customerPackage.findFirst({ where: { shopId, customerId: customer.id, membershipPlanId: plan.id, status: { in: ["active", "paused"] } } });
        if (existingMembership) throw new Error("Customer already has an active or paused balance for this membership plan.");
      }
      if (membership && (membership.membershipPlanId !== plan.id || membership.customerId !== customer.id)) {
        throw new Error("Membership relationships must belong to the active shop.");
      }
      if (paid) {
        const shop = await transaction.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
        assertUsdSettlementCurrency(shop?.currencyCode);
      }
      let transactionId = null;
      let visitsDelta = 0;
      let amount = 0;
      if (paid) {
        if (action === "purchase" && membership) throw new Error("Purchase cannot target an existing membership.");
        if (action === "renew" && !membership) throw new Error("Renew requires an existing membership.");
        if (membership?.status === "cancelled") throw new Error("A cancelled membership cannot be renewed.");
        const paymentMethod = args.paymentMethod || "cash";
        if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error("Membership card and gift-card tenders require captured provider or ledger evidence; record cash or use a connected membership-capable adapter.");
        if (!Number.isInteger(plan.price) || plan.price < 0 || !Number.isInteger(plan.includedVisits) || (plan.includedVisits ?? 0) < 0) {
          throw new Error("This membership plan has an invalid price or included visits. Fix the plan before selling it.");
        }
        amount = plan.price;
        visitsDelta = plan.includedVisits ?? 0;
        const sale = await transaction.checkoutTransaction.create({
          data: {
            shopId,
            customerId: customer.id,
            status: "paid",
            subtotal: amount,
            total: amount,
            currencyCode: "USD",
            paymentMethod,
            completedAt: now,
            notes: `${action === "purchase" ? "Membership purchase" : "Membership renewal"} \xB7 ${plan.name} \xB7 ${plan.billingInterval} \xB7 ${visitsDelta} visits`
          }
        });
        transactionId = sale.id;
        const termStart = membership?.expiresAt && membership.expiresAt > now ? membership.expiresAt : now;
        const termEndsAt = termEnd(termStart, String(plan.billingInterval));
        if (!membership) {
          membership = await transaction.customerPackage.create({
            data: {
              shopId,
              customerId: customer.id,
              membershipPlanId: plan.id,
              remainingVisits: visitsDelta,
              // Automatic billing is not implemented; renewals are recorded by staff.
              status: "active",
              startsAt: now,
              expiresAt: termEndsAt,
              nextBillingAt: termEndsAt,
              autoRenew: false
            },
            include: { membershipPlan: true }
          });
        } else {
          membership = await transaction.customerPackage.update({
            where: { id: membership.id },
            data: {
              remainingVisits: (membership.remainingVisits || 0) + visitsDelta,
              status: "active",
              expiresAt: termEndsAt,
              nextBillingAt: termEndsAt,
              pausedAt: null,
              cancelledAt: null
            },
            include: { membershipPlan: true }
          });
        }
        await transaction.packageUsage.create({ data: {
          customerPackageId: membership.id,
          transactionId,
          usageType: "grant",
          visitsDelta,
          balanceAfter: membership.remainingVisits || 0,
          reason: `${action} \xB7 ${plan.name}`,
          referenceKey: `membership:${commandHash}:grant`,
          occurredAt: now
        } });
      } else {
        if (!membership) throw new Error("This membership action requires an existing membership.");
        if (action === "pause" && membership.status !== "active") throw new Error("Only active memberships can be paused.");
        if (action === "resume" && membership.status !== "paused") throw new Error("Only paused memberships can be resumed.");
        if (action === "cancel" && !["active", "paused"].includes(String(membership.status))) throw new Error("Only active or paused memberships can be cancelled.");
        membership = await transaction.customerPackage.update({
          where: { id: membership.id },
          data: action === "pause" ? { status: "paused", pausedAt: now, autoRenew: false } : action === "resume" ? { status: "active", pausedAt: null } : { status: "cancelled", cancelledAt: now, autoRenew: false, nextBillingAt: null },
          include: { membershipPlan: true }
        });
      }
      const eventType = membershipEventType(action);
      const event = await transaction.membershipEvent.create({ data: {
        shopId,
        customerId: customer.id,
        membershipPlanId: plan.id,
        customerPackageId: membership.id,
        transactionId,
        idempotencyKeyHash: commandHash,
        eventType,
        planNameSnapshot: plan.name,
        amount,
        visitsDelta,
        resultingVisits: membership.remainingVisits || 0,
        occurredAt: now,
        reason: args.reason?.trim() || ""
      } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `membership:${event.id}:${eventType}:v1`,
        eventType: `membership.${eventType}`,
        aggregateType: "customer_package",
        aggregateId: membership.id,
        shopId,
        occurredAt: now,
        data: { membership: { id: membership.id, customerId: customer.id, planId: plan.id, action: eventType, amount, visitsDelta, resultingVisits: membership.remainingVisits || 0, status: membership.status, actorId: context.session?.itemId ?? null } }
      }));
      return membership;
    });
    if (!result) throw new Error("Membership evidence is missing its balance.");
    return { success: true, error: null, membership: { id: result.id, status: result.status, remainingVisits: result.remainingVisits, nextBillingAt: result.nextBillingAt?.toISOString() || null, autoRenew: result.autoRenew } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to manage membership.", membership: null };
  }
}
var import_node_crypto16, ACTIONS, PAID_ACTIONS, PAYMENT_METHODS;
var init_manageMemberships = __esm({
  "features/keystone/mutations/manageMemberships.ts"() {
    "use strict";
    import_node_crypto16 = require("node:crypto");
    init_access();
    init_commandReceipt();
    init_serializableTransaction();
    init_currentAuthorization();
    init_supportedSettlementCurrency();
    ACTIONS = /* @__PURE__ */ new Set(["purchase", "purchase_package", "renew", "pause", "resume", "cancel"]);
    PAID_ACTIONS = /* @__PURE__ */ new Set(["purchase", "purchase_package", "renew"]);
    PAYMENT_METHODS = /* @__PURE__ */ new Set(["cash"]);
  }
});

// features/keystone/mutations/refundCashCheckout.ts
async function refundCashCheckout(_root, args, context) {
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
    const reason = args.reason?.trim();
    const key = args.idempotencyKey?.trim();
    if (!args.cashReturned || !reason || reason.length < 3 || reason.length > 1e3 || !key || key.length > 200) throw new Error("Confirm the cash has been returned and provide a reason and retry key.");
    const eventKey = `cash-refund:${shopId}:${(0, import_node_crypto17.createHash)("sha256").update(key).digest("hex")}`;
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const tx = client;
      await requireCurrentShopPermission(context.session, "canManagePayments", tx);
      const owner = await tx.shopMembership.findFirst({ where: { shopId, userId: context.session.itemId, status: "active", membershipRole: "owner" }, select: { id: true } });
      if (!owner) throw new Error("Only the shop owner can record a cash refund.");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))", "barbershop-cash-refund", args.transactionId);
      const prior = await tx.cashRefund.findUnique({ where: { eventKey } });
      if (prior) {
        if (prior.transactionId !== args.transactionId || prior.reason !== reason) throw new Error("Refund retry key was used for different details.");
        return { id: prior.id, amount: prior.amount, replayed: true };
      }
      const receipt = await tx.checkoutTransaction.findFirst({ where: { id: args.transactionId, shopId }, include: { appointments: true, cashRefund: true } });
      if (!receipt || receipt.paymentMethod !== "cash" || receipt.status !== "paid" || receipt.paymentSessionId || receipt.cashRefund || receipt.appointments.length !== 1 || (receipt.total ?? 0) < 0) throw new Error("Only an unrefunded, cash-only appointment receipt can be refunded here.");
      assertUsdSettlementCurrency(receipt.currencyCode);
      const paidCommission = await tx.commission.count({ where: { transactionId: receipt.id, status: "paid" } });
      if (paidCommission) throw new Error("A commission was already paid. Owner reconciliation is required before refunding this receipt.");
      const refundedAt = /* @__PURE__ */ new Date();
      const refund = await tx.cashRefund.create({ data: { shopId, transactionId: receipt.id, eventKey, actorId: context.session.itemId, reason, amount: receipt.total ?? 0, tipAmount: receipt.tipAmount ?? 0, taxAmount: receipt.taxAmount ?? 0, refundedAt } });
      await tx.checkoutTransaction.update({ where: { id: receipt.id }, data: { status: "refunded" } });
      await tx.appointment.updateMany({ where: { transactionId: receipt.id, shopId }, data: { paymentStatus: "refunded" } });
      await tx.commission.updateMany({ where: { transactionId: receipt.id, status: { in: ["projected", "approved"] } }, data: { status: "voided" } });
      await recordCommandReceipt(tx, buildCommandReceipt({ actorId: context.session?.itemId, eventKey: `${eventKey}:receipt`, eventType: "checkout.cash_refunded", aggregateType: "checkout_transaction", aggregateId: receipt.id, shopId, occurredAt: refundedAt, data: { refundId: refund.id, amount: refund.amount, tipAmount: refund.tipAmount, taxAmount: refund.taxAmount, reason, actorId: context.session.itemId, settlement: "owner_attested_cash_return" } }));
      return { id: refund.id, amount: refund.amount, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to record cash refund.", data: null };
  }
}
var import_node_crypto17;
var init_refundCashCheckout = __esm({
  "features/keystone/mutations/refundCashCheckout.ts"() {
    "use strict";
    import_node_crypto17 = require("node:crypto");
    init_currentAuthorization();
    init_commandReceipt();
    init_serializableTransaction();
    init_supportedSettlementCurrency();
  }
});

// features/keystone/mutations/manageWorkforce.ts
async function lockResource(transaction, resource) {
  await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-booking", resource);
}
async function acceptedAppointmentsInWindow(transaction, input) {
  const resources = input.wholeShop ? [] : [
    ...input.barberId ? [{ barberId: input.barberId }] : [],
    ...input.chairId ? [{ chairId: input.chairId }] : []
  ];
  if (!input.wholeShop && !resources.length) return 0;
  return transaction.appointment.count({ where: {
    shopId: input.shopId,
    status: { in: [...ACCEPTED_APPOINTMENT_STATUSES] },
    startsAt: { lt: input.endsAt },
    OR: [{ endsAt: { gt: input.startsAt } }, { endsAt: null, startsAt: { gte: input.startsAt } }],
    ...resources.length ? { AND: [{ OR: resources }] } : {}
  } });
}
function hash5(value) {
  return (0, import_node_crypto18.createHash)("sha256").update(value).digest("hex");
}
function date(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
async function manageStaffShift(_root, args, context) {
  if (!permissions.canManageSchedules({ session: context.session })) return { success: false, error: "Not authorized to manage shifts.", shift: null };
  const action = args.action?.trim();
  const key = args.idempotencyKey?.trim();
  if (!SHIFT_ACTIONS.has(action) || !key || key.length > 200) return { success: false, error: "A valid shift action and idempotency key are required.", shift: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManageSchedules");
    const shift = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue;
      await requireCurrentShopPermission(context.session, "canManageSchedules", transaction);
      const commandHash = hash5(key);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-shift", args.shiftId || args.barberId || commandHash);
      if (action === "schedule") {
        const startsAt = date(args.scheduledStart);
        const endsAt = date(args.scheduledEnd);
        const replay2 = await transaction.staffShift.findUnique({ where: { idempotencyKeyHash: commandHash } });
        if (replay2) {
          if (replay2.shopId !== shopId || replay2.barberId !== args.barberId || args.chairId && replay2.chairId !== args.chairId || !startsAt || !endsAt || replay2.scheduledStart.getTime() !== startsAt.getTime() || replay2.scheduledEnd.getTime() !== endsAt.getTime() || replay2.notes !== (args.notes?.trim() || "")) throw new Error("Shift idempotency key was reused for different input.");
          return replay2;
        }
        if (!args.barberId || !startsAt || !endsAt || endsAt <= startsAt) throw new Error("Barber and a valid shift window are required.");
        const barber = await transaction.barber.findUnique({ where: { id: args.barberId }, include: { chair: true } });
        if (!barber || barber.shopId !== shopId) throw new Error("Barber was not found in the active shop.");
        const chairId = args.chairId || barber.chairId;
        if (chairId) {
          const chair = await transaction.barberChair.findUnique({ where: { id: chairId } });
          if (!chair || chair.shopId !== shopId || chair.status !== "active") throw new Error("Shift chair is unavailable in the active shop.");
          await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-shift-chair", chairId);
        }
        const overlap = await transaction.staffShift.findFirst({ where: {
          shopId,
          status: { in: ["scheduled", "clocked_in"] },
          scheduledStart: { lt: endsAt },
          scheduledEnd: { gt: startsAt },
          OR: [{ barberId: barber.id }, ...chairId ? [{ chairId }] : []]
        } });
        if (overlap) throw new Error("This barber or chair already has an overlapping shift.");
        const created = await transaction.staffShift.create({ data: {
          shopId,
          barberId: barber.id,
          chairId,
          idempotencyKeyHash: commandHash,
          status: "scheduled",
          scheduledStart: startsAt,
          scheduledEnd: endsAt,
          notes: args.notes?.trim() || ""
        } });
        await recordCommandReceipt(transaction, buildCommandReceipt({
          actorId: context.session?.itemId,
          eventKey: `shift:${created.id}:scheduled:v1`,
          eventType: "shift.scheduled",
          aggregateType: "staff_shift",
          aggregateId: created.id,
          shopId,
          occurredAt: created.createdAt,
          data: { shift: { id: created.id, barberId: barber.id, chairId, scheduledStart: startsAt.toISOString(), scheduledEnd: endsAt.toISOString() } }
        }));
        return created;
      }
      if (!args.shiftId) throw new Error("Shift is required.");
      const eventKey = `shift-command:${commandHash}:v1`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (replay.shopId !== shopId || payload?.data?.shift?.id !== args.shiftId || payload.data.shift.action !== action) throw new Error("Shift idempotency key was reused for different input.");
        const replayShift = await transaction.staffShift.findUniqueOrThrow({ where: { id: args.shiftId } });
        if (replayShift.shopId !== shopId) throw new Error("Shift idempotency key belongs to another shop.");
        return replayShift;
      }
      const current = await transaction.staffShift.findUnique({ where: { id: args.shiftId } });
      if (!current || current.shopId !== shopId) throw new Error("Shift was not found in the active shop.");
      const now = /* @__PURE__ */ new Date();
      const data = action === "clock_in" ? current.status === "scheduled" ? { status: "clocked_in", clockedInAt: now } : null : action === "clock_out" ? current.status === "clocked_in" ? { status: "completed", clockedOutAt: now } : null : ["scheduled", "clocked_in"].includes(String(current.status)) ? { status: "cancelled", clockedOutAt: current.status === "clocked_in" ? now : null } : null;
      if (!data) throw new Error(`Shift in ${current.status} state cannot ${action.replace("_", " ")}.`);
      if (action === "cancel" && current.barberId) {
        await lockResource(transaction, `staff:${current.barberId}`);
        const stranded = await acceptedAppointmentsInWindow(transaction, { shopId, startsAt: current.status === "clocked_in" ? now : current.scheduledStart, endsAt: current.scheduledEnd, barberId: current.barberId });
        if (stranded) throw new Error(`${stranded} booked appointment(s) rely on this shift. Reschedule or reassign them before cancelling it.`);
      }
      const updated = await transaction.staffShift.update({ where: { id: current.id }, data });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: `shift.${updated.status}`,
        aggregateType: "staff_shift",
        aggregateId: updated.id,
        shopId,
        occurredAt: now,
        data: { shift: { id: updated.id, action, fromStatus: current.status, toStatus: updated.status } }
      }));
      return updated;
    });
    return { success: true, error: null, shift: { id: shift.id, status: shift.status, scheduledStart: shift.scheduledStart.toISOString(), scheduledEnd: shift.scheduledEnd.toISOString(), clockedInAt: shift.clockedInAt?.toISOString() || null, clockedOutAt: shift.clockedOutAt?.toISOString() || null } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to manage shift.", shift: null };
  }
}
async function manageScheduleException(_root, args, context) {
  if (!permissions.canManageSchedules({ session: context.session })) return { success: false, error: "Not authorized to manage schedule exceptions.", exception: null };
  const action = args.action?.trim();
  const key = args.idempotencyKey?.trim();
  if (!EXCEPTION_ACTIONS.has(action) || !key || key.length > 200) return { success: false, error: "A valid exception action and idempotency key are required.", exception: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManageSchedules");
    const exception = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue;
      await requireCurrentShopPermission(context.session, "canManageSchedules", transaction);
      const commandHash = hash5(key);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-schedule-exception", args.exceptionId || commandHash);
      if (action === "create") {
        const startsAt = date(args.startsAt);
        const endsAt = date(args.endsAt);
        const type = args.exceptionType?.trim() || "";
        const replay = await transaction.scheduleException.findUnique({ where: { idempotencyKeyHash: commandHash } });
        if (replay) {
          if (replay.shopId !== shopId || replay.exceptionType !== type || replay.barberId !== (args.barberId || null) || replay.chairId !== (args.chairId || null) || !startsAt || !endsAt || replay.startsAt.getTime() !== startsAt.getTime() || replay.endsAt.getTime() !== endsAt.getTime() || replay.reason !== (args.reason?.trim() || "")) throw new Error("Schedule-exception idempotency key was reused for different input.");
          return replay;
        }
        if (!EXCEPTION_TYPES.has(type) || !startsAt || !endsAt || endsAt <= startsAt || !args.reason?.trim()) throw new Error("Type, reason, and a valid exception window are required.");
        if (type === "working_override" && !args.barberId) throw new Error("A working override requires a barber.");
        if (type === "chair_unavailable" && !args.chairId) throw new Error("Chair unavailability requires a chair.");
        const [barber, chair] = await Promise.all([
          args.barberId ? transaction.barber.findUnique({ where: { id: args.barberId } }) : null,
          args.chairId ? transaction.barberChair.findUnique({ where: { id: args.chairId } }) : null
        ]);
        if (barber && barber.shopId !== shopId || chair && chair.shopId !== shopId) throw new Error("Exception resources must belong to the active shop.");
        if (type !== "working_override") {
          if (barber) await lockResource(transaction, `staff:${barber.id}`);
          if (chair) await lockResource(transaction, `chair:${shopId}:${chair.id}`);
          const stranded = await acceptedAppointmentsInWindow(transaction, { shopId, startsAt, endsAt, barberId: barber?.id, chairId: chair?.id, wholeShop: type === "shop_closure" && !barber && !chair });
          if (stranded) throw new Error(`${stranded} booked appointment(s) fall in this window. Reschedule or cancel them before blocking this time.`);
        }
        const created = await transaction.scheduleException.create({ data: {
          shopId,
          barberId: barber?.id || null,
          chairId: chair?.id || null,
          idempotencyKeyHash: commandHash,
          exceptionType: type,
          status: "active",
          startsAt,
          endsAt,
          reason: args.reason.trim()
        } });
        await recordCommandReceipt(transaction, buildCommandReceipt({
          actorId: context.session?.itemId,
          eventKey: `schedule-exception:${created.id}:created:v1`,
          eventType: "schedule_exception.created",
          aggregateType: "schedule_exception",
          aggregateId: created.id,
          shopId,
          occurredAt: created.createdAt,
          data: { exception: { id: created.id, type, barberId: barber?.id || null, chairId: chair?.id || null, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } }
        }));
        return created;
      }
      if (!args.exceptionId) throw new Error("Schedule exception is required.");
      const eventKey = `schedule-exception-command:${commandHash}:v1`;
      const replayEvent = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replayEvent) {
        const payload = replayEvent.payload;
        if (replayEvent.shopId !== shopId || payload?.data?.exception?.id !== args.exceptionId || payload.data.exception.action !== "cancel") throw new Error("Schedule-exception idempotency key was reused for different input.");
        return transaction.scheduleException.findFirstOrThrow({ where: { id: args.exceptionId, shopId } });
      }
      const current = await transaction.scheduleException.findUnique({ where: { id: args.exceptionId } });
      if (!current || current.shopId !== shopId) throw new Error("Schedule exception was not found in the active shop.");
      if (current.status === "cancelled") return current;
      const updated = await transaction.scheduleException.update({ where: { id: current.id }, data: { status: "cancelled" } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey,
        eventType: "schedule_exception.cancelled",
        aggregateType: "schedule_exception",
        aggregateId: updated.id,
        shopId,
        occurredAt: updated.updatedAt,
        data: { exception: { id: updated.id, action: "cancel", fromStatus: current.status, toStatus: updated.status } }
      }));
      return updated;
    });
    return { success: true, error: null, exception: { id: exception.id, status: exception.status, exceptionType: exception.exceptionType, startsAt: exception.startsAt.toISOString(), endsAt: exception.endsAt.toISOString() } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to manage schedule exception.", exception: null };
  }
}
async function linkBarberAccount(_root, args, context) {
  if (!permissions.canManageStaff({ session: context.session })) return { success: false, error: "Not authorized to manage staff accounts.", barber: null };
  const key = args.idempotencyKey?.trim();
  if (!args.barberId || !key || key.length > 200) return { success: false, error: "Barber and idempotency key are required.", barber: null };
  try {
    const barber = await runSerializableTransaction(context.prisma, async (transactionValue) => {
      const transaction = transactionValue;
      const shopId = await requireCurrentShopPermission(context.session, "canManageStaff", transaction);
      const actor = await transaction.shopMembership.findFirst({ where: { shopId, userId: context.session.itemId, status: "active", membershipRole: { in: ["owner", "manager"] } }, select: { id: true } });
      if (!actor) throw new Error("Only a shop owner or manager can link staff accounts.");
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-staff-identity", args.barberId);
      const current = await transaction.barber.findFirst({ where: { id: args.barberId, shopId } });
      if (!current) throw new Error("Barber was not found in the active shop.");
      const userId = args.userId || null;
      if (current.userId === userId) return current;
      if (userId) {
        const membership = await transaction.shopMembership.findFirst({ where: { shopId, userId, status: "active" }, select: { id: true } });
        if (!membership) throw new Error("Invite this person to the shop first; only active shop members can be linked.");
        const linked = await transaction.barber.findFirst({ where: { userId }, select: { id: true } });
        if (linked) throw new Error("This account is already linked to another barber profile.");
      }
      const updated = await transaction.barber.update({ where: { id: current.id }, data: { userId } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        actorId: context.session?.itemId,
        eventKey: `barber-account:${hash5(key)}:v1`,
        eventType: userId ? "barber.account_linked" : "barber.account_unlinked",
        aggregateType: "barber",
        aggregateId: current.id,
        shopId,
        occurredAt: updated.updatedAt,
        data: { barberAccount: { barberId: current.id, previousUserId: current.userId, userId, actorId: context.session?.itemId ?? null } }
      }));
      return updated;
    });
    return { success: true, error: null, barber: { id: barber.id, userId: barber.userId } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to link staff account.", barber: null };
  }
}
var import_node_crypto18, SHIFT_ACTIONS, EXCEPTION_ACTIONS, EXCEPTION_TYPES, ACCEPTED_APPOINTMENT_STATUSES;
var init_manageWorkforce = __esm({
  "features/keystone/mutations/manageWorkforce.ts"() {
    "use strict";
    import_node_crypto18 = require("node:crypto");
    init_access();
    init_commandReceipt();
    init_serializableTransaction();
    init_currentAuthorization();
    SHIFT_ACTIONS = /* @__PURE__ */ new Set(["schedule", "clock_in", "clock_out", "cancel"]);
    EXCEPTION_ACTIONS = /* @__PURE__ */ new Set(["create", "cancel"]);
    EXCEPTION_TYPES = /* @__PURE__ */ new Set(["time_off", "shop_closure", "chair_unavailable", "working_override"]);
    ACCEPTED_APPOINTMENT_STATUSES = ["requested", "confirmed", "checked_in", "in_chair"];
  }
});

// features/keystone/mutations/manageWaitlist.ts
async function manageWaitlist(_root, args, context) {
  if (!permissions.canManageQueue({ session: context.session })) return { success: false, error: "Not authorized to manage the waitlist.", entry: null };
  const action = args.action?.trim();
  const key = args.idempotencyKey?.trim();
  if (!ACTIONS2.has(action) || !key || key.length > 200) return { success: false, error: "A valid waitlist action and idempotency key are required.", entry: null };
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManageQueue");
    const entry = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const commandHash = hash6(key);
      const eventKey = `waitlist-command:${commandHash}:v1`;
      await requireCurrentShopPermission(context.session, "canManageQueue", transaction);
      const inputHash = hash6(JSON.stringify([action, args.waitlistEntryId || null, args.customerName?.trim() || null, args.phone?.trim() || null, args.customerId || null, args.requestedServiceId || null, args.requestedBarberId || null, args.preferredAt || null, args.notes?.trim() || null, context.session?.itemId || null]));
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-waitlist", args.waitlistEntryId || `${shopId}:${args.phone || commandHash}`);
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        if (replay.shopId !== shopId) throw new Error("Waitlist idempotency key belongs to another shop.");
        const payload = replay.payload;
        const saved = payload?.data?.waitlist;
        if (!saved?.id || saved.action !== action || saved.inputHash !== inputHash) throw new Error("Waitlist idempotency key was reused with different input.");
        return transaction.waitlistEntry.findFirstOrThrow({ where: { id: String(saved.id), shopId } });
      }
      if (action === "create") {
        const customerName = args.customerName?.trim() || "";
        const phone = args.phone?.trim() || "";
        const preferredAt = args.preferredAt ? new Date(args.preferredAt) : null;
        if (customerName.length < 2 || phone.replace(/\D/g, "").length < 7 || preferredAt && Number.isNaN(preferredAt.getTime())) throw new Error("Customer name, phone, and a valid preferred time are required.");
        const [customer, service, barber] = await Promise.all([args.customerId ? transaction.customer.findFirst({ where: { id: args.customerId, shopId } }) : null, args.requestedServiceId ? transaction.service.findFirst({ where: { id: args.requestedServiceId, shopId }, include: { specialists: { select: { id: true } } } }) : null, args.requestedBarberId ? transaction.barber.findFirst({ where: { id: args.requestedBarberId, shopId } }) : null]);
        if (args.customerId && !customer || args.requestedServiceId && !service || args.requestedBarberId && !barber || customer && customer.shopId !== shopId || service && (service.shopId !== shopId || service.status !== "active") || barber && (barber.shopId !== shopId || barber.status !== "active")) throw new Error("Waitlist relationships must belong to the active shop.");
        if (service?.specialists.length && barber && !service.specialists.some((item) => item.id === barber.id)) throw new Error("Requested barber does not provide this service.");
        const duplicate = await transaction.waitlistEntry.findFirst({ where: { shopId, phone, status: { in: ["waiting", "notified"] }, requestedServiceId: service?.id || null } });
        if (duplicate) throw new Error("This customer already has an active waitlist request for that service.");
        const created = await transaction.waitlistEntry.create({ data: { shopId, customerName, phone, customerId: customer?.id || null, requestedServiceId: service?.id || null, requestedBarberId: barber?.id || null, status: "waiting", preferredAt, notes: args.notes?.trim() || "", metadata: { source: "operator" } } });
        await recordCommandReceipt(transaction, buildCommandReceipt({ actorId: context.session?.itemId, eventKey, eventType: "waitlist.created", aggregateType: "waitlist_entry", aggregateId: created.id, shopId, occurredAt: created.createdAt, data: { waitlist: { id: created.id, action, inputHash, customerId: customer?.id || null, requestedServiceId: service?.id || null, requestedBarberId: barber?.id || null, preferredAt: args.preferredAt || null, actorId: context.session?.itemId ?? null } } }));
        return created;
      }
      if (!args.waitlistEntryId) throw new Error("Waitlist entry is required.");
      const current = await transaction.waitlistEntry.findFirst({ where: { id: args.waitlistEntryId, shopId } });
      if (!current) throw new Error("Waitlist entry was not found in the active shop.");
      if (action === "notify" ? current.status !== "waiting" : !["waiting", "notified"].includes(String(current.status))) throw new Error(`Waitlist entry in ${current.status} state cannot ${action}.`);
      const updated = await transaction.waitlistEntry.update({ where: { id: current.id }, data: action === "notify" ? { status: "notified", notifiedAt: /* @__PURE__ */ new Date() } : { status: "expired" } });
      await recordCommandReceipt(transaction, buildCommandReceipt({ actorId: context.session?.itemId, eventKey, eventType: `waitlist.${updated.status}`, aggregateType: "waitlist_entry", aggregateId: updated.id, shopId, occurredAt: updated.updatedAt, data: { waitlist: { id: updated.id, action, inputHash, fromStatus: current.status, toStatus: updated.status, actorId: context.session?.itemId ?? null } } }));
      return updated;
    });
    return { success: true, error: null, entry: { id: entry.id, status: entry.status, customerName: entry.customerName, preferredAt: entry.preferredAt?.toISOString() || null, notifiedAt: entry.notifiedAt?.toISOString() || null } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to manage waitlist.", entry: null };
  }
}
var import_node_crypto19, ACTIONS2, hash6;
var init_manageWaitlist = __esm({
  "features/keystone/mutations/manageWaitlist.ts"() {
    "use strict";
    import_node_crypto19 = require("node:crypto");
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_serializableTransaction();
    ACTIONS2 = /* @__PURE__ */ new Set(["create", "notify", "expire"]);
    hash6 = (value) => (0, import_node_crypto19.createHash)("sha256").update(value).digest("hex");
  }
});

// features/keystone/mutations/staffAppointments.ts
function digest(value) {
  return (0, import_node_crypto20.createHash)("sha256").update(value).digest("hex");
}
function fail2(error) {
  return { success: false, error, data: null };
}
function clean5(value) {
  return value?.trim() || "";
}
function safeError(error, fallback) {
  return error instanceof Error && !error.message.includes("Invalid `") ? error.message : fallback;
}
async function assertStaffSlot(transaction, input) {
  await lockBookingResources(transaction, { serviceId: input.serviceId, barberId: input.barberId });
  const [service, barber, shop] = await Promise.all([
    transaction.service.findUnique({ where: { id: input.serviceId }, include: { specialists: { select: { id: true } } } }),
    transaction.barber.findUnique({ where: { id: input.barberId }, include: { chair: { select: { id: true, shopId: true, status: true } } } }),
    transaction.shop.findUnique({ where: { id: input.shopId }, select: { id: true, status: true, timezone: true } })
  ]);
  if (!shop || shop.status !== "active") throw new Error("The active shop is unavailable.");
  if (!service || service.shopId !== input.shopId || service.status !== "active") throw new Error("Selected service is not active in this shop.");
  if (!barber || barber.shopId !== input.shopId || barber.status !== "active" || !barber.bookingEnabled) throw new Error("Selected barber is not bookable in this shop.");
  if (!barber.chair || barber.chair.shopId !== input.shopId) throw new Error("The selected barber does not have an assigned chair in this shop.");
  if (barber.chair.status !== "active") throw new Error("The selected barber chair is unavailable.");
  if (service.specialists.length > 0 && !service.specialists.some((item) => item.id === barber.id)) throw new Error("Selected barber does not provide this service.");
  await lockBookingResources(transaction, { serviceId: service.id, barberId: barber.id, chairNumber: `${input.shopId}:${barber.chair.id}` });
  const timeZone = shop.timezone;
  if (!timeZone) throw new Error("Shop timezone is unavailable.");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(input.startsAt);
  } catch {
    throw new Error("Shop timezone is unavailable.");
  }
  const durationMinutes = input.durationMinutes || service.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) throw new Error("Service duration is unavailable.");
  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 6e4);
  const { start, end } = dayRange(startsAt, timeZone);
  const minute = (value) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const bufferMinutes = Math.max(0, barber.bufferMinutes || 0);
  const chairId = barber.chair.id;
  const [schedule, exceptions, shifts, appointments] = await Promise.all([
    transaction.barberSchedule.findFirst({ where: { barberId: barber.id, dayOfWeek: dayKeyForDate(startsAt, timeZone), isWorking: true } }),
    transaction.scheduleException.findMany({ where: { shopId: input.shopId, status: "active", startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, OR: [{ barberId: barber.id }, { chairId }, { exceptionType: "shop_closure", barberId: null, chairId: null }] } }),
    transaction.staffShift.findMany({ where: { shopId: input.shopId, barberId: barber.id, status: { in: ["scheduled", "clocked_in"] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } } }),
    transaction.appointment.findMany({
      where: {
        ...input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {},
        shopId: input.shopId,
        status: { in: [...ACTIVE_STATUSES] },
        ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes),
        OR: [{ barberId: barber.id }, { chairId }]
      },
      select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true },
      take: MAX_BOOKING_CAPACITY_CANDIDATES + 1
    })
  ]);
  assertAppointmentCandidateSetComplete(appointments);
  const blocking = exceptions.filter((item) => item.exceptionType !== "working_override");
  if (blocking.length) throw new Error(blocking[0].reason || "That time is blocked by a schedule exception.");
  if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && endsAt <= shift.scheduledEnd)) throw new Error("That time is outside the barber\u2019s scheduled shift.");
  const override = exceptions.find((item) => item.exceptionType === "working_override");
  const effectiveSchedule = override ? {
    id: override.id,
    barberId: barber.id,
    dayOfWeek: dayKeyForDate(startsAt, timeZone),
    isWorking: true,
    startMinute: minute(override.startsAt),
    endMinute: minute(override.endsAt),
    breakStartMinute: null,
    breakEndMinute: null,
    notes: override.reason,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt
  } : schedule;
  if (!isSlotAvailable({
    startsAt,
    timeZone,
    serviceDuration: durationMinutes + bufferMinutes,
    schedule: effectiveSchedule ? { ...effectiveSchedule, dayOfWeek: String(effectiveSchedule.dayOfWeek), barber: { id: barber.id, displayName: barber.displayName } } : null,
    appointments: appointments.map((item) => ({
      id: item.id,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt?.toISOString() || null,
      durationMinutes: item.durationMinutes || 30,
      barber: item.barberId ? { id: item.barberId } : null
    })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    blockingWindows: blocking.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason }))
  })) throw new Error("That slot is taken or outside the barber\u2019s working hours. Choose another time.");
  const authority = await requireEffectivePractitionerAuthority(transaction, { shopId: input.shopId, barberId: barber.id, serviceId: service.id, at: startsAt });
  return { service, barber, chairId, endsAt, durationMinutes, authority, timeZone };
}
async function readReplay(transaction, eventKey, shopId, request) {
  const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
  if (!replay) return null;
  const payload = replay.payload;
  const saved = payload?.data?.command;
  if (replay.shopId !== shopId || !saved?.appointmentId || saved.request !== request) {
    throw new Error("This request key was already used for a different appointment command.");
  }
  return saved.appointmentId;
}
async function createStaffAppointment(_root, args, context) {
  if (!permissions.canManageAppointments({ session: context.session })) return fail2("Not authorized to book appointments.");
  const key = clean5(args.idempotencyKey);
  const serviceId = clean5(args.serviceId);
  const barberId = clean5(args.barberId);
  const customerId = clean5(args.customerId);
  const firstName = clean5(args.customerFirstName);
  const lastName = clean5(args.customerLastName);
  const phone = clean5(args.customerPhone);
  const email = clean5(args.customerEmail);
  const notes = clean5(args.notes).slice(0, 2e3);
  const source = SOURCES.has(clean5(args.source)) ? clean5(args.source) : "staff";
  const waitlistEntryId = clean5(args.waitlistEntryId);
  const startsAt = new Date(args.startsAt || "");
  if (key.length < 8 || key.length > 200) return fail2("A valid request key is required.");
  if (!serviceId || !barberId) return fail2("Choose a service and a barber.");
  if (Number.isNaN(startsAt.getTime())) return fail2("Choose a valid appointment time.");
  if (startsAt.getTime() <= Date.now()) return fail2("Choose a future appointment time.");
  if (startsAt.getTime() > Date.now() + 365 * 864e5) return fail2("Choose a time within the next year.");
  if (!customerId) {
    if (firstName.length < 1 || firstName.length > 80 || lastName.length > 80) return fail2("Enter the new customer\u2019s first name.");
    if (phone.replace(/\D/g, "").length < 7 || phone.length > 40) return fail2("Enter a valid phone number for the new customer.");
    if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return fail2("Enter a valid email or leave it blank.");
  }
  let shopId;
  try {
    shopId = await requireCurrentShopPermission(context.session, "canManageAppointments", context.prisma);
  } catch (error) {
    return fail2(safeError(error, "Not authorized to book appointments for this shop."));
  }
  if (waitlistEntryId) {
    try {
      await requireCurrentShopPermission(context.session, "canManageQueue", context.prisma);
    } catch {
      return fail2("Waitlist promotion also requires queue access for this shop.");
    }
  }
  const request = canonicalJson({ customerId: customerId || null, firstName: customerId ? null : firstName, lastName: customerId ? null : lastName, phone: customerId ? null : phone, email: customerId ? null : email, serviceId, barberId, startsAt: startsAt.toISOString(), notes, source, waitlistEntryId: waitlistEntryId || null });
  const eventKey = `staff-appointment-create:${digest(`${shopId}:${key}`)}:v1`;
  const access = createPublicAccessToken();
  try {
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-staff-appointment", eventKey);
      await requireCurrentShopPermission(context.session, "canManageAppointments", transaction);
      const replayedId = await readReplay(transaction, eventKey, shopId, request);
      if (replayedId) {
        const prior = await transaction.appointment.findUnique({ where: { id: replayedId }, select: { id: true, status: true, startsAt: true, customerId: true } });
        return { appointmentId: replayedId, status: prior?.status || null, startsAt: prior?.startsAt.toISOString() || null, customerId: prior?.customerId || null, replayed: true, accessToken: null };
      }
      let waitlist = null;
      if (waitlistEntryId) {
        await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-waitlist", waitlistEntryId);
        const entry = await transaction.waitlistEntry.findFirst({ where: { id: waitlistEntryId, shopId }, select: { id: true, status: true, metadata: true } });
        if (!entry) throw new Error("Waitlist entry was not found in the active shop.");
        if (!["waiting", "notified"].includes(String(entry.status))) throw new Error(`A ${entry.status} waitlist entry cannot be booked.`);
        waitlist = entry;
      }
      let customer = null;
      if (customerId) {
        customer = await transaction.customer.findFirst({ where: { id: customerId, shopId }, select: { id: true, firstName: true, lastName: true } });
        if (!customer) throw new Error("Selected customer was not found in this shop.");
      }
      const slot = await assertStaffSlot(transaction, { shopId, serviceId, barberId, startsAt });
      const [bookingPolicy, waiverRequirement] = await Promise.all([
        requireEffectiveBookingPolicy(transaction, { shopId, at: /* @__PURE__ */ new Date() }),
        getWaiverRequirement(transaction, slot.service.id)
      ]);
      if (!customer) {
        customer = await transaction.customer.create({ data: { shopId, firstName, lastName, phone, email, status: "active" }, select: { id: true, firstName: true, lastName: true } });
      }
      const appointment = await transaction.appointment.create({
        data: {
          shopId,
          chairId: slot.chairId,
          startsAt,
          endsAt: slot.endsAt,
          durationMinutes: slot.durationMinutes,
          serviceTitleSnapshot: slot.service.name || "Barbershop service",
          serviceImagePathSnapshot: slot.service.imagePath || "",
          serviceModifiersSnapshot: [],
          barberNameSnapshot: slot.barber.displayName || "",
          barberChairNumberSnapshot: slot.barber.chairNumber || "",
          // Staff took the booking themselves, so it is confirmed on entry.
          status: "confirmed",
          source,
          paymentStatus: slot.service.depositRequired ? "deposit_due" : "not_required",
          price: slot.service.price || 0,
          depositAmount: slot.service.depositAmount || 0,
          internalNotes: notes,
          // The customer's status link greets them by the name staff entered.
          guestNameSnapshot: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
          publicAccessTokenHash: access.hash,
          serviceId: slot.service.id,
          barberId: slot.barber.id,
          customerId: customer.id
        },
        select: { id: true, status: true, startsAt: true, endsAt: true, createdAt: true }
      });
      await transaction.$executeRawUnsafe(`
        UPDATE "Appointment"
        SET "bookingAuthoritySnapshot" = $2::jsonb, "bookingPolicySnapshot" = $3::jsonb, "waiverRequirementSnapshot" = $4::jsonb
        WHERE id = $1
      `, appointment.id, JSON.stringify(slot.authority), JSON.stringify(bookingPolicy), JSON.stringify(waiverRequirement));
      if (waitlist) {
        const metadata = waitlist.metadata && typeof waitlist.metadata === "object" && !Array.isArray(waitlist.metadata) ? waitlist.metadata : {};
        await transaction.waitlistEntry.update({ where: { id: waitlist.id }, data: { status: "booked", customerId: customer.id, metadata: { ...metadata, appointmentId: appointment.id, bookedAt: appointment.createdAt.toISOString() } } });
      }
      await recordCommandReceipt(transaction, buildCommandReceipt({
        eventKey,
        eventType: "appointment.created",
        aggregateType: "appointment",
        aggregateId: appointment.id,
        shopId,
        occurredAt: appointment.createdAt,
        data: {
          command: { request, appointmentId: appointment.id },
          appointment: {
            id: appointment.id,
            status: appointment.status,
            startsAt: appointment.startsAt.toISOString(),
            endsAt: appointment.endsAt?.toISOString() || null,
            customerId: customer.id,
            barberId: slot.barber.id,
            chairId: slot.chairId,
            serviceId: slot.service.id,
            price: slot.service.price || 0,
            source,
            bookingAuthority: slot.authority,
            bookingPolicy,
            waiverRequirement,
            waitlistEntryId: waitlist?.id || null
          }
        }
      }));
      return { appointmentId: appointment.id, status: appointment.status, startsAt: appointment.startsAt.toISOString(), customerId: customer.id, waitlistEntryId: waitlist?.id || null, waiverRequired: waiverRequirement.required, replayed: false, accessToken: access.token };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail2(safeError(error, "Unable to book this appointment. Refresh the booking board before retrying."));
  }
}
async function manageStaffAppointment(_root, args, context) {
  if (!permissions.canManageAppointments({ session: context.session })) return fail2("Not authorized to change appointments.");
  const action = clean5(args.action).toLowerCase();
  const appointmentId = clean5(args.appointmentId);
  const reason = clean5(args.reason);
  const key = clean5(args.idempotencyKey);
  const nextBarberId = clean5(args.barberId);
  if (!["cancel", "reschedule"].includes(action)) return fail2("Action must be cancel or reschedule.");
  if (!appointmentId || key.length < 8 || key.length > 200) return fail2("Appointment and request key are required.");
  if (reason.length < 2 || reason.length > 1e3) return fail2("Enter a reason for this change.");
  const requestedStart = action === "reschedule" && args.startsAt ? new Date(args.startsAt) : null;
  if (requestedStart && (Number.isNaN(requestedStart.getTime()) || requestedStart <= /* @__PURE__ */ new Date())) return fail2("Choose a future appointment time.");
  if (action === "reschedule" && !requestedStart && !nextBarberId) return fail2("Choose a new time or barber.");
  let shopId;
  try {
    shopId = await requireCurrentShopPermission(context.session, "canManageAppointments", context.prisma);
  } catch (error) {
    return fail2(safeError(error, "Not authorized to change appointments for this shop."));
  }
  const eventKey = `staff-appointment-change:${appointmentId}:${digest(`${shopId}:${key}`)}`;
  try {
    let staleCheckouts = [];
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-appointment-transition", appointmentId);
      await requireCurrentShopPermission(context.session, "canManageAppointments", transaction);
      const appointment = await transaction.appointment.findFirst({ where: { id: appointmentId, shopId } });
      if (!appointment) throw new Error("Appointment not found in the active shop.");
      const prior = (await transaction.$queryRawUnsafe('SELECT "appointment" AS "appointmentId", action, reason, "nextStartsAt" FROM "AppointmentChangeEvent" WHERE "eventKey" = $1 LIMIT 1', eventKey))[0];
      if (prior) {
        if (prior.appointmentId !== appointmentId || prior.action !== (action === "cancel" ? "cancelled" : "rescheduled") || prior.reason !== reason) throw new Error("This request key was already used for a different appointment change.");
        return { appointmentId, action, status: appointment.status, startsAt: appointment.startsAt.toISOString(), barberId: appointment.barberId, replayed: true };
      }
      if (!["requested", "confirmed"].includes(String(appointment.status))) throw new Error("Only requested or confirmed appointments can be cancelled or rescheduled. Use the board status actions for guests already in the shop.");
      if (appointment.paymentStatus === "paid" || appointment.paymentStatus === "refunded" && action !== "cancel") throw new Error("Settled appointments cannot be changed here.");
      if (!appointment.serviceId || !appointment.barberId) throw new Error("This appointment is missing its service or barber.");
      const snapshot = (await transaction.$queryRawUnsafe('SELECT "bookingPolicySnapshot", "bookingAuthoritySnapshot" FROM "Appointment" WHERE id = $1 FOR UPDATE', appointmentId))[0];
      const policy = snapshot?.bookingPolicySnapshot;
      const now = /* @__PURE__ */ new Date();
      const consequence = policy ? appointmentChangeConsequences({ action, startsAt: appointment.startsAt, now, paymentStatus: appointment.paymentStatus, depositAmount: appointment.depositAmount, policy, priorReschedules: 0 }) : { feeAmount: 0, depositConsequence: appointment.paymentStatus === "deposit_paid" && (appointment.depositAmount || 0) > 0 ? "manual_review" : "none" };
      let nextStartsAt = null;
      let nextEndsAt = null;
      let nextAuthority = snapshot?.bookingAuthoritySnapshot ?? null;
      let nextBarber = null;
      if (action === "reschedule") {
        const startsAt = requestedStart || appointment.startsAt;
        const barberId = nextBarberId || appointment.barberId;
        const slot = await assertStaffSlot(transaction, { shopId, serviceId: appointment.serviceId, barberId, startsAt, durationMinutes: appointment.durationMinutes, excludeAppointmentId: appointment.id });
        nextStartsAt = startsAt;
        nextEndsAt = slot.endsAt;
        nextAuthority = slot.authority;
        nextBarber = { id: slot.barber.id, displayName: slot.barber.displayName || "", chairNumber: slot.barber.chairNumber || "" };
        await transaction.$executeRawUnsafe(
          'UPDATE "Appointment" SET "startsAt" = $2, "endsAt" = $3, "bookingAuthoritySnapshot" = $4::jsonb, "barber" = $5, "chair" = $6, "updatedAt" = $7 WHERE id = $1',
          appointmentId,
          nextStartsAt,
          nextEndsAt,
          JSON.stringify(nextAuthority),
          slot.barber.id,
          slot.chairId,
          now
        );
      } else {
        await transaction.appointment.update({ where: { id: appointmentId }, data: { status: "cancelled", cancellationReason: reason } });
        staleCheckouts = await closeOpenDepositSessions(transaction, appointmentId);
      }
      await transaction.$executeRawUnsafe(
        `INSERT INTO "AppointmentChangeEvent" (id, "eventKey", action, "actorType", "actorReferenceHash", reason, "previousStartsAt", "previousEndsAt", "nextStartsAt", "nextEndsAt", "policySnapshot", "authoritySnapshot", "feeAmount", "depositConsequence", "occurredAt", "shop", "appointment", "createdAt", "updatedAt") VALUES ($1,$2,$3::"AppointmentChangeEventActionType",'operator',$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::"AppointmentChangeEventDepositConsequenceType",$14,$15,$16,$14,$14)`,
        (0, import_node_crypto20.randomUUID)(),
        eventKey,
        action === "cancel" ? "cancelled" : "rescheduled",
        digest(context.session?.itemId || ""),
        reason,
        appointment.startsAt,
        appointment.endsAt,
        nextStartsAt,
        nextEndsAt,
        JSON.stringify(policy ?? null),
        JSON.stringify(nextAuthority ?? null),
        consequence.feeAmount,
        consequence.depositConsequence,
        now,
        shopId,
        appointment.id
      );
      await recordCommandReceipt(transaction, buildCommandReceipt({
        eventKey: `${eventKey}:receipt`,
        eventType: action === "cancel" ? "appointment.operator_cancelled" : "appointment.operator_rescheduled",
        aggregateType: "appointment",
        aggregateId: appointment.id,
        shopId,
        occurredAt: now,
        data: { appointmentId, action, reason, previousStartsAt: appointment.startsAt.toISOString(), nextStartsAt: nextStartsAt?.toISOString() || null, previousBarberId: appointment.barberId, nextBarberId: nextBarber?.id || null, feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence }
      }));
      return {
        appointmentId,
        action,
        status: action === "cancel" ? "cancelled" : appointment.status,
        startsAt: (nextStartsAt || appointment.startsAt).toISOString(),
        barberId: nextBarber?.id || appointment.barberId,
        feeAmount: consequence.feeAmount,
        depositConsequence: consequence.depositConsequence,
        replayed: false
      };
    });
    await Promise.all(staleCheckouts.map((id) => expireAtStripe(id)));
    return { success: true, error: null, data };
  } catch (error) {
    return fail2(safeError(error, "Unable to change this appointment. Refresh the booking board before retrying."));
  }
}
var import_node_crypto20, ACTIVE_STATUSES, SOURCES;
var init_staffAppointments = __esm({
  "features/keystone/mutations/staffAppointments.ts"() {
    "use strict";
    import_node_crypto20 = require("node:crypto");
    init_expireStalePaymentSessions();
    init_shop_time();
    init_access();
    init_availability();
    init_bookingCapacity();
    init_bookingPolicy();
    init_currentAuthorization();
    init_commandReceipt();
    init_practitionerAuthority();
    init_publicAccessToken();
    init_waiverEvidence();
    ACTIVE_STATUSES = ["requested", "confirmed", "checked_in", "in_chair"];
    SOURCES = /* @__PURE__ */ new Set(["phone", "staff", "walk_in"]);
  }
});

// features/keystone/mutations/staffQueueEntries.ts
function digest2(value) {
  return (0, import_node_crypto21.createHash)("sha256").update(value).digest("hex");
}
function fail3(error) {
  return { success: false, error, data: null };
}
function clean6(value) {
  return value?.trim() || "";
}
function safeError2(error, fallback) {
  return error instanceof Error && !error.message.includes("Invalid `") ? error.message : fallback;
}
async function assertQueueChoices(transaction, shopId, serviceId, barberId) {
  const [service, barber] = await Promise.all([
    serviceId ? transaction.service.findUnique({ where: { id: serviceId }, select: { id: true, status: true, shopId: true, specialists: { select: { id: true } } } }) : null,
    barberId ? transaction.barber.findUnique({ where: { id: barberId }, select: { id: true, status: true, bookingEnabled: true, shopId: true } }) : null
  ]);
  if (serviceId && (!service || service.shopId !== shopId || service.status !== "active")) throw new Error("Selected service is not active in this shop.");
  if (barberId && (!barber || barber.shopId !== shopId || barber.status !== "active" || !barber.bookingEnabled)) throw new Error("Selected barber is not bookable in this shop.");
  if (service?.specialists.length && barberId && !service.specialists.some((item) => item.id === barberId)) throw new Error("Selected barber does not provide this service.");
}
async function readReplay2(transaction, eventKey, shopId, request) {
  const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
  if (!replay) return null;
  const saved = replay.payload?.data?.command;
  if (replay.shopId !== shopId || !saved?.queueEntryId || saved.request !== request) throw new Error("This request key was already used for a different queue command.");
  return saved.queueEntryId;
}
async function createStaffQueueEntry(_root, args, context) {
  if (!permissions.canManageQueue({ session: context.session })) return fail3("Not authorized to add walk-ins.");
  const customerName = clean6(args.customerName);
  const phone = clean6(args.phone);
  const serviceId = clean6(args.requestedServiceId);
  const barberId = clean6(args.requestedBarberId);
  const notes = clean6(args.notes).slice(0, 1e3);
  const key = clean6(args.idempotencyKey);
  const partySize = Number(args.partySize ?? 1);
  const quotedWaitMinutes = args.quotedWaitMinutes == null ? null : Number(args.quotedWaitMinutes);
  if (customerName.length < 2 || customerName.length > 120) return fail3("Enter the guest\u2019s name.");
  if (phone && (phone.replace(/\D/g, "").length < 7 || phone.length > 40)) return fail3("Enter a valid phone number or leave it blank.");
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) return fail3("Party size must be a whole number from 1 to 8.");
  if (quotedWaitMinutes !== null && (!Number.isInteger(quotedWaitMinutes) || quotedWaitMinutes < 0 || quotedWaitMinutes > 480)) return fail3("Quoted wait must be a whole number of minutes from 0 to 480.");
  if (key.length < 8 || key.length > 200) return fail3("A valid request key is required.");
  let shopId;
  try {
    shopId = await requireCurrentShopPermission(context.session, "canManageQueue", context.prisma);
  } catch (error) {
    return fail3(safeError2(error, "Not authorized to manage this shop\u2019s queue."));
  }
  const request = canonicalJson({ customerName, phone, partySize, serviceId: serviceId || null, barberId: barberId || null, notes, quotedWaitMinutes });
  const eventKey = `staff-queue-create:${digest2(`${shopId}:${key}`)}:v1`;
  try {
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-staff-queue", eventKey);
      await requireCurrentShopPermission(context.session, "canManageQueue", transaction);
      const replayedId = await readReplay2(transaction, eventKey, shopId, request);
      if (replayedId) return { queueEntryId: replayedId, replayed: true };
      await assertQueueChoices(transaction, shopId, serviceId, barberId);
      if (phone) {
        await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-public-queue", `${shopId}:${phone.replace(/\D/g, "")}`);
        const existing = await transaction.walkInQueueEntry.findFirst({ where: { shopId, phone, status: { in: ["waiting", "texted", "in_chair"] } }, select: { id: true } });
        if (existing) throw new Error("This phone number already has an active queue entry.");
      }
      const created = await transaction.walkInQueueEntry.create({
        data: { shopId, customerName, phone, partySize, status: "waiting", quotedWaitMinutes, notes, requestedServiceId: serviceId || null, requestedBarberId: barberId || null },
        select: { id: true, status: true, createdAt: true }
      });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        eventKey,
        eventType: "queue.checked_in",
        aggregateType: "walk_in_queue_entry",
        aggregateId: created.id,
        shopId,
        occurredAt: created.createdAt,
        data: { command: { request, queueEntryId: created.id }, queueEntry: { id: created.id, status: created.status, requestedServiceId: serviceId || null, requestedBarberId: barberId || null, partySize, source: "operator" } }
      }));
      return { queueEntryId: created.id, status: created.status, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail3(safeError2(error, "Unable to add this walk-in. Refresh the queue before retrying."));
  }
}
async function assignWalkInQueueEntry(_root, args, context) {
  if (!permissions.canManageQueue({ session: context.session })) return fail3("Not authorized to update walk-ins.");
  const queueEntryId = clean6(args.queueEntryId);
  const serviceId = clean6(args.requestedServiceId);
  const barberId = clean6(args.requestedBarberId);
  const key = clean6(args.idempotencyKey);
  if (!queueEntryId || !serviceId) return fail3("Choose a service for this guest.");
  if (key.length < 8 || key.length > 200) return fail3("A valid request key is required.");
  let shopId;
  try {
    shopId = await requireCurrentShopPermission(context.session, "canManageQueue", context.prisma);
  } catch (error) {
    return fail3(safeError2(error, "Not authorized to manage this shop\u2019s queue."));
  }
  const request = canonicalJson({ queueEntryId, serviceId, barberId: barberId || null });
  const eventKey = `staff-queue-assign:${digest2(`${shopId}:${key}`)}:v1`;
  try {
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-walk-in", `queue:${queueEntryId}`);
      await requireCurrentShopPermission(context.session, "canManageQueue", transaction);
      const replayedId = await readReplay2(transaction, eventKey, shopId, request);
      if (replayedId) return { queueEntryId: replayedId, requestedServiceId: serviceId, requestedBarberId: barberId || null, replayed: true };
      const entry = await transaction.walkInQueueEntry.findFirst({ where: { id: queueEntryId, shopId }, select: { id: true, status: true, appointment: { select: { id: true } } } });
      if (!entry) throw new Error("Queue entry was not found in the active shop.");
      if (!["waiting", "texted"].includes(String(entry.status)) || entry.appointment) throw new Error("Only waiting guests can be reassigned.");
      await assertQueueChoices(transaction, shopId, serviceId, barberId);
      const updated = await transaction.walkInQueueEntry.update({ where: { id: entry.id }, data: { requestedServiceId: serviceId, requestedBarberId: barberId || null }, select: { id: true, updatedAt: true } });
      await recordCommandReceipt(transaction, buildCommandReceipt({
        eventKey,
        eventType: "queue.assigned",
        aggregateType: "walk_in_queue_entry",
        aggregateId: updated.id,
        shopId,
        occurredAt: updated.updatedAt,
        data: { command: { request, queueEntryId: updated.id }, queueEntry: { id: updated.id, requestedServiceId: serviceId, requestedBarberId: barberId || null } }
      }));
      return { queueEntryId: updated.id, requestedServiceId: serviceId, requestedBarberId: barberId || null, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail3(safeError2(error, "Unable to update this walk-in. Refresh the queue before retrying."));
  }
}
var import_node_crypto21;
var init_staffQueueEntries = __esm({
  "features/keystone/mutations/staffQueueEntries.ts"() {
    "use strict";
    import_node_crypto21 = require("node:crypto");
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_serializableTransaction();
  }
});

// features/keystone/mutations/managePublicAppointment.ts
function digest3(value) {
  return (0, import_node_crypto22.createHash)("sha256").update(value).digest("hex");
}
function fail4(error) {
  return { success: false, error, data: null };
}
async function assertRescheduleSlot(transaction, appointment, startsAt) {
  if (!appointment.serviceId || !appointment.barberId || !appointment.shopId || !appointment.chairId) throw new Error("This appointment is missing assigned capacity.");
  await lockBookingResources(transaction, { serviceId: appointment.serviceId, barberId: appointment.barberId, chairNumber: `${appointment.shopId}:${appointment.chairId}` });
  const [service, barber] = await Promise.all([
    transaction.service.findUnique({ where: { id: appointment.serviceId } }),
    transaction.barber.findUnique({ where: { id: appointment.barberId }, include: { chair: true } })
  ]);
  if (!service || service.status !== "active" || !barber || barber.status !== "active" || !barber.bookingEnabled || barber.chairId !== appointment.chairId || barber.chair?.status !== "active") {
    throw new Error("The assigned service, practitioner, or chair is no longer available.");
  }
  const durationMinutes = appointment.durationMinutes || service.durationMinutes || 30;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 6e4);
  const bufferMinutes = occupiedBufferMinutes(barber.bufferMinutes, service.bookingBufferMinutes);
  const occupiedEndsAt = new Date(endsAt.getTime() + bufferMinutes * 6e4);
  const shop = await transaction.shop.findUnique({ where: { id: appointment.shopId }, select: { timezone: true, hours: true } });
  const timeZone = shop?.timezone || "UTC";
  const { start, end } = dayRange(startsAt, timeZone);
  const minute = (value) => value <= start ? 0 : value >= end ? 1440 : shopMinute(value, timeZone);
  const [schedule, exceptions, shifts, appointments] = await Promise.all([
    transaction.barberSchedule.findFirst({ where: { barberId: appointment.barberId, dayOfWeek: dayKeyForDate(startsAt, timeZone), isWorking: true } }),
    transaction.scheduleException.findMany({ where: { shopId: appointment.shopId, status: "active", startsAt: { lt: occupiedEndsAt }, endsAt: { gt: startsAt }, OR: [{ barberId: appointment.barberId }, { chairId: appointment.chairId }, { exceptionType: "shop_closure", barberId: null, chairId: null }] } }),
    transaction.staffShift.findMany({ where: { shopId: appointment.shopId, barberId: appointment.barberId, status: { in: ["scheduled", "clocked_in"] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } } }),
    transaction.appointment.findMany({ where: { id: { not: appointment.id }, shopId: appointment.shopId, status: { in: [...ACTIVE_STATUSES2] }, ...shopDayAppointmentCandidateFilter(start, end, bufferMinutes), OR: [{ barberId: appointment.barberId }, { chairId: appointment.chairId }] }, select: { id: true, startsAt: true, endsAt: true, durationMinutes: true, barberId: true, status: true }, take: MAX_BOOKING_CAPACITY_CANDIDATES + 1 })
  ]);
  assertAppointmentCandidateSetComplete(appointments);
  const blocking = exceptions.filter((item) => item.exceptionType !== "working_override");
  if (blocking.length) throw new Error(blocking[0].reason || "That time is blocked.");
  if (shifts.length && !shifts.some((shift) => startsAt >= shift.scheduledStart && occupiedEndsAt <= shift.scheduledEnd)) throw new Error("That time is outside the barber\u2019s shift.");
  const override = exceptions.find((item) => item.exceptionType === "working_override");
  const effectiveSchedule = clipToPostedHours(override ? { ...schedule, id: override.id, barberId: appointment.barberId, dayOfWeek: dayKeyForDate(startsAt, timeZone), isWorking: true, startMinute: minute(override.startsAt), endMinute: minute(override.endsAt), breakStartMinute: null, breakEndMinute: null, notes: override.reason, createdAt: override.createdAt, updatedAt: override.updatedAt } : schedule, shop?.hours, dayKeyForDate(startsAt, timeZone));
  if (!isSlotAvailable({
    startsAt,
    timeZone,
    serviceDuration: durationMinutes + bufferMinutes,
    schedule: effectiveSchedule ? { ...effectiveSchedule, dayOfWeek: String(effectiveSchedule.dayOfWeek), barber: { id: barber.id, displayName: barber.displayName } } : null,
    appointments: appointments.map((item) => ({
      id: item.id,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt?.toISOString() || null,
      durationMinutes: item.durationMinutes || 30,
      status: item.status,
      barber: item.barberId ? { id: item.barberId } : null
    })),
    occupiedAppointmentBufferMinutes: bufferMinutes,
    blockingWindows: blocking.map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt, reason: item.reason }))
  })) {
    throw new Error("That slot is unavailable. Choose another time.");
  }
  const authority = await requireEffectivePractitionerAuthority(transaction, { shopId: appointment.shopId, barberId: appointment.barberId, serviceId: appointment.serviceId, at: startsAt });
  return { endsAt, authority };
}
async function managePublicAppointment(_root, args, context) {
  const action = args.action.trim().toLowerCase();
  const appointmentId = args.appointmentId.trim();
  const reason = args.reason.trim();
  const key = args.idempotencyKey.trim();
  const accessToken = args.accessToken?.trim() || "";
  const sessionItemId = context.session?.itemId || null;
  const preview = args.preview === true;
  if (!["cancel", "reschedule"].includes(action)) return fail4("Action must be cancel or reschedule.");
  if (!appointmentId || !accessToken && !sessionItemId || key.length < 8 || key.length > 200 || reason.length < 2 || reason.length > 1e3) return fail4("Enter a reason for the change.");
  const requestedStart = action === "reschedule" ? new Date(args.startsAt || "") : null;
  if (requestedStart && Number.isNaN(requestedStart.getTime())) return fail4("Choose a new appointment time.");
  const eventKey = `public-appointment-change:${appointmentId}:${digest3(key)}`;
  try {
    let staleCheckouts = [];
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-public-appointment", appointmentId);
      const appointment = await transaction.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment) throw new Error("Appointment not found.");
      assertAppointmentAccess({ token: accessToken, storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId });
      const prior = (await transaction.$queryRawUnsafe('SELECT action, reason, "nextStartsAt", "appointment" AS "appointmentId", "feeAmount", "depositConsequence" FROM "AppointmentChangeEvent" WHERE "eventKey" = $1 LIMIT 1', eventKey))[0];
      if (prior) {
        if (prior.appointmentId !== appointmentId || prior.action !== (action === "cancel" ? "cancelled" : "rescheduled") || prior.reason !== reason || requestedStart && prior.nextStartsAt?.getTime() !== requestedStart.getTime()) throw new Error("This change request was already used with different details. Reload the page and try again.");
        return { appointmentId, action, replayed: true, startsAt: prior.nextStartsAt?.toISOString() || null, feeAmount: prior.feeAmount ?? 0, depositConsequence: prior.depositConsequence || "none" };
      }
      if (requestedStart && requestedStart <= /* @__PURE__ */ new Date()) throw new Error("Choose a future appointment time.");
      if (!["requested", "confirmed"].includes(appointment.status || "")) throw new Error("Only requested or confirmed appointments can be changed online. Contact the shop.");
      if (appointment.startsAt <= /* @__PURE__ */ new Date()) throw new Error("This appointment has already started. Contact the shop to change it.");
      if (!appointment.shopId || !appointment.serviceId || !appointment.barberId || !appointment.customerId) throw new Error("This appointment must be changed by the shop.");
      const snapshot = (await transaction.$queryRawUnsafe('SELECT "bookingPolicySnapshot", "bookingAuthoritySnapshot", "customerRescheduleCount" FROM "Appointment" WHERE id = $1 FOR UPDATE', appointmentId))[0];
      if (!snapshot?.bookingPolicySnapshot || !snapshot.bookingAuthoritySnapshot) throw new Error("This appointment must be changed by the shop.");
      const consequence = appointmentChangeConsequences({ action, startsAt: appointment.startsAt, now: /* @__PURE__ */ new Date(), paymentStatus: appointment.paymentStatus, depositAmount: appointment.depositAmount, policy: snapshot.bookingPolicySnapshot, priorReschedules: snapshot.customerRescheduleCount });
      let nextStartsAt = null;
      let nextEndsAt = null;
      let nextAuthority = snapshot.bookingAuthoritySnapshot;
      const slot = action === "reschedule" && requestedStart ? await assertRescheduleSlot(transaction, appointment, requestedStart) : null;
      if (preview) {
        return { appointmentId, action, preview: true, startsAt: requestedStart?.toISOString() || appointment.startsAt.toISOString(), feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, policyName: snapshot.bookingPolicySnapshot.name, policyVersion: snapshot.bookingPolicySnapshot.version };
      }
      if (args.acceptedFeeAmount == null || args.acceptedFeeAmount !== consequence.feeAmount) {
        throw new Error("The change fee is different from what you reviewed. Review the change again before confirming.");
      }
      if (slot && requestedStart) {
        nextStartsAt = requestedStart;
        nextEndsAt = slot.endsAt;
        nextAuthority = slot.authority;
        await transaction.$executeRawUnsafe('UPDATE "Appointment" SET "startsAt" = $2, "endsAt" = $3, "bookingAuthoritySnapshot" = $4::jsonb, "customerRescheduleCount" = "customerRescheduleCount" + 1, "updatedAt" = $5 WHERE id = $1', appointmentId, nextStartsAt, nextEndsAt, JSON.stringify(nextAuthority), /* @__PURE__ */ new Date());
      } else {
        await transaction.appointment.update({ where: { id: appointmentId }, data: { status: "cancelled", cancellationReason: reason } });
        staleCheckouts = await closeOpenDepositSessions(transaction, appointmentId);
      }
      const occurredAt = /* @__PURE__ */ new Date();
      const actorReference = appointment.accountId ? `account:${appointment.accountId}` : appointment.publicAccessTokenHash || "";
      await transaction.$executeRawUnsafe(`INSERT INTO "AppointmentChangeEvent" (id, "eventKey", action, "actorType", "actorReferenceHash", reason, "previousStartsAt", "previousEndsAt", "nextStartsAt", "nextEndsAt", "policySnapshot", "authoritySnapshot", "feeAmount", "depositConsequence", "occurredAt", "shop", "appointment", "createdAt", "updatedAt") VALUES ($1,$2,$3::"AppointmentChangeEventActionType",'customer',$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::"AppointmentChangeEventDepositConsequenceType",$14,$15,$16,$14,$14)`, (0, import_node_crypto22.randomUUID)(), eventKey, action === "cancel" ? "cancelled" : "rescheduled", digest3(actorReference), reason, appointment.startsAt, appointment.endsAt, nextStartsAt, nextEndsAt, JSON.stringify(snapshot.bookingPolicySnapshot), JSON.stringify(nextAuthority), consequence.feeAmount, consequence.depositConsequence, occurredAt, appointment.shopId, appointment.id);
      await recordCommandReceipt(transaction, buildCommandReceipt({ eventKey: `${eventKey}:receipt`, eventType: action === "cancel" ? "appointment.customer_cancelled" : "appointment.customer_rescheduled", aggregateType: "appointment", aggregateId: appointment.id, shopId: appointment.shopId, occurredAt, data: { appointmentId, action, previousStartsAt: appointment.startsAt.toISOString(), nextStartsAt: nextStartsAt?.toISOString() || null, feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, policy: snapshot.bookingPolicySnapshot, authority: nextAuthority } }));
      return { appointmentId, action, startsAt: nextStartsAt?.toISOString() || appointment.startsAt.toISOString(), feeAmount: consequence.feeAmount, depositConsequence: consequence.depositConsequence, replayed: false };
    });
    await Promise.all(staleCheckouts.map((id) => expireAtStripe(id)));
    return { success: true, error: null, data };
  } catch (error) {
    return fail4(error instanceof Error && !error.message.includes("Invalid `") ? error.message : "Unable to change this appointment. Contact the shop.");
  }
}
var import_node_crypto22, ACTIVE_STATUSES2;
var init_managePublicAppointment = __esm({
  "features/keystone/mutations/managePublicAppointment.ts"() {
    "use strict";
    import_node_crypto22 = require("node:crypto");
    init_expireStalePaymentSessions();
    init_shop_time();
    init_availability();
    init_shop_hours();
    init_bookingCapacity();
    init_bookingPolicy();
    init_commandReceipt();
    init_practitionerAuthority();
    init_waiverEvidence();
    ACTIVE_STATUSES2 = ["requested", "confirmed", "checked_in", "in_chair"];
  }
});

// features/keystone/mutations/signPublicWaiver.ts
function hash7(value) {
  return (0, import_node_crypto23.createHash)("sha256").update(value).digest("hex");
}
function fail5(error) {
  return { success: false, error, data: null };
}
async function signPublicWaiver(_root, args, context) {
  const appointmentId = args.appointmentId.trim();
  const idempotencyKey = args.idempotencyKey.trim();
  const accessToken = args.accessToken?.trim() || "";
  const sessionItemId = context.session?.itemId || null;
  if (!appointmentId || !accessToken && !sessionItemId || idempotencyKey.length < 8 || idempotencyKey.length > 200) return fail5("This appointment link is invalid. Open it again from your confirmation.");
  let signer;
  try {
    signer = assertWaiverSigner(args);
  } catch (error) {
    return fail5(error instanceof Error ? error.message : "Invalid signer evidence.");
  }
  const signatureKeyHash = hash7(`${appointmentId}:${idempotencyKey}`);
  try {
    const data = await runSerializableBookingTransaction(context.prisma, async (rawTransaction) => {
      const transaction = rawTransaction;
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-public-waiver", appointmentId);
      const appointment = await transaction.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment) throw new Error("Appointment not found.");
      assertAppointmentAccess({ token: accessToken, storedHash: appointment.publicAccessTokenHash, accountId: appointment.accountId, sessionItemId });
      const existing = (await transaction.$queryRawUnsafe('SELECT id, "signedByName", "signerRole", "guardianName" FROM "WaiverForm" WHERE "signatureKeyHash" = $1 LIMIT 1', signatureKeyHash))[0];
      if (existing) {
        if (existing.signedByName !== signer.signerName || existing.signerRole !== signer.signerRole || (existing.guardianName || "") !== signer.guardianName) throw new Error("This waiver was already signed with different details. Reload the page.");
        return { waiverId: existing.id, replayed: true };
      }
      if (!["requested", "confirmed", "checked_in"].includes(appointment.status || "")) throw new Error("This appointment can no longer accept a waiver.");
      if (!appointment.shopId || !appointment.customerId || !appointment.serviceId) throw new Error("Appointment waiver linkage is incomplete.");
      const requirement = await getAppointmentWaiverRequirement(transaction, appointment.id);
      if (!requirement.required) throw new Error("This service does not require a waiver.");
      const occurredAt = /* @__PURE__ */ new Date();
      const waiverId = (0, import_node_crypto23.randomUUID)();
      const affirmationHash = hash7(JSON.stringify({ appointmentId, serviceId: appointment.serviceId, customerId: appointment.customerId, templateKey: requirement.templateKey, templateVersion: requirement.templateVersion, templateHash: requirement.templateHash, signerName: signer.signerName, signerRole: signer.signerRole, guardianName: signer.guardianName, affirmation: true, signedAt: occurredAt.toISOString() }));
      await transaction.$executeRawUnsafe(`INSERT INTO "WaiverForm" (id, title, "waiverType", status, "templateKey", "templateVersion", "templateHash", "signatureKeyHash", "signedByName", "signerRole", "guardianName", affirmation, "affirmationHash", "signedAt", metadata, "shop", "customer", "appointment", "service", "createdAt", "updatedAt") VALUES ($1,$2,'service','signed',$3,$4,$5,$6,$7,$8,$9,true,$10,$11,$12::jsonb,$13,$14,$15,$16,$11,$11)`, waiverId, `${requirement.templateKey} ${requirement.templateVersion}`, requirement.templateKey, requirement.templateVersion, requirement.templateHash, signatureKeyHash, signer.signerName, signer.signerRole, signer.guardianName || null, affirmationHash, occurredAt, JSON.stringify({ source: "public_appointment", signerControlled: true }), appointment.shopId, appointment.customerId, appointment.id, appointment.serviceId);
      await recordCommandReceipt(transaction, buildCommandReceipt({ eventKey: `waiver:${waiverId}:signed:v1`, eventType: "waiver.signed", aggregateType: "waiver", aggregateId: waiverId, shopId: appointment.shopId, occurredAt, data: { waiverId, appointmentId, serviceId: appointment.serviceId, customerId: appointment.customerId, templateKey: requirement.templateKey, templateVersion: requirement.templateVersion, templateHash: requirement.templateHash, signerRole: signer.signerRole, guardianAuthorityRecorded: signer.signerRole === "guardian", signedAt: occurredAt.toISOString(), affirmationHash } }));
      return { waiverId, templateKey: requirement.templateKey, templateVersion: requirement.templateVersion, signedAt: occurredAt.toISOString(), replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return fail5(error instanceof Error ? error.message : "Unable to record waiver evidence.");
  }
}
var import_node_crypto23;
var init_signPublicWaiver = __esm({
  "features/keystone/mutations/signPublicWaiver.ts"() {
    "use strict";
    import_node_crypto23 = require("node:crypto");
    init_bookingCapacity();
    init_commandReceipt();
    init_waiverEvidence();
  }
});

// features/keystone/mutations/setPractitionerCredentialStatus.ts
function hash8(value) {
  return (0, import_node_crypto24.createHash)("sha256").update(value).digest("hex");
}
async function setPractitionerCredentialStatus(_root, args, context) {
  if (!permissions.canManageStaff({ session: context.session })) return { success: false, error: "Not authorized to manage practitioner authority.", data: null };
  const credentialId = args.credentialId.trim();
  const status = args.status.trim();
  const reason = args.reason.trim();
  const key = args.idempotencyKey.trim();
  if (!credentialId || !["suspended", "revoked", "expired"].includes(status) || reason.length < 2 || reason.length > 1e3 || key.length < 8 || key.length > 200) return { success: false, error: "Credential, terminal status, reason, and idempotency key are required.", data: null };
  try {
    const data = await runSerializableTransaction(context.prisma, async (client) => {
      const transaction = client;
      const shopId = await requireCurrentShopPermission(context.session, "canManageStaff", transaction);
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "barbershop-practitioner-credential", credentialId);
      const rows = await transaction.$queryRawUnsafe('SELECT id, "shop" AS "shopId", status, "barber" AS "barberId", "service" AS "serviceId", "evidenceHash" FROM "PractitionerCredential" WHERE id = $1 AND "shop" = $2 FOR UPDATE', credentialId, shopId);
      const credential = rows[0];
      if (!credential) throw new Error("Practitioner credential not found.");
      const eventKey = `credential:${credentialId}:status:${hash8(key)}`;
      const replay = await transaction.commandReceipt.findUnique({ where: { eventKey } });
      if (replay) {
        const payload = replay.payload;
        if (payload?.data?.status !== status || payload.data.reason !== reason) throw new Error("Idempotency key was reused with different credential status evidence.");
        return { credentialId, status, replayed: true };
      }
      if (credential.status !== "active") throw new Error("Only an active credential can transition to a terminal authority status.");
      const occurredAt = /* @__PURE__ */ new Date();
      await transaction.$executeRawUnsafe(`UPDATE "PractitionerCredential" SET status = $2, "updatedAt" = $3 WHERE id = $1 AND status = 'active'`, credentialId, status, occurredAt);
      await recordCommandReceipt(transaction, buildCommandReceipt({ actorId: context.session?.itemId, eventKey, eventType: `practitioner_credential.${status}`, aggregateType: "practitioner_credential", aggregateId: credentialId, shopId: credential.shopId, occurredAt, data: { status, previousStatus: credential.status, reason, barberId: credential.barberId, serviceId: credential.serviceId, evidenceHash: credential.evidenceHash, actorId: context.session?.itemId ?? null } }));
      return { credentialId, status, replayed: false };
    });
    return { success: true, error: null, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update practitioner authority.", data: null };
  }
}
var import_node_crypto24;
var init_setPractitionerCredentialStatus = __esm({
  "features/keystone/mutations/setPractitionerCredentialStatus.ts"() {
    "use strict";
    import_node_crypto24 = require("node:crypto");
    init_access();
    init_currentAuthorization();
    init_commandReceipt();
    init_serializableTransaction();
  }
});

// features/keystone/utils/storefrontSettingsInput.ts
function validLogo(svg) {
  const sanitized = sanitizeStoreLogoSvg(svg);
  if (!sanitized) throw new Error("Invalid SVG format.");
  return sanitized;
}
function boundedText(value, label, max, required = false) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (required && !normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}
function parseStorefrontSettingsInput(args) {
  const currencyCode = boundedText(args.currencyCode, "Currency code", 3, true).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("Currency code must be a three-letter ISO code.");
  assertUsdSettlementCurrency(currencyCode);
  const timezone = boundedText(args.timezone, "Timezone", 100, true);
  if (!/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(timezone)) {
    throw new Error("Timezone must be an IANA timezone such as America/New_York.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }
  let hours;
  if (args.hours !== void 0 && args.hours !== null) {
    const normalized = normalizeShopHours(args.hours);
    if ("error" in normalized) throw new Error(normalized.error);
    hours = normalized.hours;
  }
  return {
    ...hours ? { hours } : {},
    name: boundedText(args.name, "Shop name", 120, true),
    tagline: boundedText(args.tagline, "Tagline", 240),
    address: boundedText(args.address, "Address", 300),
    phone: boundedText(args.phone, "Phone", 40),
    timezone,
    currencyCode,
    brandColor: requireStorefrontBrandColor(args.brandColor),
    ...args.logoIcon === void 0 ? {} : { logoIcon: validLogo(args.logoIcon) },
    ...args.logoColor === void 0 ? {} : { logoColor: normalizeStoreLogoColor(args.logoColor) },
    isPublic: Boolean(args.isPublic)
  };
}
var init_storefrontSettingsInput = __esm({
  "features/keystone/utils/storefrontSettingsInput.ts"() {
    "use strict";
    init_sanitize_store_logo();
    init_store_logo();
    init_storefront_settings();
    init_supportedSettlementCurrency();
    init_shop_hours();
  }
});

// features/keystone/mutations/manageStorefrontSettings.ts
async function getActiveShopStorefrontSettings(_root, _args, context) {
  const shopId = await requireCurrentShopPermission(context.session, "canManageOnboarding");
  return context.query.Shop.findOne({
    where: { id: shopId },
    query: STOREFRONT_SETTINGS_SELECTION
  });
}
async function updateActiveShopStorefrontSettings(_root, args, context) {
  try {
    const shopId = await requireCurrentShopPermission(context.session, "canManageOnboarding");
    const { expectedShopId, expectedVersion, ...input } = args;
    const data = parseStorefrontSettingsInput(input);
    if (expectedShopId || expectedVersion) {
      if (expectedShopId && expectedShopId !== shopId) throw new SettingsConflict("Your active shop changed since this form was loaded. Your changes were not saved. Reload to edit the current shop.");
      await context.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe('SELECT "updatedAt" FROM "Shop" WHERE id = $1 FOR UPDATE', shopId);
        if (!rows[0]) throw new SettingsConflict("This shop could not be found. Reload and try again.");
        const currentVersion = rows[0].updatedAt ? new Date(rows[0].updatedAt).toISOString() : "";
        if (expectedVersion && currentVersion !== new Date(expectedVersion).toISOString()) {
          throw new SettingsConflict("These settings were changed elsewhere since you loaded them. Your changes were not saved. Reload to see the latest settings.");
        }
        await tx.shop.update({ where: { id: shopId }, data });
      }, { isolationLevel: "Serializable" });
      const shop2 = await context.query.Shop.findOne({ where: { id: shopId }, query: STOREFRONT_SETTINGS_SELECTION });
      return { success: true, error: null, conflict: false, data: shop2 };
    }
    const shop = await context.query.Shop.updateOne({
      where: { id: shopId },
      data,
      query: STOREFRONT_SETTINGS_SELECTION
    });
    return { success: true, error: null, conflict: false, data: shop };
  } catch (error) {
    return {
      success: false,
      conflict: error instanceof SettingsConflict,
      error: error instanceof Error && !error.message.includes("Invalid `") ? error.message : "Unable to update storefront settings.",
      data: null
    };
  }
}
var STOREFRONT_SETTINGS_SELECTION, SettingsConflict;
var init_manageStorefrontSettings = __esm({
  "features/keystone/mutations/manageStorefrontSettings.ts"() {
    "use strict";
    init_currentAuthorization();
    init_storefrontSettingsInput();
    STOREFRONT_SETTINGS_SELECTION = "id name tagline address phone timezone currencyCode hours brandColor logoIcon logoColor isPublic updatedAt";
    SettingsConflict = class extends Error {
    };
  }
});

// features/shared/receipt-net.ts
function netReceiptTotal(receipt) {
  const total = receipt.total || 0;
  if (total < 0) return total;
  if (receipt.status === "refunded") return 0;
  return Math.max(0, total - (receipt.paymentSession?.refundedAmount || 0) - (receipt.cashRefund?.amount || 0));
}
var init_receipt_net = __esm({
  "features/shared/receipt-net.ts"() {
    "use strict";
  }
});

// features/keystone/utils/serviceCatalogProjection.ts
function uncategorizedServiceWhere(shopId) {
  return { shopId, categoryId: null };
}
function countProjectedServices(categories, uncategorizedServices) {
  return categories.reduce((count, category) => count + category.services.length, 0) + uncategorizedServices.length;
}
var init_serviceCatalogProjection = __esm({
  "features/keystone/utils/serviceCatalogProjection.ts"() {
    "use strict";
  }
});

// features/keystone/utils/customerDuplicates.ts
function phoneKey(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}
function emailKey(email) {
  return (email || "").trim().toLowerCase();
}
function duplicateHint(customer, others) {
  const phone = phoneKey(customer.phone);
  const email = emailKey(customer.email);
  if (!phone && !email) return null;
  let byPhone = false;
  let byEmail = false;
  const ids = /* @__PURE__ */ new Set();
  for (const other of others) {
    if (other.id === customer.id) continue;
    const samePhone = Boolean(phone) && phoneKey(other.phone) === phone;
    const sameEmail = Boolean(email) && emailKey(other.email) === email;
    if (samePhone) byPhone = true;
    if (sameEmail) byEmail = true;
    if (samePhone || sameEmail) ids.add(other.id);
  }
  if (!ids.size) return null;
  return {
    count: ids.size,
    matchedOn: byPhone && byEmail ? "phone and email" : byPhone ? "phone" : "email",
    // Search by what matched so the directory lists both records for the merge.
    search: byPhone ? (customer.phone || "").trim() : (customer.email || "").trim()
  };
}
function duplicateCandidateWhere(customer) {
  const phone = phoneKey(customer.phone);
  const email = emailKey(customer.email);
  const or = [];
  if (phone) or.push({ phone: { contains: phone.slice(-4) } });
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  return or.length ? { id: { not: { equals: customer.id } }, OR: or } : null;
}
var init_customerDuplicates = __esm({
  "features/keystone/utils/customerDuplicates.ts"() {
    "use strict";
  }
});

// features/keystone/queries/getPlatformProjections.ts
async function loadOperationsGroomingNotes(context, shopId) {
  const access = async (permission) => await currentShopForPermission(context.session, permission, context.prisma) === shopId ? "granted" : "restricted";
  const notesAccess = await access("canManageCustomerNotes");
  if (notesAccess === "restricted") {
    return { notesAccess, notesCustomerAccess: "restricted", notesStaffAccess: "restricted", notes: null };
  }
  const [notesCustomerAccess, notesStaffAccess] = await Promise.all([access("canManageCustomers"), access("canManageStaff")]);
  const rows = await context.query.GroomingNote.findMany({
    where: { shop: { id: { equals: shopId } } },
    orderBy: [{ createdAt: "desc" }],
    take: GROOMING_NOTE_LIMIT,
    query: `id title noteType privateToStaff${notesCustomerAccess === "granted" ? " customer { id firstName lastName }" : ""}${notesStaffAccess === "granted" ? " barber { id displayName }" : ""}`
  });
  const notes = rows.map((item) => {
    const customer = notesCustomerAccess === "granted" ? item.customer : null;
    const barber = notesStaffAccess === "granted" ? item.barber : null;
    const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";
    return {
      id: String(item.id),
      title: item.title ?? null,
      noteType: item.noteType ?? null,
      privateToStaff: item.privateToStaff ?? null,
      customer: customer ? { id: customer.id, name: customerName || null } : null,
      barber: barber ? { id: barber.id, name: barber.displayName ?? null } : null
    };
  });
  return { notesAccess, notesCustomerAccess, notesStaffAccess, notes };
}
async function loadPreferredBarbers(context, shopId, preferredBarberIds) {
  const staffAccess = await currentShopForPermission(context.session, "canManageStaff", context.prisma) === shopId ? "granted" : "restricted";
  const barberIds = [...new Set(preferredBarberIds.filter((id) => typeof id === "string" && id.length > 0))].slice(0, PREFERRED_BARBER_LIMIT);
  const barbers = staffAccess === "granted" && barberIds.length ? await context.query.Barber.findMany({
    where: { shop: { id: { equals: shopId } }, id: { in: barberIds } },
    take: barberIds.length,
    query: "id displayName chairNumber"
  }) : [];
  const barbersById = new Map(barbers.map((barber) => [String(barber.id), barber]));
  return { staffAccess, barbersById };
}
async function sameShopAccess(context, permission, shopId) {
  return await currentShopForPermission(context.session, permission, context.prisma) === shopId ? "granted" : "restricted";
}
async function loadProtectedCustomerRelations(context, shopId, customerIds, options = {}) {
  const planSearch = options.planSearch?.trim().slice(0, 120) || "";
  const [appointmentsAccess, paymentsAccess, membershipsAccess] = await Promise.all([
    sameShopAccess(context, "canManageAppointments", shopId),
    sameShopAccess(context, "canManagePayments", shopId),
    sameShopAccess(context, "canManageMemberships", shopId)
  ]);
  const shopFilter = { shop: { id: { equals: shopId } } };
  const appointmentSelection = `id startsAt status paymentStatus price durationMinutes serviceTitleSnapshot barberNameSnapshot${paymentsAccess === "granted" ? " transaction { id total paymentMethod completedAt }" : ""}`;
  const [appointmentsByCustomer, transactionsByCustomer, membershipReads] = await Promise.all([
    appointmentsAccess === "granted" ? Promise.all(customerIds.map((customerId) => context.query.Appointment.findMany({
      where: { ...shopFilter, customer: { id: { equals: customerId } } },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: 5,
      query: appointmentSelection
    }))) : Promise.resolve(customerIds.map(() => null)),
    paymentsAccess === "granted" ? Promise.all(customerIds.map((customerId) => context.query.CheckoutTransaction.findMany({
      where: { ...shopFilter, customer: { id: { equals: customerId } } },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: 5,
      query: "id status total paymentMethod completedAt"
    }))) : Promise.resolve(customerIds.map(() => null)),
    membershipsAccess === "granted" ? Promise.all([
      Promise.all(customerIds.map((customerId) => context.query.CustomerPackage.findMany({
        // Expired/used-up balances stay visible so their original record can be renewed.
        where: { ...shopFilter, customer: { id: { equals: customerId } }, status: { in: ["active", "paused", "expired", "used_up"] } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 5,
        query: "id remainingVisits status expiresAt nextBillingAt autoRenew servicePackage { id name } membershipPlan { id name billingInterval price includedVisits }"
      }))),
      context.query.MembershipPlan.findMany({
        where: { ...shopFilter, status: { equals: "active" }, ...planSearch ? { name: { contains: planSearch, mode: "insensitive" } } : {} },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: MEMBERSHIP_PLAN_LIMIT + 1,
        query: "id name price includedVisits billingInterval"
      }),
      context.query.CustomerPackage.count({ where: { ...shopFilter, status: { equals: "active" } } }),
      context.query.ServicePackage.findMany({
        where: { ...shopFilter, status: { equals: "active" }, ...planSearch ? { name: { contains: planSearch, mode: "insensitive" } } : {} },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: MEMBERSHIP_PLAN_LIMIT + 1,
        query: "id name price items { quantity }"
      })
    ]) : Promise.resolve(null)
  ]);
  const [balancesByCustomer, planRows, packageHolders, packageRows] = membershipReads ?? [customerIds.map(() => null), null, null, null];
  const servicePackages = packageRows ? packageRows.slice(0, MEMBERSHIP_PLAN_LIMIT).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    price: Number(row.price) || 0,
    visits: (row.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)
  })) : null;
  const servicePackagesTruncated = Boolean(packageRows && packageRows.length > MEMBERSHIP_PLAN_LIMIT);
  const membershipPlansTruncated = Boolean(planRows && planRows.length > MEMBERSHIP_PLAN_LIMIT);
  const membershipPlans = planRows ? planRows.slice(0, MEMBERSHIP_PLAN_LIMIT) : null;
  return {
    access: { appointments: appointmentsAccess, payments: paymentsAccess, memberships: membershipsAccess },
    appointmentsByCustomer,
    transactionsByCustomer,
    balancesByCustomer,
    membershipPlans,
    membershipPlansTruncated,
    servicePackages,
    servicePackagesTruncated,
    packageHolders
  };
}
async function scope(context, permission, message) {
  if (!permissions.canAccessDashboard({ session: context.session })) throw new Error(message);
  try {
    const shopId = await requireCurrentShopPermission(context.session, permission, context.prisma);
    const dependencies = {
      // The board lists barbers and services through the projection itself, so front desk and
      // barber (who manage appointments and the queue but not the catalog) are not locked out.
      canManageAppointments: ["canManageCustomers"],
      canManageQueue: ["canManageCustomers", "canManageAppointments"],
      canViewReports: ["canManageAppointments", "canManagePayments", "canManageQueue", "canManageSchedules", "canManageStaff", "canManageMemberships"],
      canManageSchedules: ["canManageStaff"]
    };
    for (const required of dependencies[permission] || []) await requireCurrentShopPermission(context.session, required, context.prisma);
    return shopId;
  } catch (error) {
    if (error instanceof Error && /revoked|changed|active shop/i.test(error.message)) throw error;
    throw new Error(message);
  }
}
async function shopTimeZone(prisma, shopId) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  return shop?.timezone || "UTC";
}
async function getBookingProjection(_root, args, context) {
  const shopId = await scope(context, "canManageAppointments", "Not authorized to access booking operations.");
  const shop = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  if (!shop?.timezone) throw new Error("Shop timezone is not configured. Set it in Store Settings.");
  const timeZone = shop.timezone;
  const { start, end } = shopDayRange(args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : /* @__PURE__ */ new Date(), timeZone);
  const status = args.status && BOOKING_STATUSES.includes(args.status) ? args.status : null;
  const page = Math.max(1, Math.floor(Number(args.page) || 1));
  const dayWhere = { shopId, startsAt: { gte: start, lt: end } };
  const listWhere = { ...dayWhere, ...status ? { status } : {} };
  const canRefund = await currentShopForPermission(context.session, "canManagePayments", context.prisma) === shopId;
  const [appointments, matching, grouped, bookedValue, barbers, services] = await Promise.all([
    context.prisma.appointment.findMany({
      where: listWhere,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * BOOKING_PAGE_SIZE,
      take: BOOKING_PAGE_SIZE,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        durationMinutes: true,
        status: true,
        source: true,
        paymentStatus: true,
        price: true,
        depositAmount: true,
        customerNotes: true,
        internalNotes: true,
        bookingPolicySnapshot: true,
        serviceTitleSnapshot: true,
        barberNameSnapshot: true,
        barberChairNumberSnapshot: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
        barber: { select: { id: true, displayName: true, chairNumber: true } },
        service: { select: { id: true, name: true, durationMinutes: true, price: true, color: true } },
        noShowEvents: { orderBy: { markedAt: "desc" }, take: 1, select: { id: true, feeAmount: true, feeWaived: true, markedAt: true } }
      }
    }),
    context.prisma.appointment.count({ where: listWhere }),
    context.prisma.appointment.groupBy({ by: ["status"], where: dayWhere, _count: true }),
    context.prisma.appointment.aggregate({ where: { ...dayWhere, status: { notIn: ["cancelled", "no_show"] } }, _sum: { price: true } }),
    context.prisma.barber.findMany({ where: { shopId, status: "active" }, orderBy: [{ displayName: "asc" }, { id: "asc" }], select: {
      id: true,
      displayName: true,
      chairNumber: true,
      bookingEnabled: true,
      schedules: { where: { dayOfWeek: dayKeyForDate(shopDateKey(start, timeZone), timeZone), isWorking: true }, select: { startMinute: true, endMinute: true } },
      scheduleExceptions: { where: { status: "active", exceptionType: "time_off", startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } }
    } }),
    context.prisma.service.findMany({ where: { shopId, status: "active" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, durationMinutes: true, price: true, depositRequired: true, specialists: { select: { id: true } } } })
  ]);
  const depositRows = canRefund && appointments.length ? await context.prisma.paymentSession.findMany({
    where: { shopId, appointmentId: { in: appointments.map((item) => item.id) }, status: { in: ["captured", "partially_refunded", "refunded"] }, transaction: { is: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, appointmentId: true, status: true, amount: true, refundedAmount: true, paymentProvider: { select: { code: true } } }
  }) : [];
  const depositsByAppointment = /* @__PURE__ */ new Map();
  for (const { appointmentId, paymentProvider, ...session } of depositRows) {
    if (!appointmentId) continue;
    const list49 = depositsByAppointment.get(appointmentId) || [];
    list49.push({ ...session, status: session.status ? String(session.status) : null, processor: paymentProvider ? paymentProviderSettlement(paymentProvider) === "processor" : false });
    depositsByAppointment.set(appointmentId, list49);
  }
  const dayBarbers = barbers.map(({ schedules, scheduleExceptions, ...barber }) => ({
    ...barber,
    workingDay: schedules.length > 0 && scheduleExceptions.length === 0,
    dayStartMinute: schedules[0]?.startMinute ?? null,
    dayEndMinute: schedules[0]?.endMinute ?? null
  }));
  const counted = Object.fromEntries(grouped.map((item) => [String(item.status), item._count]));
  const statusCounts = Object.fromEntries(BOOKING_STATUSES.map((value) => [value, counted[value] || 0]));
  const total = BOOKING_STATUSES.reduce((sum, value) => sum + statusCounts[value], 0);
  return {
    timeZone,
    date: shopDateKey(start, timeZone),
    status,
    page,
    pageSize: BOOKING_PAGE_SIZE,
    matching,
    canRefundDeposits: canRefund,
    appointments: appointments.map(({ bookingPolicySnapshot, ...appointment }) => ({
      ...appointment,
      bookingEligibility: bookingEligibilityFromSnapshot(bookingPolicySnapshot),
      depositSessions: canRefund ? depositsByAppointment.get(appointment.id) || [] : null
    })),
    barbers: dayBarbers,
    services: services.map(({ specialists, ...service }) => ({ ...service, specialistIds: specialists.map((item) => item.id) })),
    statusCounts,
    metrics: {
      scheduled: total,
      inShop: statusCounts.checked_in + statusCounts.in_chair,
      activeFlow: statusCounts.requested + statusCounts.confirmed + statusCounts.checked_in + statusCounts.in_chair,
      bookedValue: bookedValue._sum.price || 0
    }
  };
}
async function getQueueProjection(_root, args, context) {
  const shopId = await scope(context, "canManageQueue", "Not authorized to access queue operations.");
  const select38 = {
    id: true,
    customerName: true,
    phone: true,
    partySize: true,
    status: true,
    quotedWaitMinutes: true,
    checkedInAt: true,
    seatedAt: true,
    notes: true,
    requestedService: { select: { id: true, name: true, durationMinutes: true, price: true } },
    requestedBarber: { select: { id: true, displayName: true, chairNumber: true } },
    appointment: { select: { id: true, status: true, startsAt: true, serviceTitleSnapshot: true, barberNameSnapshot: true } },
    customer: { select: { id: true, firstName: true, lastName: true, phone: true } }
  };
  const search = args.search?.trim().slice(0, 120) || "";
  const page = Math.max(1, Math.floor(Number(args.page) || 1));
  const timeZone = await shopTimeZone(context.prisma, shopId);
  const { start: shopDayStart } = shopDayRange(/* @__PURE__ */ new Date(), timeZone);
  await context.prisma.walkInQueueEntry.updateMany({ where: { shopId, status: { in: ["waiting", "texted"] }, checkedInAt: { lt: shopDayStart } }, data: { status: "left" } });
  const activeWhere = {
    shopId,
    status: { in: ["waiting", "texted", "in_chair"] },
    ...search ? { OR: [{ customerName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}
  };
  const [active, activeMatching, served, grouped, services, barbers] = await Promise.all([
    context.prisma.walkInQueueEntry.findMany({ where: activeWhere, orderBy: [{ checkedInAt: "asc" }, { id: "asc" }], skip: (page - 1) * QUEUE_PAGE_SIZE, take: QUEUE_PAGE_SIZE, select: select38 }),
    context.prisma.walkInQueueEntry.count({ where: activeWhere }),
    context.prisma.walkInQueueEntry.findMany({ where: { shopId, status: "served" }, orderBy: [{ seatedAt: "desc" }, { id: "desc" }], take: 20, select: select38 }),
    context.prisma.walkInQueueEntry.groupBy({ by: ["status"], where: { shopId }, _count: true }),
    context.prisma.service.findMany({ where: { shopId, status: "active" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, durationMinutes: true, price: true, specialists: { select: { id: true } } } }),
    context.prisma.barber.findMany({ where: { shopId, status: "active", bookingEnabled: true }, orderBy: [{ displayName: "asc" }, { id: "asc" }], select: { id: true, displayName: true, chairNumber: true } })
  ]);
  const counts = Object.fromEntries(grouped.map((item) => [String(item.status), item._count]));
  const activeTotal = (counts.waiting || 0) + (counts.texted || 0) + (counts.in_chair || 0);
  return {
    active,
    served,
    counts,
    activeTotal,
    activeMatching,
    search,
    page,
    pageSize: QUEUE_PAGE_SIZE,
    timeZone,
    hasMoreActive: page * QUEUE_PAGE_SIZE < activeMatching,
    services: services.map(({ specialists, ...service }) => ({ ...service, specialistIds: specialists.map((item) => item.id) })),
    barbers
  };
}
function pageNumber(value) {
  return Math.max(1, Math.floor(Number(value) || 1));
}
async function getCustomersProjection(_root, args, context) {
  const shopId = await scope(context, "canManageCustomers", "Not authorized to access customer records.");
  const search = args.search?.trim().slice(0, 120) || "";
  const page = pageNumber(args.page);
  const isOwner = await hasCurrentOwnerMembership(context.session, shopId, context.prisma);
  const shopFilter = { shop: { id: { equals: shopId } } };
  const timeZone = await shopTimeZone(context.prisma, shopId);
  const customerSelection = "id firstName lastName phone email status preferredContactMethod acceptsMarketing lastVisitAt createdAt preferredBarber { id }";
  const directoryWhere = { ...shopFilter, ...search ? { OR: [
    { firstName: { contains: search, mode: "insensitive" } },
    { lastName: { contains: search, mode: "insensitive" } },
    { phone: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } }
  ] } : {} };
  const [pageCustomers, total, requested] = await Promise.all([
    context.query.Customer.findMany({
      where: directoryWhere,
      // Stable order: id breaks ties so paging never skips or repeats a customer.
      orderBy: [{ lastVisitAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      take: CUSTOMER_PAGE_SIZE,
      skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      query: customerSelection
    }),
    context.query.Customer.count({ where: directoryWhere }),
    // An explicitly requested customer resolves under the same shop scope even when off-page.
    args.customerId ? context.query.Customer.findMany({ where: { ...shopFilter, id: { equals: args.customerId } }, take: 1, query: customerSelection }) : Promise.resolve([])
  ]);
  const requestedCustomer = requested[0] && !pageCustomers.some((customer) => customer.id === requested[0].id) ? requested[0] : null;
  const customers = requestedCustomer ? [requestedCustomer, ...pageCustomers] : pageCustomers;
  const statuses = ["active", "vip", "needs_attention", "blocked"];
  const [statusCounts, waiversByCustomer, relations, preferred, appointmentCounts, duplicates] = await Promise.all([
    Promise.all(statuses.map((status) => context.query.Customer.count({ where: { ...shopFilter, status: { equals: status } } }))),
    Promise.all(customers.map((customer) => context.query.WaiverForm.findMany({ where: { ...shopFilter, customer: { id: { equals: customer.id } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: CUSTOMER_HISTORY_PREVIEW, query: "id title waiverType status signedAt createdAt" }))),
    loadProtectedCustomerRelations(context, shopId, customers.map((customer) => customer.id), { planSearch: args.planSearch }),
    loadPreferredBarbers(context, shopId, customers.map((customer) => customer.preferredBarber?.id)),
    // Full visit counts (the history preview is capped), only with appointment authority.
    sameShopAccess(context, "canManageAppointments", shopId).then((access) => access === "granted" ? Promise.all(customers.map((customer) => context.query.Appointment.count({ where: { ...shopFilter, customer: { id: { equals: customer.id } } } }))) : customers.map(() => null)),
    // Same-shop records sharing this phone or email: a staff hint only, never an automatic match.
    Promise.all(customers.map(async (customer) => {
      const where = duplicateCandidateWhere(customer);
      if (!where) return null;
      const others = await context.query.Customer.findMany({ where: { ...shopFilter, ...where }, take: 50, query: "id phone email" });
      return duplicateHint(customer, others);
    }))
  ]);
  const notesAccess = await currentShopForPermission(context.session, "canManageCustomerNotes", context.prisma) === shopId ? "granted" : "restricted";
  const noteVisibility = isOwner ? {} : { visibility: { equals: "staff" } };
  const [notesByCustomer, notesCount] = notesAccess === "granted" ? await Promise.all([
    Promise.all(customers.map((customer) => context.query.CustomerNote.findMany({
      where: { shop: { id: { equals: shopId } }, customer: { id: { equals: customer.id } }, ...noteVisibility },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: CUSTOMER_HISTORY_PREVIEW,
      query: CUSTOMER_NOTE_SELECTION
    }))),
    context.query.CustomerNote.count({ where: { shop: { id: { equals: shopId } }, ...noteVisibility } })
  ]) : [customers.map(() => null), null];
  return {
    timeZone,
    page,
    pageSize: CUSTOMER_PAGE_SIZE,
    total,
    requestedCustomerId: requestedCustomer?.id ?? null,
    historyPreviewLimit: CUSTOMER_HISTORY_PREVIEW,
    customers: customers.map((customer, index) => {
      const { preferredBarber, ...record } = customer;
      const preferredBarberId = preferredBarber?.id;
      const waivers = waiversByCustomer[index];
      return {
        ...record,
        waivers,
        notes: notesByCustomer[index],
        preferredBarber: preferred.staffAccess === "granted" && preferredBarberId ? preferred.barbersById.get(preferredBarberId) ?? null : null,
        appointments: relations.appointmentsByCustomer[index],
        appointmentsCount: appointmentCounts[index],
        possibleDuplicate: duplicates[index],
        transactions: relations.transactionsByCustomer[index],
        packageBalances: relations.balancesByCustomer[index]
      };
    }),
    membershipPlans: relations.membershipPlans,
    membershipPlansTruncated: relations.membershipPlansTruncated,
    servicePackages: relations.servicePackages,
    servicePackagesTruncated: relations.servicePackagesTruncated,
    counts: Object.fromEntries(statuses.map((status, index) => [status, statusCounts[index]])),
    packageHolders: relations.packageHolders,
    notesCount,
    notesAccess,
    appointmentsAccess: relations.access.appointments,
    paymentsAccess: relations.access.payments,
    membershipsAccess: relations.access.memberships,
    staffAccess: preferred.staffAccess
  };
}
async function getPosProjection(_root, args, context) {
  const shopId = await scope(context, "canManagePayments", "Not authorized to access POS settlement.");
  await expireStalePaymentSessions(context.prisma, shopId).catch(() => 0);
  for (const permission of ["canManageAppointments", "canManageCustomers", "canManageMemberships"]) await requireCurrentShopPermission(context.session, permission, context.prisma);
  const shop = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { currencyCode: true } });
  assertUsdSettlementCurrency(shop?.currencyCode);
  const timeZone = await shopTimeZone(context.prisma, shopId);
  const { start, end } = shopDayRange(/* @__PURE__ */ new Date(), timeZone);
  const now = /* @__PURE__ */ new Date();
  const ticketPage = pageNumber(args?.ticketPage), salePage = pageNumber(args?.salePage), receiptPage = pageNumber(args?.receiptPage);
  const ticketSearch = args?.ticketSearch?.trim().slice(0, 120) || "";
  const saleSearch = args?.saleSearch?.trim().slice(0, 120) || "";
  const receiptId = args?.receiptId?.trim().slice(0, 64) || "";
  const openTicketWhere = { shopId, status: { in: ["checked_in", "in_chair"] }, paymentStatus: { notIn: ["paid", "refunded"] } };
  const ticketWhere = { ...openTicketWhere, ...ticketSearch ? { OR: [
    { customer: { firstName: { contains: ticketSearch, mode: "insensitive" } } },
    { customer: { lastName: { contains: ticketSearch, mode: "insensitive" } } },
    { customer: { phone: { contains: ticketSearch } } },
    { serviceTitleSnapshot: { contains: ticketSearch, mode: "insensitive" } },
    { barberNameSnapshot: { contains: ticketSearch, mode: "insensitive" } }
  ] } : {} };
  const usableBalances = { status: "active", remainingVisits: { gt: 0 }, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] };
  const ticketSelect = {
    id: true,
    startsAt: true,
    status: true,
    paymentStatus: true,
    price: true,
    depositAmount: true,
    serviceId: true,
    serviceTitleSnapshot: true,
    barberNameSnapshot: true,
    barberChairNumberSnapshot: true,
    customer: { select: { id: true, firstName: true, lastName: true, phone: true, packageBalances: { where: usableBalances, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], select: { id: true, remainingVisits: true, expiresAt: true, servicePackage: { select: { id: true, name: true, items: { select: { serviceId: true } } } }, membershipPlan: { select: { id: true, name: true } } } } } }
  };
  const saleWhere = { shopId, lineType: "sale", ...saleSearch ? { OR: [
    { productNameSnapshot: { contains: saleSearch, mode: "insensitive" } },
    { skuSnapshot: { contains: saleSearch, mode: "insensitive" } },
    { transactionId: saleSearch }
  ] } : {} };
  const receiptWhere = { shopId, appointments: { some: {} }, status: { in: ["paid", "refunded", "partially_refunded"] }, ...receiptId ? { id: receiptId } : {} };
  const [appointments, ticketTotal2, outstanding, packageHolders, requested, products, productLines, saleTotal, receipts, receiptTotal, paidToday] = await Promise.all([
    context.prisma.appointment.findMany({ where: ticketWhere, orderBy: [{ status: "desc" }, { startsAt: "desc" }, { id: "asc" }], take: POS_PAGE_SIZE, skip: (ticketPage - 1) * POS_PAGE_SIZE, select: ticketSelect }),
    context.prisma.appointment.count({ where: ticketWhere }),
    context.prisma.appointment.aggregate({ where: openTicketWhere, _sum: { price: true } }),
    context.prisma.appointment.count({ where: { ...openTicketWhere, customer: { packageBalances: { some: usableBalances } } } }),
    // A handed-off appointment is resolved on its own, under this shop, regardless of page.
    args?.appointmentId ? context.prisma.appointment.findFirst({ where: { id: args.appointmentId, shopId }, select: ticketSelect }) : Promise.resolve(null),
    context.prisma.product.findMany({ where: { shopId, status: "active" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, sku: true, price: true, inventoryLots: { where: { status: "active" }, select: { quantityRemaining: true } } } }),
    context.prisma.productSaleLine.findMany({ where: saleWhere, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: POS_PAGE_SIZE, skip: (salePage - 1) * POS_PAGE_SIZE, select: { id: true, lineType: true, productNameSnapshot: true, skuSnapshot: true, quantity: true, unitPrice: true, subtotal: true, taxAmount: true, total: true, returnedQuantity: true, occurredAt: true, originalLineId: true, transactionId: true, transaction: { select: { paymentMethod: true } } } }),
    context.prisma.productSaleLine.count({ where: saleWhere }),
    context.prisma.checkoutTransaction.findMany({ where: receiptWhere, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: POS_PAGE_SIZE, skip: (receiptPage - 1) * POS_PAGE_SIZE, select: {
      id: true,
      status: true,
      subtotal: true,
      tipAmount: true,
      taxAmount: true,
      discountAmount: true,
      total: true,
      paymentMethod: true,
      paymentSessionId: true,
      currencyCode: true,
      completedAt: true,
      customer: { select: { id: true, firstName: true, lastName: true } },
      lineItems: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, price: true, durationMinutes: true, barberName: true, barberChairNumber: true, packageName: true, packageVisitsConsumed: true } },
      cashRefund: { select: { id: true, amount: true, reason: true, refundedAt: true } }
    } }),
    context.prisma.checkoutTransaction.count({ where: receiptWhere }),
    context.prisma.checkoutTransaction.count({ where: { shopId, status: "paid", completedAt: { gte: start, lt: end } } })
  ]);
  const eligible = (ticket) => ticket.customer ? {
    ...ticket,
    customer: { ...ticket.customer, packageBalances: ticket.customer.packageBalances.filter((balance) => Boolean(balance.membershipPlan) || Boolean(ticket.serviceId && balance.servicePackage?.items.some((item) => item.serviceId === ticket.serviceId))) }
  } : ticket;
  return {
    timeZone,
    onlineCard: Boolean(await onlineDepositProvider(context.prisma, shopId)),
    appointments: appointments.map(eligible),
    requestedAppointment: requested ? eligible(requested) : null,
    requestedAppointmentId: args?.appointmentId || null,
    tickets: { page: ticketPage, pageSize: POS_PAGE_SIZE, total: ticketTotal2, search: ticketSearch },
    products: products.map((product) => ({ ...product, availableQuantity: product.inventoryLots.reduce((sum, lot) => sum + (lot.quantityRemaining || 0), 0), inventoryLots: void 0 })),
    productLines: productLines.map(({ transaction, ...line }) => ({ ...line, paymentMethod: transaction?.paymentMethod ?? null })),
    sales: { page: salePage, pageSize: POS_PAGE_SIZE, total: saleTotal, search: saleSearch },
    receipts,
    receiptPaging: { page: receiptPage, pageSize: POS_PAGE_SIZE, total: receiptTotal, receiptId },
    // Totals are computed over the full open-ticket scope, not the displayed page.
    metrics: { ready: await context.prisma.appointment.count({ where: openTicketWhere }), outstanding: outstanding._sum.price || 0, packageHolders, paidToday }
  };
}
function reportRange(args, timeZone) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const today = shopDateKey(/* @__PURE__ */ new Date(), timeZone);
  const endDate = args.endDate && datePattern.test(args.endDate) ? args.endDate : today;
  const defaultStart = /* @__PURE__ */ new Date(`${endDate}T12:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - (REPORT_DEFAULT_DAYS - 1));
  const startDate = args.startDate && datePattern.test(args.startDate) ? args.startDate : defaultStart.toISOString().slice(0, 10);
  if (args.startDate && !datePattern.test(args.startDate) || args.endDate && !datePattern.test(args.endDate)) throw new Error("Report dates must be shop-local calendar dates.");
  const days = Math.round((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 864e5) + 1;
  if (!Number.isFinite(days) || days < 1) throw new Error("The report start date must be on or before the end date.");
  if (days > REPORT_MAX_DAYS) throw new Error(`Choose a report range of at most ${REPORT_MAX_DAYS} days.`);
  return { start: shopDayRange(startDate, timeZone).start, end: shopDayRange(endDate, timeZone).end, startDate, endDate, days };
}
async function getReportsProjection(_root, args, context) {
  const shopId = await scope(context, "canViewReports", "Not authorized to access owner reports.");
  const shopRow = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true, currencyCode: true } });
  const timeZone = validTimeZone(shopRow?.timezone);
  if (!timeZone) throw new Error("The shop timezone is not set. Set it in Store Settings to view reports.");
  const { start, end, startDate, endDate, days } = reportRange(args || {}, timeZone);
  const [appointments, settledTransactions, queue, payouts, productLines, completedAppointments, schedules, blockingExceptions, membershipBalances, membershipEvents] = await Promise.all([
    context.prisma.appointment.groupBy({ by: ["status"], where: { shopId, startsAt: { gte: start, lt: end } }, _count: true }),
    context.prisma.checkoutTransaction.findMany({ take: 5001, where: { shopId, status: { in: ["paid", "partially_refunded", "refunded"] }, completedAt: { gte: start, lt: end } }, select: { id: true, status: true, subtotal: true, discountAmount: true, taxAmount: true, tipAmount: true, total: true, paymentSession: { select: { refundedAmount: true } }, cashRefund: { select: { amount: true, tipAmount: true, taxAmount: true } }, lineItems: { select: { title: true, barberName: true, price: true, durationMinutes: true, service: { select: { id: true } }, appointment: { select: { barberId: true } } } } } }),
    context.prisma.walkInQueueEntry.groupBy({ by: ["status"], where: { shopId, checkedInAt: { gte: start, lt: end } }, _count: true }),
    context.prisma.commissionPayout.aggregate({ where: { shopId, paidAt: { gte: start, lt: end } }, _sum: { totalAmount: true }, _count: true }),
    context.prisma.productSaleLine.findMany({ take: 5001, where: { shopId, occurredAt: { gte: start, lt: end } }, select: { lineType: true, total: true } }),
    // Completions count when the service finished, the same clock receipts use.
    context.prisma.appointment.findMany({ take: 5001, where: { shopId, status: "completed", OR: [{ serviceCompletedAt: { gte: start, lt: end } }, { serviceCompletedAt: null, startsAt: { gte: start, lt: end } }] }, select: { durationMinutes: true, barber: { select: { displayName: true } } } }),
    context.prisma.barberSchedule.findMany({ take: 5001, where: { barber: { shopId, status: "active" }, isWorking: true }, select: { startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } }),
    context.prisma.scheduleException.findMany({ take: 5001, where: { shopId, status: "active", exceptionType: { in: ["time_off", "shop_closure", "chair_unavailable"] }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true } }),
    context.prisma.customerPackage.findMany({ take: 5001, where: { shopId, status: { in: ["active", "paused"] } }, select: { id: true, remainingVisits: true, membershipPlan: { select: { price: true, includedVisits: true } }, servicePackage: { select: { price: true, items: { select: { quantity: true } } } } } }),
    context.prisma.membershipEvent.findMany({ take: 5001, where: { shopId, eventType: { in: ["purchased", "renewed"] } }, orderBy: { occurredAt: "desc" }, select: { customerPackageId: true, amount: true, visitsDelta: true } })
  ]);
  for (const rows of [settledTransactions, productLines, completedAppointments, schedules, blockingExceptions, membershipBalances, membershipEvents]) {
    if (rows.length > 5e3) throw new Error("Report range exceeds the supported record limit.");
  }
  const appointmentCounts = { ...Object.fromEntries(appointments.map((item) => [String(item.status), item._count])), completed: completedAppointments.length };
  const queueCounts = Object.fromEntries(queue.map((item) => [String(item.status), item._count]));
  const appointmentTotal = appointments.reduce((sum, item) => sum + item._count, 0);
  const queueClosed = (queueCounts.served || 0) + (queueCounts.left || 0);
  const serviceLines = settledTransactions.flatMap((transaction) => {
    const refundableServiceTotal = transaction.status === "refunded" ? 0 : Math.max(0, (transaction.subtotal || 0) - (transaction.discountAmount || 0) - (transaction.paymentSession?.refundedAmount || 0) - Math.max(0, (transaction.cashRefund?.amount || 0) - (transaction.cashRefund?.tipAmount || 0) - (transaction.cashRefund?.taxAmount || 0)));
    const lineTotal = transaction.lineItems.reduce((sum, line) => sum + Math.max(0, line.price || 0), 0);
    return transaction.lineItems.map((line) => ({ ...line, netRevenue: lineTotal ? Math.round(refundableServiceTotal * Math.max(0, line.price || 0) / lineTotal) : 0 }));
  });
  const performance = (identity) => {
    const rows = Object.values(serviceLines.reduce((result, line) => {
      const { id, label } = identity(line);
      const key = id ? `id:${id}` : `label:${label}`;
      const current = result[key] || { key, name: label, revenue: 0, appointments: 0, linked: Boolean(id) };
      current.revenue += line.netRevenue;
      current.appointments += 1;
      result[key] = current;
      return result;
    }, {})).sort((left, right) => right.revenue - left.revenue);
    const nameCounts = rows.reduce((counts, row) => {
      counts[row.name] = (counts[row.name] || 0) + 1;
      return counts;
    }, {});
    return rows.map((row) => ({ ...row, duplicateName: nameCounts[row.name] > 1 }));
  };
  const servicePerformance = performance((line) => ({ id: line.service?.id || null, label: line.title || "Service" }));
  const barberPerformance = performance((line) => ({ id: line.appointment?.barberId || null, label: line.barberName || "Unassigned" }));
  const completedMinutes = completedAppointments.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
  const weeklyCapacityMinutes = schedules.reduce((sum, item) => {
    const breakMinutes = item.breakStartMinute != null && item.breakEndMinute != null ? Math.max(0, item.breakEndMinute - item.breakStartMinute) : 0;
    return sum + Math.max(0, (item.endMinute || 0) - (item.startMinute || 0) - breakMinutes);
  }, 0);
  const exceptionMinutes = blockingExceptions.reduce((sum, item) => sum + Math.max(0, (Math.min(end.getTime(), item.endsAt.getTime()) - Math.max(start.getTime(), item.startsAt.getTime())) / 6e4), 0);
  const capacityMinutes = Math.max(0, Math.round(weeklyCapacityMinutes * (days / 7) - exceptionMinutes));
  const latestMembershipGrant = /* @__PURE__ */ new Map();
  membershipEvents.forEach((event) => {
    if (event.customerPackageId && !latestMembershipGrant.has(event.customerPackageId)) latestMembershipGrant.set(event.customerPackageId, { amount: event.amount || 0, visitsDelta: event.visitsDelta || 0 });
  });
  const membershipLiability = membershipBalances.reduce((sum, balance) => {
    const visits = Math.max(0, balance.remainingVisits || 0);
    if (balance.membershipPlan) {
      const snapshot = latestMembershipGrant.get(balance.id);
      return sum + Math.round((snapshot?.amount || 0) * visits / Math.max(1, snapshot?.visitsDelta || 1));
    }
    const packageVisits = balance.servicePackage?.items.reduce((total, item) => total + (item.quantity || 0), 0) || 1;
    return sum + Math.round((balance.servicePackage?.price || 0) * visits / packageVisits);
  }, 0);
  const netPaidTotal = settledTransactions.reduce((sum, transaction) => sum + netReceiptTotal(transaction), 0);
  const netTips = settledTransactions.reduce((sum, transaction) => sum + (transaction.status === "refunded" ? 0 : transaction.tipAmount || 0), 0);
  return { range: { start, end, startDate, endDate, days, timeZone, currencyCode: shopRow?.currencyCode || "USD" }, appointments: { total: appointmentTotal, ...appointmentCounts }, revenue: { paidTotal: netPaidTotal, tips: netTips, transactionCount: settledTransactions.length, productSales: productLines.reduce((sum, line) => sum + (line.total || 0), 0), productSaleCount: productLines.filter((line) => line.lineType === "sale").length }, queue: queueCounts, payouts: { total: payouts._sum.totalAmount || 0, count: payouts._count }, rates: { completion: appointmentTotal ? Math.min(100, Math.round((appointmentCounts.completed || 0) / appointmentTotal * 100)) : 0, queueConversion: queueClosed ? Math.round((queueCounts.served || 0) / queueClosed * 100) : 0, utilization: capacityMinutes ? Math.round(completedMinutes / capacityMinutes * 100) : 0 }, liabilities: { memberships: membershipLiability, activeBalances: membershipBalances.length }, servicePerformance, barberPerformance };
}
async function getServicesProjection(_root, _args, context) {
  const shopId = await scope(context, "canManageServices", "Not authorized to access service management.");
  const membershipsAccess = await currentShopForPermission(context.session, "canManageMemberships", context.prisma) === shopId ? "granted" : "restricted";
  const [categories, uncategorizedServices, packages, memberships, products, bookingEligibility] = await Promise.all([
    context.prisma.serviceCategory.findMany({ where: { shopId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, services: { where: { shopId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, durationMinutes: true, price: true, depositAmount: true } } } }),
    context.prisma.service.findMany({ where: uncategorizedServiceWhere(shopId), orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, durationMinutes: true, price: true, depositAmount: true } }),
    membershipsAccess === "granted" ? context.prisma.servicePackage.findMany({ where: { shopId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, price: true } }) : Promise.resolve(null),
    membershipsAccess === "granted" ? context.prisma.membershipPlan.findMany({ where: { shopId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, price: true, includedVisits: true } }) : Promise.resolve(null),
    context.prisma.product.findMany({ where: { shopId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, sku: true, status: true, price: true } }),
    getBookingEligibilityProjection(context.prisma, shopId)
  ]);
  return { categories, uncategorizedServices, packages, memberships, membershipsAccess, products, bookingEligibility, metrics: { services: countProjectedServices(categories, uncategorizedServices), packages: packages?.length ?? null, memberships: memberships?.length ?? null, products: products.length } };
}
function validTimeZone(value) {
  if (!value) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(/* @__PURE__ */ new Date());
    return value;
  } catch {
    return null;
  }
}
async function getStaffProjection(_root, _args, context) {
  const shopId = await scope(context, "canManageSchedules", "Not authorized to access staff operations.");
  const shop = await context.prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  const timeZone = validTimeZone(shop?.timezone);
  const now = /* @__PURE__ */ new Date();
  const openShiftWhere = { OR: [{ status: "clocked_in" }, { status: "scheduled", scheduledEnd: { gte: now } }] };
  const upcomingExceptionWhere = { endsAt: { gte: now }, status: "active" };
  const shopWideExceptionWhere = { shopId, barberId: null, status: "active", endsAt: { gte: now } };
  const [barbers, shopWideExceptions, shopWideExceptionCount] = await Promise.all([
    context.prisma.barber.findMany({ where: { shopId }, orderBy: [{ displayName: "asc" }, { id: "asc" }], select: {
      id: true,
      displayName: true,
      status: true,
      bookingEnabled: true,
      chairNumber: true,
      serviceCommissionRateBps: true,
      userId: true,
      chair: { select: { id: true, chairNumber: true, stationName: true, status: true } },
      specialties: { select: { id: true, name: true } },
      schedules: { orderBy: [{ dayOfWeek: "asc" }, { id: "asc" }], select: { id: true, dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } },
      shifts: { where: openShiftWhere, orderBy: [{ scheduledStart: "asc" }, { id: "asc" }], take: STAFF_ROW_LIMIT, select: { id: true, status: true, scheduledStart: true, scheduledEnd: true, clockedInAt: true, chair: { select: { id: true, chairNumber: true } } } },
      scheduleExceptions: { where: upcomingExceptionWhere, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: STAFF_ROW_LIMIT, select: { id: true, exceptionType: true, status: true, startsAt: true, endsAt: true, reason: true } },
      _count: { select: { shifts: { where: openShiftWhere }, scheduleExceptions: { where: upcomingExceptionWhere } } }
    } }),
    context.prisma.scheduleException.findMany({ where: shopWideExceptionWhere, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: STAFF_ROW_LIMIT, select: { id: true, exceptionType: true, startsAt: true, endsAt: true, reason: true } }),
    context.prisma.scheduleException.count({ where: shopWideExceptionWhere })
  ]);
  const commissionAccess = await currentShopForPermission(context.session, "canManagePayments", context.prisma) === shopId ? "granted" : "restricted";
  const commissionRows = commissionAccess === "granted" ? await context.query.Commission.findMany({
    where: { shop: { id: { equals: shopId } }, status: { in: ["projected", "approved"] } },
    orderBy: [{ createdAt: "desc" }],
    take: COMMISSION_LIMIT + 1,
    query: "commissionAmount status barber { id }"
  }) : [];
  const commissionTruncated = commissionRows.length > COMMISSION_LIMIT;
  const canLinkAccounts = (await currentManagedShopIds(context.session, context.prisma)).includes(shopId);
  const memberRows = canLinkAccounts ? await context.prisma.shopMembership.findMany({ where: { shopId, status: "active" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select: { user: { select: { id: true, name: true, email: true } } } }) : [];
  const members = canLinkAccounts ? memberRows.flatMap((row) => row.user ? [{ id: row.user.id, name: row.user.name || row.user.email || "Member", email: row.user.email || null }] : []) : null;
  const commissionTotalsAvailable = commissionAccess === "granted" && !commissionTruncated;
  const commissionBarberId = (row) => row.barber?.id;
  const commissionAttributable = commissionTotalsAvailable && commissionRows.every((row) => typeof commissionBarberId(row) === "string");
  const commissionSum = (rows) => rows.reduce((sum, row) => sum + (Number(row.commissionAmount) || 0), 0);
  return {
    timeZone,
    commissionAccess,
    commissionTruncated,
    members,
    barbers: barbers.map(({ _count, userId, ...barber }) => ({
      ...barber,
      // The linked account id is shown only to those who may change it.
      linkedUserId: canLinkAccounts ? userId : void 0,
      accountLinked: Boolean(userId),
      openShiftCount: _count.shifts,
      upcomingExceptionCount: _count.scheduleExceptions,
      projectedCommission: commissionAttributable ? commissionSum(commissionRows.filter((row) => commissionBarberId(row) === barber.id)) : null
    })),
    shopWideExceptions,
    shopWideExceptionCount,
    metrics: { total: barbers.length, bookable: barbers.filter((item) => item.bookingEnabled && item.status === "active").length, workingDays: barbers.reduce((sum, item) => sum + item.schedules.filter((schedule) => schedule.isWorking).length, 0), projectedCommission: commissionTotalsAvailable ? commissionSum(commissionRows) : null, openShifts: barbers.reduce((sum, item) => sum + item._count.shifts, 0), upcomingExceptions: barbers.reduce((sum, item) => sum + item._count.scheduleExceptions, 0) + shopWideExceptionCount }
  };
}
async function getOperationsProjection(_root, _args, context) {
  const shopId = await scope(context, "canManagePayments", "Not authorized to access owner operations.");
  await expireStalePaymentSessions(context.prisma, shopId).catch(() => 0);
  const sectionAccess = async (permission) => await currentShopForPermission(context.session, permission, context.prisma) === shopId ? "granted" : "restricted";
  const [staffAccess, inventoryAccess, queueAccess, customersAccess, policiesAccess] = await Promise.all([
    sectionAccess("canManageStaff"),
    sectionAccess("canManageServices"),
    sectionAccess("canManageQueue"),
    sectionAccess("canManageCustomers"),
    sectionAccess("canManageAppointments")
  ]);
  const when = (access, read) => access === "granted" ? read() : Promise.resolve(null);
  const actionableCommission = { shopId, status: { in: ["projected", "approved"] } };
  const actionableWaitlist = { shopId, status: { in: ["waiting", "notified"] } };
  const openPaymentSession = { shopId, status: { in: ["pending", "authorized", "captured", "partially_refunded"] } };
  const [shop, chairs, lots, suppliers, products, activeServices, activeBarbers, commissions, payouts, tips, policies, waitlist, groomingNotes, waivers, paymentSessions, reconciliations] = await Promise.all([
    context.prisma.shop.findUniqueOrThrow({ where: { id: shopId }, select: { id: true, name: true, slug: true, timezone: true, currencyCode: true } }),
    when(staffAccess, () => context.prisma.barberChair.findMany({ where: { shopId }, orderBy: [{ chairNumber: "asc" }, { id: "asc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, chairNumber: true, stationName: true, status: true, assignedBarbers: { select: { id: true, displayName: true } } } })),
    when(inventoryAccess, () => context.prisma.inventoryLot.findMany({ where: { shopId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, lotNumber: true, quantityReceived: true, quantityRemaining: true, unitCost: true, receivedAt: true, expiresAt: true, status: true, product: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } })),
    when(inventoryAccess, () => context.prisma.supplier.findMany({ where: { shopId }, orderBy: [{ name: "asc" }, { id: "asc" }], take: SUPPLIER_OPTION_LIMIT, select: { id: true, name: true, status: true, contactName: true, email: true, phone: true } })),
    when(inventoryAccess, () => context.prisma.product.findMany({ where: { shopId, status: "active", inventoryTracked: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, sku: true, cost: true, inventoryLots: { where: { status: "active" }, select: { quantityRemaining: true } } } })),
    when(queueAccess, () => context.prisma.service.findMany({ where: { shopId, status: "active" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true } })),
    when(queueAccess, () => context.prisma.barber.findMany({ where: { shopId, status: "active" }, orderBy: [{ displayName: "asc" }, { id: "asc" }], select: { id: true, displayName: true } })),
    // Unresolved commissions first, oldest first, so older approved work is never starved by newer rows.
    context.prisma.commission.findMany({ where: actionableCommission, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, commissionNumber: true, status: true, commissionAmount: true, commissionRate: true, createdAt: true, barber: { select: { id: true, displayName: true } }, appointment: { select: { startsAt: true, serviceTitleSnapshot: true } }, transaction: { select: { completedAt: true } } } }),
    context.prisma.commissionPayout.findMany({ where: { shopId }, orderBy: [{ paidAt: "desc" }, { id: "desc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, payoutNumber: true, status: true, commissionCount: true, totalAmount: true, paidAt: true, notes: true, barber: { select: { id: true, displayName: true } } } }),
    context.prisma.tip.findMany({ where: { shopId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, tipNumber: true, amount: true, paymentMethod: true, createdAt: true, barber: { select: { id: true, displayName: true } }, customer: { select: { id: true, firstName: true, lastName: true } } } }),
    when(policiesAccess, () => context.prisma.noShowPolicy.findMany({ where: { shopId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, name: true, status: true, feeAmount: true, graceMinutes: true, appliesToMemberships: true } })),
    when(queueAccess, () => context.prisma.waitlistEntry.findMany({ where: actionableWaitlist, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, customerName: true, phone: true, status: true, preferredAt: true, notifiedAt: true, requestedService: { select: { id: true, name: true } }, requestedBarber: { select: { id: true, displayName: true } } } })),
    // Customer-note governed: gated separately from the payment scope above.
    loadOperationsGroomingNotes(context, shopId),
    when(customersAccess, () => context.prisma.waiverForm.findMany({ where: { shopId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, title: true, waiverType: true, status: true, signedByName: true, signedAt: true, customer: { select: { id: true, firstName: true, lastName: true } } } })),
    context.prisma.paymentSession.findMany({ where: openPaymentSession, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, status: true, amount: true, currencyCode: true, updatedAt: true, paymentProvider: { select: { code: true, name: true } } } }),
    context.prisma.paymentReconciliation.findMany({ where: { shopId }, orderBy: [{ observedAt: "desc" }, { id: "desc" }], take: OPERATIONS_ROW_LIMIT, select: { id: true, localStatusBefore: true, remoteStatus: true, localStatusAfter: true, changed: true, amount: true, observedAt: true } })
  ]);
  const countWhen = (access, count) => access === "granted" ? count() : Promise.resolve(null);
  const [chairCount, lotCount, supplierCount, commissionCount, payoutCount, tipCount, policyCount, waitlistCount, waiverCount, reconciliationCount, inventoryUnits, payableCommission, tipTotal, reconciliationChanges] = await Promise.all([
    countWhen(staffAccess, () => context.prisma.barberChair.count({ where: { shopId } })),
    countWhen(inventoryAccess, () => context.prisma.inventoryLot.count({ where: { shopId } })),
    countWhen(inventoryAccess, () => context.prisma.supplier.count({ where: { shopId } })),
    context.prisma.commission.count({ where: actionableCommission }),
    context.prisma.commissionPayout.count({ where: { shopId } }),
    context.prisma.tip.count({ where: { shopId } }),
    countWhen(policiesAccess, () => context.prisma.noShowPolicy.count({ where: { shopId } })),
    countWhen(queueAccess, () => context.prisma.waitlistEntry.count({ where: actionableWaitlist })),
    countWhen(customersAccess, () => context.prisma.waiverForm.count({ where: { shopId } })),
    context.prisma.paymentReconciliation.count({ where: { shopId } }),
    inventoryAccess === "granted" ? context.prisma.inventoryLot.aggregate({ where: { shopId, status: "active" }, _sum: { quantityRemaining: true } }).then((result) => result._sum.quantityRemaining || 0) : Promise.resolve(null),
    context.prisma.commission.aggregate({ where: { shopId, status: "approved" }, _sum: { commissionAmount: true } }).then((result) => result._sum.commissionAmount || 0),
    context.prisma.tip.aggregate({ where: { shopId }, _sum: { amount: true } }).then((result) => result._sum.amount || 0),
    context.prisma.paymentReconciliation.count({ where: { shopId, changed: true } })
  ]);
  const customerName = (customer) => customer ? { id: customer.id, name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") } : null;
  return {
    shop,
    access: { staff: staffAccess, inventory: inventoryAccess, queue: queueAccess, customers: customersAccess, policies: policiesAccess },
    chairs: chairs?.map((item) => ({ ...item, assignedBarbers: item.assignedBarbers.map((barber) => ({ id: barber.id, name: barber.displayName })) })) ?? null,
    lots,
    suppliers,
    activeServices,
    activeBarbers: activeBarbers?.map((barber) => ({ id: barber.id, name: barber.displayName })) ?? null,
    products: products?.map((product) => {
      const onHand = product.inventoryLots.reduce((sum, lot) => sum + (lot.quantityRemaining || 0), 0);
      return { id: product.id, name: product.name, sku: product.sku, cost: product.cost, onHand, reorderSuggested: onHand <= 5 };
    }) ?? null,
    commissions: commissions.map((item) => ({ ...item, barber: item.barber ? { id: item.barber.id, name: item.barber.displayName } : null })),
    payouts: payouts.map((item) => ({ ...item, barber: item.barber ? { id: item.barber.id, name: item.barber.displayName } : null })),
    tips: tips.map((item) => ({ ...item, barber: item.barber ? { id: item.barber.id, name: item.barber.displayName } : null, customer: customerName(item.customer) })),
    policies,
    waitlist: waitlist?.map((item) => ({ ...item, requestedBarber: item.requestedBarber ? { id: item.requestedBarber.id, name: item.requestedBarber.displayName } : null })) ?? null,
    // null (never an empty list) when note authority is restricted.
    notes: groomingNotes.notes,
    notesAccess: groomingNotes.notesAccess,
    notesCustomerAccess: groomingNotes.notesCustomerAccess,
    notesStaffAccess: groomingNotes.notesStaffAccess,
    waivers: waivers?.map((item) => ({ ...item, customer: customerName(item.customer) })) ?? null,
    // Only processor-settled sessions can be reconciled; manual (pay-in-person)
    // sessions have no remote status, so they are not offered for reconciliation.
    paymentSessions: paymentSessions.filter((session) => session.paymentProvider && paymentProviderSettlement(session.paymentProvider) === "processor").map(({ paymentProvider, ...session }) => ({ ...session, paymentProvider: paymentProvider ? { name: paymentProvider.name } : null })),
    reconciliations,
    counts: { chairs: chairCount, lots: lotCount, suppliers: supplierCount, commissions: commissionCount, payouts: payoutCount, tips: tipCount, policies: policyCount, waitlist: waitlistCount, waivers: waiverCount, reconciliations: reconciliationCount },
    // Complete shop-wide aggregates, independent of the capped display rows.
    metrics: { inventoryUnits, payableCommission, tips: tipTotal, reconciliationChanges }
  };
}
var GROOMING_NOTE_LIMIT, PREFERRED_BARBER_LIMIT, CUSTOMER_NOTE_SELECTION, COMMISSION_LIMIT, MEMBERSHIP_PLAN_LIMIT, BOOKING_PAGE_SIZE, BOOKING_STATUSES, QUEUE_PAGE_SIZE, CUSTOMER_PAGE_SIZE, CUSTOMER_HISTORY_PREVIEW, POS_PAGE_SIZE, REPORT_MAX_DAYS, REPORT_DEFAULT_DAYS, STAFF_ROW_LIMIT, OPERATIONS_ROW_LIMIT, SUPPLIER_OPTION_LIMIT;
var init_getPlatformProjections = __esm({
  "features/keystone/queries/getPlatformProjections.ts"() {
    "use strict";
    init_expireStalePaymentSessions();
    init_publicDeposits();
    init_shop_time();
    init_availability();
    init_access();
    init_receipt_net();
    init_currentAuthorization();
    init_supportedSettlementCurrency();
    init_serviceCatalogProjection();
    init_bookingPolicy();
    init_public_booking_eligibility();
    init_paymentProviderAdapter();
    init_customerDuplicates();
    GROOMING_NOTE_LIMIT = 10;
    PREFERRED_BARBER_LIMIT = 50;
    CUSTOMER_NOTE_SELECTION = "id noteType body visibility createdAt appointment { id startsAt serviceTitleSnapshot }";
    COMMISSION_LIMIT = 2e3;
    MEMBERSHIP_PLAN_LIMIT = 100;
    BOOKING_PAGE_SIZE = 100;
    BOOKING_STATUSES = ["requested", "confirmed", "checked_in", "in_chair", "completed", "cancelled", "no_show"];
    QUEUE_PAGE_SIZE = 100;
    CUSTOMER_PAGE_SIZE = 25;
    CUSTOMER_HISTORY_PREVIEW = 5;
    POS_PAGE_SIZE = 25;
    REPORT_MAX_DAYS = 366;
    REPORT_DEFAULT_DAYS = 30;
    STAFF_ROW_LIMIT = 10;
    OPERATIONS_ROW_LIMIT = 20;
    SUPPLIER_OPTION_LIMIT = 200;
  }
});

// features/keystone/mutations/index.ts
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql9`
      type PublicService {
        id: ID
        name: String
        description: String
        imagePath: String
        durationMinutes: Int
        price: Int
        depositRequired: Boolean
        depositAmount: Int
        color: String
        specialists: [PublicBarber!]
      }

      type PublicProduct {
        id: ID!
        name: String!
        sku: String
        productType: String
        price: Int
        description: String
        imagePath: String
      }

      type PublicStorefrontSettings {
        id: ID!
        name: String!
        tagline: String
        address: String
        phone: String
        timezone: String!
        currencyCode: String!
        hours: JSON
        brandColor: String!
        logoIcon: String
        logoColor: String
      }

      type PublicServiceCategory {
        id: ID
        name: String
        description: String
        services: [PublicService!]!
      }

      type PublicBarber {
        id: ID
        displayName: String
        bio: String
        imagePath: String
        chairNumber: String
        bookingEnabled: Boolean
        specialties: [PublicService!]
      }

      type PublicPackageBalance {
        id: ID
        remainingVisits: Int
        status: String
        expiresAt: String
        servicePackageName: String
        membershipPlanName: String
      }

      type PublicAppointmentCustomer {
        id: ID
        firstName: String
        lastName: String
        packageBalances: [PublicPackageBalance!]
      }

      type PublicAppointmentLineItem {
        id: ID
        title: String
        price: Int
        durationMinutes: Int
        imagePath: String
        modifiers: JSON
        barberName: String
        barberChairNumber: String
        packageBalanceId: String
        packageName: String
        packageVisitsConsumed: Int
      }

      type PublicAppointmentTransaction {
        id: ID
        status: String
        total: Int
        formattedTotal: String
        paymentMethod: String
        completedAt: String
        refundedAmount: Int
        formattedRefundedAmount: String
        refundedAt: String
      }

      type PublicAppointment {
        id: ID
        startsAt: String
        endsAt: String
        durationMinutes: Int
        status: String
        source: String
        paymentStatus: String
        price: Int
        depositAmount: Int
        customerNotes: String
        bookingEligibility: JSON
        bookingTimezone: String
        waiverRequired: Boolean
        waiverTemplateKey: String
        waiverTemplateVersion: String
        waiverTemplateText: String
        waiverTemplateHash: String
        waiverSigned: Boolean
        customer: PublicAppointmentCustomer
        barber: PublicBarber
        service: PublicService
        lineItems: [PublicAppointmentLineItem!]
        transaction: PublicAppointmentTransaction
      }

      type PublicBookedAppointment {
        id: ID!
        bookingEligibility: JSON
        bookingTimezone: String!
        startsAt: String
        endsAt: String
        durationMinutes: Int
        status: String
        paymentStatus: String
        price: Int
        depositAmount: Int
        service: PublicService
        barber: PublicBarber
      }

      type AvailabilitySlot {
        time: String!
        startsAt: String
        available: Boolean!
        barberId: ID
        barberName: String
        blockedReason: String
      }

      type OnlineBookingResult {
        success: Boolean!
        disposition: String!
        error: String
        accessToken: String
        appointment: PublicBookedAppointment
      }

      type PublicQueueEntry {
        id: ID!
        status: String
        partySize: Int
        quotedWaitMinutes: Int
        checkedInAt: String
        seatedAt: String
        requestedService: PublicService
        requestedBarber: PublicBarber
      }

      type CreatePublicQueueEntryResult {
        success: Boolean!
        error: String
        accessToken: String
        queueEntry: PublicQueueEntry
      }

      type AppointmentPaymentSession {
        id: ID!
        status: String
        amount: Int
        currencyCode: String
        providerPaymentId: String
        expiresAt: String
        capturedAt: String
        cancelledAt: String
        refundedAmount: Int
      }

      type AppointmentPaymentSessionResult {
        success: Boolean!
        error: String
        paymentSession: AppointmentPaymentSession
      }

      type CheckoutAppointmentResult {
        success: Boolean!
        error: String
        transaction: CheckoutTransaction
        appointment: Appointment
      }

      type InventoryMovementResult {
        success: Boolean!
        error: String
        movement: InventoryMovement
      }

      type SeatedWalkIn {
        queueEntryId: ID!
        appointmentId: ID!
        status: String!
        startsAt: String!
        barberId: ID!
        chairNumber: String!
      }

      type SeatWalkInQueueEntryResult {
        success: Boolean!
        error: String
        seated: SeatedWalkIn
      }

      type TransitionedAppointment {
        id: ID!
        status: String!
        paymentStatus: String!
        updatedAt: String!
      }

      type TransitionAppointmentResult {
        success: Boolean!
        error: String
        appointment: TransitionedAppointment
      }

      type TransitionedQueueEntry {
        id: ID!
        status: String!
        updatedAt: String!
      }

      type TransitionQueueEntryResult {
        success: Boolean!
        error: String
        queueEntry: TransitionedQueueEntry
      }

      type SelectedActiveShop {
        id: ID!
        name: String!
        slug: String!
      }

      type PublicPaymentOptions {
        onlineDeposits: Boolean!
      }

      type PublicPackageLine {
        quantity: Int!
        serviceId: ID!
        serviceName: String!
      }

      type PublicPackageOffer {
        id: ID!
        name: String!
        description: String
        price: Int!
        items: [PublicPackageLine!]!
      }

      type PublicPlanOffer {
        id: ID!
        name: String!
        description: String
        price: Int!
        billingInterval: String!
        includedVisits: Int
        discountPercent: Int
      }

      type PublicMembershipOffers {
        packages: [PublicPackageOffer!]!
        plans: [PublicPlanOffer!]!
      }

      type PublicBarberDay {
        dayOfWeek: String!
        startMinute: Int
        endMinute: Int
      }

      type PublicWalkInStatus {
        open: Boolean!
        barbersOnNow: Int!
        opensAt: String
        onNowIds: [ID!]!
      }

      type ClaimableShop {
        id: ID!
        name: String!
        slug: String!
        isPublic: Boolean!
      }

      type SelectActiveShopResult {
        success: Boolean!
        error: String
        shop: SelectedActiveShop
      }

      type PlatformProjectionResult {
        success: Boolean!
        error: String
        data: JSON
      }

      type DomainCommandResult {
        success: Boolean!
        error: String
        data: JSON
      }

      type EnsureDefaultPaymentProviderResult {
        success: Boolean!
        error: String
        provider: PaymentProvider
      }

      type BarbershopOnboardingSeedStat {
        listKey: String!
        created: Int!
        reused: Int!
        skipped: Int!
      }

      type BarbershopOnboardingResult {
        mode: String!
        databaseName: String @deprecated(reason: "Infrastructure identity is not exposed; always null.")
        dryRun: Boolean!
        stats: [BarbershopOnboardingSeedStat!]!
      }

      type RunBarbershopOnboardingResult {
        success: Boolean!
        error: String
        result: BarbershopOnboardingResult
      }

      type Query {
        redirectToInit: Boolean
        accountBookings(page: Int): PlatformProjectionResult!
        accountBalances: PlatformProjectionResult!
        getPublicMembershipOffers: PublicMembershipOffers!
        getPublicBarberWeek(barberId: ID!): [PublicBarberDay!]!
        exportMyAccountData: PlatformProjectionResult!
        getPublicStorefrontSettings: PublicStorefrontSettings
        getPublicServiceCatalog: [PublicServiceCategory!]!
        getPublicBookingEligibility: PlatformProjectionResult!
        getPublicBarbers: [PublicBarber!]!
        getPublicProducts: [PublicProduct!]!
        activeShopStorefrontSettings: PlatformProjectionResult!
        platformBooking(date: String, status: String, page: Int): PlatformProjectionResult!
        platformQueue(search: String, page: Int): PlatformProjectionResult!
        platformCustomers(search: String, page: Int, customerId: ID, planSearch: String): PlatformProjectionResult!
        platformPos(appointmentId: ID, ticketPage: Int, ticketSearch: String, salePage: Int, saleSearch: String, receiptPage: Int, receiptId: ID): PlatformProjectionResult!
        platformReports(startDate: String, endDate: String): PlatformProjectionResult!
        platformServices: PlatformProjectionResult!
        platformStaff: PlatformProjectionResult!
        platformOperations: PlatformProjectionResult!
        checkBarberAvailability(
          barberId: ID!
          serviceId: ID
          date: String!
          serviceDuration: Int!
          includeUnavailable: Boolean
        ): [AvailabilitySlot!]!
        getPublicQueue: [PublicQueueEntry!]!
        claimableShops: [ClaimableShop!]!
        getPublicWalkInStatus: PublicWalkInStatus!
        getPublicPaymentOptions: PublicPaymentOptions!
        openDeskCardPayment(appointmentId: ID!): DomainCommandResult!
        giftCardOptions: JSON
        lookupGiftCard(code: String!): DomainCommandResult!
        platformTeam: PlatformProjectionResult!
        getPublicQueueEntry(
          queueEntryId: ID!
          accessToken: String!
        ): PublicQueueEntry
        getPublicAppointment(
          appointmentId: ID!
          accessToken: String
        ): PublicAppointment
      }

      type Mutation {
        createAccountBooking(requestKey: String!, guestProof: String!, requestBody: String!): OnlineBookingResult!
        recoverAccountBooking(requestKey: String!, guestProof: String!, requestBody: String!, closeIfAbsent: Boolean): OnlineBookingResult!
        createOnlineBooking(requestKey: String!, guestProof: String!, requestBody: String!): OnlineBookingResult!
        recoverGuestBooking(requestKey: String!, guestProof: String!, requestBody: String!, closeIfAbsent: Boolean): OnlineBookingResult!

        managePublicAppointment(appointmentId: ID!, accessToken: String, action: String!, startsAt: String, reason: String!, idempotencyKey: String!, preview: Boolean, acceptedFeeAmount: Int): DomainCommandResult!
        signPublicWaiver(appointmentId: ID!, accessToken: String, signerName: String!, signerRole: String!, guardianName: String, affirmation: Boolean!, idempotencyKey: String!): DomainCommandResult!
        setPractitionerCredentialStatus(credentialId: ID!, status: String!, reason: String!, idempotencyKey: String!): DomainCommandResult!

        updateActiveShopStorefrontSettings(
          name: String!
          tagline: String
          address: String
          phone: String
          timezone: String!
          currencyCode: String!
          brandColor: String!
          logoIcon: String
          logoColor: String
          isPublic: Boolean!
          hours: JSON
          expectedShopId: ID
          expectedVersion: String
        ): DomainCommandResult!

        createPublicQueueEntry(
          customerName: String!
          phone: String!
          partySize: Int
          requestedServiceId: ID
          requestedBarberId: ID
          accessToken: String
        ): CreatePublicQueueEntryResult!

        initiateAppointmentPaymentSession(
          appointmentId: ID!
          amount: Int
          currencyCode: String
          idempotencyKey: String!
        ): AppointmentPaymentSessionResult!

        captureAppointmentPaymentSession(
          paymentSessionId: ID!
        ): AppointmentPaymentSessionResult!

        refundAppointmentPaymentSession(
          paymentSessionId: ID!
          amount: Int
          idempotencyKey: String!
        ): AppointmentPaymentSessionResult!

        cancelAppointmentPaymentSession(
          paymentSessionId: ID!
        ): AppointmentPaymentSessionResult!

        checkoutAppointment(
          appointmentId: ID!
          paymentMethod: String
          packageBalanceId: ID
          tipAmount: Int
          discountAmount: Int
          taxAmount: Int
          notes: String
          paymentSessionId: ID
          giftCardCode: String
          idempotencyKey: String
        ): CheckoutAppointmentResult!

        recordInventoryMovement(
          inventoryLotId: ID!
          movementType: String!
          quantityDelta: Int!
          reason: String!
          referenceKey: String!
        ): InventoryMovementResult!

        receiveInventoryLot(productId: ID!, supplierId: ID, lotNumber: String!, quantity: Int!, unitCost: Int, receivedAt: String, expiresAt: String, idempotencyKey: String!): DomainCommandResult!

        seatWalkInQueueEntry(
          queueEntryId: ID!
        ): SeatWalkInQueueEntryResult!

        transitionAppointment(
          appointmentId: ID!
          toStatus: String!
          idempotencyKey: String!
        ): TransitionAppointmentResult!

        transitionQueueEntry(
          queueEntryId: ID!
          toStatus: String!
          idempotencyKey: String!
        ): TransitionQueueEntryResult!

        selectActiveShop(shopId: ID!): SelectActiveShopResult!
        claimShopOwnership(shopId: ID!): SelectActiveShopResult!
        addShopMemberByEmail(email: String!, membershipRole: String!): DomainCommandResult!
        startDepositCheckout(appointmentId: ID!, accessToken: String): DomainCommandResult!
        startDeskCardPayment(appointmentId: ID!, tipAmount: Int, discountAmount: Int, taxAmount: Int, notes: String): DomainCommandResult!
        checkDeskCardPayment(paymentSessionId: ID!): DomainCommandResult!
        cancelDeskCardPayment(paymentSessionId: ID!): DomainCommandResult!
        expireStalePaymentSessions(force: Boolean): DomainCommandResult!
        startGiftCardCheckout(amount: Int!, purchaserName: String!, purchaserEmail: String!, recipientName: String, recipientEmail: String, message: String): DomainCommandResult!
        returnGiftCardCheckout(transactionId: ID!, reason: String!, idempotencyKey: String!): DomainCommandResult!
        confirmGiftCardOrder(giftCardId: ID!, token: String!): DomainCommandResult!
        startProductCheckout(productId: ID!, buyerName: String!, buyerEmail: String!): DomainCommandResult!
        confirmProductOrder(orderId: ID!, token: String!): DomainCommandResult!
        confirmDepositCheckout(appointmentId: ID!, accessToken: String): DomainCommandResult!

        markAppointmentNoShow(appointmentId: ID!, policyId: ID, reason: String!, idempotencyKey: String!): DomainCommandResult!
        transitionCommission(commissionId: ID!, toStatus: String!, reason: String, idempotencyKey: String!): DomainCommandResult!
        payApprovedCommissions(commissionIds: [ID!]!, notes: String, idempotencyKey: String!): DomainCommandResult!
        refundCashCheckout(transactionId: ID!, reason: String!, cashReturned: Boolean!, idempotencyKey: String!): DomainCommandResult!
        recordProductSale(productId: ID!, quantity: Int!, paymentMethod: String!, taxRateBps: Int, idempotencyKey: String!): DomainCommandResult!
        returnProductSaleLine(saleLineId: ID!, quantity: Int!, reason: String!, cashReturned: Boolean, restock: Boolean, idempotencyKey: String!): DomainCommandResult!
        reconcilePaymentSession(paymentSessionId: ID!, idempotencyKey: String!): DomainCommandResult!
        addCustomerNote(customerId: ID!, body: String!, noteType: String, visibility: String, appointmentId: ID, idempotencyKey: String!): DomainCommandResult!
        setCustomerStatus(customerId: ID!, status: String!, reason: String, idempotencyKey: String!): DomainCommandResult!
        mergeCustomers(keepCustomerId: ID!, duplicateCustomerId: ID!, idempotencyKey: String!): DomainCommandResult!
        setCustomerConsent(customerId: ID!, acceptsMarketing: Boolean!, preferredContactMethod: String, idempotencyKey: String!): DomainCommandResult!
        issueCustomerWaiver(customerId: ID!, appointmentId: ID, title: String!, waiverType: String, deliveryStatus: String, idempotencyKey: String!): DomainCommandResult!
        manageMembership(action: String!, customerId: ID, membershipPlanId: ID, servicePackageId: ID, customerPackageId: ID, paymentMethod: String, reason: String, idempotencyKey: String!): DomainCommandResult!
        manageStaffShift(action: String!, shiftId: ID, barberId: ID, chairId: ID, scheduledStart: String, scheduledEnd: String, notes: String, idempotencyKey: String!): DomainCommandResult!
        linkBarberAccount(barberId: ID!, userId: ID, idempotencyKey: String!): DomainCommandResult!
        manageScheduleException(action: String!, exceptionId: ID, exceptionType: String, barberId: ID, chairId: ID, startsAt: String, endsAt: String, reason: String, idempotencyKey: String!): DomainCommandResult!
        createStaffAppointment(customerId: ID, customerFirstName: String, customerLastName: String, customerPhone: String, customerEmail: String, serviceId: ID!, barberId: ID!, startsAt: String!, notes: String, source: String, waitlistEntryId: ID, idempotencyKey: String!): DomainCommandResult!
        manageStaffAppointment(appointmentId: ID!, action: String!, startsAt: String, barberId: ID, reason: String!, idempotencyKey: String!): DomainCommandResult!
        createStaffQueueEntry(customerName: String!, phone: String, partySize: Int, requestedServiceId: ID, requestedBarberId: ID, notes: String, quotedWaitMinutes: Int, idempotencyKey: String!): DomainCommandResult!
        assignWalkInQueueEntry(queueEntryId: ID!, requestedServiceId: ID!, requestedBarberId: ID, idempotencyKey: String!): DomainCommandResult!
        manageWaitlist(action: String!, waitlistEntryId: ID, customerName: String, phone: String, customerId: ID, requestedServiceId: ID, requestedBarberId: ID, preferredAt: String, notes: String, idempotencyKey: String!): DomainCommandResult!

        ensureDefaultPaymentProvider: EnsureDefaultPaymentProviderResult!

        runBarbershopOnboarding(
          mode: String!
          shopName: String
          shopAddress: String
          shopPhone: String
          shopTimezone: String
        ): RunBarbershopOnboardingResult!

      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        getPublicStorefrontSettings,
        getPublicServiceCatalog,
        accountBookings: getAccountBookings,
        accountBalances: getAccountBalances,
        getPublicMembershipOffers,
        getPublicBarberWeek,
        exportMyAccountData,
        getPublicBookingEligibility,
        getPublicBarbers,
        getPublicProducts,
        activeShopStorefrontSettings: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getActiveShopStorefrontSettings(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load storefront settings.", data: null };
          }
        },
        platformBooking: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getBookingProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load booking.", data: null };
          }
        },
        platformQueue: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getQueueProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load queue.", data: null };
          }
        },
        platformCustomers: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getCustomersProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load customers.", data: null };
          }
        },
        platformPos: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getPosProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load POS.", data: null };
          }
        },
        platformReports: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getReportsProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load reports.", data: null };
          }
        },
        platformServices: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getServicesProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load services.", data: null };
          }
        },
        platformStaff: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getStaffProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load staff.", data: null };
          }
        },
        platformOperations: async (root, args, context) => {
          try {
            return { success: true, error: null, data: await getOperationsProjection(root, args, context) };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to load operations.", data: null };
          }
        },
        checkBarberAvailability,
        getPublicQueue,
        getPublicQueueEntry,
        claimableShops,
        getPublicWalkInStatus,
        getPublicPaymentOptions,
        openDeskCardPayment,
        giftCardOptions: async (_root, _args, context) => giftCardOptions(context.sudo().prisma),
        lookupGiftCard,
        platformTeam,
        getPublicAppointment
      },
      Mutation: {
        createOnlineBooking,
        createAccountBooking,
        recoverAccountBooking,
        recoverGuestBooking,
        managePublicAppointment,
        signPublicWaiver,
        setPractitionerCredentialStatus,
        updateActiveShopStorefrontSettings,
        createPublicQueueEntry,
        initiateAppointmentPaymentSession,
        captureAppointmentPaymentSession,
        refundAppointmentPaymentSession,
        cancelAppointmentPaymentSession,
        checkoutAppointment,
        recordInventoryMovement,
        receiveInventoryLot: async (root, args, context) => {
          const result = await receiveInventoryLot(root, args, context);
          return { success: result.success, error: result.error, data: result.received };
        },
        seatWalkInQueueEntry,
        transitionAppointment,
        transitionQueueEntry,
        selectActiveShop,
        claimShopOwnership,
        addShopMemberByEmail,
        startDepositCheckout,
        startDeskCardPayment,
        checkDeskCardPayment,
        cancelDeskCardPayment,
        startGiftCardCheckout,
        returnGiftCardCheckout,
        confirmGiftCardOrder,
        startProductCheckout,
        confirmProductOrder,
        expireStalePaymentSessions: async (_root, _args, context) => {
          try {
            const shopId = await requireCurrentShopPermission(context.session, "canManagePayments");
            await settleOpenGiftCards(context.prisma, shopId).catch(() => void 0);
            await settleOpenProductOrders(context.prisma, shopId).catch(() => void 0);
            const force = Boolean(_args && _args.force);
            const result = await sweepStalePaymentSessions(context.prisma, shopId, /* @__PURE__ */ new Date(), { force });
            return { success: true, error: null, data: result };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unable to expire payments.", data: null };
          }
        },
        confirmDepositCheckout,
        markAppointmentNoShow: async (root, args, context) => {
          const result = await markAppointmentNoShow(root, args, context);
          return { success: result.success, error: result.error, data: result.evidence };
        },
        transitionCommission: async (root, args, context) => {
          const result = await transitionCommission(root, args, context);
          return { success: result.success, error: result.error, data: result.commission };
        },
        payApprovedCommissions: async (root, args, context) => {
          const result = await createCommissionPayout(root, args, context);
          return { success: result.success, error: result.error, data: result.payout };
        },
        refundCashCheckout,
        recordProductSale: async (root, args, context) => {
          const result = await recordProductSale(root, args, context);
          return { success: result.success, error: result.error, data: result.sale };
        },
        returnProductSaleLine: async (root, args, context) => {
          const result = await returnProductSaleLine(root, args, context);
          return { success: result.success, error: result.error, data: result.returned };
        },
        reconcilePaymentSession: async (root, args, context) => {
          const result = await reconcilePaymentSession(root, args, context);
          return { success: result.success, error: result.error, data: result.reconciliation };
        },
        addCustomerNote: async (root, args, context) => {
          const result = await addCustomerNote(root, args, context);
          return { success: result.success, error: result.error, data: result.note };
        },
        mergeCustomers: async (root, args, context) => {
          const result = await mergeCustomers(root, args, context);
          return { success: result.success, error: result.error, data: result.customer };
        },
        setCustomerStatus: async (root, args, context) => {
          const result = await setCustomerStatus(root, args, context);
          return { success: result.success, error: result.error, data: result.customer };
        },
        setCustomerConsent: async (root, args, context) => {
          const result = await setCustomerConsent(root, args, context);
          return { success: result.success, error: result.error, data: result.customer };
        },
        issueCustomerWaiver: async (root, args, context) => {
          const result = await issueCustomerWaiver(root, args, context);
          return { success: result.success, error: result.error, data: result.waiver };
        },
        manageMembership: async (root, args, context) => {
          const result = await manageMembership(root, args, context);
          return { success: result.success, error: result.error, data: result.membership };
        },
        manageStaffShift: async (root, args, context) => {
          const result = await manageStaffShift(root, args, context);
          return { success: result.success, error: result.error, data: result.shift };
        },
        linkBarberAccount: async (root, args, context) => {
          const result = await linkBarberAccount(root, args, context);
          return { success: result.success, error: result.error, data: result.barber };
        },
        manageScheduleException: async (root, args, context) => {
          const result = await manageScheduleException(root, args, context);
          return { success: result.success, error: result.error, data: result.exception };
        },
        manageWaitlist: async (root, args, context) => {
          const result = await manageWaitlist(root, args, context);
          return { success: result.success, error: result.error, data: result.entry };
        },
        createStaffAppointment,
        manageStaffAppointment,
        createStaffQueueEntry,
        assignWalkInQueueEntry,
        ensureDefaultPaymentProvider,
        runBarbershopOnboarding: async (root, args, context) => {
          const response = await runBarbershopOnboarding(root, args, context);
          return {
            ...response,
            result: response.result ? {
              mode: response.result.mode,
              databaseName: null,
              dryRun: response.result.dryRun,
              stats: Object.entries(response.result.stats).map(([listKey, stat2]) => ({
                listKey,
                created: stat2.created,
                reused: stat2.reused,
                skipped: stat2.skipped ?? 0
              }))
            } : null
          };
        }
      }
    }
  });
}
var import_schema, graphql9;
var init_mutations = __esm({
  "features/keystone/mutations/index.ts"() {
    "use strict";
    import_schema = require("@graphql-tools/schema");
    init_redirectToInit();
    init_checkBarberAvailability();
    init_createOnlineBooking();
    init_getAccountBookings();
    init_getPublicOffers();
    init_guestBookingCommand();
    init_checkoutAppointment();
    init_ensureDefaultPaymentProvider();
    init_getPublicAppointment();
    init_getPublicBookingEligibility();
    init_getPublicServices();
    init_getStorefrontSettings();
    init_getPublicQueue();
    init_createPublicQueueEntry();
    init_runBarbershopOnboarding();
    init_initiateAppointmentPaymentSession();
    init_captureAppointmentPaymentSession();
    init_refundAppointmentPaymentSession();
    init_cancelAppointmentPaymentSession();
    init_recordInventoryMovement();
    init_receiveInventoryLot();
    init_seatWalkInQueueEntry();
    init_transitionAppointment();
    init_transitionQueueEntry();
    init_selectActiveShop();
    init_claimShopOwnership();
    init_manageTeam();
    init_publicDeposits();
    init_expireStalePaymentSessions();
    init_currentAuthorization();
    init_giftCards();
    init_productOrders();
    init_deskCardPayment();
    init_markAppointmentNoShow();
    init_manageCommissions();
    init_manageProductSales();
    init_reconcilePaymentSession();
    init_manageCustomers();
    init_manageMemberships();
    init_refundCashCheckout();
    init_manageWorkforce();
    init_manageWaitlist();
    init_staffAppointments();
    init_staffQueueEntries();
    init_managePublicAppointment();
    init_signPublicWaiver();
    init_setPractitionerCredentialStatus();
    init_manageStorefrontSettings();
    init_getPlatformProjections();
    graphql9 = String.raw;
  }
});

// features/keystone/lib/email-layout.ts
function storeNameFromEnv(fallback = "Barbershop") {
  const match = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.SMTP_FROM || "");
  return match?.[1]?.trim() || fallback;
}
function emailButton(label, href) {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
<tr><td class="em-btn" align="center" bgcolor="${C.button}" style="border-radius:8px;background:${C.button};">
<a class="em-btn-a" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:${C.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}
function emailLayout(input) {
  const store = escapeHtml(input.storeName || storeNameFromEnv());
  const support = escapeHtml(input.supportEmail || SUPPORT_EMAIL);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
a { color:${C.link}; }
@media (max-width: 620px) { .em-pad { padding-left:20px !important; padding-right:20px !important; } }
@media (prefers-color-scheme: dark) {
  .em-canvas { background:#09090b !important; }
  .em-card { background:#18181b !important; border-color:#27272a !important; }
  .em-text { color:#fafafa !important; }
  .em-muted { color:#a1a1aa !important; }
  .em-line { border-color:#3f3f46 !important; }
  .em-panel { background:#27272a !important; border-color:#3f3f46 !important; color:#fafafa !important; }
  .em-btn { background:#fafafa !important; }
  .em-btn-a { color:#18181b !important; }
  .em-link { color:#fafafa !important; }
}
[data-ogsc] .em-text { color:#fafafa !important; }
[data-ogsc] .em-muted { color:#a1a1aa !important; }
[data-ogsb] .em-canvas { background:#09090b !important; }
[data-ogsb] .em-card { background:#18181b !important; }
</style>
</head>
<body class="em-canvas" style="margin:0;padding:0;background:${C.canvas};">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>` : ""}
<table role="presentation" class="em-canvas" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td class="em-pad" style="padding:8px 32px 20px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.01em;"><span class="em-text" style="color:${C.text};">${store}</span></td></tr>
<tr><td class="em-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr><td class="em-pad" style="padding:32px 32px 16px;">
<h1 class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.02em;color:${C.text};">${escapeHtml(input.title)}</h1>
${input.body}
</td></tr>
</table>
</td></tr>
<tr><td class="em-pad" style="padding:20px 32px 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.subtle};">
<span class="em-muted" style="color:${C.subtle};">${input.footerNote ? `${input.footerNote}<br>` : ""}Questions? Email <a class="em-link" href="mailto:${support}" style="color:${C.muted};text-decoration:underline;">${support}</a>.<br>${store}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
var SUPPORT_EMAIL, FONT, C, escapeHtml, p, emailParagraph, emailMuted;
var init_email_layout = __esm({
  "features/keystone/lib/email-layout.ts"() {
    "use strict";
    SUPPORT_EMAIL = "hello@barbershop.openship.org";
    FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
    C = {
      canvas: "#f4f4f5",
      card: "#ffffff",
      text: "#18181b",
      muted: "#52525b",
      subtle: "#71717a",
      line: "#e4e4e7",
      panel: "#fafafa",
      button: "#18181b",
      buttonText: "#ffffff",
      link: "#18181b"
    };
    escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    p = (html, style = "") => `<p class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text};${style}">${html}</p>`;
    emailParagraph = p;
    emailMuted = (html) => `<p class="em-muted" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${html}</p>`;
  }
});

// features/keystone/lib/mail.ts
function resetLinkOrigin(baseUrl) {
  const configured = baseUrl || process.env.SMTP_STORE_LINK || "";
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("Email delivery unavailable.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local) || url.username || url.password) {
    throw new Error("Email delivery unavailable.");
  }
  return url.origin;
}
async function resetPathFor(email) {
  const user = await domainPrisma.user.findUnique({
    where: { email },
    select: {
      role: { select: { canAccessDashboard: true } },
      shopMemberships: { where: { status: "active" }, select: { id: true }, take: 1 }
    }
  });
  return user?.role?.canAccessDashboard || user?.shopMemberships?.length ? "/dashboard/reset" : "/account/reset";
}
function mailTransport() {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: pass } = process.env;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : void 0;
  if (!host || !user || !pass || port !== void 0 && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Email delivery unavailable.");
  return (0, import_nodemailer.createTransport)({ host, port, auth: { user, pass }, disableFileAccess: true, disableUrlAccess: true });
}
function passwordResetEmail({ url }) {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`
  });
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const url = new URL(await resetPathFor(to), resetLinkOrigin(baseUrl));
  url.searchParams.set("token", resetToken);
  const info = await mailTransport().sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Reset your password",
    html: passwordResetEmail({ url: url.toString() })
  });
  const accepted = (info.accepted || []).map((entry) => String(typeof entry === "string" ? entry : entry.address || "").toLowerCase());
  if ((info.rejected || []).length || !accepted.includes(to.toLowerCase())) {
    throw new Error("The mail server did not accept the password reset email.");
  }
}
var import_nodemailer;
var init_mail = __esm({
  "features/keystone/lib/mail.ts"() {
    "use strict";
    import_nodemailer = require("nodemailer");
    init_domainPrisma();
    init_email_layout();
  }
});

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint2) {
  let hostname = "";
  try {
    hostname = endpoint2 ? new URL(endpoint2).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}
var init_s3_storage = __esm({
  "features/keystone/lib/s3-storage.ts"() {
    "use strict";
  }
});

// features/keystone/utils/runtimeConfig.ts
function runtimeConfig(env = process.env) {
  const databaseURL2 = env.DATABASE_URL || "";
  let url;
  try {
    url = new URL(databaseURL2);
  } catch {
    throw new Error("DATABASE_URL must be a configured PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use PostgreSQL.");
  const secret = env.SESSION_SECRET || "";
  if (secret.length < 32 || /this secret should only be used in testing/i.test(secret)) throw new Error("SESSION_SECRET must be a private random value of at least 32 characters.");
  return { databaseURL: databaseURL2, sessionConfig: { maxAge: 60 * 60, secret } };
}
var init_runtimeConfig = __esm({
  "features/keystone/utils/runtimeConfig.ts"() {
    "use strict";
  }
});

// features/keystone/database-url.ts
function pooledDatabaseUrl(url, role = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]));
  return parsed.toString();
}
var POOL_SIZES, OVERRIDE_ENV;
var init_database_url = __esm({
  "features/keystone/database-url.ts"() {
    "use strict";
    POOL_SIZES = { web: 15, worker: 5 };
    OVERRIDE_ENV = {
      web: "DATABASE_CONNECTION_LIMIT",
      worker: "DATABASE_CONNECTION_LIMIT_WORKER"
    };
  }
});

// features/keystone/index.ts
var import_auth, import_core49, import_config, import_session, databaseURL, sessionConfig, bucketName, region, accessKeyId, secretAccessKey, endpoint, withAuth, keystone_default;
var init_keystone = __esm({
  "features/keystone/index.ts"() {
    "use strict";
    import_auth = require("@keystone-6/auth");
    import_core49 = require("@keystone-6/core");
    import_config = require("dotenv/config");
    init_models();
    import_session = require("@keystone-6/core/session");
    init_mutations();
    init_mail();
    init_s3_storage();
    init_domainPrisma();
    init_runtimeConfig();
    init_database_url();
    ({ databaseURL, sessionConfig } = runtimeConfig());
    ({
      S3_BUCKET_NAME: bucketName = "keystone-test",
      S3_REGION: region = "ap-southeast-2",
      S3_ACCESS_KEY_ID: accessKeyId = "keystone",
      S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
      S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com"
    } = process.env);
    ({ withAuth } = (0, import_auth.createAuth)({
      listKey: "User",
      identityField: "email",
      secretField: "password",
      initFirstItem: {
        fields: ["name", "email", "password"],
        itemData: {
          role: {
            create: {
              name: "Admin",
              canSeeOtherPeople: true,
              canEditOtherPeople: true,
              canManagePeople: true,
              canManageRoles: true,
              canAccessDashboard: true,
              canManageOnboarding: true,
              canManageServices: true,
              canManageStaff: true,
              canManageSchedules: true,
              canManageAppointments: true,
              canManageQueue: true,
              canManageCustomers: true,
              canManageCustomerNotes: true,
              canManageMemberships: true,
              canManagePayments: true,
              canViewReports: true
            }
          }
        }
      },
      passwordResetLink: {
        async sendToken(args) {
          await sendPasswordResetEmail(args.token, args.identity);
        }
      },
      sessionData: `
    name
    email
    onboardingStatus
    activeShop { id slug status }
    shopMemberships(where: { status: { equals: active } }) {
      id
      status
      membershipRole
      shop { id slug status }
    }
    role {
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageOnboarding
      canManageServices
      canManageStaff
      canManageSchedules
      canManageAppointments
      canManageQueue
      canManageCustomers
      canManageCustomerNotes
      canManageMemberships
      canManagePayments
      canViewReports
    }
  `
    }));
    keystone_default = withAuth(
      (0, import_core49.config)({
        db: {
          provider: "postgresql",
          url: pooledDatabaseUrl(databaseURL),
          extendPrismaClient: bindDomainPrisma
        },
        lists: models,
        storage: {
          my_images: {
            kind: "s3",
            type: "image",
            bucketName,
            region,
            accessKeyId,
            secretAccessKey,
            endpoint,
            signed: { expiry: 5e3 },
            forcePathStyle: s3ForcePathStyle(endpoint)
          }
        },
        ui: {
          isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
        },
        session: (0, import_session.statelessSessions)(sessionConfig),
        graphql: {
          extendGraphqlSchema
        }
      })
    );
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);
init_keystone();
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map

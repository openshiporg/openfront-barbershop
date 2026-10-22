import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { s3ForcePathStyle } from "./lib/s3-storage";

import { bindDomainPrisma } from './utils/domainPrisma';
import { runtimeConfig } from './utils/runtimeConfig';

const { databaseURL, sessionConfig } = runtimeConfig();

const {
  S3_BUCKET_NAME: bucketName = "keystone-test",
  S3_REGION: region = "ap-southeast-2",
  S3_ACCESS_KEY_ID: accessKeyId = "keystone",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
  S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com",
} = process.env;

const { withAuth } = createAuth({
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
          canViewReports: true,
        },
      },
    },
  },
  passwordResetLink: {
    async sendToken(args) {
      // send the email
      await sendPasswordResetEmail(args.token, args.identity);
    },
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
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
      extendPrismaClient: bindDomainPrisma,
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
        signed: { expiry: 5000 },
        forcePathStyle: s3ForcePathStyle(endpoint),
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
    },
  })
);
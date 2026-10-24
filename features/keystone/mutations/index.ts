import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import checkBarberAvailability from "../queries/checkBarberAvailability";
import createOnlineBooking, { createAccountBooking } from "./createOnlineBooking";
import { exportMyAccountData, getAccountBookings, recoverAccountBooking } from "../queries/getAccountBookings";
import { recoverGuestBooking } from "../utils/guestBookingCommand";
import checkoutAppointment from "./checkoutAppointment";
import ensureDefaultPaymentProvider from "./ensureDefaultPaymentProvider";
import getPublicAppointment from "../queries/getPublicAppointment";
import getPublicBookingEligibility from '../queries/getPublicBookingEligibility';
import { getPublicBarbers, getPublicProducts, getPublicServiceCatalog } from "../queries/getPublicServices";
import getPublicStorefrontSettings from "../queries/getStorefrontSettings";
import { getPublicQueue, getPublicQueueEntry, getPublicWalkInStatus } from "../queries/getPublicQueue";
import createPublicQueueEntry from "./createPublicQueueEntry";
import runBarbershopOnboarding from "./runBarbershopOnboarding";
import initiateAppointmentPaymentSession from "./initiateAppointmentPaymentSession";
import captureAppointmentPaymentSession from "./captureAppointmentPaymentSession";
import refundAppointmentPaymentSession from "./refundAppointmentPaymentSession";
import cancelAppointmentPaymentSession from "./cancelAppointmentPaymentSession";
import recordInventoryMovement from "./recordInventoryMovement";
import receiveInventoryLot from "./receiveInventoryLot";
import seatWalkInQueueEntry from "./seatWalkInQueueEntry";
import transitionAppointment from "./transitionAppointment";
import transitionQueueEntry from "./transitionQueueEntry";
import selectActiveShop from "./selectActiveShop";
import claimShopOwnership, { claimableShops } from "./claimShopOwnership";
import markAppointmentNoShow from "./markAppointmentNoShow";
import { createCommissionPayout, transitionCommission } from "./manageCommissions";
import { recordProductSale, returnProductSaleLine } from "./manageProductSales";
import reconcilePaymentSession from "./reconcilePaymentSession";
import { addCustomerNote, issueCustomerWaiver, setCustomerConsent, setCustomerStatus } from "./manageCustomers";
import manageMembership from "./manageMemberships";
import refundCashCheckout from './refundCashCheckout';
import { linkBarberAccount, manageScheduleException, manageStaffShift } from "./manageWorkforce";
import manageWaitlist from "./manageWaitlist";
import { createStaffAppointment, manageStaffAppointment } from "./staffAppointments";
import { assignWalkInQueueEntry, createStaffQueueEntry } from "./staffQueueEntries";
import managePublicAppointment from './managePublicAppointment';
import signPublicWaiver from './signPublicWaiver';
import setPractitionerCredentialStatus from './setPractitionerCredentialStatus';
import {
  getActiveShopStorefrontSettings,
  updateActiveShopStorefrontSettings,
} from './manageStorefrontSettings';
import {
  getBookingProjection,
  getCustomersProjection,
  getOperationsProjection,
  getPosProjection,
  getQueueProjection,
  getReportsProjection,
  getServicesProjection,
  getStaffProjection,
} from "../queries/getPlatformProjections";

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
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
        isDemo: Boolean!
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
          isDemo: Boolean!
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

        markAppointmentNoShow(appointmentId: ID!, policyId: ID, reason: String!, idempotencyKey: String!): DomainCommandResult!
        transitionCommission(commissionId: ID!, toStatus: String!, reason: String, idempotencyKey: String!): DomainCommandResult!
        payApprovedCommissions(commissionIds: [ID!]!, notes: String, idempotencyKey: String!): DomainCommandResult!
        refundCashCheckout(transactionId: ID!, reason: String!, cashReturned: Boolean!, idempotencyKey: String!): DomainCommandResult!
        recordProductSale(productId: ID!, quantity: Int!, paymentMethod: String!, taxRateBps: Int, idempotencyKey: String!): DomainCommandResult!
        returnProductSaleLine(saleLineId: ID!, quantity: Int!, reason: String!, cashReturned: Boolean, restock: Boolean, idempotencyKey: String!): DomainCommandResult!
        reconcilePaymentSession(paymentSessionId: ID!, idempotencyKey: String!): DomainCommandResult!
        addCustomerNote(customerId: ID!, body: String!, noteType: String, visibility: String, appointmentId: ID, idempotencyKey: String!): DomainCommandResult!
        setCustomerStatus(customerId: ID!, status: String!, reason: String, idempotencyKey: String!): DomainCommandResult!
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
        redirectToInit,
        getPublicStorefrontSettings,
        getPublicServiceCatalog,
        accountBookings: getAccountBookings,
        exportMyAccountData,
        getPublicBookingEligibility,
        getPublicBarbers,
        getPublicProducts,
        activeShopStorefrontSettings: async (root, args, context) => {
          try { return { success: true, error: null, data: await getActiveShopStorefrontSettings(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load storefront settings.', data: null }; }
        },
        platformBooking: async (root, args, context) => {
          try { return { success: true, error: null, data: await getBookingProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load booking.', data: null }; }
        },
        platformQueue: async (root, args, context) => {
          try { return { success: true, error: null, data: await getQueueProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load queue.', data: null }; }
        },
        platformCustomers: async (root, args, context) => {
          try { return { success: true, error: null, data: await getCustomersProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load customers.', data: null }; }
        },
        platformPos: async (root, args, context) => {
          try { return { success: true, error: null, data: await getPosProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load POS.', data: null }; }
        },
        platformReports: async (root, args, context) => {
          try { return { success: true, error: null, data: await getReportsProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load reports.', data: null }; }
        },
        platformServices: async (root, args, context) => {
          try { return { success: true, error: null, data: await getServicesProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load services.', data: null }; }
        },
        platformStaff: async (root, args, context) => {
          try { return { success: true, error: null, data: await getStaffProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load staff.', data: null }; }
        },
        platformOperations: async (root, args, context) => {
          try { return { success: true, error: null, data: await getOperationsProjection(root, args, context) }; }
          catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load operations.', data: null }; }
        },
        checkBarberAvailability,
        getPublicQueue,
        getPublicQueueEntry,
        claimableShops,
        getPublicWalkInStatus,
        getPublicAppointment,
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
          const result = await receiveInventoryLot(root, args, context); return { success: result.success, error: result.error, data: result.received };
        },
        seatWalkInQueueEntry,
        transitionAppointment,
        transitionQueueEntry,
        selectActiveShop,
        claimShopOwnership,
        markAppointmentNoShow: async (root, args, context) => {
          const result = await markAppointmentNoShow(root, args, context); return { success: result.success, error: result.error, data: result.evidence };
        },
        transitionCommission: async (root, args, context) => {
          const result = await transitionCommission(root, args, context); return { success: result.success, error: result.error, data: result.commission };
        },
        payApprovedCommissions: async (root, args, context) => {
          const result = await createCommissionPayout(root, args, context); return { success: result.success, error: result.error, data: result.payout };
        },
        refundCashCheckout,
        recordProductSale: async (root, args, context) => {
          const result = await recordProductSale(root, args, context); return { success: result.success, error: result.error, data: result.sale };
        },
        returnProductSaleLine: async (root, args, context) => {
          const result = await returnProductSaleLine(root, args, context); return { success: result.success, error: result.error, data: result.returned };
        },
        reconcilePaymentSession: async (root, args, context) => {
          const result = await reconcilePaymentSession(root, args, context); return { success: result.success, error: result.error, data: result.reconciliation };
        },
        addCustomerNote: async (root, args, context) => {
          const result = await addCustomerNote(root, args, context); return { success: result.success, error: result.error, data: result.note };
        },
        setCustomerStatus: async (root, args, context) => {
          const result = await setCustomerStatus(root, args, context); return { success: result.success, error: result.error, data: result.customer };
        },
        setCustomerConsent: async (root, args, context) => {
          const result = await setCustomerConsent(root, args, context); return { success: result.success, error: result.error, data: result.customer };
        },
        issueCustomerWaiver: async (root, args, context) => {
          const result = await issueCustomerWaiver(root, args, context); return { success: result.success, error: result.error, data: result.waiver };
        },
        manageMembership: async (root, args, context) => {
          const result = await manageMembership(root, args, context); return { success: result.success, error: result.error, data: result.membership };
        },
        manageStaffShift: async (root, args, context) => {
          const result = await manageStaffShift(root, args, context); return { success: result.success, error: result.error, data: result.shift };
        },
        linkBarberAccount: async (root, args, context) => {
          const result = await linkBarberAccount(root, args, context); return { success: result.success, error: result.error, data: result.barber };
        },
        manageScheduleException: async (root, args, context) => {
          const result = await manageScheduleException(root, args, context); return { success: result.success, error: result.error, data: result.exception };
        },
        manageWaitlist: async (root, args, context) => {
          const result = await manageWaitlist(root, args, context); return { success: result.success, error: result.error, data: result.entry };
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
            result: response.result
              ? {
                  mode: response.result.mode,
                  databaseName: null,
                  dryRun: response.result.dryRun,
                  stats: Object.entries(response.result.stats).map(([listKey, stat]) => ({
                    listKey,
                    created: stat.created,
                    reused: stat.reused,
                    skipped: stat.skipped ?? 0,
                  })),
                }
              : null,
          };
        },
      },
    },
  });
}

/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ServiceCategoryStatusType" AS ENUM ('active', 'hidden');

-- CreateEnum
CREATE TYPE "ServiceStatusType" AS ENUM ('active', 'hidden', 'archived');

-- CreateEnum
CREATE TYPE "BarberStatusType" AS ENUM ('active', 'away', 'inactive');

-- CreateEnum
CREATE TYPE "BarberScheduleDayOfWeekType" AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- CreateEnum
CREATE TYPE "CustomerStatusType" AS ENUM ('active', 'vip', 'needs_attention', 'blocked');

-- CreateEnum
CREATE TYPE "CustomerPreferredContactMethodType" AS ENUM ('sms', 'email', 'phone');

-- CreateEnum
CREATE TYPE "CustomerNoteNoteTypeType" AS ENUM ('preference', 'formula', 'service_issue', 'general');

-- CreateEnum
CREATE TYPE "CustomerNoteVisibilityType" AS ENUM ('staff', 'owner');

-- CreateEnum
CREATE TYPE "AppointmentStatusType" AS ENUM ('requested', 'confirmed', 'checked_in', 'in_chair', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "AppointmentSourceType" AS ENUM ('online', 'phone', 'walk_in', 'staff');

-- CreateEnum
CREATE TYPE "AppointmentPaymentStatusType" AS ENUM ('not_required', 'deposit_due', 'deposit_paid', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "WalkInQueueEntryStatusType" AS ENUM ('waiting', 'texted', 'in_chair', 'served', 'left');

-- CreateEnum
CREATE TYPE "MembershipPlanBillingIntervalType" AS ENUM ('monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "MembershipPlanStatusType" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ServicePackageStatusType" AS ENUM ('active', 'hidden', 'archived');

-- CreateEnum
CREATE TYPE "CustomerPackageStatusType" AS ENUM ('active', 'paused', 'used_up', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "CheckoutTransactionStatusType" AS ENUM ('open', 'paid', 'partially_refunded', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "CheckoutTransactionPaymentMethodType" AS ENUM ('cash', 'card', 'package', 'gift_card', 'other');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canManageAllTodos",
ADD COLUMN     "canManageAppointments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCustomerNotes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCustomers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageMemberships" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageQueue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSchedules" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageServices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewReports" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER DEFAULT 0,
    "status" "ServiceCategoryStatusType" DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "price" INTEGER NOT NULL,
    "depositRequired" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" INTEGER DEFAULT 0,
    "status" "ServiceStatusType" DEFAULT 'active',
    "bookingBufferMinutes" INTEGER DEFAULT 10,
    "color" TEXT NOT NULL DEFAULT '#111827',
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barber" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "chairNumber" TEXT NOT NULL DEFAULT '',
    "status" "BarberStatusType" DEFAULT 'active',
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bufferMinutes" INTEGER DEFAULT 10,
    "user" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberSchedule" (
    "id" TEXT NOT NULL,
    "barber" TEXT,
    "dayOfWeek" "BarberScheduleDayOfWeekType" NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "startMinute" INTEGER DEFAULT 540,
    "endMinute" INTEGER DEFAULT 1020,
    "breakStartMinute" INTEGER,
    "breakEndMinute" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarberSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "status" "CustomerStatusType" DEFAULT 'active',
    "preferredContactMethod" "CustomerPreferredContactMethodType" DEFAULT 'sms',
    "acceptsMarketing" BOOLEAN NOT NULL DEFAULT true,
    "birthday" TIMESTAMP(3),
    "lastVisitAt" TIMESTAMP(3),
    "user" TEXT,
    "preferredBarber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "noteType" "CustomerNoteNoteTypeType" DEFAULT 'general',
    "body" TEXT NOT NULL DEFAULT '',
    "visibility" "CustomerNoteVisibilityType" DEFAULT 'staff',
    "appointment" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "barber" TEXT,
    "service" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "durationMinutes" INTEGER DEFAULT 30,
    "status" "AppointmentStatusType" DEFAULT 'requested',
    "source" "AppointmentSourceType" DEFAULT 'online',
    "paymentStatus" "AppointmentPaymentStatusType" DEFAULT 'not_required',
    "price" INTEGER,
    "depositAmount" INTEGER DEFAULT 0,
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "customerNotes" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "queueEntry" TEXT,
    "transaction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalkInQueueEntry" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "partySize" INTEGER DEFAULT 1,
    "status" "WalkInQueueEntryStatusType" DEFAULT 'waiting',
    "requestedService" TEXT,
    "requestedBarber" TEXT,
    "quotedWaitMinutes" INTEGER DEFAULT 20,
    "checkedInAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "seatedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalkInQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "billingInterval" "MembershipPlanBillingIntervalType" DEFAULT 'monthly',
    "includedVisits" INTEGER DEFAULT 1,
    "discountPercent" INTEGER DEFAULT 0,
    "status" "MembershipPlanStatusType" DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "status" "ServicePackageStatusType" DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackageItem" (
    "id" TEXT NOT NULL,
    "package" TEXT,
    "service" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPackage" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "servicePackage" TEXT,
    "membershipPlan" TEXT,
    "remainingVisits" INTEGER DEFAULT 0,
    "status" "CustomerPackageStatusType" DEFAULT 'active',
    "startsAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutTransaction" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "barber" TEXT,
    "packageBalance" TEXT,
    "status" "CheckoutTransactionStatusType" DEFAULT 'open',
    "subtotal" INTEGER DEFAULT 0,
    "tipAmount" INTEGER DEFAULT 0,
    "taxAmount" INTEGER DEFAULT 0,
    "discountAmount" INTEGER DEFAULT 0,
    "total" INTEGER DEFAULT 0,
    "paymentMethod" "CheckoutTransactionPaymentMethodType" DEFAULT 'card',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Barber_specialties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Barber_user_key" ON "Barber"("user");

-- CreateIndex
CREATE INDEX "BarberSchedule_barber_idx" ON "BarberSchedule"("barber");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_user_key" ON "Customer"("user");

-- CreateIndex
CREATE INDEX "Customer_preferredBarber_idx" ON "Customer"("preferredBarber");

-- CreateIndex
CREATE INDEX "CustomerNote_customer_idx" ON "CustomerNote"("customer");

-- CreateIndex
CREATE INDEX "CustomerNote_appointment_idx" ON "CustomerNote"("appointment");

-- CreateIndex
CREATE INDEX "CustomerNote_createdBy_idx" ON "CustomerNote"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_queueEntry_key" ON "Appointment"("queueEntry");

-- CreateIndex
CREATE INDEX "Appointment_customer_idx" ON "Appointment"("customer");

-- CreateIndex
CREATE INDEX "Appointment_barber_idx" ON "Appointment"("barber");

-- CreateIndex
CREATE INDEX "Appointment_service_idx" ON "Appointment"("service");

-- CreateIndex
CREATE INDEX "Appointment_transaction_idx" ON "Appointment"("transaction");

-- CreateIndex
CREATE INDEX "WalkInQueueEntry_requestedService_idx" ON "WalkInQueueEntry"("requestedService");

-- CreateIndex
CREATE INDEX "WalkInQueueEntry_requestedBarber_idx" ON "WalkInQueueEntry"("requestedBarber");

-- CreateIndex
CREATE INDEX "WalkInQueueEntry_customer_idx" ON "WalkInQueueEntry"("customer");

-- CreateIndex
CREATE INDEX "ServicePackageItem_package_idx" ON "ServicePackageItem"("package");

-- CreateIndex
CREATE INDEX "ServicePackageItem_service_idx" ON "ServicePackageItem"("service");

-- CreateIndex
CREATE INDEX "CustomerPackage_customer_idx" ON "CustomerPackage"("customer");

-- CreateIndex
CREATE INDEX "CustomerPackage_servicePackage_idx" ON "CustomerPackage"("servicePackage");

-- CreateIndex
CREATE INDEX "CustomerPackage_membershipPlan_idx" ON "CustomerPackage"("membershipPlan");

-- CreateIndex
CREATE INDEX "CheckoutTransaction_customer_idx" ON "CheckoutTransaction"("customer");

-- CreateIndex
CREATE INDEX "CheckoutTransaction_barber_idx" ON "CheckoutTransaction"("barber");

-- CreateIndex
CREATE INDEX "CheckoutTransaction_packageBalance_idx" ON "CheckoutTransaction"("packageBalance");

-- CreateIndex
CREATE UNIQUE INDEX "_Barber_specialties_AB_unique" ON "_Barber_specialties"("A", "B");

-- CreateIndex
CREATE INDEX "_Barber_specialties_B_index" ON "_Barber_specialties"("B");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_category_fkey" FOREIGN KEY ("category") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberSchedule" ADD CONSTRAINT "BarberSchedule_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_preferredBarber_fkey" FOREIGN KEY ("preferredBarber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_queueEntry_fkey" FOREIGN KEY ("queueEntry") REFERENCES "WalkInQueueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkInQueueEntry" ADD CONSTRAINT "WalkInQueueEntry_requestedService_fkey" FOREIGN KEY ("requestedService") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkInQueueEntry" ADD CONSTRAINT "WalkInQueueEntry_requestedBarber_fkey" FOREIGN KEY ("requestedBarber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkInQueueEntry" ADD CONSTRAINT "WalkInQueueEntry_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_package_fkey" FOREIGN KEY ("package") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_servicePackage_fkey" FOREIGN KEY ("servicePackage") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_membershipPlan_fkey" FOREIGN KEY ("membershipPlan") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutTransaction" ADD CONSTRAINT "CheckoutTransaction_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutTransaction" ADD CONSTRAINT "CheckoutTransaction_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutTransaction" ADD CONSTRAINT "CheckoutTransaction_packageBalance_fkey" FOREIGN KEY ("packageBalance") REFERENCES "CustomerPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Barber_specialties" ADD CONSTRAINT "_Barber_specialties_A_fkey" FOREIGN KEY ("A") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Barber_specialties" ADD CONSTRAINT "_Barber_specialties_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

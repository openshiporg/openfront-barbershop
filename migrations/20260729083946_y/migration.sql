-- CreateEnum
CREATE TYPE "ScheduleExceptionExceptionTypeType" AS ENUM ('time_off', 'shop_closure', 'chair_unavailable', 'working_override');

-- CreateEnum
CREATE TYPE "ScheduleExceptionStatusType" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "StaffShiftStatusType" AS ENUM ('scheduled', 'clocked_in', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MembershipEventEventTypeType" AS ENUM ('purchased', 'renewed', 'paused', 'resumed', 'cancelled');

-- AlterTable
ALTER TABLE "CustomerPackage" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "nextBillingAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "barber" TEXT,
    "chair" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL DEFAULT '',
    "exceptionType" "ScheduleExceptionExceptionTypeType" DEFAULT 'time_off',
    "status" "ScheduleExceptionStatusType" DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "barber" TEXT,
    "chair" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL DEFAULT '',
    "status" "StaffShiftStatusType" DEFAULT 'scheduled',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "clockedInAt" TIMESTAMP(3),
    "clockedOutAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customer" TEXT,
    "membershipPlan" TEXT,
    "customerPackage" TEXT,
    "transaction" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL DEFAULT '',
    "eventType" "MembershipEventEventTypeType" NOT NULL,
    "planNameSnapshot" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER DEFAULT 0,
    "visitsDelta" INTEGER DEFAULT 0,
    "resultingVisits" INTEGER DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_idempotencyKeyHash_key" ON "ScheduleException"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "ScheduleException_shop_idx" ON "ScheduleException"("shop");

-- CreateIndex
CREATE INDEX "ScheduleException_barber_idx" ON "ScheduleException"("barber");

-- CreateIndex
CREATE INDEX "ScheduleException_chair_idx" ON "ScheduleException"("chair");

-- CreateIndex
CREATE UNIQUE INDEX "StaffShift_idempotencyKeyHash_key" ON "StaffShift"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "StaffShift_shop_idx" ON "StaffShift"("shop");

-- CreateIndex
CREATE INDEX "StaffShift_barber_idx" ON "StaffShift"("barber");

-- CreateIndex
CREATE INDEX "StaffShift_chair_idx" ON "StaffShift"("chair");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipEvent_idempotencyKeyHash_key" ON "MembershipEvent"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "MembershipEvent_shop_idx" ON "MembershipEvent"("shop");

-- CreateIndex
CREATE INDEX "MembershipEvent_customer_idx" ON "MembershipEvent"("customer");

-- CreateIndex
CREATE INDEX "MembershipEvent_membershipPlan_idx" ON "MembershipEvent"("membershipPlan");

-- CreateIndex
CREATE INDEX "MembershipEvent_customerPackage_idx" ON "MembershipEvent"("customerPackage");

-- CreateIndex
CREATE INDEX "MembershipEvent_transaction_idx" ON "MembershipEvent"("transaction");

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_chair_fkey" FOREIGN KEY ("chair") REFERENCES "BarberChair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_chair_fkey" FOREIGN KEY ("chair") REFERENCES "BarberChair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEvent" ADD CONSTRAINT "MembershipEvent_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEvent" ADD CONSTRAINT "MembershipEvent_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEvent" ADD CONSTRAINT "MembershipEvent_membershipPlan_fkey" FOREIGN KEY ("membershipPlan") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEvent" ADD CONSTRAINT "MembershipEvent_customerPackage_fkey" FOREIGN KEY ("customerPackage") REFERENCES "CustomerPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEvent" ADD CONSTRAINT "MembershipEvent_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

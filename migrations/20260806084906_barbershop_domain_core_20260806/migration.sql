/*
  Warnings:

  - The primary key for the `_Barber_specialties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[signatureKeyHash]` on the table `WaiverForm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Barber_specialties` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PractitionerCredentialCredentialTypeType" AS ENUM ('barber', 'master_barber', 'apprentice', 'cosmetology', 'other');

-- CreateEnum
CREATE TYPE "PractitionerCredentialStatusType" AS ENUM ('active', 'suspended', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "BookingPolicyStatusType" AS ENUM ('active', 'retired');

-- CreateEnum
CREATE TYPE "BookingPolicyDepositCancellationRuleType" AS ENUM ('refund', 'forfeit', 'manual_review');

-- CreateEnum
CREATE TYPE "AppointmentChangeEventActionType" AS ENUM ('cancelled', 'rescheduled');

-- CreateEnum
CREATE TYPE "AppointmentChangeEventActorTypeType" AS ENUM ('customer', 'operator');

-- CreateEnum
CREATE TYPE "AppointmentChangeEventDepositConsequenceType" AS ENUM ('none', 'refund_required', 'forfeiture_pending', 'manual_review');

-- CreateEnum
CREATE TYPE "WaiverFormSignerRoleType" AS ENUM ('customer', 'guardian');

-- AlterEnum
ALTER TYPE "WaiverFormWaiverTypeType" ADD VALUE 'service';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bookingAuthoritySnapshot" JSONB,
ADD COLUMN     "bookingPolicySnapshot" JSONB,
ADD COLUMN     "customerRescheduleCount" INTEGER DEFAULT 0,
ADD COLUMN     "executionAuthoritySnapshot" JSONB,
ADD COLUMN     "serviceCompletedAt" TIMESTAMP(3),
ADD COLUMN     "serviceStartedAt" TIMESTAMP(3),
ADD COLUMN     "waiverRequirementSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "acceptsMarketing" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "waiverRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waiverTemplateHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waiverTemplateKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waiverTemplateText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waiverTemplateVersion" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "jurisdictionCode" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "WaiverForm" ADD COLUMN     "affirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "affirmationHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "guardianName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "service" TEXT,
ADD COLUMN     "signatureKeyHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "signerRole" "WaiverFormSignerRoleType",
ADD COLUMN     "templateHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "templateKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "templateVersion" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "_Barber_specialties" DROP CONSTRAINT "_Barber_specialties_AB_pkey";

-- CreateTable
CREATE TABLE "PractitionerCredential" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "barber" TEXT,
    "service" TEXT,
    "supervisor" TEXT,
    "credentialType" "PractitionerCredentialCredentialTypeType" NOT NULL,
    "credentialNumber" TEXT NOT NULL DEFAULT '',
    "issuingAuthority" TEXT NOT NULL DEFAULT '',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "scopeDescription" TEXT NOT NULL DEFAULT '',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "status" "PractitionerCredentialStatusType" NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "supervisionRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPolicy" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "policyTextHash" TEXT NOT NULL DEFAULT '',
    "status" "BookingPolicyStatusType" DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "cancellationWindowMinutes" INTEGER NOT NULL DEFAULT 1440,
    "rescheduleWindowMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lateCancellationFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "rescheduleFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "depositCancellationRule" "BookingPolicyDepositCancellationRuleType" DEFAULT 'manual_review',
    "maxCustomerReschedules" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentChangeEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "appointment" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "action" "AppointmentChangeEventActionType" NOT NULL,
    "actorType" "AppointmentChangeEventActorTypeType" NOT NULL,
    "actorReferenceHash" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "previousStartsAt" TIMESTAMP(3) NOT NULL,
    "previousEndsAt" TIMESTAMP(3),
    "nextStartsAt" TIMESTAMP(3),
    "nextEndsAt" TIMESTAMP(3),
    "policySnapshot" JSONB,
    "authoritySnapshot" JSONB,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "depositConsequence" "AppointmentChangeEventDepositConsequenceType" DEFAULT 'none',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PractitionerCredential_shop_idx" ON "PractitionerCredential"("shop");

-- CreateIndex
CREATE INDEX "PractitionerCredential_barber_idx" ON "PractitionerCredential"("barber");

-- CreateIndex
CREATE INDEX "PractitionerCredential_service_idx" ON "PractitionerCredential"("service");

-- CreateIndex
CREATE INDEX "PractitionerCredential_supervisor_idx" ON "PractitionerCredential"("supervisor");

-- CreateIndex
CREATE INDEX "BookingPolicy_shop_idx" ON "BookingPolicy"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentChangeEvent_eventKey_key" ON "AppointmentChangeEvent"("eventKey");

-- CreateIndex
CREATE INDEX "AppointmentChangeEvent_shop_idx" ON "AppointmentChangeEvent"("shop");

-- CreateIndex
CREATE INDEX "AppointmentChangeEvent_appointment_idx" ON "AppointmentChangeEvent"("appointment");

-- CreateIndex
CREATE UNIQUE INDEX "WaiverForm_signatureKeyHash_key" ON "WaiverForm"("signatureKeyHash");

-- CreateIndex
CREATE INDEX "WaiverForm_service_idx" ON "WaiverForm"("service");

-- CreateIndex
CREATE UNIQUE INDEX "_Barber_specialties_AB_unique" ON "_Barber_specialties"("A", "B");

-- AddForeignKey
ALTER TABLE "PractitionerCredential" ADD CONSTRAINT "PractitionerCredential_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerCredential" ADD CONSTRAINT "PractitionerCredential_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerCredential" ADD CONSTRAINT "PractitionerCredential_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerCredential" ADD CONSTRAINT "PractitionerCredential_supervisor_fkey" FOREIGN KEY ("supervisor") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPolicy" ADD CONSTRAINT "BookingPolicy_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentChangeEvent" ADD CONSTRAINT "AppointmentChangeEvent_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentChangeEvent" ADD CONSTRAINT "AppointmentChangeEvent_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverForm" ADD CONSTRAINT "WaiverForm_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

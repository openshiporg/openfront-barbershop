-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" DEFAULT 'not_started';

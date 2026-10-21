-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "publicAccessTokenHash" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "WalkInQueueEntry" ADD COLUMN     "publicAccessTokenHash" TEXT NOT NULL DEFAULT '';

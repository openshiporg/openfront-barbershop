-- AlterTable
ALTER TABLE "LifecycleOutboxEvent" ADD COLUMN     "actorId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "WalkInQueueEntry" ALTER COLUMN "quotedWaitMinutes" DROP DEFAULT;

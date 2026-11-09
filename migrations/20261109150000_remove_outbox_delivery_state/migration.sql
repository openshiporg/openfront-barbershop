-- The lifecycle outbox never delivered anything. Keep the rows only as
-- idempotency receipts for commands: rename the table and drop the delivery state.
ALTER TABLE "LifecycleOutboxEvent" RENAME TO "CommandReceipt";
ALTER TABLE "CommandReceipt" RENAME CONSTRAINT "LifecycleOutboxEvent_pkey" TO "CommandReceipt_pkey";
ALTER TABLE "CommandReceipt" RENAME CONSTRAINT "LifecycleOutboxEvent_shop_fkey" TO "CommandReceipt_shop_fkey";
ALTER INDEX "LifecycleOutboxEvent_eventKey_key" RENAME TO "CommandReceipt_eventKey_key";
ALTER INDEX "LifecycleOutboxEvent_shop_idx" RENAME TO "CommandReceipt_shop_idx";

ALTER TABLE "CommandReceipt"
  DROP COLUMN "status",
  DROP COLUMN "attempts",
  DROP COLUMN "maxAttempts",
  DROP COLUMN "availableAt",
  DROP COLUMN "lockedAt",
  DROP COLUMN "lastAttemptAt",
  DROP COLUMN "deliveredAt",
  DROP COLUMN "lastError",
  DROP COLUMN "replayCount";

DROP TYPE "LifecycleOutboxEventStatusType";

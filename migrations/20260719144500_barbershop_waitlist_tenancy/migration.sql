ALTER TABLE "WaitlistEntry" ADD COLUMN "shop" TEXT;

UPDATE "WaitlistEntry" AS entry
SET "shop" = customer."shop"
FROM "Customer" AS customer
WHERE entry."customer" = customer."id";

UPDATE "WaitlistEntry"
SET "shop" = shop."id"
FROM "Shop" AS shop
WHERE shop."slug" = 'stack-and-fade' AND "WaitlistEntry"."shop" IS NULL;

ALTER TABLE "WaitlistEntry" ALTER COLUMN "shop" SET NOT NULL;
CREATE INDEX "WaitlistEntry_shop_idx" ON "WaitlistEntry"("shop");
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "activeShop" TEXT;

-- Preserve current single-shop behavior while making later multi-shop selection explicit.
UPDATE "User" AS app_user
SET "activeShop" = (
  SELECT membership."shop"
  FROM "ShopMembership" AS membership
  JOIN "Shop" AS shop ON shop."id" = membership."shop"
  WHERE membership."user" = app_user."id"
    AND membership."status" = 'active'
    AND shop."status" = 'active'
  ORDER BY
    CASE membership."membershipRole" WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
    membership."createdAt" ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "ShopMembership" AS membership
  JOIN "Shop" AS shop ON shop."id" = membership."shop"
  WHERE membership."user" = app_user."id"
    AND membership."status" = 'active'
    AND shop."status" = 'active'
);

CREATE INDEX "User_activeShop_idx" ON "User"("activeShop");
ALTER TABLE "User" ADD CONSTRAINT "User_activeShop_fkey" FOREIGN KEY ("activeShop") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

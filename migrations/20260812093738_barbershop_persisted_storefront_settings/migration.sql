-- Add a constrained persisted storefront palette and explicit demo marker.
CREATE TYPE "ShopBrandColorType" AS ENUM ('amber', 'indigo', 'emerald', 'rose', 'slate');

ALTER TABLE "Shop"
  ADD COLUMN "brandColor" "ShopBrandColorType" NOT NULL DEFAULT 'amber',
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "isPublic" SET DEFAULT false;

-- Upgrade only the untouched historical demo identity. Merchant-renamed shops
-- are deliberately left unchanged.
UPDATE "Shop"
SET
  "name" = 'Stack & Fade Demo Barbershop',
  "legalName" = 'Stack & Fade Demo Barbershop',
  "tagline" = 'Demo storefront — sample services, barbers, appointments, and retail catalog.',
  "address" = 'Demo location · 118 Franklin Ave, Brooklyn, NY 11205',
  "brandColor" = 'amber',
  "isDemo" = true
WHERE "slug" = 'stack-and-fade'
  AND "name" = 'Stack & Fade Barber Co.';

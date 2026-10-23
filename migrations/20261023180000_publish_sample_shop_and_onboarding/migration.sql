-- The published Stack & Fade shop now carries real copy: list it for search.
UPDATE "Shop" SET "isDemo" = false
WHERE "slug" = 'stack-and-fade' AND "name" = 'Stack & Fade' AND "isPublic" = true AND "isDemo" = true;

-- Owners of a shop that already has services and barbers have nothing left to set up.
UPDATE "User" u SET "onboardingStatus" = 'completed'
WHERE (u."onboardingStatus" IS NULL OR u."onboardingStatus" IN ('not_started', 'in_progress'))
  AND EXISTS (
    SELECT 1 FROM "ShopMembership" m
    WHERE m."user" = u.id AND m.status = 'active' AND m."membershipRole" = 'owner'
      AND EXISTS (SELECT 1 FROM "Service" s WHERE s."shop" = m."shop")
      AND EXISTS (SELECT 1 FROM "Barber" b WHERE b."shop" = m."shop")
  );

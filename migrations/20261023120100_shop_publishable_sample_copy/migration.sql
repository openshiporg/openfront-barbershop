-- Replace the placeholder "Demo" identity on the untouched sample shop with
-- the publishable sample copy. Merchant-edited values are left unchanged.
UPDATE "Shop" SET "name" = 'Stack & Fade'
WHERE "name" = 'Stack & Fade Demo Barbershop';

UPDATE "Shop" SET "legalName" = 'Stack & Fade'
WHERE "legalName" = 'Stack & Fade Demo Barbershop';

UPDATE "Shop" SET "tagline" = 'Haircuts · Beards · Walk-ins'
WHERE "tagline" = 'Demo storefront — sample services, barbers, appointments, and retail catalog.';

UPDATE "Shop" SET "address" = '118 Franklin Ave, Brooklyn, NY 11205'
WHERE "address" = 'Demo location · 118 Franklin Ave, Brooklyn, NY 11205';

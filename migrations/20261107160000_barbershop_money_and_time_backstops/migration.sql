-- Barbershop had no CHECK constraints at all; the locked writers keep these invariants, and the
-- database now backs them. Fails closed on existing violations; nothing is rewritten.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PaymentSession" WHERE "amount" < 0 OR coalesce("refundedAmount", 0) < 0 OR coalesce("refundedAmount", 0) > "amount") THEN RAISE EXCEPTION 'Payment sessions refunded beyond their amount require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "GiftCard" WHERE "initialValue" < 0 OR "balance" < 0 OR "balance" > "initialValue") THEN RAISE EXCEPTION 'Gift cards outside 0..initial value require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "CustomerPackage" WHERE coalesce("remainingVisits", 0) < 0) THEN RAISE EXCEPTION 'Packages with negative visits require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "PackageUsage" WHERE "visitsDelta" = 0 OR "balanceAfter" < 0) THEN RAISE EXCEPTION 'Package usages with zero delta or negative balance require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "Appointment" WHERE ("endsAt" IS NOT NULL AND "endsAt" <= "startsAt") OR coalesce("durationMinutes", 1) <= 0 OR coalesce("price", 0) < 0 OR coalesce("depositAmount", 0) < 0) THEN RAISE EXCEPTION 'Appointments with backwards times or negative money require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "CheckoutTransaction" WHERE coalesce("subtotal", 0) < 0 OR coalesce("tipAmount", 0) < 0 OR coalesce("taxAmount", 0) < 0 OR coalesce("discountAmount", 0) < 0 OR coalesce("total", 0) < 0) THEN RAISE EXCEPTION 'Sales with negative amounts require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "Service" WHERE "price" < 0 OR "durationMinutes" <= 0 OR coalesce("depositAmount", 0) < 0 OR coalesce("depositAmount", 0) > "price") THEN RAISE EXCEPTION 'Services with invalid price, duration or deposit require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "StaffShift" WHERE "scheduledEnd" <= "scheduledStart") THEN RAISE EXCEPTION 'Shifts that end before they start require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "ScheduleException" WHERE "endsAt" <= "startsAt") THEN RAISE EXCEPTION 'Schedule exceptions that end before they start require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "ProductSaleLine" WHERE "quantity" <= 0 OR coalesce("returnedQuantity", 0) < 0 OR coalesce("returnedQuantity", 0) > "quantity" OR "unitPrice" < 0 OR "total" < 0) THEN RAISE EXCEPTION 'Sale lines returned beyond quantity require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "InventoryLot" WHERE coalesce("quantityRemaining", 0) < 0 OR coalesce("quantityReceived", 0) < 0) THEN RAISE EXCEPTION 'Inventory lots with negative quantity require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "InventoryMovement" WHERE "quantityDelta" = 0 OR "quantityAfter" < 0) THEN RAISE EXCEPTION 'Stock movements with zero delta or negative balance require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "Tip" WHERE coalesce("amount", 0) < 0) OR EXISTS (SELECT 1 FROM "Commission" WHERE coalesce("commissionAmount", 0) < 0) OR EXISTS (SELECT 1 FROM "CommissionPayout" WHERE "totalAmount" < 0 OR "commissionCount" < 0) THEN RAISE EXCEPTION 'Negative tips or commissions require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "MembershipPlan" WHERE "price" < 0 OR coalesce("discountPercent", 0) NOT BETWEEN 0 AND 100) OR EXISTS (SELECT 1 FROM "ServicePackage" WHERE "price" < 0) OR EXISTS (SELECT 1 FROM "Product" WHERE coalesce("price", 0) < 0 OR coalesce("cost", 0) < 0) THEN RAISE EXCEPTION 'Catalog prices out of range require manual remediation'; END IF;
END $$;

ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_refund_range_check" CHECK ("amount" >= 0 AND coalesce("refundedAmount", 0) BETWEEN 0 AND "amount");
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_balance_range_check" CHECK ("initialValue" >= 0 AND "balance" BETWEEN 0 AND "initialValue");
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_visits_nonnegative_check" CHECK (coalesce("remainingVisits", 0) >= 0);
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_ledger_check" CHECK ("visitsDelta" <> 0 AND "balanceAfter" >= 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_time_and_money_check" CHECK (("endsAt" IS NULL OR "endsAt" > "startsAt") AND coalesce("durationMinutes", 1) > 0 AND coalesce("price", 0) >= 0 AND coalesce("depositAmount", 0) >= 0);
ALTER TABLE "CheckoutTransaction" ADD CONSTRAINT "CheckoutTransaction_amounts_nonnegative_check" CHECK (coalesce("subtotal", 0) >= 0 AND coalesce("tipAmount", 0) >= 0 AND coalesce("taxAmount", 0) >= 0 AND coalesce("discountAmount", 0) >= 0 AND coalesce("total", 0) >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_duration_deposit_check" CHECK ("price" >= 0 AND "durationMinutes" > 0 AND coalesce("depositAmount", 0) BETWEEN 0 AND "price");
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_window_check" CHECK ("scheduledEnd" > "scheduledStart");
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_window_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "ProductSaleLine" ADD CONSTRAINT "ProductSaleLine_quantity_money_check" CHECK ("quantity" > 0 AND coalesce("returnedQuantity", 0) BETWEEN 0 AND "quantity" AND "unitPrice" >= 0 AND "total" >= 0);
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_quantities_nonnegative_check" CHECK (coalesce("quantityRemaining", 0) >= 0 AND coalesce("quantityReceived", 0) >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ledger_check" CHECK ("quantityDelta" <> 0 AND "quantityAfter" >= 0);
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_amount_nonnegative_check" CHECK (coalesce("amount", 0) >= 0);
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_amount_nonnegative_check" CHECK (coalesce("commissionAmount", 0) >= 0);
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_amounts_nonnegative_check" CHECK ("totalAmount" >= 0 AND "commissionCount" >= 0);
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_price_discount_check" CHECK ("price" >= 0 AND coalesce("discountPercent", 0) BETWEEN 0 AND 100);
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_price_nonnegative_check" CHECK ("price" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_cost_nonnegative_check" CHECK (coalesce("price", 0) >= 0 AND coalesce("cost", 0) >= 0);

-- Additive draft; generation comparison and disposable rehearsal are pending a named lane.
-- Existing immutable policies retain their original direct active-service eligibility.
-- No historical Appointment policy snapshots are rewritten.
CREATE TYPE "BookingPolicyPublicServiceEligibilityType" AS ENUM ('legacy_active_service', 'active_catalog');
ALTER TABLE "BookingPolicy" ADD COLUMN "publicServiceEligibility" "BookingPolicyPublicServiceEligibilityType" NOT NULL DEFAULT 'legacy_active_service';

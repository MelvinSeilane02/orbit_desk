-- Enforces orbit-desk-master-build-prompt.md §7a, adapted: onboarding status
-- is auto-derived from contact completeness rather than manually toggled
-- (overriding, for this one field, the original Master Build Spec tie-break
-- documented in WHAT_WAS_BUILT.md). Mirrors the style of the existing
-- completion-guard trigger (fn_projects_guard_completion).
--
-- A client is "complete" once first name, surname, and email are all
-- present and non-blank. Complete -> onboarded, incomplete -> pending,
-- recalculated on every insert/update. A manually-set 'rejected' status is
-- exempt and is never overridden by this trigger — see
-- rejectClientAction/restoreClientAction in src/lib/actions/clients.ts.

CREATE OR REPLACE FUNCTION fn_clients_set_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  NEW."onboardingComplete" := (
    NEW."primaryContactFirstName" IS NOT NULL AND btrim(NEW."primaryContactFirstName") <> '' AND
    NEW."primaryContactSurname"   IS NOT NULL AND btrim(NEW."primaryContactSurname")   <> '' AND
    NEW."email"                   IS NOT NULL AND btrim(NEW."email")                   <> ''
  );

  IF NEW."onboardingStatus" <> 'rejected' THEN
    NEW."onboardingStatus" := CASE WHEN NEW."onboardingComplete" THEN 'onboarded' ELSE 'pending' END::"OnboardingStatus";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_set_onboarding ON "clients";

CREATE TRIGGER trg_clients_set_onboarding
  BEFORE INSERT OR UPDATE ON "clients"
  FOR EACH ROW
  EXECUTE FUNCTION fn_clients_set_onboarding();

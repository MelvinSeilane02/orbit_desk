-- Enforces spec §5: "Completed requires Transferred first" and the Master Build
-- Spec's stage-transition rule, at the database level, not just in application code
-- (mirrors the completion-guard trigger described in orbit-desk-master-build-prompt.md §29).
--
-- A project may only move into stage = 'completed' if its *previous* stored stage
-- was 'transferred'. This blocks skipping straight from e.g. 'active' or 'built'
-- to 'completed' even if application code has a bug, while still allowing every
-- other transition (including moving out of 'completed' back to 'transferred' if
-- ever needed for a correction).

CREATE OR REPLACE FUNCTION fn_projects_guard_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'completed' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'transferred') THEN
    RAISE EXCEPTION 'A project can only be marked Completed from the Transferred stage';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_guard_completion ON "projects";

CREATE TRIGGER trg_projects_guard_completion
  BEFORE INSERT OR UPDATE ON "projects"
  FOR EACH ROW
  EXECUTE FUNCTION fn_projects_guard_completion();

-- ============================================================================
-- N6-14 — HOUSEHOLD LIFECYCLE RECONCILE (CR-08)  —  DRAFT, DO NOT APPLY BLINDLY.
-- Runs AFTER 20260816_household_lifecycle.sql has COMMITTED (its own transaction), i.e. once the
-- family AFTER INSERT trigger is visible to other sessions. Closes the deployment-window gap:
-- a family committed by another session AFTER the primary backfill statement but BEFORE the primary
-- COMMIT would have been missed by the snapshot backfill and would not yet see the trigger. This
-- generic, idempotent pass stamps any family that still lacks a lifecycle row.
--
-- Uses the SAME canonical cutoff (public.household_lifecycle_tracking_cutoff()) — no second literal.
-- MISSING AUTHORITY (created_by NULL / auth row absent / timestamp unavailable) → legacy_unknown,
-- NEVER never_initialized. Item evidence → initialized.
--
-- TWO post-commit convergence guarantees (idempotent, monotone):
--   A. every family has a lifecycle row (INSERT the missing ones, lineage-aware);
--   B. every family with CURRENT positive item evidence is INITIALIZED (promote existing
--      non-initialized rows) — closes the race where the first item was inserted after the primary
--      backfill but before the primary COMMIT (item trigger not yet visible → no transition).
-- No negative reclassification: zero-item existing rows are never changed; an already-initialized row
-- is never touched (its original initialized_at is preserved; no downgrade; no timestamp churn).
-- ============================================================================

BEGIN;

-- A. Insert lifecycle rows for families that still have none (lineage-aware classification).
INSERT INTO public.household_lifecycle (family_id, state, initialized_at)
SELECT f.id,
       CASE
         WHEN EXISTS (SELECT 1 FROM public.items i WHERE i.family_id = f.id)
           THEN 'initialized'
         WHEN (SELECT u.created_at FROM auth.users u WHERE u.id = f.created_by)
              >= public.household_lifecycle_tracking_cutoff()
           THEN 'never_initialized'         -- Auth prouvé créé après le cutoff → foyer réellement neuf
         ELSE 'legacy_unknown'              -- item absent + Auth pre-cutoff / NULL / introuvable → UNKNOWN (jamais NEVER)
       END,
       CASE
         WHEN EXISTS (SELECT 1 FROM public.items i WHERE i.family_id = f.id)
           THEN COALESCE((SELECT min(i.created_at) FROM public.items i WHERE i.family_id = f.id), now())
         ELSE NULL
       END
FROM public.families f
WHERE NOT EXISTS (SELECT 1 FROM public.household_lifecycle hl WHERE hl.family_id = f.id)
ON CONFLICT (family_id) DO NOTHING;

-- B. Promote EXISTING non-initialized rows to initialized where CURRENT item evidence exists.
--    Positive evidence overrides never_initialized / legacy_unknown. Never touches already-initialized
--    rows (WHERE state <> 'initialized') → no downgrade, no timestamp churn. Write-once initialized_at.
UPDATE public.household_lifecycle hl
SET state = 'initialized',
    initialized_at = COALESCE(
      hl.initialized_at,                                                            -- NULL for non-init rows; belt-and-suspenders
      (SELECT min(i.created_at) FROM public.items i WHERE i.family_id = hl.family_id),
      now()
    )
WHERE hl.state <> 'initialized'
  AND EXISTS (SELECT 1 FROM public.items i WHERE i.family_id = hl.family_id);

COMMIT;

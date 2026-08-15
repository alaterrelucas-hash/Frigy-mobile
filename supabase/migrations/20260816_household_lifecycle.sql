-- ============================================================================
-- N6-14 — HOUSEHOLD LIFECYCLE TRUTH (CR-08)  —  DRAFT, DO NOT APPLY BLINDLY.
-- Reviewed separately before any production application. Additive only.
--
-- Purpose: durably distinguish, HOUSEHOLD-scoped, three states —
--   never_initialized  : lifecycle tracking knows the household never persisted a stock item
--   legacy_unknown     : pre-tracking / unprovable — MUST NOT be read as "never"
--   initialized        : a canonical items INSERT has occurred (write-once, durable)
--
-- Design (see N6-14 Phase-1.x proofs):
--   * dedicated table (not a families column) → SELECT-only member RLS, definer-only writes;
--   * a families AFTER INSERT trigger stamps new households WITHOUT rewriting the existing
--     (repo-absent) setup_user_profile / handle_new_user function bodies — both paths INSERT
--     into families, so one trigger covers both authorities;
--   * an items AFTER INSERT trigger performs the write-once transition in the SAME transaction;
--   * profiles client DELETE is removed (old-client erase then no-ops, preserving lineage);
--   * the auth.users→profiles ON DELETE CASCADE FK is left UNTOUCHED (real account deletion works).
--
-- TRACKING CUTOFF: set :tracking_cutoff to the deployment timestamp at apply time.
--   auth identity created >= cutoff  → a family it creates is 'never_initialized'
--   auth identity created <  cutoff  → 'legacy_unknown' (cannot prove never)
-- ============================================================================

BEGIN;

-- Deployment cutoff. REPLACE the literal with the actual apply-time timestamp before applying.
-- (Kept as a DB-side constant function so triggers reference one stable value.)
CREATE OR REPLACE FUNCTION public.household_lifecycle_tracking_cutoff()
RETURNS timestamptz
LANGUAGE sql IMMUTABLE
AS $$ SELECT '2026-08-16T00:00:00Z'::timestamptz $$;

-- ---------------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_lifecycle (
  family_id      uuid PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
  state          text NOT NULL DEFAULT 'never_initialized'
                   CHECK (state IN ('never_initialized','legacy_unknown','initialized')),
  initialized_at timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- consistency: initialized  <=>  initialized_at IS NOT NULL
  CONSTRAINT household_lifecycle_state_consistency CHECK (
    (state = 'initialized'     AND initialized_at IS NOT NULL) OR
    (state <> 'initialized'    AND initialized_at IS NULL)
  )
);

-- ---------------------------------------------------------------------------
-- 2. RLS — member SELECT only; NO client INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------
ALTER TABLE public.household_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_lifecycle_member_select ON public.household_lifecycle;
CREATE POLICY household_lifecycle_member_select
  ON public.household_lifecycle
  FOR SELECT
  USING (
    family_id IN (SELECT p.family_id FROM public.profiles p WHERE p.id = auth.uid())
  );
-- No FOR INSERT / UPDATE / DELETE policies → authenticated clients cannot write lifecycle.
-- All writes happen through SECURITY DEFINER triggers below and this migration's backfill.

-- Least-privilege at the TABLE-privilege layer (do not rely on ambient default grants):
--   anon           → NO access at all
--   authenticated  → SELECT only (row authority still enforced by the RLS policy above)
-- Migration/trigger owner privileges are unaffected (DEFINER functions bypass this + RLS).
REVOKE ALL PRIVILEGES ON TABLE public.household_lifecycle FROM anon, authenticated;
GRANT SELECT ON TABLE public.household_lifecycle TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. BACKFILL — every existing family gets a row. LINEAGE-AWARE (identical classification to the
--    family trigger and the reconciliation pass — the three paths must never disagree):
--      item evidence                         → initialized
--      0 item + Auth created >= cutoff        → never_initialized (genuinely new household)
--      0 item + Auth pre-cutoff / NULL / absent → legacy_unknown (MISSING AUTHORITY ≠ NEVER)
--    Authority = family.created_by → auth.users.created_at (NOT families.created_at: a fallback can
--    mint a new family for an OLD Auth identity, which must stay legacy_unknown).
-- ---------------------------------------------------------------------------
INSERT INTO public.household_lifecycle (family_id, state, initialized_at)
SELECT f.id,
       CASE
         WHEN EXISTS (SELECT 1 FROM public.items i WHERE i.family_id = f.id)
           THEN 'initialized'
         WHEN (SELECT u.created_at FROM auth.users u WHERE u.id = f.created_by)
              >= public.household_lifecycle_tracking_cutoff()
           THEN 'never_initialized'
         ELSE 'legacy_unknown'
       END,
       CASE
         WHEN EXISTS (SELECT 1 FROM public.items i WHERE i.family_id = f.id)
           THEN COALESCE((SELECT min(i.created_at) FROM public.items i WHERE i.family_id = f.id), now())
         ELSE NULL
       END
FROM public.families f
ON CONFLICT (family_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. FAMILY CREATION STAMP — covers handle_new_user AND setup_user_profile (both INSERT families).
--    Definer so it can read auth.users.created_at. Never overwrites an existing lifecycle row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stamp_family_lifecycle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE auth_created timestamptz;
BEGIN
  SELECT u.created_at INTO auth_created FROM auth.users u WHERE u.id = NEW.created_by;
  INSERT INTO public.household_lifecycle (family_id, state, initialized_at)
  VALUES (
    NEW.id,
    CASE WHEN auth_created IS NOT NULL
          AND auth_created >= public.household_lifecycle_tracking_cutoff()
         THEN 'never_initialized' ELSE 'legacy_unknown' END,
    NULL
  )
  ON CONFLICT (family_id) DO NOTHING; -- idempotent; backfill/first-insert win if already present
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_family_lifecycle ON public.families;
CREATE TRIGGER trg_stamp_family_lifecycle
  AFTER INSERT ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.stamp_family_lifecycle();

-- ---------------------------------------------------------------------------
-- 5. ITEM INSERT → INITIALIZED (write-once, UPSERT, same transaction as the insert).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_household_initialized()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.household_lifecycle (family_id, state, initialized_at)
  VALUES (NEW.family_id, 'initialized', now())
  ON CONFLICT (family_id) DO UPDATE
    SET state = 'initialized',
        -- write-once: preserve the first initialized_at ever recorded
        initialized_at = COALESCE(public.household_lifecycle.initialized_at, EXCLUDED.initialized_at)
    WHERE public.household_lifecycle.state <> 'initialized';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_household_initialized ON public.items;
CREATE TRIGGER trg_mark_household_initialized
  AFTER INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.mark_household_initialized();

-- ---------------------------------------------------------------------------
-- 6. PROFILES — remove client DELETE authority (preserve household lineage against old clients).
--    Replace the broad ALL policy with equivalent non-DELETE policies. The
--    auth.users→profiles ON DELETE CASCADE FK is NOT modified → genuine account deletion (service
--    role, RLS-exempt) still cascades and deletes the profile row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_own ON public.profiles;

DROP POLICY IF EXISTS profiles_own_select ON public.profiles;
CREATE POLICY profiles_own_select ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_own_insert ON public.profiles;
CREATE POLICY profiles_own_insert ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_own_update ON public.profiles;
CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- Intentionally NO "FOR DELETE" policy → authenticated clients cannot delete their profile row.

COMMIT;

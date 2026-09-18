-- STOCK UPDATE — CAUSAL MODEL V2 (remaining-first, causality only when useful). ADDITIVE, layered AFTER
-- 20260818_partial_outcome_remaining.sql (V1, already live). NON APPLIQUÉE ici : appliquée seulement en
-- passe de déploiement dédiée. Reproductible sur base vierge SI V1 tourne d'abord.
--
-- DOCTRINE : représentation ≠ réalité ; UNKNOWN reste UNKNOWN ; absence de déclaration ≠ preuve d'absence ;
-- correction ≠ usage ≠ gaspillage ; les bandes de reste NE SONT PAS des %/g/unités/euros. Les déclarations
-- causales sont QUALITATIVES (used_declared / waste_declared), jamais une allocation.
--
-- MODÈLE : le reste (remaining_level) est la vérité première. La cause n'est sollicitée par l'UI V2 QUE
-- lorsque after_level = EMPTY (clôture). Les 4 états de déclaration sont légitimes : (f,f)(t,f)(f,t)(t,t).
-- PAS de MIXED, PAS de NONE, PAS de USED_AND_WASTED, PAS de %, PAS d'ordre entre causes.
--
-- AUTORITÉ UNIQUE : apply_stock_update est le SEUL algorithme de mutation. apply_partial_outcome devient un
-- mince wrapper de compatibilité (USED→(t,f), WASTED→(f,t)) qui route vers apply_stock_update.
-- set_approximate_remaining_level reste la correction explicite (event_kind='CORRECTED').
--
-- ROLLBACK conceptuel (ordre inverse) :
--   -- restaurer les corps V1 de apply_partial_outcome / set_approximate_remaining_level (voir migration V1) ;
--   DROP FUNCTION IF EXISTS public.apply_stock_update(uuid,text,boolean,boolean,text);
--   ALTER TABLE public.stock_outcome_events DROP COLUMN IF EXISTS event_kind, DROP COLUMN IF EXISTS used_declared, DROP COLUMN IF EXISTS waste_declared;
--   ALTER TABLE public.stock_outcome_events ALTER COLUMN outcome_type SET NOT NULL;  -- seulement si aucune ligne V2
--   ALTER TABLE public.items DROP COLUMN IF EXISTS used_declared, DROP COLUMN IF EXISTS waste_declared;

BEGIN;

-- ── A. PROJECTIONS ITEM (agrégats de CYCLE DE VIE, monotones : false→true ; jamais réinitialisés) ──
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS used_declared  boolean NOT NULL DEFAULT false;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS waste_declared boolean NOT NULL DEFAULT false;

-- ── B. LEDGER V2 : mêmes lignes physiques (stock_outcome_events), colonnes additives. PAS de 2e ledger. ──
ALTER TABLE public.stock_outcome_events ADD COLUMN IF NOT EXISTS event_kind     text;
ALTER TABLE public.stock_outcome_events ADD COLUMN IF NOT EXISTS used_declared  boolean;
ALTER TABLE public.stock_outcome_events ADD COLUMN IF NOT EXISTS waste_declared boolean;
-- outcome_type devient métadonnée de COMPATIBILITÉ (plus l'autorité causale) → nullable pour les lignes V2.
ALTER TABLE public.stock_outcome_events ALTER COLUMN outcome_type DROP NOT NULL;

-- ── C. BACKFILL des lignes V1 existantes (sûr même si 0 ligne aujourd'hui — ne doit PAS en dépendre) ──
UPDATE public.stock_outcome_events SET
  event_kind     = CASE WHEN outcome_type = 'CORRECTED' THEN 'CORRECTED' ELSE 'UPDATE' END,
  used_declared  = COALESCE(used_declared,  outcome_type = 'USED'),
  waste_declared = COALESCE(waste_declared, outcome_type = 'WASTED')
WHERE event_kind IS NULL;

-- Défauts + intégrité après backfill (nouvelles lignes V2 renseignent toujours ces colonnes).
UPDATE public.stock_outcome_events SET used_declared = COALESCE(used_declared,false), waste_declared = COALESCE(waste_declared,false);
ALTER TABLE public.stock_outcome_events ALTER COLUMN used_declared  SET DEFAULT false, ALTER COLUMN used_declared  SET NOT NULL;
ALTER TABLE public.stock_outcome_events ALTER COLUMN waste_declared SET DEFAULT false, ALTER COLUMN waste_declared SET NOT NULL;
UPDATE public.stock_outcome_events SET event_kind = 'UPDATE' WHERE event_kind IS NULL;
ALTER TABLE public.stock_outcome_events ALTER COLUMN event_kind SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_outcome_events_event_kind_chk') THEN
    ALTER TABLE public.stock_outcome_events ADD CONSTRAINT stock_outcome_events_event_kind_chk
      CHECK (event_kind IN ('UPDATE','CORRECTED'));
  END IF;
END $$;

-- ── D. BACKFILL des projections ITEM depuis événements + clôtures legacy (jamais de fabrication sur ligne active) ──
--   used_declared  = un événement USED existant  OU une clôture legacy « consommé sans gaspillage » (consumed=true, wasted≠true)
--   waste_declared = items.wasted=true            OU un événement WASTED existant
UPDATE public.items i SET
  used_declared = (
    i.used_declared
    OR EXISTS (SELECT 1 FROM public.stock_outcome_events e WHERE e.item_id = i.id AND e.used_declared IS TRUE)
    OR (i.consumed IS TRUE AND i.wasted IS NOT TRUE)
  ),
  waste_declared = (
    i.waste_declared
    OR i.wasted IS TRUE
    OR EXISTS (SELECT 1 FROM public.stock_outcome_events e WHERE e.item_id = i.id AND e.waste_declared IS TRUE)
  );

-- ── E. RPC CANONIQUE UNIQUE — apply_stock_update (remaining-first ; cause optionnelle) ──
-- Ordre : validate → lock item → authz foyer → idempotency (charge utile canonique) → close-guard →
-- monotonicité → OR des déclarations dans les projections item → snapshot/close atomique → 1 événement.
CREATE OR REPLACE FUNCTION public.apply_stock_update(
  p_item_id uuid, p_after_level text,
  p_used_declared boolean DEFAULT false, p_waste_declared boolean DEFAULT false,
  p_client_event_id text DEFAULT NULL
) RETURNS public.items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items; v_before text; v_prior public.stock_outcome_events;
  v_used boolean; v_waste boolean; v_closes boolean;
BEGIN
  IF p_after_level NOT IN ('EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL') THEN RAISE EXCEPTION 'INVALID_AFTER_LEVEL'; END IF;
  -- Rejette le NULL causal → pas de 3e état accidentel (« non déclaré » = false explicite, pas NULL).
  IF p_used_declared IS NULL OR p_waste_declared IS NULL THEN RAISE EXCEPTION 'INVALID_DECLARATION'; END IF;

  SELECT * INTO v_item FROM public.items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  PERFORM public._assert_item_member(v_item.family_id);

  -- Idempotency AVANT le garde de clôture. Charge utile canonique = (item, UPDATE, after, used, waste).
  IF p_client_event_id IS NOT NULL THEN
    SELECT * INTO v_prior FROM public.stock_outcome_events WHERE client_event_id = p_client_event_id;
    IF FOUND THEN
      IF v_prior.item_id = p_item_id AND v_prior.event_kind = 'UPDATE'
         AND v_prior.after_level = p_after_level
         AND COALESCE(v_prior.used_declared,false)  = p_used_declared
         AND COALESCE(v_prior.waste_declared,false) = p_waste_declared THEN
        RETURN v_item;                                   -- rejeu sûr (no-op)
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';
    END IF;
  END IF;

  IF v_item.consumed IS TRUE THEN RAISE EXCEPTION 'ITEM_ALREADY_CLOSED'; END IF;   -- §Q
  v_before := v_item.remaining_level;                    -- serveur, sous verrou (jamais du client)

  IF v_before IS NOT NULL AND public._remaining_ord(p_after_level) > public._remaining_ord(v_before) THEN
    RAISE EXCEPTION 'INCREASE_NOT_ALLOWED';               -- monotonicité quick-update → correction en fiche
  END IF;

  -- Projections de cycle de vie : OR (jamais d'effacement). V2 non-EMPTY envoie (f,f) → inchangé.
  v_used  := COALESCE(v_item.used_declared,false)  OR p_used_declared;
  v_waste := COALESCE(v_item.waste_declared,false) OR p_waste_declared;
  v_closes := (p_after_level = 'EMPTY');

  IF v_closes THEN
    -- Clôture : consumed=true ; legacy wasted = waste_declared CUMULÉ (miroir de compatibilité) ; EMPTY.
    UPDATE public.items SET consumed = true, used_declared = v_used, waste_declared = v_waste,
      wasted = v_waste, remaining_level = 'EMPTY',
      assertion_provenance = COALESCE(assertion_provenance,'{}'::jsonb)
        || jsonb_build_object('remaining', jsonb_build_object('authority','DIRECT','assertedAt', now()))
      WHERE id = p_item_id RETURNING * INTO v_item;
  ELSE
    UPDATE public.items SET remaining_level = p_after_level, used_declared = v_used, waste_declared = v_waste,
      assertion_provenance = COALESCE(assertion_provenance,'{}'::jsonb)
        || jsonb_build_object('remaining', jsonb_build_object('authority','DIRECT','assertedAt', now()))
      WHERE id = p_item_id RETURNING * INTO v_item;       -- consumed/wasted INCHANGÉS (ligne active)
  END IF;

  -- UN événement. outcome_type = NULL (métadonnée legacy ; pas de MIXED fabriqué).
  INSERT INTO public.stock_outcome_events
    (item_id, family_id, actor, event_kind, outcome_type, used_declared, waste_declared, before_level, after_level, client_event_id)
  VALUES
    (p_item_id, v_item.family_id, auth.uid(), 'UPDATE', NULL, p_used_declared, p_waste_declared, v_before, p_after_level, p_client_event_id);

  RETURN v_item;
END; $$;

-- ── F. WRAPPER DE COMPATIBILITÉ — apply_partial_outcome route vers l'autorité unique (aucun writer dupliqué) ──
CREATE OR REPLACE FUNCTION public.apply_partial_outcome(
  p_item_id uuid, p_outcome_type text, p_after_level text, p_client_event_id text DEFAULT NULL
) RETURNS public.items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_outcome_type NOT IN ('USED','WASTED') THEN RAISE EXCEPTION 'INVALID_OUTCOME_TYPE'; END IF;
  RETURN public.apply_stock_update(
    p_item_id, p_after_level,
    (p_outcome_type = 'USED'), (p_outcome_type = 'WASTED'),
    p_client_event_id);
END; $$;

-- ── G. CORRECTION — set_approximate_remaining_level : event_kind='CORRECTED', N'EFFACE PAS les projections ──
CREATE OR REPLACE FUNCTION public.set_approximate_remaining_level(
  p_item_id uuid, p_level text, p_client_event_id text DEFAULT NULL
) RETURNS public.items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items; v_before text; v_prior public.stock_outcome_events;
BEGIN
  IF p_level NOT IN ('QUARTER','HALF','THREE_QUARTERS','FULL') THEN RAISE EXCEPTION 'INVALID_LEVEL'; END IF; -- EMPTY exclu

  SELECT * INTO v_item FROM public.items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  PERFORM public._assert_item_member(v_item.family_id);

  IF p_client_event_id IS NOT NULL THEN
    SELECT * INTO v_prior FROM public.stock_outcome_events WHERE client_event_id = p_client_event_id;
    IF FOUND THEN
      IF v_prior.item_id = p_item_id AND v_prior.event_kind = 'CORRECTED' AND v_prior.after_level = p_level THEN
        RETURN v_item;
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';
    END IF;
  END IF;

  IF v_item.consumed IS TRUE THEN RAISE EXCEPTION 'ITEM_ALREADY_CLOSED'; END IF;
  v_before := v_item.remaining_level;

  -- Assertion d'état courant : remaining + provenance seulement. consumed/wasted/used_declared/waste_declared INCHANGÉS.
  UPDATE public.items SET remaining_level = p_level,
    assertion_provenance = COALESCE(assertion_provenance,'{}'::jsonb)
      || jsonb_build_object('remaining', jsonb_build_object('authority','DIRECT','assertedAt', now()))
    WHERE id = p_item_id RETURNING * INTO v_item;

  INSERT INTO public.stock_outcome_events
    (item_id, family_id, actor, event_kind, outcome_type, used_declared, waste_declared, before_level, after_level, client_event_id)
  VALUES
    (p_item_id, v_item.family_id, auth.uid(), 'CORRECTED', NULL, false, false, v_before, p_level, p_client_event_id);

  RETURN v_item;
END; $$;

-- ── H. SÉCURITÉ — la nouvelle fonction reçoit par défaut EXECUTE à PUBLIC : on le RETIRE, puis on GRANTe.
--    (apply_partial_outcome / set_approximate_remaining_level : CREATE OR REPLACE conserve leurs grants V1.)
REVOKE ALL ON FUNCTION public.apply_stock_update(uuid,text,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_stock_update(uuid,text,boolean,boolean,text) TO authenticated, service_role;

COMMIT;

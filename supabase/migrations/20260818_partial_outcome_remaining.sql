-- PARTIAL OUTCOME + REMAINING STATE (V1) — migration ADDITIVE, NULLABLE, backward-compatible.
-- NON APPLIQUÉE en production ici : rédigée dans le repo, appliquée seulement après revue humaine
-- ET après une VÉRIFICATION DU SCHÉMA DISTANT (remote_schema.sql du repo est vide → hypothèses ci-dessous
-- à confirmer avant apply : items.id uuid, items.family_id uuid, items.consumed bool, items.wasted bool,
-- items.assertion_provenance jsonb [migration 20260815], public.profiles(id uuid, family_id uuid),
-- extension pgcrypto/gen_random_uuid disponible, RLS sur items déjà activée).
--
-- Doctrine : correction ≠ consommation ≠ gaspillage ; assertion approximative ≠ quantité exacte ;
-- autorité = DIRECT (vocabulaire canonique, PAS de parallèle) ; legacy = remaining_level NULL (UNKNOWN),
-- AUCUN backfill. Aucune suppression, aucun rename destructif.
--
-- SÉCURITÉ (gate PM-1) : RPC SECURITY DEFINER avec search_path figé + contrôle d'appartenance foyer
-- EXPLICITE (ne dépend PAS d'une RLS items supposée) ; family_id/actor dérivés SERVEUR (jamais du client) ;
-- ledger append-only (RLS deny-all, écrit uniquement par les RPC) ; idempotency à charge utile vérifiée.
--
-- ROLLBACK conceptuel :
--   DROP FUNCTION IF EXISTS public.apply_partial_outcome(uuid,text,text,text);
--   DROP FUNCTION IF EXISTS public.set_approximate_remaining_level(uuid,text,text);
--   DROP FUNCTION IF EXISTS public._remaining_ord(text);
--   DROP TABLE IF EXISTS public.stock_outcome_events;
--   ALTER TABLE public.items DROP COLUMN IF EXISTS remaining_level;

BEGIN;

-- ── A. SNAPSHOT : état restant approximatif COURANT (valeur ; l'AUTORITÉ vit dans assertion_provenance.remaining) ──
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS remaining_level text
    CHECK (remaining_level IS NULL OR remaining_level IN ('EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL'));

-- ── B. LEDGER CAUSAL : ce qui vient de se passer (USED/WASTED/CORRECTED), before/after, quand ──
-- V1 : trace causale SUBORDONNÉE à l'item représenté (PAS encore le registre d'impact long terme —
-- Profile/Impact/Rescue ne doivent PAS le consommer dans cette tranche). D'où ON DELETE CASCADE.
CREATE TABLE IF NOT EXISTS public.stock_outcome_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  family_id     uuid NOT NULL,              -- dérivé SERVEUR (items.family_id NOT NULL) — jamais du client
  -- actor : dérivé SERVEUR de auth.uid() (jamais du client), NON-NULL à la CRÉATION (authz exige
  -- auth.uid() != NULL via _assert_item_member). Nullable AU REPOS + FK ON DELETE SET NULL : si un
  -- membre/profil est supprimé alors que le foyer/l'item survit, l'événement conserve son intégrité
  -- référentielle (actor→NULL) au lieu d'un UUID orphelin. Mirroir du précédent items.added_by.
  actor         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  outcome_type  text NOT NULL CHECK (outcome_type IN ('USED','WASTED','CORRECTED')),
  before_level  text CHECK (before_level IS NULL OR before_level IN ('EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL')),
  after_level   text NOT NULL CHECK (after_level IN ('EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL')),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  client_event_id text                      -- clé d'idempotency (anti double-tap)
);
CREATE INDEX IF NOT EXISTS stock_outcome_events_item_idx ON public.stock_outcome_events (item_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS stock_outcome_events_client_idx
  ON public.stock_outcome_events (client_event_id) WHERE client_event_id IS NOT NULL;

-- Ledger APPEND-ONLY : RLS activée SANS aucune policy → aucun rôle applicatif n'a d'accès direct
-- (SELECT/INSERT/UPDATE/DELETE tous refusés), service_role inclus (qui reçoit les privilèges de table
-- par défaut). Seuls les RPC SECURITY DEFINER ci-dessous écrivent (en tant que propriétaire postgres).
-- Un client ne peut donc PAS réécrire USED→WASTED après coup ni supprimer l'historique. Le service_role
-- peut toujours INVOQUER la surface RPC canonique (son EXECUTE de fonction reste légitime).
ALTER TABLE public.stock_outcome_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.stock_outcome_events FROM anon, authenticated, service_role;

-- Ordre discret des niveaux (garde de monotonicité). IMMUTABLE, search_path figé.
CREATE OR REPLACE FUNCTION public._remaining_ord(l text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE l
    WHEN 'EMPTY' THEN 0 WHEN 'QUARTER' THEN 1 WHEN 'HALF' THEN 2
    WHEN 'THREE_QUARTERS' THEN 3 WHEN 'FULL' THEN 4 ELSE NULL END;
$$;

-- Garde d'appartenance foyer commune : l'appelant authentifié DOIT partager le family_id de l'item.
-- (Ne dépend PAS d'une RLS items supposée — défense en profondeur, même modèle que household_lifecycle.)
CREATE OR REPLACE FUNCTION public._assert_item_member(p_family_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_family_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.family_id = p_family_id
  ) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
END; $$;

-- ── RPC 1 : apply_partial_outcome — ATOMIQUE (event insert + item update dans la même transaction fonction) ──
-- USED/WASTED + niveau restant APRÈS. EMPTY → converge vers la clôture TOTALE canonique (consumed=true ;
-- wasted si WASTED). NON-EMPTY → row RESTE ACTIVE (consumed/wasted inchangés), snapshot mis à jour.
-- Ordre : lock item → authz → idempotency (charge utile vérifiée) → close-guard → monotonicité → write → event.
CREATE OR REPLACE FUNCTION public.apply_partial_outcome(
  p_item_id uuid, p_outcome_type text, p_after_level text, p_client_event_id text DEFAULT NULL
) RETURNS public.items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items; v_before text; v_prior public.stock_outcome_events; v_closes boolean;
BEGIN
  IF p_outcome_type NOT IN ('USED','WASTED') THEN RAISE EXCEPTION 'INVALID_OUTCOME_TYPE'; END IF;
  IF p_after_level NOT IN ('EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL') THEN RAISE EXCEPTION 'INVALID_AFTER_LEVEL'; END IF;

  -- Verrou d'abord (§10) : sérialise les updates concurrents sur le même item avant tout contrôle d'état.
  SELECT * INTO v_item FROM public.items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  PERFORM public._assert_item_member(v_item.family_id);   -- §4 appartenance foyer (sinon NOT_AUTHORIZED)

  -- Idempotency (§8) : même token → doit désigner la MÊME charge utile, sinon conflit déterministe.
  IF p_client_event_id IS NOT NULL THEN
    SELECT * INTO v_prior FROM public.stock_outcome_events WHERE client_event_id = p_client_event_id;
    IF FOUND THEN
      IF v_prior.item_id = p_item_id AND v_prior.outcome_type = p_outcome_type
         AND v_prior.after_level = p_after_level THEN
        RETURN v_item;                                    -- rejeu sûr (no-op)
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';             -- un token de retry ne peut PAS muter autre chose
    END IF;
  END IF;

  IF v_item.consumed IS TRUE THEN RAISE EXCEPTION 'ITEM_ALREADY_CLOSED'; END IF;  -- §6
  v_before := v_item.remaining_level;                      -- §9 before = état serveur verrouillé (jamais client)

  -- §12 monotonicité (before connu uniquement ; égal autorisé §13)
  IF v_before IS NOT NULL AND public._remaining_ord(p_after_level) > public._remaining_ord(v_before) THEN
    RAISE EXCEPTION 'INCREASE_NOT_ALLOWED';                -- → route correction côté client
  END IF;

  v_closes := (p_after_level = 'EMPTY');
  IF v_closes THEN
    -- §7 clôture : consumed=true, wasted selon l'issue, remaining_level=EMPTY (jamais actif+EMPTY).
    -- L'assertion de restant est REFRAÎCHIE (authority=DIRECT, assertedAt=now) via le MÊME merge jsonb
    -- non-clobbant que la branche partielle : sinon remaining.assertedAt resterait figé sur l'ancien
    -- niveau (HALF/QUARTER…) alors que remaining_level vaut désormais EMPTY. quantity/dateValue/dateType
    -- et toute clé future sont préservés (`||` top-level).
    UPDATE public.items SET consumed = true, wasted = (p_outcome_type = 'WASTED'), remaining_level = 'EMPTY',
      assertion_provenance = COALESCE(assertion_provenance, '{}'::jsonb)
        || jsonb_build_object('remaining', jsonb_build_object('authority','DIRECT','assertedAt', now()))
      WHERE id = p_item_id RETURNING * INTO v_item;
  ELSE
    UPDATE public.items SET remaining_level = p_after_level,
      assertion_provenance = COALESCE(assertion_provenance, '{}'::jsonb)
        || jsonb_build_object('remaining', jsonb_build_object('authority','DIRECT','assertedAt', now()))
      WHERE id = p_item_id RETURNING * INTO v_item;        -- consumed/wasted INCHANGÉS (row active)
  END IF;

  INSERT INTO public.stock_outcome_events (item_id, family_id, actor, outcome_type, before_level, after_level, client_event_id)
  VALUES (p_item_id, v_item.family_id, auth.uid(), p_outcome_type, v_before, p_after_level, p_client_event_id);

  RETURN v_item;
END; $$;

-- ── RPC 2 : set_approximate_remaining_level — CORRECTION directe (fiche produit). JAMAIS consommation/gaspillage. ──
-- Assertion d'état courant, tout sens autorisé (pas de monotonicité). Événement distinct CORRECTED.
-- §6 : refus si row close. §7 : refus EMPTY (vider = déclarer USED/WASTED, pas corriger).
CREATE OR REPLACE FUNCTION public.set_approximate_remaining_level(
  p_item_id uuid, p_level text, p_client_event_id text DEFAULT NULL
) RETURNS public.items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items; v_before text; v_prior public.stock_outcome_events;
BEGIN
  IF p_level NOT IN ('QUARTER','HALF','THREE_QUARTERS','FULL') THEN
    RAISE EXCEPTION 'INVALID_LEVEL';   -- EMPTY exclu ici (§7) : atteignable seulement via USED/WASTED
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  PERFORM public._assert_item_member(v_item.family_id);

  IF p_client_event_id IS NOT NULL THEN
    SELECT * INTO v_prior FROM public.stock_outcome_events WHERE client_event_id = p_client_event_id;
    IF FOUND THEN
      IF v_prior.item_id = p_item_id AND v_prior.outcome_type = 'CORRECTED' AND v_prior.after_level = p_level THEN
        RETURN v_item;
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';
    END IF;
  END IF;

  IF v_item.consumed IS TRUE THEN RAISE EXCEPTION 'ITEM_ALREADY_CLOSED'; END IF;  -- §6
  v_before := v_item.remaining_level;

  UPDATE public.items SET remaining_level = p_level,
    assertion_provenance = COALESCE(assertion_provenance, '{}'::jsonb)
      || jsonb_build_object('remaining', jsonb_build_object('authority','DIRECT','assertedAt', now()))
    WHERE id = p_item_id RETURNING * INTO v_item;  -- consumed/wasted JAMAIS touchés

  INSERT INTO public.stock_outcome_events (item_id, family_id, actor, outcome_type, before_level, after_level, client_event_id)
  VALUES (p_item_id, v_item.family_id, auth.uid(), 'CORRECTED', v_before, p_level, p_client_event_id);

  RETURN v_item;
END; $$;

-- Helpers INTERNES : NE font PAS partie de la surface RPC cliente. Sur Supabase, EXECUTE est accordé
-- par DÉFAUT à anon/authenticated/service_role pour toute fonction public créée par postgres → on le
-- RETIRE explicitement à TOUS les rôles applicatifs (service_role inclus). Les RPC canoniques
-- (SECURITY DEFINER, propriété postgres) continuent de les appeler EN TANT QUE PROPRIÉTAIRE — postgres
-- conserve ses privilèges, ces revokes ne cassent donc pas les RPC.
REVOKE ALL ON FUNCTION public._remaining_ord(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._assert_item_member(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Surface RPC cliente = UNIQUEMENT ces deux fonctions, pour le rôle authenticated (jamais anon).
-- L'autorisation fine (appartenance foyer) est DANS les RPC.
REVOKE ALL ON FUNCTION public.apply_partial_outcome(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_approximate_remaining_level(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_partial_outcome(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_approximate_remaining_level(uuid,text,text) TO authenticated;

COMMIT;

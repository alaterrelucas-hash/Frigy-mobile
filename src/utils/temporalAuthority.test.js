/**
 * Tests N6-01 + N6-02 — Temporal Authority Foundation (logique pure).
 * Aucun runner configuré → script Node autonome (même pattern que homeLogic.test.js) :
 *   node src/utils/temporalAuthority.test.js
 * Charge product.js (normalizeDlc, pur) puis temporalAuthority.js en neutralisant son import.
 * `now` est injecté (15/01/2026) → tests déterministes.
 */
const fs = require('fs');
const path = require('path');

function load(file, transforms) {
  let code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  code = (transforms ? transforms(code) : code)
    .replace(/export async function /g, 'async function ')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  const m = new module.constructor();
  m._compile(code, file);
  return m.exports;
}

const product = load('product.js', (c) => c + '\nmodule.exports={normalizeDlc};');

const T = load('temporalAuthority.js', (c) =>
  c.replace(/import \{[^}]*\} from '\.\/product';/,
      `const normalizeDlc = ${product.normalizeDlc.toString()};`)
   + '\nmodule.exports={deriveTemporalState,hasStrongTemporalAuthority,hasCurrentProjection,'
   + 'passiveTemporalDays,strongTemporalDays,amplifiedTemporalDays,AMPLIFIED_PASSIVE_DATE_TYPES,'
   + 'TEMPORAL_BASIS,TEMPORAL_AUTHORITY,DATE_TYPE};');

const {
  deriveTemporalState, hasStrongTemporalAuthority, hasCurrentProjection,
  passiveTemporalDays, strongTemporalDays, amplifiedTemporalDays, AMPLIFIED_PASSIVE_DATE_TYPES,
  TEMPORAL_BASIS, TEMPORAL_AUTHORITY, DATE_TYPE,
} = T;

const NOW = new Date(2026, 0, 15); // 15 janvier 2026
const S = (item) => deriveTemporalState(item, NOW);

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── 1. Date absolue capturée (non ouvert) → autorité DATE, type UNKNOWN (neutre) ──
const fut = S({ dlc: '20/01/2026', days_left: 5 });
ok('absolute: basis ABSOLUTE_DATE', fut.basis === TEMPORAL_BASIS.ABSOLUTE_DATE);
ok('absolute: authority DATE', fut.authority === TEMPORAL_AUTHORITY.DATE);
ok('absolute: dateType UNKNOWN (neutre)', fut.dateType === DATE_TYPE.UNKNOWN);
ok('absolute: daysRemaining = 5', fut.daysRemaining === 5);
ok('absolute: projection présente', fut.hasCurrentProjection === true);

const past = S({ dlc: '10/01/2026' });
ok('absolute past: authority DATE', past.authority === TEMPORAL_AUTHORITY.DATE);
ok('absolute past: daysRemaining = -5', past.daysRemaining === -5);

const monthYear = S({ dlc: '03/2026' }); // MM/YYYY → jour 28
ok('MM/YYYY: authority DATE', monthYear.authority === TEMPORAL_AUTHORITY.DATE);
ok('MM/YYYY: daysRemaining > 0', monthYear.daysRemaining > 0);

// ── 2. Ouvert avec ancre opened_at → ANCHORED_OPENING / HEURISTIC (borné) ──
const opened = S({ opened: true, opened_at: '2026-01-15', dlc: '18/01/2026', days_left: 3 });
ok('opened: basis ANCHORED_OPENING', opened.basis === TEMPORAL_BASIS.ANCHORED_OPENING);
ok('opened: authority HEURISTIC (pas DATE)', opened.authority === TEMPORAL_AUTHORITY.HEURISTIC);
ok('opened: daysRemaining = 3', opened.daysRemaining === 3);
ok('opened: anchor opened_at', opened.anchor === 'opened_at');

// ── 3. Ouvert SANS ancre → UNKNOWN (ancre non prouvable) ──
const openedNoAnchor = S({ opened: true, opened_at: null, dlc: '18/01/2026' });
ok('opened sans opened_at: authority NONE', openedNoAnchor.authority === TEMPORAL_AUTHORITY.NONE);
ok('opened sans opened_at: daysRemaining null', openedNoAnchor.daysRemaining === null);

// ── 4. CAS CLÉ N6-02 : bare days_left / fallback / stale → UNKNOWN (jamais countdown) ──
const bareDaysLeft = S({ dlc: '—', days_left: 5 });        // Je l'ai / estimate non ancré
ok('bare days_left(5): authority NONE', bareDaysLeft.authority === TEMPORAL_AUTHORITY.NONE);
ok('bare days_left(5): basis NONE', bareDaysLeft.basis === TEMPORAL_BASIS.NONE);
ok('bare days_left(5): daysRemaining null (UNKNOWN)', bareDaysLeft.daysRemaining === null);
ok('bare days_left(5): pas de projection', bareDaysLeft.hasCurrentProjection === false);

const fallback30 = S({ days_left: 30 });                    // fallback 30, pas de dlc
ok('fallback 30: authority NONE', fallback30.authority === TEMPORAL_AUTHORITY.NONE);
ok('fallback 30: daysRemaining null', fallback30.daysRemaining === null);

const unanchoredShort = S({ days_left: 3 });                // estimate court NON ancré → PAS de fenêtre
ok('estimate court non ancré: authority NONE', unanchoredShort.authority === TEMPORAL_AUTHORITY.NONE);
ok('estimate court non ancré: daysRemaining null', unanchoredShort.daysRemaining === null);

// ── 5. Robustesse : rien / illisible / null ──
ok('objet vide: NONE', S({}).authority === TEMPORAL_AUTHORITY.NONE);
ok('null: NONE', S(null).authority === TEMPORAL_AUTHORITY.NONE);
ok('dlc illisible: NONE', S({ dlc: 'abc' }).authority === TEMPORAL_AUTHORITY.NONE);
ok('dlc sentinelle —: NONE', S({ dlc: '—' }).authority === TEMPORAL_AUTHORITY.NONE);

// ── 6. Gates d'autorité (pour tranches consommateur ultérieures) ──
ok('strong: DATE → true', hasStrongTemporalAuthority(fut) === true);
ok('strong: HEURISTIC → false', hasStrongTemporalAuthority(opened) === false);
ok('strong: NONE → false', hasStrongTemporalAuthority(bareDaysLeft) === false);
ok('projection: DATE → true', hasCurrentProjection(fut) === true);
ok('projection: HEURISTIC → true', hasCurrentProjection(opened) === true);
ok('projection: NONE → false', hasCurrentProjection(bareDaysLeft) === false);

// ── 6bis. LINEAGE COLLAPSE (revue N6-01/02) : jamais promouvoir un dérivé en absolu ──
// `dlc` confond, sur un item OUVERT, la date dérivée d'ouverture ET une date corrigée par
// l'utilisateur (saveEdit ne touche pas opened/opened_at). Règle de sûreté : tant que la
// ligne est ouverte, l'autorité PLAFONNE à HEURISTIC — jamais DATE — quelle que soit
// l'origine du `dlc` (on sous-affirme, on ne sur-affirme jamais).
const openedUserDate = S({ opened: true, opened_at: '2026-01-15', dlc: '25/12/2026' });
ok('ouvert + date plausible user: HEURISTIC (jamais DATE)', openedUserDate.authority === TEMPORAL_AUTHORITY.HEURISTIC);
ok('ouvert + date plausible user: pas d\'autorité forte', hasStrongTemporalAuthority(openedUserDate) === false);
const openedFarDate = S({ opened: true, opened_at: '2026-01-15', dlc: '20/01/2030' });
ok('ouvert + date lointaine: jamais ABSOLUTE_DATE', openedFarDate.basis !== TEMPORAL_BASIS.ABSOLUTE_DATE);

// Post-fermeture (toggleOpened(false) restaure original_dlc réel + opened_at=null) :
// opened=false + date réelle restaurée → ABSOLUTE_DATE (correct, ce n'est PAS une fuite
// d'heuristique — le code de fermeture écrase la date d'ouverture par l'originale).
const afterUnopen = S({ opened: false, opened_at: null, dlc: '20/01/2026' });
ok('post-fermeture: date restaurée → ABSOLUTE_DATE', afterUnopen.basis === TEMPORAL_BASIS.ABSOLUTE_DATE);
ok('post-fermeture: autorité DATE', afterUnopen.authority === TEMPORAL_AUTHORITY.DATE);
// Post-fermeture sans original (→ '—') → UNKNOWN.
const afterUnopenNoOrig = S({ opened: false, opened_at: null, dlc: '—', days_left: 5 });
ok('post-fermeture sans original (—): UNKNOWN', afterUnopenNoOrig.authority === TEMPORAL_AUTHORITY.NONE);

// ── 6ter. passiveTemporalDays (N6-04) : autorité-aware pour ranking/attention/badge ──
ok('passif DATE → jours', passiveTemporalDays({ dlc: '20/01/2026' }, NOW) === 5);
ok('passif DATE dépassé → jours négatifs', passiveTemporalDays({ dlc: '10/01/2026' }, NOW) === -5);
ok('passif HEURISTIC (ouverture ancrée) → jours (soft OK)',
  passiveTemporalDays({ opened: true, opened_at: '2026-01-15', dlc: '18/01/2026' }, NOW) === 3);
ok('passif bare days_left → null (aucune position temporelle)',
  passiveTemporalDays({ dlc: '—', days_left: 3 }, NOW) === null);
ok('passif fallback 30 → null', passiveTemporalDays({ days_left: 30 }, NOW) === null);
ok('passif estimate court non ancré → null (jamais urgent)',
  passiveTemporalDays({ days_left: 2 }, NOW) === null);
ok('passif rien → null', passiveTemporalDays({}, NOW) === null);
ok('passif ouvert sans ancre → null', passiveTemporalDays({ opened: true, dlc: '18/01/2026' }, NOW) === null);

// ── 6quater. strongTemporalDays (N6-04 R-01/R-03) : signal FORT = DATE seul, autorité préservée ──
ok('fort DATE → jours', strongTemporalDays({ dlc: '20/01/2026' }, NOW) === 5);
ok('fort HEURISTIC (ouverture) → null (soft, pas de signal fort)',
  strongTemporalDays({ opened: true, opened_at: '2026-01-15', dlc: '18/01/2026' }, NOW) === null);
ok('fort NONE → null', strongTemporalDays({ dlc: '—', days_left: 2 }, NOW) === null);
// R-01 : DATE et HEURISTIC ne collapsent plus — même jours "2" mais autorité distincte.
const heurItem = { opened: true, opened_at: '2026-01-15', dlc: '17/01/2026' }; // 2 j, heuristique
const dateItem = { dlc: '17/01/2026' };                                        // 2 j, date réelle
ok('R-01 : passif identique (2) pour DATE et HEURISTIC',
  passiveTemporalDays(heurItem, NOW) === 2 && passiveTemporalDays(dateItem, NOW) === 2);
ok('R-01 : fort DISTINGUE (HEURISTIC null, DATE 2)',
  strongTemporalDays(heurItem, NOW) === null && strongTemporalDays(dateItem, NOW) === 2);

// ── 6quinquies. amplifiedTemporalDays (plafond sémantique) : DATE + type supporté (vide → 0) ──
ok('AMPLIFIED_PASSIVE_DATE_TYPES est VIDE (aucun type amplifié aujourd\'hui)', AMPLIFIED_PASSIVE_DATE_TYPES.size === 0);
ok('amplifié DATE + type UNKNOWN → null (valeur OK, sémantique absente)',
  amplifiedTemporalDays({ dlc: '17/01/2026' }, NOW) === null);
ok('amplifié HEURISTIC → null', amplifiedTemporalDays(heurItem, NOW) === null);
ok('amplifié NONE → null', amplifiedTemporalDays({ dlc: '—', days_left: 2 }, NOW) === null);
// Distinction des 3 niveaux sur la MÊME date réelle J2/UNKNOWN : passif 2, fort 2, amplifié null.
ok('3 niveaux : passif=2, fort=2, amplifié=null (DATE J2/UNKNOWN)',
  passiveTemporalDays(dateItem, NOW) === 2 && strongTemporalDays(dateItem, NOW) === 2
  && amplifiedTemporalDays(dateItem, NOW) === null);

// ── 7. Non-destructif : l'entrée n'est jamais mutée ──
const original = { dlc: '—', days_left: 5, opened: false };
const snapshot = JSON.stringify(original);
S(original);
ok('entrée non mutée', JSON.stringify(original) === snapshot);

// ── N6-08 : provenance forward (Date Type explicite + valeur de date machine non autoritaire) ──
const prov = (dv, dt) => ({ assertion_provenance: { dateValue: { authority: dv }, ...(dt ? { dateType: dt } : {}) } });
// FD-T02 : date saisie + DLC explicite → autorité DATE + type DLC.
const dlcItem = S({ dlc: '20/01/2026', ...prov('DIRECT', { value: 'DLC', authority: 'DIRECT' }) });
ok('N6-08 FD-T02 date+DLC → basis ABSOLUTE_DATE', dlcItem.basis === TEMPORAL_BASIS.ABSOLUTE_DATE);
ok('N6-08 FD-T02 date+DLC → dateType DLC', dlcItem.dateType === DATE_TYPE.DLC);
ok('N6-08 FD-T03 date+DDM → dateType DDM', S({ dlc: '20/01/2026', ...prov('DIRECT', { value: 'DDM', authority: 'DIRECT' }) }).dateType === DATE_TYPE.DDM);
ok('N6-08 FD-T01 date saisie sans type → DATE + type UNKNOWN', (() => { const s = S({ dlc: '20/01/2026', ...prov('DIRECT') }); return s.authority === TEMPORAL_AUTHORITY.DATE && s.dateType === DATE_TYPE.UNKNOWN; })());
// FD-T04 : date MACHINE non confirmée (DERIVED) → NON promue en DATE.
const mach = S({ dlc: '20/01/2026', ...prov('DERIVED') });
ok('N6-08 FD-T04 date machine (DERIVED) → PAS ABSOLUTE_DATE', mach.basis !== TEMPORAL_BASIS.ABSOLUTE_DATE);
ok('N6-08 FD-T04 date machine → pas d\'autorité DATE', mach.authority !== TEMPORAL_AUTHORITY.DATE && mach.hasCurrentProjection === false);
// TYPE-T05 : le nom de colonne dlc n'implique JAMAIS un type (legacy → UNKNOWN, déjà vérifié plus haut).
ok('N6-08 TYPE-T05 legacy dlc parseable → dateType UNKNOWN', S({ dlc: '20/01/2026' }).dateType === DATE_TYPE.UNKNOWN);
// DOWN2-T07 : un Date Type connu (DLC) n'active PAS l'amplification (allowlist AMPLIFIED vide).
ok('N6-08 DOWN2-T07 DLC connu → amplifiedTemporalDays null (pas de rouge/urgence)',
  amplifiedTemporalDays({ dlc: '20/01/2026', ...prov('DIRECT', { value: 'DLC', authority: 'DIRECT' }) }, NOW) === null);
ok('N6-08 AMPLIFIED_PASSIVE_DATE_TYPES reste VIDE', AMPLIFIED_PASSIVE_DATE_TYPES.size === 0);

console.log(`\ntemporalAuthority: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

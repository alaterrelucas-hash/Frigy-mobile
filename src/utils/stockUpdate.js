/**
 * STOCK UPDATE — contrat CANONIQUE PUR V2 (remaining-first, causalité qualitative). Aucune I/O, aucun SDK.
 *
 * Une mise à jour = un ÉTAT DE RESTE approximatif + DEUX déclarations causales QUALITATIVES, optionnelles :
 *   remainingLevel ∈ { EMPTY, QUARTER, HALF, THREE_QUARTERS, FULL } | null(=UNKNOWN)
 *   usedDeclared  : true = l'utilisateur a explicitement DÉCLARÉ un usage (false = « non déclaré », PAS « prouvé faux »)
 *   wasteDeclared : idem pour le gaspillage
 * Les 4 combinaisons (f,f)(t,f)(f,t)(t,t) sont légitimes. PAS de MIXED, PAS de %, PAS d'ordre entre causes.
 *
 * Ce module NE crée aucune quantité exacte / économie / recette : une bande n'est jamais un %/g/€.
 * La PROJECTION cumulative de cycle de vie (OR des déclarations) est faite CÔTÉ SERVEUR (RPC) — voir
 * projectDeclarations pour la règle documentée/testée.
 */

export const EVENT_KIND = { UPDATE: 'UPDATE', CORRECTED: 'CORRECTED' };
export const REMAINING_LEVELS = ['EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'];

const ORDER = REMAINING_LEVELS.reduce((m, l, i) => { m[l] = i; return m; }, {});
export const isRemainingLevel = (l) => typeof l === 'string' && Object.prototype.hasOwnProperty.call(ORDER, l);
export const isBeforeLevel = (l) => l == null || isRemainingLevel(l); // UNKNOWN = null uniquement
export const levelOrder = (l) => (isRemainingLevel(l) ? ORDER[l] : null);

/**
 * classifyStockUpdate — adjuge une mise à jour de stock (event_kind='UPDATE'). Miroir de la sémantique RPC.
 * @returns { valid, reason?, route?, effect? }
 *   effect = { eventKind:'UPDATE', closesRow, setConsumed, newRemainingLevel, usedDeclared, wasteDeclared, beforeLevel, afterLevel }
 * Règles :
 *   - booléens causaux STRICTS (rejette null/undefined/non-bool → pas de 3e état accidentel) ;
 *   - MONOTONICITÉ (data contract) : afterLevel > beforeLevel connu → INVALIDE → route CORRECTION (égal permis
 *     au niveau data ; l'UX quick-update est PLUS stricte et n'offre que du strictement inférieur — cf. stockUpdateSheetLogic) ;
 *   - EMPTY → closesRow (converge vers la clôture TOTALE canonique) ; non-EMPTY → ligne active ;
 *   - beforeLevel UNKNOWN → n'importe quel afterLevel est une assertion légitime.
 * Les déclarations causales n'influencent NI la validité NI la clôture : elles sont qualitatives.
 */
export function classifyStockUpdate({ beforeLevel = null, afterLevel, usedDeclared = false, wasteDeclared = false } = {}) {
  if (!isRemainingLevel(afterLevel)) return { valid: false, reason: 'INVALID_AFTER_LEVEL' };
  if (typeof usedDeclared !== 'boolean' || typeof wasteDeclared !== 'boolean') return { valid: false, reason: 'INVALID_DECLARATION' };
  if (!isBeforeLevel(beforeLevel)) return { valid: false, reason: 'INVALID_BEFORE_LEVEL' };
  if (beforeLevel != null && ORDER[afterLevel] > ORDER[beforeLevel]) {
    return { valid: false, reason: 'INCREASE_NOT_ALLOWED', route: 'CORRECTION' };
  }
  const empty = afterLevel === 'EMPTY';
  return {
    valid: true,
    effect: {
      eventKind: EVENT_KIND.UPDATE,
      closesRow: empty,
      setConsumed: empty,
      newRemainingLevel: afterLevel,
      usedDeclared,
      wasteDeclared,
      beforeLevel: beforeLevel ?? null,
      afterLevel,
    },
  };
}

/**
 * projectDeclarations — règle CANONIQUE de projection de cycle de vie (OR monotone, jamais d'effacement).
 * Documentée + testée ici ; APPLIQUÉE côté serveur (apply_stock_update). Le legacy `wasted` à la clôture =
 * la valeur cumulée `waste` retournée ici.
 */
export function projectDeclarations(prev = {}, update = {}) {
  return {
    used: !!prev.used || !!update.usedDeclared,
    waste: !!prev.waste || !!update.wasteDeclared,
  };
}

/**
 * N6-10 — Profile Impact Truth (CR-11/12/13/14). Statistiques Profile TRUTHFUL, pures.
 *
 * V2 (causal multi-déclaration) : compte des DÉCLARATIONS canoniques, au niveau FOYER, GLOBALES :
 *   - usedDeclaredCount  = lignes closes avec used_declared=true  (usage EXPLICITEMENT déclaré) ;
 *   - wasteDeclaredCount = lignes closes avec waste_declared=true (gaspillage EXPLICITEMENT déclaré).
 *
 * Les deux comptes PEUVENT SE CHEVAUCHER : un même produit dont une partie a été utilisée ET une partie
 * jetée compte dans LES DEUX. Ils NE somment PAS au total des lignes closes. Une clôture sans cause
 * déclarée (false/false) ne compte dans AUCUN. `waste_declared=false` ne prouve PAS l'absence de
 * gaspillage — c'est « non déclaré ». On lit donc les champs canoniques de déclaration, jamais l'inverse
 * du legacy `wasted`.
 *
 * N'INVENTE JAMAIS : argent (CR-11), CO₂ (CR-12), score/grade/comparaison (CR-13), « sauvé » (CR-14),
 * % / grammes / unités / allocation. Le compte est un nombre de LIGNES (cohortes), jamais une quantité
 * physique (N6-07). Aucun prix lu. Aucune fenêtre temporelle (N6-10 2.6).
 */
export function computeProfileStats(consumedRows = []) {
  const rows = Array.isArray(consumedRows) ? consumedRows : [];
  return {
    usedDeclaredCount: rows.filter((r) => r && r.used_declared === true).length,
    wasteDeclaredCount: rows.filter((r) => r && r.waste_declared === true).length,
  };
}

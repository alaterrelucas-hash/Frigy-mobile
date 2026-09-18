/**
 * RESCUE OUTCOME SHEET (Frigy 2027) — étape 1 (réconciliation PARTIELLE V1). Régression SOURCE :
 *   node src/utils/rescueOutcomeSheet.regression.test.js
 * Étape 1 : « J'en ai utilisé » / « J'en ai jeté » (un événement s'est produit → étape 2 demande le RESTANT)
 * + tertiaire « Rien n'a changé ». Présentationnel : aucun import Supabase/coordinateur ; issues terminales
 * SANS chevron (seule « Voir la fiche produit » navigue) ; aucune administration produit ; aucun argent/CO₂ ;
 * couleur = fonction (tokens existants). L'ancien wording whole-line (« J'ai tout … » / « Il m'en reste ») est
 * RÉOUVERT car il n'est plus valide avec la réconciliation partielle.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const src = read('../components/rescue/RescueOutcomeSheet.js');
const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

const usedRow = /Icon=\{Utensils\}[\s\S]{0,80}label="J’en ai utilisé"[\s\S]{0,40}\/>/.exec(code) || [''];
const discardRow = /Icon=\{Trash2\}[\s\S]{0,80}label="J’en ai jeté"[\s\S]{0,40}\/>/.exec(code) || [''];
const noChangeIdx = code.indexOf('Rien n’a changé');
const noChangeBlock = noChangeIdx >= 0 ? code.slice(noChangeIdx - 300, noChangeIdx + 380) : '';
const outcomeRowDef = (/const OutcomeRow = \([\s\S]*?\n  \);/.exec(code) || [''])[0];

// ── P-Q01..P-Q04 : issues d'étape 1 ──
ok('P-Q01 « J’en ai utilisé »', /label="J’en ai utilisé"/.test(code));
ok('P-Q02 « J’en ai jeté »', /label="J’en ai jeté"/.test(code));
ok('P-Q03 « Rien n’a changé »', />Rien n’a changé</.test(code));
ok('P-Q04 « Il m’en reste » n’est plus une issue d’étape 1', !/Il m’en reste/.test(code));
ok('P-Q11 USED et DISCARDED = deux callbacks distincts', /onPress=\{onUsed\}/.test(code) && /onPress=\{onDiscarded\}/.test(code));

// ── Wording réouvert : ancien whole-line retiré ──
ok('P-Q(reopen) « J’ai tout utilisé » retiré', !/J’ai tout utilisé/.test(code));
ok('P-Q(reopen) « J’ai tout jeté » retiré', !/J’ai tout jeté/.test(code));

// ── Question + support ──
ok('R-O03 question « Où en est ce produit ? »', /Où en est ce produit \?/.test(code));
ok('R-O04 support « Dis-moi simplement ce qui a changé. »', /Dis-moi simplement ce qui a changé\./.test(code));

// ── Chevrons : aucune issue terminale, seule la nav ──
ok('R-O07 « J’en ai utilisé » sans chevron', usedRow[0].length > 0 && !/Chevron/.test(usedRow[0]));
ok('R-O08 « J’en ai jeté » sans chevron', discardRow[0].length > 0 && !/Chevron/.test(discardRow[0]));
ok('R-O09 « Rien n’a changé » sans chevron', noChangeBlock.length > 0 && !/Chevron/.test(noChangeBlock));
ok('R-O09b OutcomeRow sans chevron', outcomeRowDef.length > 0 && !/Chevron/.test(outcomeRowDef));
ok('R-O10 exactement UN ChevronRight (fiche produit)', (code.match(/<ChevronRight/g) || []).length === 1
  && /Voir la fiche produit[\s\S]{0,60}<ChevronRight/.test(code));

// ── Tertiaire = vraie action ghost, pas du texte nu ──
ok('P-Q(ghost) « Rien n’a changé » = TouchableOpacity (onNoChange) + bord/surface',
  /<TouchableOpacity onPress=\{onNoChange\}/.test(noChangeBlock) && /borderWidth: 1/.test(noChangeBlock) && /accessibilityRole="button"/.test(noChangeBlock));

// ── Pas d'administration produit / badge / argent ──
ok('R-O11 pas de « SUIVI FRIGY »', !/SUIVI FRIGY/i.test(code));
ok('R-O12 pas de « Conseil de conservation »', !/Conseil de conservation/i.test(code));
ok('R-O13 pas de « Modifier ce produit »', !/Modifier ce produit/i.test(code));
ok('R-O14 pas de toggle « Ouvert »', !/>Ouvert</.test(code) && !/toggleOpened/.test(code));
ok('P-Q12/R-O15 aucun argent/€/CO₂', !/€|euro|CO2|CO₂|économ|à sauver/i.test(code));

// ── Présentationnel ──
ok('P-Q13/R-O16 aucun import/usage Supabase (hors doc)', !/supabase/i.test(code) && !/from ['"].*supabase/i.test(src));
ok('R-O17 aucun coordinateur consommation', !/consumptionOutcome/.test(src) && !/createConsumeCoordinator/.test(src));
ok('P-Q14/R-O18 dismiss distinct des issues', /onDismiss/.test(code) && /onPress=\{onDismiss\}/.test(code)
  && /onUsed/.test(code) && /onDiscarded/.test(code) && /onNoChange/.test(code));
ok('R-O19 aucun hex #RRGGBB', !/#[0-9a-fA-F]{6}\b/.test(src));
ok('R-O20 aucune bottom nav rendue', !/tabBar/i.test(src) && !/BottomNav/i.test(src) && !/navigation/i.test(code));
ok('R-O(extra) issues terminales = rangées neutres (surface + separator, pas de panneau)',
  outcomeRowDef.length > 0 && /backgroundColor: theme\.surface/.test(outcomeRowDef) && /borderColor: theme\.separator/.test(outcomeRowDef));

console.log(`\nrescueOutcomeSheet.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

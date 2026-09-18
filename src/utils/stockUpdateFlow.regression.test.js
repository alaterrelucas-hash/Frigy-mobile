/**
 * MON STOCK — SINGLE-SHEET UPDATE + DETAIL. Régression SOURCE :
 *   node src/utils/stockUpdateFlow.regression.test.js
 * Vérifie le WIRING production (FridgeScreen) + les deux surfaces (StockUpdateSheet / RemainingCorrectionSheet)
 * contre les invariants §2-§48 : une seule surface, une validation, mutation canonique unique, convergence de
 * la clôture totale, fiche inspect/corriger sans doublon USED/WASTED, aucune valeur fabriquée, approximation ≠ exact.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const strip = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

const fridgeSrc = read('../screens/FridgeScreen.js');
const fridge = strip(fridgeSrc);
const sheetSrc = read('../components/stock/StockUpdateSheet.js');
const sheet = strip(sheetSrc);
const corrSrc = read('../components/stock/RemainingCorrectionSheet.js');
const corr = strip(corrSrc);

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── §4 MERGE : une SEULE surface de mise à jour (les deux sheets Rescue prototypes ne sont plus câblés) ──
ok('§4 StockUpdateSheet importé + monté', /import StockUpdateSheet/.test(fridgeSrc) && /<StockUpdateSheet/.test(fridge));
ok('§4 aucun RescueOutcomeSheet/RescueRemainingSheet câblé', !/RescueOutcomeSheet|RescueRemainingSheet/.test(fridge));
ok('§5 preview DEV 2-étapes retiré (aucun rescueStep/rescueFixture)', !/rescueStep|rescueFixture|rescueOutcome/.test(fridge));

// ── §2/§22 : tap produit → surface UNIQUE (pas la fiche) ; la fiche est atteinte via « Voir la fiche » ──
ok('§2 tap row principale → openStockUpdate(item) (ouverture NORMALE, aucune intention)',
  /onPress=\{\(\) => openStockUpdate\(item\)\}/.test(fridge) && (fridge.match(/setUpdateItem\(item\)/g) || []).length === 1);
ok('§13 « Voir la fiche produit » → ouvre la fiche (setSelectedItem) sans mutation', /onViewProduct=\{[^}]*setSelectedItem\(it\)/.test(fridge));

// ── §14/§18 : MUTATION CANONIQUE UNIQUE — aucun écrivain d'issue parallèle ──
ok('§14 submitStockUpdate → applyStockUpdate (autorité canonique V2)', /applyStockUpdate\(supabase, \{ itemId: item\.id, remainingLevel, usedDeclared, wasteDeclared, beforeLevel, clientEventId \}\)/.test(fridge));
ok('§18 AUCUN items.update({consumed/wasted}) dans le screen (clôture convergée)', !/update\(\{\s*consumed/.test(fridge));
ok('§18 consumeItem + coordinateur supprimés', !/consumeItem|createConsumeCoordinator/.test(fridge));
ok('§18 decrementUnit mort supprimé (aucun update quantity/consumed résiduel)', !/decrementUnit/.test(fridge));
ok('§16 EMPTY → clôture (retrait de la liste) ; partiel → patch actif', /closes\b/.test(fridge) && /filter\(x => x\.id !== item\.id\)/.test(fridge) && /remaining_level: remainingLevel/.test(fridge));

// ── §15 idempotence : clientEventId STABLE par intention (réutilisé au retry, nouveau si payload change) ──
ok('§15 clientEventIdFor réutilise l’id pour la même clé (retry)', /submitRef\.current\.key === key\) return submitRef\.current\.id/.test(fridge));
ok('§15 succès → submitRef remis à null (nouvel id au prochain submit)', /submitRef\.current = null;/.test(fridge));

// ── §17 échecs : messages calmes, jamais de faux succès, cas spécifiques ──
ok('§17 INCREASE_NOT_ALLOWED / ITEM_ALREADY_CLOSED / NOT_AUTHORIZED / IDEMPOTENCY_MISMATCH gérés',
  /INCREASE_NOT_ALLOWED/.test(fridge) && /ITEM_ALREADY_CLOSED/.test(fridge) && /NOT_AUTHORIZED\|NOT_AUTHENTICATED/.test(fridge) && /IDEMPOTENCY_MISMATCH/.test(fridge));

// ── §21/§22 fiche : plus de doublon USED/WASTED ; action unique « Mettre mon stock à jour » ouvre la sheet ──
ok('§22 fiche : plus de handlers « J’ai mangé ça » / « Gaspillé »', !/J'ai mangé ça/.test(fridge) && !/Gaspillé/.test(fridge));
ok('§22 fiche : action « Mettre mon stock à jour » → openStockUpdate', /Mettre mon stock à jour/.test(fridge) && /closeModal\(\); openStockUpdate\(item\)/.test(fridge));
ok('§23 bouton global « Modifier ce produit » supprimé', !/Modifier ce produit/.test(fridge));

// ── §3/§24/§25 : éditeurs FOCALISÉS (un champ à la fois), pas un formulaire global multi-champs ──
ok('§3 rows ouvrent des éditeurs FOCALISÉS distincts (identity/date/location)',
  /openEdit\(item, 'identity'\)/.test(fridge) && /openEdit\(item, 'date'\)/.test(fridge) && /openEdit\(item, 'location'\)/.test(fridge));
ok('§3 le formulaire ne rend QUE le champ focalisé (editField gating)',
  /editField === 'identity' &&/.test(fridge) && /editField === 'date' &&/.test(fridge) && /editField === 'location' &&/.test(fridge));
ok('§3 titre focalisé (jamais « Modifier » global)', /Modifier la date/.test(fridge) && /Modifier l’emplacement/.test(fridge) && /Modifier le nom/.test(fridge) && !/>Modifier<\/Text>/.test(fridge));
ok('§25 nom + emoji toujours éditables (openEdit initialise name & emoji ; identity = nom+emoji)', /setEditFields\(\{ name: item\.name, emoji: item\.emoji/.test(fridge));

// ── §27/§28 fiche : « Reste estimé » (approx) + correction bornée CORRECTED ──
ok('§27 « Reste estimé » présent (jamais « Quantité enregistrée »)', /Reste estimé/.test(fridge) && !/Quantité enregistrée/.test(fridge));
ok('§27 remaining_level null → « Non renseigné » (jamais fabriqué)', /remainingLabel\(/.test(fridge));
ok('§28 correction → setApproximateRemainingLevel (CORRECTED, jamais consume/waste)', /setApproximateRemainingLevel\(supabase, \{ itemId: item\.id, level, clientEventId \}\)/.test(fridge));
ok('§28 RemainingCorrectionSheet monté depuis la fiche', /<RemainingCorrectionSheet/.test(fridge));

// ── §26 date : interprétation DLC/DDM seulement si type autoritaire (explicitDateType) ──
ok('§26 explicitDateType utilisé ; « Date d’expiration » (claim) retiré au profit de « Date »', /explicitDateType/.test(fridge) && !/Date d'expiration/.test(fridge));

// ── §33 delete STK-02 réutilisé (neutre) ──
ok('§33 delete = items.delete + product_removed (ni consume ni waste)', /from\('items'\)\.delete\(\)/.test(fridge) && /product_removed/.test(fridge));

// ══ StockUpdateSheet (surface unique) ══
ok('sheet : présentationnel — aucun supabase/rpc (aucune écriture au tap)', !/supabase/i.test(sheet) && !/\.rpc\(/.test(sheet));
// (on retire les % de LAYOUT — maxHeight:'90%' etc. — avant de vérifier l'absence de POURCENTAGE de donnée)
const sheetNoLayout = sheet.replace(/(maxHeight|width|height|left|right|top|bottom|flex|opacity):\s*'?\d+%'?/g, '');
ok('sheet : 5 crans via REMAINING_STOPS (contrat), jamais un % de donnée', /REMAINING_STOPS\.map/.test(sheet) && !/\d\s*%/.test(sheetNoLayout));
ok('§8 sheet : monotonicité UI stricte (isLevelSelectable vs baseline) + CTA gaté (canSubmit)', /isLevelSelectable\(s\.level, baseline\)/.test(sheet) && /canSubmit\(\{ selectedLevel: selected, beforeLevel: baseline \}\)/.test(sheet));
ok('§9 sheet : baseline ≠ sélection (init = resolveInitialSelection, JAMAIS le baseline ; baseline = remaining_level ?? null)',
  /useState\(\(\) => resolveInitialSelection\(initialRemainingLevel, baseline\)\)/.test(sheet) && /item\.remaining_level != null \? item\.remaining_level : null/.test(sheet) && !/useState\(baseline\)/.test(sheet));
ok('§6 sheet : cause révélée SEULEMENT à EMPTY (causeVisible) ; toggles indépendants (setUsed/setWaste)', /causeVisible\(selected\)/.test(sheet) && /setUsed\(v => !v\)/.test(sheet) && /setWaste\(v => !v\)/.test(sheet));
ok('§9 sheet : quitter EMPTY réinitialise les causes (sanitizeCauses au pick)', /sanitizeCauses\(level, used, waste\)/.test(sheet));
ok('§0 sheet : onConfirm UNE seule fois (au submit du CTA)', (sheet.match(/onConfirm\?\./g) || []).length === 1);
ok('§4 sheet : utilisé=accent, jeté=critical (fonction, pas jugement) ; cases à cocher (checkbox), pas radio',
  /iconColor=\{theme\.accent\} label="J’en ai utilisé"/.test(sheet) && /iconColor=\{theme\.critical\} label="J’en ai jeté"/.test(sheet) && /accessibilityRole="checkbox"/.test(sheet));
ok('sheet : wording V2 (reste d\'abord + cause à EMPTY + CTA + secondaires)',
  /Combien en reste-t-il \?/.test(sheet) && /Qu’est-ce qui s’est passé \?/.test(sheet) && /Tu peux choisir les deux, ou ne rien préciser\./.test(sheet) && /Mettre mon stock à jour/.test(sheet) && /Rien n’a changé/.test(sheet) && /Voir la fiche produit/.test(sheet) && !/Où en est ce produit \?/.test(sheet));
ok('sheet : aucun hex #RRGGBB (tokens only), sauf backdrop rgba', !/#[0-9a-fA-F]{6}\b/.test(sheet));

// ══ RemainingCorrectionSheet (correction fiche) ══
// EMPTY n'est jamais un CRAN sélectionnable (CORRECTION_STOPS l'exclut — prouvé dans le test logique) ; le
// composant ne référence 'EMPTY' que pour NE PAS le pré-sélectionner, et offre une sortie vers la mise à jour.
ok('corr : CORRECTION_STOPS + sortie « il n’en reste plus » → update, pas de correction EMPTY silencieuse',
  /CORRECTION_STOPS\.map/.test(corr) && /onGoToUpdate/.test(corr) && /Il n’en reste plus/.test(corr));
ok('corr : présentationnel (aucun supabase), aucun %, aucun mot consommation/gaspillage', !/supabase/i.test(corr) && !/%/.test(corr) && !/consomm|gaspill/i.test(corr));

// ══ OUVERTURE INTENTIONNELLE — « Il n'en reste plus » → EMPTY pré-sélectionné (micro-UX, aucune mutation) ══
// L'utilisateur vient d'affirmer qu'il n'en reste plus : la sheet ne doit pas lui reposer la question.
// EMPTY n'est qu'un ÉTAT UI INITIAL — aucun RPC, aucune cause, aucune autorité métier supplémentaire.
ok('corr : « Il n’en reste plus » = simple sortie (aucune mutation, aucun onConfirm)',
  /onPress=\{onGoToUpdate\}/.test(corr) && (corr.match(/onConfirm\?\./g) || []).length === 1 && !/rpc|supabase/i.test(corr));
ok('§INTENT wiring : onGoToUpdate → openStockUpdate(it, \'EMPTY\') (aucun apply/set RPC sur ce chemin)',
  /onGoToUpdate=\{\(\) => \{ const it = correctItem; setCorrectItem\(null\); openStockUpdate\(it, 'EMPTY'\); \}\}/.test(fridge));
ok('§INTENT openStockUpdate = pré-sélection UI SEULE (setUpdateInitialLevel + setUpdateItem, rien d’autre)',
  /const openStockUpdate = \(item, initialLevel = null\) => \{ setUpdateInitialLevel\(initialLevel\); setUpdateItem\(item\); \};/.test(fridge));
ok('§INTENT toute ouverture déclare son intention (défaut null) → aucun EMPTY résiduel sur un tap normal',
  /openStockUpdate = \(item, initialLevel = null\)/.test(fridge) && (fridge.match(/openStockUpdate\(/g) || []).length === 4);
ok('§INTENT sheet câblée sur l’état (initialRemainingLevel={updateInitialLevel})',
  /initialRemainingLevel=\{updateInitialLevel\}/.test(fridge) && /initialRemainingLevel = null,/.test(sheet));
ok('§INTENT sheet : pré-sélection PURE — used/waste restent false à l’ouverture',
  /setSelected\(resolveInitialSelection\(initialRemainingLevel, baseline\)\);\s*\n\s*setUsed\(false\); setWaste\(false\);/.test(sheet));
ok('§INTENT sheet : aucune écriture à l’ouverture (onConfirm reste réservé au CTA)',
  (sheet.match(/onConfirm\?\./g) || []).length === 1 && !/useEffect\([^)]*onConfirm/.test(sheet));
ok('§INTENT quitter EMPTY reset toujours les causes (pick → sanitizeCauses inchangé)', /sanitizeCauses\(level, used, waste\)/.test(sheet));

console.log(`\nstockUpdateFlow.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

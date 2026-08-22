/**
 * Home CALM — WATCH SUMMARY (contrat PRÉSENTATIONNEL). Régression SOURCE :
 *   node src/utils/homeCalmSummary.regression.test.js
 * HomeCalm SYNTHÉTISE l'attention (mascotte + résumé Watch) au lieu de reproduire la liste. Il est
 * PRÉSENTATIONNEL : total + « plus proche » dérivent des props Watch déjà ordonnées/comptées (aucun re-tri,
 * recomptage, ni sélecteur local) ; aucun claim de calme global ; aucune liste Watch ni vignette. Le câblage
 * PRODUCTION (état C Watch-backed, repli silence, verrous) est couvert par homeCalmProduction.regression.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const calm = read('../components/home/HomeCalm.js');
// Corps de HomeCalm sans les commentaires (évite les faux positifs sur la doc).
const calmCode = calm.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── CALM-C01 : total dérivé des props Watch réelles (jamais codé en dur) ──
ok('CALM-C01 total = watchItems.length + watchOverflow (dérivé, non hard-codé)',
  /watchItems\.length\s*\+\s*\(?\s*typeof watchOverflow/.test(calmCode)
  && /totalWatch/.test(calmCode));
ok('CALM-C01 aucun nombre de produits codé en dur dans le rendu (pas de « sur 4 produits » littéral)',
  !/sur \d+ produit/.test(calmCode) && !/Voir les \d+ produits/.test(calmCode));

// ── CALM-C02 : « plus proche » = premier item déjà ordonné (aucun tri local) ──
ok('CALM-C02 nearest = watchItems[0] (ordre autoritaire, pas de sort/slice local)',
  /watchItems\[0\]/.test(calmCode) && !/\.sort\(/.test(calmCode));
ok('CALM-C02 échéance via descripteur autoritaire (getTemporalDescriptor(watchDays))',
  /getTemporalDescriptor\(\s*nearest\.watchDays\s*\)/.test(calmCode));

// ── CALM-C03 : la Calm ne rend PAS la liste Watch ni de vignette produit ──
ok('CALM-C03 HomeCalm n\'importe/rend jamais HomeWatchList',
  !/HomeWatchList/.test(calmCode));
ok('CALM-C03 aucune vignette produit dans la Calm (pas de resolveFoodImage)',
  !/resolveFoodImage/.test(calm));

// ── CALM-C04 : aucune revendication de calme global ──
const GLOBAL_CALM = /(Tout va bien|Rien à signaler|Rien d.urgent|Tout est sous contr|Tu n.as rien à faire|frigo est tranquille|Ton frigo est)/i;
// NB : on scanne le CODE (commentaires retirés) — la doc liste volontairement les phrases INTERDITES.
ok('CALM-C04 aucun claim de calme global dans le rendu HomeCalm', !GLOBAL_CALM.test(calmCode));

// ── CALM-C05 : CTA copie = total réel + grammaire ──
ok('CALM-C05 CTA dérive du total (Voir le produit / Voir les ${totalWatch} produits)',
  /totalWatch === 1 \? 'Voir le produit' : `Voir les \$\{totalWatch\} produits`/.test(calm));
ok('CALM-C05 énoncé principal + grammaire produit/produits dérivés du total',
  /produit\$\{totalWatch > 1 \? 's' : ''\}/.test(calm) && /Je garde un œil\{'\\n'\}sur \{countLabel\}/.test(calm));

// ── CALM-C07 : structure sémantique du titre sur DEUX lignes (« Je garde un œil / sur N produits ») ──
ok('CALM-C07 titre en deux lignes via saut explicite + total dynamique (jamais « sur 4 » codé)',
  /Je garde un œil\{'\\n'\}sur \{countLabel\}/.test(calm) && !/Je garde un œil sur 4/.test(calm));

// ── CALM-C08 : « plus proche » = produit ET échéance sur la MÊME ligne (aucun saut intentionnel) ──
ok('CALM-C08 échéance jointe inline (« · ${temporalInline} »), aucun saut entre nom et échéance',
  /· \$\{temporalInline\}/.test(calm) && !/nearest\.name[\s\S]{0,60}\{'\\n'\}/.test(calm));

// ── Asset validé uniquement ──
ok('ASSET HomeCalm réutilise frigy-first-run.png (aucun nouvel asset)',
  /assets\/frigy-first-run\.png/.test(calmCode)
  && !/frigy-empty|require\('.*(cherry|cerise)/i.test(calmCode));

console.log(`\nhomeCalmSummary.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

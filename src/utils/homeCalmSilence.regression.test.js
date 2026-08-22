/**
 * Home CALM — VARIANTE SILENCE (zéro-Watch / aucune suggestion). Régression SOURCE :
 *   node src/utils/homeCalmSilence.regression.test.js
 * Contrat : la variante SILENCE de HomeCalm appartient à la MÊME famille visuelle (même asset + géométrie
 * mascotte + halo) mais rend une copie BORNÉE décrivant la sortie de Frigy — AUCUN CTA, AUCUN produit,
 * AUCUN total (jamais « 0 produits »), AUCUNE revendication de calme global, AUCUN contenu « plus proche ».
 * La variante WATCH (verrouillée) reste inchangée. Le rendu prod (état C) n'est PAS modifié par cette passe.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const calm = read('../components/home/HomeCalm.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Isole la branche SILENCE (entre `isSilence ? (` et `) : hasWatch ? (`) et la branche WATCH.
const sIdx = calm.indexOf('isSilence ? (');
const wIdx = calm.indexOf(') : hasWatch ? (', sIdx);
const nullIdx = calm.indexOf(') : null}', wIdx > 0 ? wIdx : 0);
const strip = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
const silenceArm = strip(sIdx >= 0 && wIdx > sIdx ? calm.slice(sIdx, wIdx) : '');
const watchArm = wIdx >= 0 && nullIdx > wIdx ? calm.slice(wIdx, nullIdx) : '';

// ── SILENCE-C01 : la variante silence NE rend AUCUN compteur (« 0 produit(s) » / total) ──
// La copie approuvée dit « sur tes produits » (aucun nombre) → on interdit un COMPTE (chiffre + produit)
// et toute dérivation de total, pas le mot « produits » en soi.
ok('SILENCE-C01 branche silence : aucun compteur (chiffre + produit) ni total dérivé',
  silenceArm.length > 0 && !/\d+\s*produit/.test(silenceArm) && !/countLabel|totalWatch/.test(silenceArm));
// Garde structurelle : le total/nearest ne sont pas évalués en silence (hasWatch gaté sur !isSilence).
ok('SILENCE-C01 hasWatch gaté sur !isSilence (nearest/total jamais évalués en silence)',
  /const hasWatch = !isSilence &&/.test(calm));

// ── SILENCE-C02 : aucun CTA Watch en silence ──
ok('SILENCE-C02 branche silence : aucun CTA (pas de TouchableOpacity / « Voir » / onSeeMore)',
  silenceArm.length > 0 && !/TouchableOpacity/.test(silenceArm) && !/Voir/.test(silenceArm) && !/onSeeMore/.test(silenceArm));

// ── SILENCE-C03 : aucun contenu « plus proche » / nom produit en silence ──
ok('SILENCE-C03 branche silence : aucun « Le plus proche » ni nearest.name',
  silenceArm.length > 0 && !/plus proche/i.test(silenceArm) && !/nearest\.name/.test(silenceArm) && !/temporalInline/.test(silenceArm));

// ── SILENCE-C04 : aucune revendication de calme global dans la copie silence ──
const GLOBAL_CALM = /(Tout va bien|Rien à signaler|Aucune urgence|Tout est sous contr|Tu n.as rien à faire|frigo va bien|Tout est bon)/i;
ok('SILENCE-C04 copie silence sans revendication de calme global',
  silenceArm.length > 0 && !GLOBAL_CALM.test(silenceArm));
// ── SILENCE-C07 : copie MAIN exacte, deux lignes, sans point final ──
ok('SILENCE-C07 main = « Je garde un œil / sur tes produits » (2 lignes, sans point final)',
  /Je garde un œil\{'\\n'\}sur tes produits\s*\n/.test(silenceArm)
  && !/sur tes produits\./.test(silenceArm));

// ── SILENCE-C08 : copie SECONDAIRE exacte ──
ok('SILENCE-C08 secondaire = « Je te montrerai ici ce qui mérite ton attention. »',
  /Je te montrerai ici ce qui mérite ton attention\./.test(silenceArm));

// ── SILENCE-C05 : la variante WATCH verrouillée reste inchangée ──
ok('SILENCE-C05 watch : titre + plus proche + CTA dynamiques préservés',
  /Je garde un œil\{'\\n'\}sur \{countLabel\}/.test(watchArm)
  && /Le plus proche : /.test(watchArm) && /\{nearest\.name\}/.test(watchArm)
  && /\{ctaLabel\}/.test(watchArm));

// ── SILENCE-C06 : même famille visuelle (asset validé + géométrie mascotte + halo partagés) ──
ok('SILENCE-C06 asset Frigy validé partagé (frigy-first-run.png), aucune 2e image',
  /assets\/frigy-first-run\.png/.test(calm) && !/frigy-empty|home-results|require\('.*cerise/i.test(calm));
ok('SILENCE-C06 mascotte + halo partagés (une seule géométrie, hors branche texte)',
  (calm.match(/source=\{MASCOT\}/g) || []).length === 1
  && /backgroundColor: theme\.accentSoft, opacity: 0\.20/.test(calm)
  && /const M = Math\.max\(320, Math\.min\(Math\.round\(W \* 1\.02\), 410\)\)/.test(calm));

console.log(`\nhomeCalmSilence.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/**
 * RESCUE REMAINING SHEET (Frigy 2027) — étape 2 : « combien en reste-t-il ? ». Régression SOURCE :
 *   node src/utils/rescueRemainingSheet.regression.test.js
 * COUNT → stepper entier borné [0, previousRemaining] (AFTER ≤ BEFORE). FRACTION → jauge DISCRÈTE 5 crans
 * (0/¼/½/¾/plein), toujours « environ », jamais un %. Le type d'issue (USED/DISCARDED) vient de l'étape 1 ;
 * delta = BEFORE − AFTER. Présentationnel : aucun import Supabase/coordinateur ; aucune écriture ; aucun argent.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const src = read('../components/rescue/RescueRemainingSheet.js');
const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

const stops = (/const FRACTION_STOPS = \[([\s\S]*?)\];/.exec(src) || ['', ''])[1];

// ── F-G01..06 : jauge FRACTION = exactement 5 crans 0/.25/.5/.75/1 ──
ok('F-G01 exactement 5 crans fraction', (stops.match(/value:/g) || []).length === 5);
ok('F-G02 cran 0 (Vide)', /value: 0,[\s\S]{0,40}label: 'Vide'/.test(stops));
ok('F-G03 cran 0.25', /value: 0\.25/.test(stops));
ok('F-G04 cran 0.5 (Moitié)', /value: 0\.5,[\s\S]{0,40}label: 'Moitié'/.test(stops));
ok('F-G05 cran 0.75', /value: 0\.75/.test(stops));
ok('F-G06 cran 1 (Plein)', /value: 1,[\s\S]{0,40}label: 'Plein'/.test(stops));
ok('F-G07 labels humains (Vide/Moitié/Plein + « Environ … »)',
  /Environ 1\/4/.test(stops) && /Environ la moitié/.test(stops) && /Environ 3\/4/.test(stops));
ok('F-G08 aucun pourcentage continu (aucun composant Slider, aucun onValueChange, aucun %)',
  !/import[^\n]*Slider/.test(src) && !/<Slider/.test(src) && !/onValueChange/.test(src) && !/%/.test(code));
ok('F-G09 cran sélectionné visuellement distinct (repère accent, contrôle LINÉAIRE : ligne fine derrière)',
  /selected \? theme\.accent : theme\.surface/.test(src)
  && /position: 'absolute'[\s\S]{0,80}height: 2[\s\S]{0,60}backgroundColor: theme\.separator/.test(src));
ok('F-G10 tokens theme existants (accent/separator/surface/text/bg)',
  /theme\.accent/.test(code) && /theme\.separator/.test(code)
  && /theme\.surface/.test(code) && /theme\.text1/.test(code) && /theme\.bg/.test(code));

// ── C-Q01..06 : COUNT = stepper entier borné ──
ok('C-Q01 stepper entier (Minus/Plus) en mode COUNT', /<Minus size=/.test(code) && /<Plus size=/.test(code) && /!isFraction/.test(src) === false && /isFraction \?/.test(src));
ok('C-Q02 minimum 0 (dec borné à 0)', /Math\.max\(0, a - 1\)/.test(src));
ok('C-Q03 maximum = previousRemaining (countMax)', /const countMax = Math\.max\(0, Math\.round\(previousRemaining\)\)/.test(src));
ok('C-Q04 pas de négatif (disabled à after <= 0)', /disabled=\{after <= 0\}/.test(src));
ok('C-Q05 ne peut pas dépasser l’état précédent (inc borné à countMax + disabled)',
  /Math\.min\(countMax, a \+ 1\)/.test(src) && /disabled=\{after >= countMax\}/.test(src));
ok('C-Q06 lisible sans clavier (« N sur {countMax} », pas de TextInput)',
  /sur \{countMax\}/.test(src) && !/TextInput/.test(src));

// ── Vérité : AFTER ≤ BEFORE ; question RESTANT ; delta implicite ; type d'issue reçu ──
ok('P-Q05 COUNT = contrôle entier', /quantityMode === 'FRACTION'/.test(src) && /const isFraction/.test(src));
ok('P-Q06/07 FRACTION = crans approximatifs, jamais un %', /FRACTION_STOPS\.map/.test(src) && !/%/.test(code));
ok('P-Q08 type d’issue choisi AVANT le restant (outcomeType prop)', /outcomeType = 'USED'/.test(src));
ok('P-Q09 delta conceptuel = before/after transmis à onConfirm',
  /onConfirm\?\.\(\{ outcomeType, before: previousRemaining, after, mode: quantityMode \}\)/.test(src));
ok('P-Q10 AFTER ≤ BEFORE (crans > previousRemaining désactivés ; count borné countMax)',
  /s\.value > previousRemaining/.test(src) && /Math\.min\(countMax/.test(src));
ok('P-Q(question) « Combien en reste-t-il ? » (RESTANT, pas « % consommé »)',
  /Combien en reste-t-il \?/.test(code) && !/consommé/i.test(code) && !/pourcentage/i.test(code));

// ── Présentationnel ──
ok('P-Q13 aucun import/usage Supabase (hors doc)', !/supabase/i.test(code) && !/from ['"].*supabase/i.test(src));
ok('R aucun coordinateur consommation', !/consumptionOutcome/.test(src) && !/createConsumeCoordinator/.test(src));
ok('P-Q12 aucun argent/€/CO₂', !/€|euro|CO2|CO₂|économ|à sauver/i.test(code));
ok('R aucun hex #RRGGBB (couleurs via tokens)', !/#[0-9a-fA-F]{6}\b/.test(src));
ok('R confirmation « Mettre mon stock à jour »', /Mettre mon stock à jour/.test(code));

console.log(`\nrescueRemainingSheet.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

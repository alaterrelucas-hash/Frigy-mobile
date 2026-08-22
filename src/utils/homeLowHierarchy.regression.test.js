/**
 * Home LOW KNOWLEDGE — clarté NARRATIVE (but d'état → contexte connu → question locale). Régression SOURCE :
 *   node src/utils/homeLowHierarchy.regression.test.js
 * Contrat : le TITRE d'état LOW décrit le BUT (« Aide-moi à mieux connaître ton stock », famille Calm : 29/700
 * vert accent). L'eyebrow « JE CONNAIS DÉJÀ » rend explicite ce que Frigy sait (Riz). Une QUESTION LOCALE
 * subordonnée (« Tu as aussi l'un de ceux-là ? ») introduit les 3 candidats. L'ancienne « Lesquels as-tu aussi
 * chez toi ? » ne rend plus. Chips « J'en ai », sortie « Je n'ai aucun de ceux-là » et logique métier inchangés.
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const low = read('../components/home/HomeLowStock.js');
const lowCode = low.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── LOW-N01 : titre d'état = but (« Aide-moi à mieux connaître / ton stock »), 2 lignes ──
ok('LOW-N01 titre d\'état = « Aide-moi à mieux connaître{\\n}ton stock »',
  /Aide-moi à mieux connaître\{'\\n'\}ton stock/.test(lowCode));

// ── LOW-N02 : titre = hiérarchie d'état verte (famille Calm : 29/700 accent), gaté showModule ──
ok('LOW-N02 titre = fonts.semibold 29 / 700 / theme.accent, juste avant le texte',
  /fontFamily: fonts\.semibold, fontSize: 29, fontWeight: '700'[^}]*color: theme\.accent[\s\S]{0,140}Aide-moi à mieux connaître/.test(lowCode));
ok('LOW-N02b titre gaté sur showModule (pas de but sans candidats)',
  /\{showModule && \([\s\S]{0,260}Aide-moi à mieux connaître/.test(low));

// ── LOW-N03 : l'ancienne « Lesquels as-tu aussi chez toi ? » ne rend plus ──
ok('LOW-N03 « Lesquels as-tu aussi chez toi ? » absent du rendu',
  !/Lesquels as-tu aussi chez toi \?/.test(lowCode));

// ── LOW-N04 : eyebrow « JE CONNAIS DÉJÀ » (ex-« CE QUE TU AS ») ──
ok('LOW-N04 eyebrow « JE CONNAIS DÉJÀ » présent ; « CE QUE TU AS » retiré',
  /JE CONNAIS DÉJÀ/.test(lowCode) && !/CE QUE TU AS/.test(lowCode));
// eyebrow reste secondaire/neutre (12/600 text2, pas vert, pas headline).
ok('LOW-N04b eyebrow reste 12/600 text2 (secondaire, non vert)',
  /fontSize: 12, fontWeight: '600'[^}]*color: theme\.text2[\s\S]{0,60}JE CONNAIS DÉJÀ/.test(lowCode));

// ── LOW-N05 : contexte produit connu préservé (nom + location réels + image) ──
ok('LOW-N05 produit connu préservé (one.name + one.location + resolveFoodImage)',
  /\{one\.name\}/.test(lowCode) && /\{one\.location\}/.test(lowCode) && /resolveFoodImage\(one\)/.test(low));

// ── LOW-N06 : question LOCALE exacte ──
ok('LOW-N06 question locale = « Tu as aussi l\'un de ceux-là ? »',
  /Tu as aussi l’un de ceux-là \?/.test(lowCode));

// ── LOW-N07 : question locale APRÈS le contexte connu, JUSTE avant les candidats (subordonnée, sombre) ──
ok('LOW-N07 question locale dans le module, immédiatement avant candidates.map',
  /Tu as aussi l’un de ceux-là \?[\s\S]{0,160}candidates\.map/.test(lowCode));
ok('LOW-N07b question locale subordonnée (21/600 text1, ni majuscules ni vert)',
  /fontSize: 21, fontWeight: '600'[^}]*color: theme\.text1[\s\S]{0,80}Tu as aussi l’un de ceux-là/.test(lowCode)
  && !/color: theme\.accent[\s\S]{0,40}Tu as aussi l’un/.test(lowCode));

// ── LOW-N08 : candidats inchangés (rendu data-driven : image + nom + openSheet) ──
ok('LOW-N08 candidats inchangés (candidates.map → image + nom + openSheet)',
  /candidates\.map\(/.test(low) && /source=\{c\.image\}/.test(low) && /\{c\.name\}/.test(low)
  && /onPress=\{\(\) => openSheet\(c\)\}/.test(low));

// ── LOW-N09 : chip « J'en ai » inchangé ──
ok('LOW-N09 chip « J\'en ai » présent (libellé + Plus)',
  />J'en ai<\/Text>/.test(lowCode) && /<Plus size=/.test(lowCode));

// ── LOW-N10 : sortie « Je n'ai aucun de ceux-là » inchangée (rejectSet) ──
ok('LOW-N10 « Je n\'ai aucun de ceux-là » présent (rejectSet inchangé)',
  /Je n'ai aucun de ceux-là<\/Text>/.test(lowCode) && /onPress=\{\(\) => rejectSet\(/.test(lowCode));

// ── LOW-N11 : aucune logique métier LOW changée ──
ok('LOW-N11 logique LOW intacte (selectAffinityCandidates + onConfirmHave + rejectSet + showModule)',
  /selectAffinityCandidates\(/.test(low) && /onConfirmHave\?\.\(/.test(low)
  && /const showModule = candidates\.length > 0 && rounds < MAX_SETS/.test(low)
  && /const candidates = selectAffinityCandidates\(items, \{ excludeKeys/.test(low));

// ── Aucune copie explicative / tutorialisation ajoutée ──
ok('LOW-N (no-tuto) aucune copie explicative ajoutée',
  !/(Plus tu m'en dis|personnaliser Frigy|Réponds simplement|Je construis ton stock|Étape 1)/i.test(lowCode));

// ── LOW-B01..B10 : BALANCE — surface CONTEXTE compacte + zone ACTION ouverte ──
// Région SURFACE = du View accentSoft jusqu'au ternaire d'action `{showModule ?` (titre + produit connu).
const idxSurface = low.indexOf('marginHorizontal: 16');
const idxAction = low.indexOf('{showModule ?', idxSurface);
const surfaceRegion = idxSurface >= 0 && idxAction > idxSurface ? low.slice(idxSurface, idxAction) : '';
const surface = (low.match(/<View style=\{\{ marginHorizontal: 16[\s\S]*?\}\}>/) || [''])[0];

// LOW-B01 : EXACTEMENT une surface tonale contexte (signature = radius 28 ; le repère + décoratif
// utilise accentSoft en petit cercle radius 17, ce n'est PAS une surface).
ok('LOW-B01 une seule surface tonale contexte (marginHorizontal 16 + accentSoft + radius 28)',
  (low.match(/borderRadius: 28/g) || []).length === 1
  && /marginHorizontal: 16[\s\S]{0,120}backgroundColor: theme\.accentSoft[\s\S]{0,60}borderRadius: 28/.test(low));
// LOW-B02 : greeting hors surface (hors HomeLowStock)
ok('LOW-B02 greeting « Bonjour » hors surface (non rendu dans HomeLowStock)', !/Bonjour/.test(lowCode));
// LOW-B03 : la surface CONTIENT titre + produit connu (JE CONNAIS DÉJÀ + nom + rice)
ok('LOW-B03 surface = titre + {product} ; produit connu = JE CONNAIS DÉJÀ + nom + rice',
  surfaceRegion.length > 0 && /Aide-moi à mieux connaître/.test(surfaceRegion) && /\{product\}/.test(surfaceRegion)
  && /JE CONNAIS DÉJÀ/.test(low) && /\{one\.name\}/.test(low) && /source=\{primary\.image\}/.test(low));
// LOW-B04 : la surface NE contient PAS question / candidats / actions / réponse négative
ok('LOW-B04 surface SANS question/candidats/actions/négatif',
  surfaceRegion.length > 0 && !/Tu as aussi/.test(surfaceRegion) && !/candidates\.map/.test(surfaceRegion)
  && !/J'en ai/.test(surfaceRegion) && !/Je n'ai aucun/.test(surfaceRegion));
// LOW-B05 : la question d'action rend APRÈS la surface (zone ouverte)
ok('LOW-B05 question d\'action après la surface (ternaire ouvert)',
  low.indexOf('Tu as aussi l’un de ceux-là') > idxAction && idxAction > 0);
// LOW-B06 : candidats sur CANVAS OUVERT (gouttière page 20, hors surface)
ok('LOW-B06 candidats sur canvas ouvert (question + rangée paddingHorizontal 20)',
  /Tu as aussi l’un de ceux-là \?[\s\S]{0,120}paddingHorizontal: 20/.test(lowCode)
  && /justifyContent: 'space-between', paddingHorizontal: 20[\s\S]{0,40}candidates\.map/.test(low));
// LOW-B07 : aucune sous-card candidat
ok('LOW-B07 aucune card par candidat (cellule width CELL + alignItems, sans fond/bord)',
  /key=\{c\.key\} style=\{\{ width: CELL, alignItems: 'center' \}\}/.test(low));
// LOW-B08 : contrôles interactifs conservés
ok('LOW-B08 pills intacts (chip « J\'en ai » + pill « Je n\'ai aucun »)',
  />J'en ai<\/Text>/.test(lowCode) && /borderColor: theme\.separator, backgroundColor: theme\.surface/.test(low)
  && /Je n'ai aucun de ceux-là<\/Text>/.test(lowCode));
// LOW-B09 : halo threshold rejeté absent (signature = opacité 0.12 ; le repère + décoratif utilise
// légitimement pointerEvents none, ce n'est pas le halo).
ok('LOW-B09 halo threshold rejeté absent (aucune ellipse opacity 0.12)',
  !/opacity: 0\.12/.test(low) && !/borderRadius: 9999/.test(low));
// LOW-B10 : aucune surface tonale imbriquée / card-stack ; surface sans ombre/élévation
ok('LOW-B10 une seule surface (radius 28), sans ombre/élévation ; pas de card-stack',
  (low.match(/borderRadius: 28/g) || []).length === 1
  && surface.length > 0 && !/shadow/i.test(surface) && !/elevation/i.test(surface));

// ── LOW-A01..A10 : AUTONOMY HINT (éducation + global, non-interactif, hors card) ──
const idxHint = low.indexOf('Tu as autre chose chez toi');
const hintRegion = idxHint >= 0 ? low.slice(idxHint - 800, idxHint + 700) : '';
ok('LOW-A01 hint présent UNIQUEMENT dans HomeLowStock (LOW possession-learning)', idxHint > 0);
ok('LOW-A02 titre exact « Tu as autre chose chez toi ? »', /Tu as autre chose chez toi \?/.test(lowCode));
ok('LOW-A03 body exact « Ajoute-le avec le + en bas de l’écran. »',
  /Ajoute-le avec le \+ en bas de l’écran\./.test(lowCode));
ok('LOW-A04 ligne capacités exacte « Photo, scan ou ajout manuel. » (truth gate vérifié)',
  /Photo, scan ou ajout manuel\./.test(lowCode));
ok('LOW-A05 hint NON tappable (repère + en pointerEvents none, aucun Touchable/CTA « Ajouter »)',
  /pointerEvents="none"[\s\S]{0,340}<Plus size=/.test(low)
  && !/Ajouter<\/Text>|Ajouter un produit|Scanner<\/Text>|Prendre une photo<\/Text>/.test(hintRegion)
  && !/(TouchableOpacity|Pressable)[\s\S]{0,120}Tu as autre chose chez toi/.test(low));
ok('LOW-A06 comportement + global inchangé (HomeLowStock n\'appelle ni onScan ni navigation +)',
  !/onScan/.test(low) && !/setScanOpen/.test(low));
ok('LOW-A07 hint HORS surface contexte (rendu après le ternaire action, hors surfaceRegion)',
  idxHint > idxAction && !/Tu as autre chose chez toi/.test(surfaceRegion));
ok('LOW-A08 hint n\'enveloppe PAS candidats/négatif dans une autre card (aucune 2e surface tonale)',
  (low.match(/borderRadius: 28/g) || []).length === 1);
ok('LOW-A09 aucune flèche directionnelle introduite (aucun composant/asset Arrow)',
  !/Arrow/.test(low) && !/require\('.*arrow/i.test(low));
ok('LOW-A10 autres états Home ne reçoivent pas le hint (copie absente hors HomeLowStock)',
  !/Tu as autre chose chez toi/.test(read('../screens/HomeScreen.js'))
  && !/Tu as autre chose chez toi/.test(read('../components/home/HomeCalm.js')));

// ── LOW-A-CUE01..07 : repère + NU (aucun conteneur bouton), non-interactif ──
// Style du View qui porte le repère + (pointerEvents none, contenant le <Plus>).
const cueM = low.match(/<View pointerEvents="none"[^>]*style=\{\{([^}]*)\}\}>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)*<Plus/);
const cueStyle = cueM ? cueM[1] : '';
ok('LOW-A-CUE01 repère Plus décoratif toujours présent', /<Plus size=\{?20\}? color=\{theme\.accent\}/.test(low));
ok('LOW-A-CUE02 repère non-interactif (pointerEvents none, a11y masqué)',
  /<View pointerEvents="none"[^>]*accessibilityElementsHidden[\s\S]{0,140}<Plus/.test(low));
ok('LOW-A-CUE03 AUCUN conteneur bouton (ni fond, ni radius, ni width/height sur le repère)',
  cueStyle.length > 0 && !/backgroundColor/.test(cueStyle) && !/borderRadius/.test(cueStyle)
  && !/width:/.test(cueStyle) && !/height:/.test(cueStyle) && !/border/i.test(cueStyle) && !/shadow/i.test(cueStyle));
ok('LOW-A-CUE04 aucun Pressable/Touchable/onPress autour du repère + / du hint',
  !/(TouchableOpacity|Pressable|onPress)[\s\S]{0,160}<Plus size=\{?20/.test(low)
  && !/(TouchableOpacity|Pressable)[\s\S]{0,120}Tu as autre chose chez toi/.test(low));
ok('LOW-A-CUE05 routage + global inchangé (HomeLowStock n\'appelle ni onScan ni navigation +)',
  !/onScan/.test(low) && !/setScanOpen/.test(low));
ok('LOW-A-CUE06 aucune flèche directionnelle (aucun composant Arrow)', !/Arrow/.test(low));
ok('LOW-A-CUE07 copie hint inchangée (titre + body + tertiaire)',
  /Tu as autre chose chez toi \?/.test(lowCode) && /Ajoute-le avec le \+ en bas de l’écran\./.test(lowCode)
  && /Photo, scan ou ajout manuel\./.test(lowCode));

console.log(`\nhomeLowHierarchy.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

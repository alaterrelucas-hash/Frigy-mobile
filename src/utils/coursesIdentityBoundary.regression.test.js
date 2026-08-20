/**
 * N6-15 — Frontière d'identité (T10) : verrou de régression. Régression SOURCE :
 *   node src/utils/coursesIdentityBoundary.regression.test.js
 *
 * TYPE DE TEST : STATIC SOURCE CONTRACTS — PAS un test comportemental auth/session exécuté. La raison pour
 * laquelle une preuve statique est acceptée ici est la JOIGNABILITÉ architecturale : l'état « signout
 * pendant un handoff Courses vivant » ne peut PAS être produit par l'UI normale sans d'abord exécuter le
 * nettoyage même que l'on teste — le Scan est dans un Modal plein écran opaque, et le logout n'existe que
 * dans Profile (inaccessible tant que scanOpen). On prouve donc par la structure de la source que les
 * garanties critiques existent (invalidation contexte + remount + démontage de l'arbre authentifié).
 */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const app  = read('../../App.js');
const scan = read('../screens/ScanScreen.js');
const profile = read('../screens/ProfileScreen.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// Effet-frontière d'identité (invalidation d'un contexte actif sur transition user/family).
const boundary = (app.match(/useEffect\(\(\) => \{\s*\n\s*const ctx = captureContextRef\.current;[\s\S]*?\}, \[user\?\.id, familyId\]\);/) || [''])[0];

// ── IDENT-T01 : Modal Scan plein écran (non transparent) → nav Profile masquée dessous ──
ok('IDENT-T01 Modal Scan non transparent (opaque plein écran)',
  /<Modal visible=\{scanOpen\}[^>]*>/.test(app) && !/<Modal visible=\{scanOpen\}[^>]*transparent/.test(app));

// ── IDENT-T02 : logout appartient à ProfileScreen, pas à ScanScreen ──
ok('IDENT-T02 logout = ProfileScreen (auth.signOut) ; ScanScreen ne déconnecte jamais',
  /auth\.signOut\(\)/.test(profile) && !/auth\.signOut\(/.test(scan));

// ── IDENT-T03 : transition auth met à jour `user` ──
ok('IDENT-T03 onAuthStateChange → setUser', /onAuthStateChange\(\([^)]*\) => \{\s*\n?\s*setUser\(session\?\.user \|\| null\)/.test(app));

// ── IDENT-T04 : l'effet-frontière dépend de user?.id + familyId ──
ok('IDENT-T04 effet dépend de [user?.id, familyId]', boundary.length > 0 && /\}, \[user\?\.id, familyId\]\);/.test(boundary));
ok('IDENT-T04 garde d\'invalidation = user absent OU owner user OU owner family divergent',
  /if \(!user \|\| ctx\.userOwner !== user\?\.id \|\| ctx\.familyOwner !== familyId\)/.test(boundary));

// ── IDENT-T05/T06/T07 : invalidation exécute null + close + bump ──
ok('IDENT-T05 setCaptureContext(null)', /setCaptureContext\(null\);/.test(boundary));
ok('IDENT-T06 setScanOpen(false)', /setScanOpen\(false\);/.test(boundary));
ok('IDENT-T07 scanSessionKey incrémenté', /setScanSessionKey\(k => k \+ 1\);/.test(boundary));

// ── IDENT-T08 : ScanScreen rendu avec key={scanSessionKey} (remount déterministe) ──
ok('IDENT-T08 <ScanScreen key={scanSessionKey}', /<ScanScreen key=\{scanSessionKey\}/.test(app));

// ── IDENT-T09 : !user rend LoginScreen (démontage de l'arbre Scan authentifié) ──
ok('IDENT-T09 !user ? <LoginScreen', /:\s*!user \?\s*\(?\s*\n?\s*<LoginScreen/.test(app));

// ── IDENT-T10/T11 : aucune copie locale de deterministicItemId / lineage dans ScanScreen ──
// deterministicItemId n'est lu QUE via ctx.* (le prop captureContext), jamais stocké dans un useState.
ok('IDENT-T10 aucun useState pour deterministicItemId/lineage/shoppingItemId',
  !/useState[^\n]*deterministicItemId/i.test(scan) && !/set(DeterministicItemId|Lineage|ShoppingItemId)\b/.test(scan));
ok('IDENT-T11 deterministicItemId/lineage lus uniquement via ctx.* (prop), pas de variable persistée',
  /ctx\.deterministicItemId/.test(scan) && /ctx\.lineage/.test(scan)
  && !/const \[[^\]]*(deterministicItemId|lineage)[^\]]*\] = useState/i.test(scan));

// ── IDENT-T12 : la frontière FAMILLE reçoit la même protection (familyId dans deps + garde) ──
ok('IDENT-T12 frontière famille couverte (familyId dans garde ET deps)',
  /ctx\.familyOwner !== familyId/.test(boundary) && /\[user\?\.id, familyId\]/.test(boundary));

// ── IDENT-T13 : fermeture Scan normale nettoie captureContext ──
ok('IDENT-T13 onClose Scan → setCaptureContext(null)',
  /onClose=\{\(\) => \{ setScanOpen\(false\); setCaptureContext\(null\); \}\}/.test(app));

// ── IDENT-T14 : protection T9 "Scanner un autre" intacte (consume + reset local complet) ──
ok('IDENT-T14 "Scanner un autre" = consumeCourseCtx + reset local complet',
  /onPress=\{\(\) => \{ consumeCourseCtx\(\); setResult\(null\);[\s\S]*?setManualName\(''\); \}\}/.test(scan)
  && /Scanner un autre/.test(scan));

console.log(`\ncoursesIdentityBoundary.regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

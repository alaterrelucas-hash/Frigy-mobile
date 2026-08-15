/**
 * N6-10 — Profile Impact Truth (CR-11/12/13/14/20/21). Régression SOURCE (scan) :
 *   node src/utils/profileImpactTruth.test.js
 * ProfileScreen.js/App.js importent react-native → non compilables ici ; on scanne la SOURCE
 * (commentaires retirés d'abord, pour ne pas matcher le texte explicatif) afin de garantir que les
 * assertions mensongères ne peuvent PAS réapparaître.
 */
const fs = require('fs');
const path = require('path');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const profileRaw = fs.readFileSync(path.join(__dirname, '../screens/ProfileScreen.js'), 'utf8');
const appRaw     = fs.readFileSync(path.join(__dirname, '../../App.js'), 'utf8');
const profile = stripComments(profileRaw);
const app     = stripComments(appRaw);

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + label); } };

// ── CR-11 ARGENT : aucune économie/monétaire inventée (calcul, prix fallback, carte €, résumé) ──
// (2.5 apparaît légitimement dans strokeWidth={2.5} → on cible l'expression monétaire, pas la constante nue)
ok('IMPACT no price fallback (price || 2.5) supprimé', !profile.includes('price || 2.5') && !profile.includes('|| 2.5'));
ok('IMPACT no variable savings', !/\bsavings\b/.test(profile));
ok('IMPACT stats ne lit plus price (select wasted only)', profile.includes(".select('wasted')") && !profile.includes(".select('price"));
ok('IMPACT no carte « Économies estimées »', !profile.includes('Économies estimées'));
ok('IMPACT no symbole € affiché', !profile.includes(' €`') && !profile.includes('toFixed(0)} €'));

// ── CR-12 CO₂ : aucun modèle causal (0.75 apparaît en rgba → on cible le multiplicateur « * 0.75 */ ») ──
ok('IMPACT no multiplicateur CO₂ (* 0.75)', !profile.includes('* 0.75'));
ok('IMPACT no « CO₂ évité »', !profile.includes('CO₂ évité'));
ok('IMPACT no clé co2 dans les stats', !/\bco2\b/.test(profile));

// ── CR-13 SCORE / COMPARAISON : supprimés totalement ──
ok('IMPACT no getWeekGrade', !profile.includes('getWeekGrade'));
ok('IMPACT no FRENCH_AVG_WASTE', !profile.includes('FRENCH_AVG_WASTE'));
ok('IMPACT no comparisonPct', !profile.includes('comparisonPct'));
ok('IMPACT no « % mieux que la moyenne »', !profile.includes('mieux que la moyenne'));
ok('IMPACT no « moyenne française »', !profile.includes('moyenne française'));
ok('IMPACT no scoreLabel', !profile.includes('scoreLabel'));

// ── CR-14 SAUVÉ : plus de « produits sauvés » (consommé ≠ sauvé) ; libellé factuel ──
ok('IMPACT no carte « Produits sauvés »', !profile.includes('Produits sauvés'));
ok('IMPACT libellé « Consommations enregistrées » présent', profile.includes('Consommations enregistrées'));
ok('IMPACT libellé « Gaspillages déclarés » présent', profile.includes('Gaspillages déclarés'));

// ── HEBDO (N6-10 2.6) : carte SUPPRIMÉE — updated_at (timestamp technique, trigger prod) ≠ instant
//    d'événement → aucune revendication « cette semaine ». Aucun champ événementiel inventé. ──
ok('WEEKLY « CETTE SEMAINE » supprimé', !profile.includes('CETTE SEMAINE'));
ok('WEEKLY empty-state hebdo supprimé', !profile.includes('Aucune activité enregistrée cette semaine'));
ok('WEEKLY no cercle de grade (weekGrade)', !profile.includes('weekGrade'));
ok('WEEKLY no requête .gte(updated_at) (aucune fenêtre temporelle)', !profile.includes(".gte('updated_at'") && !profile.includes('.gte("updated_at"'));
ok('WEEKLY no weekStart', !profile.includes('weekStart'));
ok('WEEKLY no vars hebdo (weekRecorded/weekDeclaredWaste/weekTotal)',
  !profile.includes('weekRecorded') && !profile.includes('weekDeclaredWaste') && !profile.includes('weekTotal'));
// Aucune statistique Profile n'utilise updated_at comme horodatage d'événement conso/gaspillage
ok('WEEKLY aucune stat Profile n\'utilise updated_at', !profile.includes('updated_at'));
ok('WEEKLY no champ événementiel inventé (consumed_at/wasted_at)', !profile.includes('consumed_at') && !profile.includes('wasted_at'));
// Indicateurs GLOBAUX véridiques conservés (déjà dans la grille de stats)
ok('WEEKLY→GLOBAL consommations enregistrées globales conservées', profile.includes('recordedConsumptions'));
ok('WEEKLY→GLOBAL gaspillages déclarés globaux conservés', profile.includes('declaredWaste'));

// ── SHARE (CR-11) : feature CONSERVÉE, message neutre (0 chiffre inventé, 0 causalité, 0 1re personne de résultat) ──
ok('SHARE handlers conservés (WhatsApp/SMS/More)', profile.includes('handleShareWhatsApp') && profile.includes('handleShareSMS') && profile.includes('handleShareMore'));
ok('SHARE shareMessage conservé', profile.includes('shareMessage'));
ok('SHARE no « 30 € »', !profile.includes('30 €'));
ok('SHARE no « économise » (promesse causale)', !profile.includes('économise') && !profile.includes('économies par mois'));
ok('SHARE no « je ne jette » (assertion 1re personne)', !profile.includes('je ne jette'));
ok('SHARE invite subtitle sans « économiser »', !profile.includes('aide tes proches à économiser'));

// ── CR-21 NOTIFICATIONS : surface de préférences RETIRÉE (aucun toggle mensonger) ──
ok('NOTIF NotificationsModal supprimé', !profile.includes('NotificationsModal') && !profile.includes('function NotificationsModal'));
ok('NOTIF NOTIF_OPTIONS supprimé', !profile.includes('NOTIF_OPTIONS'));
ok('NOTIF MOCK_NOTIFS supprimé', !profile.includes('MOCK_NOTIFS'));
ok('NOTIF entrée menu « notifs » supprimée', !profile.includes("id: 'notifs'"));
ok('NOTIF ProfileScreen n\'écrit plus notification_prefs', !profile.includes('notification_prefs'));
ok('NOTIF ProfileScreen n\'importe plus Switch/Bell', !/[,{]\s*Switch\b/.test(profile) && !/\bBell\b/.test(profile));

// App.js : récaps mensongers supprimés, gate N6-03 PRÉSERVÉ
ok('NOTIF App.js récap weeklySavingsSummary supprimé', !app.includes('weeklySavingsSummary'));
ok('NOTIF App.js récap monthlyCo2Impact supprimé', !app.includes('monthlyCo2Impact'));
ok('NOTIF App.js no « Ton récap de la semaine »', !app.includes('Ton récap de la semaine'));
ok('NOTIF App.js no « impact CO₂ du mois »', !app.includes('impact CO₂ du mois'));
ok('NOTIF App.js gate N6-03 expiry PRÉSERVÉ (selectExpiryPushes)', app.includes('selectExpiryPushes'));
ok('NOTIF App.js wording neutre push PRÉSERVÉ (buildNeutralPushContent)', app.includes('buildNeutralPushContent'));

// ── CR-20 SUPPRESSION COMPTE (N6-10 2.6) : LIBELLÉ = EFFET RÉEL. Bornage au set réellement effacé ; ──
//    exclusions (photo, identifiant, local) explicitement divulguées.
ok('ACCOUNT libellé étroit « Effacer mes produits, listes et historique »', profile.includes('Effacer mes produits, listes et historique'));
ok('ACCOUNT no « Effacer mes données Frigy » (trop large)', !profile.includes('Effacer mes données Frigy'));
ok('ACCOUNT no « Effacer toutes mes données » (trop large)', !profile.includes('Effacer toutes mes données') && !profile.includes('toutes mes données'));
ok('ACCOUNT no « Supprimer mon compte » (faux)', !profile.includes('Supprimer mon compte'));
ok('ACCOUNT no « Supprimer définitivement » (revendication compte permanent)', !profile.includes('Supprimer définitivement'));
ok('ACCOUNT confirmation énumère le contenu réellement effacé',
  profile.includes('tes produits') && profile.includes('ta liste de courses') && profile.includes('recettes enregistrées') && profile.includes('ton historique') && profile.includes('profil'));
ok('ACCOUNT confirmation dit déconnexion', profile.includes('déconnectera'));
ok('ACCOUNT confirmation dit PHOTO de profil NON supprimée', profile.includes('photo de profil') && profile.includes('pas supprim'));
ok('ACCOUNT confirmation dit identifiant de connexion NON supprimé', profile.includes('identifiant de connexion'));
ok('ACCOUNT confirmation reconnaît des données techniques locales résiduelles', profile.includes('techniques locales'));
ok('ACCOUNT échec honnête (suppression non terminée)', profile.includes('pas pu être terminée'));
ok('ACCOUNT échec n\'implique pas de rollback complet', !profile.includes('annulée') && !profile.includes('rétablies') && !profile.includes('restaurées'));
// L'action ne DOIT PAS avoir été élargie (pas de suppression avatar/Storage/Auth/RevenueCat/AsyncStorage)
ok('ACCOUNT deletion NON élargie (pas de remove avatars/Storage)', !profile.includes("storage.from('avatars').remove") || (profile.match(/storage\.from\('avatars'\)\.remove/g) || []).length <= 1);
ok('ACCOUNT no Auth admin.deleteUser / Edge Function', !profile.includes('admin.deleteUser') && !profile.includes('functions.invoke'));

console.log(`\nprofileImpactTruth: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

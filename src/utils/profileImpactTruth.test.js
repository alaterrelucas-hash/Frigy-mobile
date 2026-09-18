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
ok('IMPACT stats ne lit plus price (select des déclarations canoniques V2, jamais price)', profile.includes(".select('used_declared, waste_declared')") && !profile.includes(".select('price"));
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
ok('IMPACT libellé V2 « Utilisations déclarées » présent', profile.includes('Utilisations déclarées'));
ok('IMPACT libellé « Gaspillages déclarés » présent', profile.includes('Gaspillages déclarés'));
// §26 : chevauchement explicité, jamais « entièrement gaspillé » ni catégories exclusives.
ok('IMPACT overlap explicité (un même produit peut apparaître dans les deux)', profile.includes('peut apparaître dans les deux') || profile.includes('peut aussi compter comme utilisé'));
ok('IMPACT jamais « entièrement gaspillé »', !profile.includes('entièrement gaspill'));

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
ok('WEEKLY→GLOBAL utilisations déclarées globales conservées', profile.includes('usedDeclaredCount'));
ok('WEEKLY→GLOBAL gaspillages déclarés globaux conservés', profile.includes('wasteDeclaredCount'));

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
// N6-14 : la surface de préférences est retirée (aucune persistance depuis un toggle). Le SEUL usage
// restant de notification_prefs est la RÉINITIALISATION à null lors de l'effacement des données (N6-14).
ok('NOTIF ProfileScreen ne PERSISTE plus de prefs depuis un toggle', !profile.includes('notification_prefs: updated') && !profile.includes('update({ notification_prefs: updated'));
ok('NOTIF le seul notification_prefs restant est le reset d\'effacement (→ null)',
  !profile.includes('notification_prefs') || profile.includes('notification_prefs: null'));
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

// ── N6-14 (CR-08) : identité de foyer PRÉSERVÉE + vérité d'effacement (aucune erreur → faux succès) ──
ok('ERASE ne supprime PLUS la ligne profiles (update-reset, préserve family_id)', !profile.includes("from('profiles').delete()") && profile.includes("from('profiles').update({"));
ok('ERASE préserve l\'identité de membre (id/family_id/role/avatar NON réinitialisés)',
  !profile.includes('family_id: null') && !profile.includes('role: null') && !profile.includes('avatar_url: null'));
ok('ERASE réinitialise les données personnelles (name/phone/prefs/push/score/streak/last_opened)',
  profile.includes('name: null') && profile.includes('phone: null') && profile.includes('notification_prefs: null') && profile.includes('push_token: null') && profile.includes('score: 0') && profile.includes('streak: 0') && profile.includes('last_opened: null'));
// Chaque mutation vérifie {error} et throw → aucune erreur n'atteint le signOut de succès.
ok('ERASE wrapper vérifie {error} et throw', profile.includes('const { error } = await p; if (error) throw error;'));
ok('ERASE toutes les mutations passent par run() (items/shopping/recipes/scan/profiles)',
  profile.includes("run(supabase.from('items').delete") && profile.includes("run(supabase.from('shopping_items').delete") && profile.includes("run(supabase.from('saved_recipes').delete") && profile.includes("run(supabase.from('scan_history').delete") && profile.includes("run(supabase.from('profiles').update"));
// N6-14 (2A.7) : l'échec d'effacement RETOURNE avant la déconnexion (aucune erreur d'effacement
// n'atteint le signOut de succès) ; l'issue de déconnexion est DISTINCTE.
ok('ERASE échec → return AVANT signOut', (() => {
  const iProfiles = profile.indexOf("run(supabase.from('profiles').update");
  const iCatch = profile.indexOf('} catch (e) {', iProfiles);
  const iReturn = profile.indexOf('return;', iCatch);
  const iSignOut = profile.indexOf('supabase.auth.signOut()', iProfiles);
  return iProfiles > 0 && iCatch > iProfiles && iReturn > iCatch && iSignOut > iReturn;
})());
ok('ERASE échec → « Suppression incomplète » (reste authentifié, retry)', profile.includes('Suppression incomplète'));
ok('SIGNOUT issue DISTINCTE : {error} inspecté explicitement', profile.includes('signOutError = (r && r.error)') || profile.includes('signOutError ='));
ok('SIGNOUT échec ≠ « incomplète » → « Données effacées » + déconnexion échouée', profile.includes('Données effacées') && profile.includes('déconnexion a échoué'));

console.log(`\nprofileImpactTruth: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

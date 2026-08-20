import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, Component } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import { Home, Refrigerator, Apple, User, Plus } from 'lucide-react-native';

import { supabase } from './src/config/supabase';
import { initSentry, Sentry } from './src/config/sentry';
import { posthog } from './src/config/posthog';
import { C } from './src/config/constants';
import { decideAddItems, CAP_DECISION } from './src/utils/capEnforcement';
import { estimateDays, suggestLocation } from './src/utils/product';
import { buildAssertionProvenance, CAPTURE_METHOD } from './src/utils/captureProvenance';
import { courseStockItemId, courseLineage } from './src/utils/handoffIdentity';
import { selectExpiryPushes, buildNeutralPushContent } from './src/utils/notificationGate';
import { strongTemporalDays } from './src/utils/temporalAuthority';
import { styles } from './src/styles';
import { searchImageByName } from './src/api/openfoodfacts';
import { RC_API_KEY } from './src/config/purchases';
import useSubscription from './src/hooks/useSubscription';
import useProOffer from './src/hooks/useProOffer';

import LoginScreen        from './src/screens/LoginScreen';
import OnboardingScreen   from './src/screens/OnboardingScreen';
import ShoppingListScreen from './src/screens/ShoppingListScreen';
import HomeScreen       from './src/screens/HomeScreen';
import FridgeScreen     from './src/screens/FridgeScreen';
import RecipesScreen    from './src/screens/RecipesScreen';
import ProfileScreen    from './src/screens/ProfileScreen';
import ScanScreen       from './src/screens/ScanScreen';
import PaywallScreen    from './src/screens/PaywallScreen';

try { initSentry(); } catch {}

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) {
    try { Sentry.captureException(error); } catch {}
  }
  render() {
    if (this.state.hasError) return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAFAF8' }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#1C1C1E', marginBottom: 10, textAlign: 'center' }}>Une erreur est survenue</Text>
          <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
            Frigy a rencontré un problème inattendu. L'équipe a été notifiée automatiquement.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#3DB33F', padding: 16, borderRadius: 14, width: '100%', alignItems: 'center' }}
            onPress={() => this.setState({ hasError: false })}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Réessayer</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
    return this.props.children;
  }
}

// Init RevenueCat si installé
let Purchases = null;
try { Purchases = require('react-native-purchases').default; } catch { /* not installed yet */ }

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function App() {
  const [tab, setTab] = useState('home');
  const [items, setItems] = useState([]);
  // N6-09 (CR-18) : lisibilité du compte SCOPÉE À LA FAMILLE. `items=[]` initial n'est PAS un foyer
  // vide connu. Un compte n'est autoritatif pour le cap QUE si hydratedFamilyId === familyId courant
  // (fetch réussi, 0 ligne inclus). Échec fetch → NE marque PAS prêt. Jeton de requête = garde
  // anti-réponse-périmée (famille A qui répond après un switch vers B n'écrase pas B).
  const [hydratedFamilyId, setHydratedFamilyId] = useState(null);
  const fetchReqRef = useRef(0);
  // N6-14 (CR-08) : FIRST_RUN vs EMPTY_STOCK est désormais AUTORITAIRE CÔTÉ SERVEUR (household_lifecycle),
  // household-scopé, durable à travers reinstall/new device/erase — plus aucune autorité AsyncStorage
  // (l'ancien flag `frigy_stock_initialized` device-scopé est abandonné). `lifecycle` = {state} ou null
  // (ligne absente / non chargée) ; `lifecycleReady` passe true après un fetch réussi pour la famille
  // courante. UNKNOWN/erreur ≠ NEVER → neutre côté Home.
  const [lifecycle, setLifecycle] = useState(null);
  const [lifecycleReady, setLifecycleReady] = useState(false);
  const lifecycleReqRef = useRef(0);
  const [user, setUser] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(null); // null = en cours de chargement
  const [scanOpen, setScanOpen] = useState(false);
  const [paywallOpen, setPaywallOpen]       = useState(false);
  const [shoppingOpen, setShoppingOpen]     = useState(false);
  // N6-15 — HANDOFF COURSES → STOCK. `captureContext` = intention en cours (nom + id déterministe +
  // lignée) transmise au FORMULAIRE MANUEL CANONIQUE (ScanScreen). `removedShoppingId` = signal de
  // cleanup pour retirer localement une ligne Courses qu'App vient de supprimer (cas modale ouverte).
  const [captureContext, setCaptureContext] = useState(null);
  const [removedShoppingId, setRemovedShoppingId] = useState(null);
  // N6-15 (frontière d'identité) : bumper cette clé REMONTE ScanScreen → détruit tout état de formulaire
  // DÉRIVÉ (manualName, result, packUnits…) qu'un handoff Courses aurait matérialisé. Le miroir `ref`
  // permet à l'effet-frontière de lire le contexte courant SANS dépendre de captureContext (anti-course §8).
  const [scanSessionKey, setScanSessionKey] = useState(0);
  const captureContextRef = useRef(null);
  const [fridgeUrgent, setFridgeUrgent] = useState(false);
  const [fridgeInitialItem, setFridgeInitialItem] = useState(null);
  const [streak, setStreak] = useState(0);
  const [notifPrefs, setNotifPrefs] = useState({});

  const { status: entitlement, isPro, entitlementBusy, purchase, restore, refresh: refreshEntitlement } = useSubscription();
  const { offerStatus, plans: offerPlans, reload: reloadOffer } = useProOffer();

  // Chargement runtime (OTA-compatible, aucun plugin natif) — App.js charge
  // uniquement la ressource. Seul Mon Stock reçoit fontFamily dans cette passe ;
  // les autres écrans continuent d'utiliser la police système sans changement.
  const [stockFontsLoaded] = useFonts({
    'SourceSans3-Regular': require('./assets/fonts/SourceSans3-Regular.ttf'),
    'SourceSans3-SemiBold': require('./assets/fonts/SourceSans3-SemiBold.ttf'),
  });

  useEffect(() => {
    // RevenueCat a besoin du module natif du store, absent dans Expo Go : y appeler
    // Purchases.configure jette « Invalid API key… native store not available » (log
    // console.error du SDK). On saute donc la config dans Expo Go — inchangé pour les
    // dev builds / TestFlight / production, où le natif est présent et configure normalement.
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return;
    try {
      if (Purchases && RC_API_KEY) {
        Purchases.configure({ apiKey: RC_API_KEY });
      }
    } catch (e) {
      try { Sentry.captureException(e); } catch {}
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('frigy_onboarding_done').then(val => {
      // null = jamais vu → afficher l'onboarding. 'true' = déjà vu → skip.
      // Pour tester : passer 'false' à la place de val === 'true'
      setOnboardingDone(val === 'true');
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
      if (session?.user) setupProfile(session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) setupProfile(session.user.id);
      else { setFamilyId(null); setItems([]); setHydratedFamilyId(null); lifecycleReqRef.current++; setLifecycle(null); setLifecycleReady(false); posthog.reset(); } // N6-09/N6-14 : invalide compte + cycle de vie
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const setupProfile = async (userId, name = null) => {
    try {
    await supabase.rpc('setup_user_profile');
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id, name, streak, last_opened, notification_prefs')
      .eq('id', userId)
      .single();
    if (profile?.family_id) {
      // Calcul du streak
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      let newStreak;
      if (!profile.last_opened) {
        newStreak = 1;
      } else if (profile.last_opened === today) {
        newStreak = profile.streak || 1;
      } else if (profile.last_opened === yesterdayStr) {
        newStreak = (profile.streak || 0) + 1;
      } else {
        newStreak = 1;
      }
      if (profile.last_opened !== today) {
        await supabase.from('profiles').update({ streak: newStreak, last_opened: today }).eq('id', userId);
      }
      setStreak(newStreak);
      const finalName = name && (!profile.name || profile.name === 'Utilisateur') ? name : (profile.name || '');
      if (name && (!profile.name || profile.name === 'Utilisateur')) {
        await supabase.from('profiles').update({ name }).eq('id', userId);
        setProfileName(name);
      } else {
        setProfileName(profile.name || '');
      }
      setFamilyId(profile.family_id);
      if (profile.notification_prefs) setNotifPrefs(profile.notification_prefs);
      fetchItems(profile.family_id);
      fetchLifecycle(profile.family_id);
      registerPushToken(userId);
      posthog.identify(userId, { name: finalName, family_id: profile.family_id });
    }
    } catch (e) {
      try { Sentry.captureException(e); } catch {}
    }
  };

  const fetchItems = async (famId) => {
    const reqId = ++fetchReqRef.current; // N6-09 : jeton « dernière requête gagne »
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('family_id', famId)
      .eq('consumed', false);
    if (fetchReqRef.current !== reqId) return; // réponse périmée (un fetch plus récent l'emporte) → ignorer
    if (error || !data) return;                // N6-09 : échec fetch → NE PAS marquer prêt (UNKNOWN ≠ ZERO)
    const mapped = data.map(i => ({ ...i, days: i.days_left, emoji: i.emoji || '🛒' }));
    setItems(mapped);
    setHydratedFamilyId(famId);                // N6-09 : compte KNOWN pour CETTE famille (0 ligne inclus)
    enrichItemImages(mapped);
  };

  // N6-14 : lit l'autorité de cycle de vie du foyer (household_lifecycle). Garde anti-réponse-périmée
  // scopée famille (jeton `lifecycleReqRef`, cf. fetchItems). Erreur → NON prêt (neutre). Ligne absente
  // (data null) → prêt mais state null = UNKNOWN (jamais interprété NEVER côté Home).
  const fetchLifecycle = async (famId) => {
    const reqId = ++lifecycleReqRef.current;
    const { data, error } = await supabase
      .from('household_lifecycle')
      .select('state')
      .eq('family_id', famId)
      .maybeSingle();
    if (lifecycleReqRef.current !== reqId) return; // réponse périmée (famille A après switch vers B) → ignorer
    if (error) { setLifecycleReady(false); return; } // échec → pas d'autorité → neutre
    setLifecycle({ state: data ? data.state : null });
    setLifecycleReady(true);
  };

  // LOW A « Confirmation Intelligente » — ajout RÉEL d'un produit confirmé « Je l'ai ».
  // Réutilise le même flow que ScanScreen (insert items + defaults honnêtes : quantité choisie,
  // location via suggestLocation, DLC via estimateDays — jamais de date fictive). Le recompute
  // Home se fait naturellement via setItems (re-render → richness/signals/candidats recalculés).
  const handleConfirmHave = async (cand, opts = {}) => {
    if (!cand?.name || !familyId) return;
    // N6-09 (CR-18) : compte lisible SEULEMENT si hydraté pour la famille courante. Compte inconnu →
    // refus NEUTRE (chargement), JAMAIS le paywall (inconnu ≠ limite atteinte). Pro : jamais bloqué.
    const countReady = familyId != null && hydratedFamilyId === familyId;
    // N6-11 (CR-15/16/17) : l'autorité d'entitlement (statut à 4 états) n'importe qu'au dépassement du
    // cap. Compte inconnu → chargement ; entitlement non établi au cap → vérification NEUTRE (jamais
    // paywall) ; limite Free atteinte → paywall. Pro : jamais bloqué.
    const dec = decideAddItems({ entitlement, countReady, activeCount: items?.length ?? 0, addCount: 1 });
    if (!dec.allowed) {
      if (dec.reason === CAP_DECISION.DENY_COUNT_UNAVAILABLE) { Alert.alert('Stock en cours de chargement', 'Réessaie dans un instant.'); return; }
      if (dec.reason === CAP_DECISION.DENY_ENTITLEMENT_UNAVAILABLE) { Alert.alert('Vérification de ton abonnement…', 'Réessaie dans un instant.'); return; }
      setPaywallOpen(true); return;
    }
    const category = 'Épicerie';
    const quantity = opts.quantity || 1;
    const days = estimateDays(category, cand.name);
    const newItem = {
      family_id: familyId, added_by: user?.id, name: cand.name, emoji: '🛒', brand: '',
      category, location: suggestLocation(category, cand.name), quantity, total_units: quantity,
      unit: '', dlc: '—', days_left: typeof days === 'number' ? days : 30, consumed: false,
      // N6-08 : « Je l'ai » = présence DIRECT, mais AUCUN compte explicite → quantité UNKNOWN
      // (quantityTouched false). Lignée HOME_HAVE persistée ; aucune date/type inventé.
      assertion_provenance: buildAssertionProvenance({ captureMethod: CAPTURE_METHOD.HOME_HAVE, quantityTouched: false, dateEnteredByUser: false }),
    };
    try {
      const { data, error } = await supabase.from('items').insert(newItem).select().single();
      if (error || !data) return;
      setItems((prev) => [...prev, { ...data, days: data.days_left, emoji: data.emoji || '🛒' }]);
    } catch (e) { try { Sentry.captureException(e); } catch {} }
  };

  // N6-15 — cleanup Courses : retire la ligne d'intention APRÈS un commit Stock confirmé/reconnu. Ne
  // supprime jamais une représentation Stock. Échec delete → Stock reste + ligne Courses reste (le
  // pré-vol la reconnaîtra au prochain essai, sans doublon). Succès → signale la modale Courses (si ouverte).
  const cleanupShoppingRow = async (shoppingItemId) => {
    if (!shoppingItemId) return false;
    const { error } = await supabase.from('shopping_items').delete().eq('id', shoppingItemId);
    if (!error) { setRemovedShoppingId(shoppingItemId); return true; }
    return false;
  };

  // Courses INITIE. Le WRITER STOCK CANONIQUE (ScanScreen.addProduct) EXÉCUTE. App orchestre :
  // pré-vol idempotent → soit reconnaît un handoff déjà rangé (retente juste le cleanup), soit ouvre
  // le formulaire manuel canonique préréempli (nom seul, ZÉRO mutation à l'ouverture).
  const handleSendToStock = async ({ shoppingItemId, name, quantity }) => {
    if (!familyId || !shoppingItemId) return;
    const deterministicItemId = courseStockItemId({ familyId, shoppingItemId });
    if (!deterministicItemId) return;
    let existing = null;
    try {
      const { data } = await supabase.from('items')
        .select('family_id, assertion_provenance').eq('id', deterministicItemId).maybeSingle();
      existing = data || null;
    } catch (e) { try { Sentry.captureException(e); } catch {} }
    if (existing) {
      const lin = existing.assertion_provenance && existing.assertion_provenance.lineage;
      if (existing.family_id === familyId && lin && lin.kind === 'COURSES' && lin.shoppingItemId === shoppingItemId) {
        // Déjà rangé (Stock canonique reconnu) → AUCUN nouvel insert, on retente SEULEMENT le cleanup
        // Courses et on inspecte son booléen pour un message VÉRIDIQUE (retiré vs non retiré).
        const cleanupOk = await cleanupShoppingRow(shoppingItemId);
        Alert.alert('Déjà dans ton stock', cleanupOk
          ? `« ${name} » est déjà dans ton stock. La ligne a été retirée de ta liste de courses.`
          : `« ${name} » est déjà dans ton stock, mais la ligne n'a pas pu être retirée de ta liste de courses.`);
        return;
      }
      Alert.alert('Impossible d\'ajouter', 'Un conflit d\'identifiant empêche l\'ajout. Réessaie plus tard.');
      return; // intégrité : pas de cleanup, pas de faux succès
    }
    // `sourceName` = nom Courses ORIGINAL, immuable (reste affichable même si l'utilisateur édite le nom
    // Stock). `sourceQuantity` = quantité Courses en CONTEXTE D'AFFICHAGE (jamais quantité/autorité Stock).
    // userOwner/familyOwner figent l'identité propriétaire → toute transition compte/foyer invalide ce
    // contexte (§7). Ne JAMAIS identifier la ligne Courses par le nom édité (cleanup = shoppingItemId).
    setCaptureContext({ shoppingItemId, sourceName: name, sourceQuantity: quantity, deterministicItemId,
      lineage: courseLineage({ shoppingItemId }), userOwner: user?.id, familyOwner: familyId });
    setShoppingOpen(false);
    setScanOpen(true);
  };

  // Miroir : garde `captureContextRef` synchronisé pour que l'effet-frontière lise le contexte COURANT
  // sans l'ajouter à ses dépendances (sinon il se déclencherait à la création du contexte → §8).
  useEffect(() => { captureContextRef.current = captureContext; }, [captureContext]);

  // N6-15 (§7 + frontière dérivée) — un handoff Courses ne doit JAMAIS survivre à une transition
  // d'identité : sign-out (user null), changement d'utilisateur (user.id) ou de foyer (familyId).
  // Quand une VRAIE frontière invalide un contexte ACTIF, on purge l'owner canonique ET on détruit le
  // formulaire Scan dérivé (fermeture + remount via scanSessionKey). L'effet ne dépend QUE de
  // user?.id/familyId → il ne peut pas se déclencher sur la création du contexte (mêmes user/family →
  // owner concordant → conservé), ni sur une consommation normale (success/reset/switch, qui ne change
  // ni user ni family) → aucun reset intempestif, aucune course.
  useEffect(() => {
    const ctx = captureContextRef.current;
    if (!ctx) return;
    if (!user || ctx.userOwner !== user?.id || ctx.familyOwner !== familyId) {
      setCaptureContext(null);
      setScanOpen(false);
      setScanSessionKey(k => k + 1); // remonte ScanScreen → état de form dérivé détruit
    }
  }, [user?.id, familyId]);

  const enrichItemImages = async (allItems) => {
    const missing = allItems.filter(i => !i.img_url).slice(0, 5);
    for (const item of missing) {
      const imgUrl = await searchImageByName(`${item.name} ${item.brand || ''}`.trim());
      if (imgUrl) {
        await supabase.from('items').update({ img_url: imgUrl }).eq('id', item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, img_url: imgUrl } : i));
      }
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const registerPushToken = async (userId) => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'f8e07325-05c9-44c1-a029-4a21db4c3fb0',
      });
      if (token?.data) {
        await supabase.from('profiles').update({ push_token: token.data }).eq('id', userId);
      }
    } catch {}
  };

  const scheduleAllNotifications = async (currentItems, prefs = {}) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' || prefs.pushEnabled === false) return;

    const now = new Date();

    // ── Alertes temporelles (N6-03 — Notification Truth Gate) ───
    // Gate de vérité : Présence active + autorité TEMPORELLE = DATE (date absolue réelle et
    // courante) uniquement. Heuristique d'ouverture / estimate non ancré / fallback /
    // `days_left` périmé n'autorisent JAMAIS une interruption. Wording NEUTRE (Date Type
    // inconnu → CR-02 : ni « expire », ni jour-butoir). Zéro push éligible = silence valide.
    // La vérité temporelle vient de la couche canonique (deriveTemporalState), pas de i.days.
    for (const { item, daysRemaining } of selectExpiryPushes(currentItems, prefs, now)) {
      const trigger = new Date();
      if (daysRemaining === 0) {
        trigger.setHours(18, 0, 0, 0);
        if (trigger <= now) continue;
      } else {
        trigger.setDate(trigger.getDate() + daysRemaining);
        trigger.setHours(9, 0, 0, 0);
      }
      const { title, body } = buildNeutralPushContent(item);
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { screen: 'recipes' } },
        trigger,
      });
    }

    // N6-10 (CR-11/12/21) : les récaps « économies hebdo » et « impact CO₂ mensuel » ont été
    // SUPPRIMÉS. Ils promettaient des métriques fabriquées (aucune économie causale ni modèle CO₂
    // réels) et n'étaient adossés à aucune vérité. Seules subsistent les alertes temporelles ci-dessus,
    // gouvernées par le gate de vérité N6-03 (non modifié). Silence = valide.
  };

  useEffect(() => {
    // N6-03 : l'annulation des anciens planning doit s'exécuter même à stock vide
    // (transition N→0 = éligibilité zéro). Ne PAS gater sur items.length, sinon les
    // pushes déjà confiés au scheduler natif survivraient. scheduleAllNotifications
    // annule tout (cancelAll) PUIS reconstruit (expiry gaté + récaps) à chaque run.
    if (!user?.id) return;
    scheduleAllNotifications(items, notifPrefs);
  }, [items, notifPrefs]);

  // N6-04 : le badge d'onglet est un signal FORT/amplifié (compteur rouge de navigation) →
  // exige l'autorité DATE (date réelle). Heuristique d'ouverture = soft, ne compte PAS ici ;
  // scalaire périmé / estimate / fallback non plus. (HomeScreen ignore la prop `expiring`.)
  const expiring = items.filter(i => { const d = strongTemporalDays(i); return d !== null && d <= 4; });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {authLoading || onboardingDone === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' }}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      ) : !onboardingDone ? (
        <OnboardingScreen onDone={() => {
          AsyncStorage.setItem('frigy_onboarding_done', 'true');
          setOnboardingDone(true);
          posthog.capture('onboarding_completed');
        }} />
      ) : !user ? (
        <LoginScreen onLogin={(u, name) => { setUser(u); setupProfile(u.id, name); }} />
      ) : (
        <SafeAreaView style={styles.safe}>
          {tab === 'home'    && <HomeScreen items={items} expiring={expiring} onNav={setTab} onScan={() => setScanOpen(true)} onUrgent={() => { setFridgeUrgent(true); setTab('fridge'); }} profileName={profileName} familyId={familyId} onItemPress={item => { setFridgeInitialItem(item); setTab('fridge'); }} onShopping={() => setShoppingOpen(true)} onConfirmHave={handleConfirmHave} streak={streak} stockFontsLoaded={stockFontsLoaded} itemsReady={familyId != null && hydratedFamilyId === familyId} lifecycleState={lifecycle ? lifecycle.state : null} lifecycleReady={lifecycleReady} />}
          {tab === 'fridge'  && <FridgeScreen items={items} setItems={setItems} user={user} familyId={familyId} urgentMode={fridgeUrgent} onExitUrgent={() => setFridgeUrgent(false)} initialItem={fridgeInitialItem} onInitialItemConsumed={() => setFridgeInitialItem(null)} onScan={() => setScanOpen(true)} onShopping={() => setShoppingOpen(true)} stockFontsLoaded={stockFontsLoaded} />}
          {tab === 'recipes' && <RecipesScreen items={items} user={user} isPro={isPro} onPaywall={() => setPaywallOpen(true)} />}
          {tab === 'profile' && <ProfileScreen profileName={profileName} user={user} familyId={familyId} entitlement={entitlement} onPaywall={() => setPaywallOpen(true)} onNameChange={setProfileName} onPrefsChange={(prefs) => { setNotifPrefs(prefs); }} onClearFridge={async () => { if (!familyId) return; await supabase.from('items').delete().eq('family_id', familyId).eq('consumed', false); setItems([]); }}
                  onClearAll={async () => { if (!familyId) return; await supabase.from('items').delete().eq('family_id', familyId); setItems([]); }} />}

          <View style={styles.tabBar}>
            {[
              { id: 'home',    label: 'Accueil',  Icon: Home },
              { id: 'fridge',  label: 'Produits', Icon: Refrigerator },
              { id: 'scan',    isScan: true },
              { id: 'recipes', label: 'Recettes', Icon: Apple },
              { id: 'profile', label: 'Profil',   Icon: User },
            ].map(t => {
              if (t.isScan) return (
                <TouchableOpacity key="scan" style={styles.scanBtn} onPress={() => setScanOpen(true)}>
                  <Plus size={26} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
              );
              const on = tab === t.id;
              return (
                <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => { setTab(t.id); posthog.capture('screen_viewed', { screen: t.id }); }}>
                  <View>
                    <t.Icon size={22} color={on ? C.green : C.t2} strokeWidth={on ? 2.5 : 1.8} />
                    {t.id === 'fridge' && expiring.length > 0 && (
                      <View style={[styles.badge, { top: -4, right: -6 }]}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{expiring.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={on ? styles.tabLabelActive : styles.tabLabel}>{t.label}</Text>
                  {on && <View style={styles.tabDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Modal visible={scanOpen} animationType="slide">
            <SafeAreaProvider>
              <ScanScreen key={scanSessionKey} onClose={() => { setScanOpen(false); setCaptureContext(null); }} setItems={setItems} items={items} user={user} familyId={familyId} entitlement={entitlement} onRetryEntitlement={refreshEntitlement} countReady={familyId != null && hydratedFamilyId === familyId} onPaywall={() => { setScanOpen(false); setPaywallOpen(true); }}
                captureContext={captureContext} onCaptureContextConsumed={() => setCaptureContext(null)} onStockCommitted={cleanupShoppingRow} />
            </SafeAreaProvider>
          </Modal>

          <Modal visible={paywallOpen} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaProvider>
              <PaywallScreen onClose={() => setPaywallOpen(false)} onSuccess={() => setPaywallOpen(false)} entitlement={entitlement} entitlementBusy={entitlementBusy} offerStatus={offerStatus} plans={offerPlans} onReloadOffer={reloadOffer} onRetryEntitlement={refreshEntitlement} purchase={purchase} restore={restore} />
            </SafeAreaProvider>
          </Modal>

          <Modal visible={shoppingOpen} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaProvider>
              <ShoppingListScreen onClose={() => setShoppingOpen(false)} familyId={familyId} user={user}
                onSendToStock={handleSendToStock} removedShoppingId={removedShoppingId} onRemovedConsumed={() => setRemovedShoppingId(null)} />
            </SafeAreaProvider>
          </Modal>
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

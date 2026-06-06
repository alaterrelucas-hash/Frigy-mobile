import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Home, Refrigerator, Apple, User, Plus } from 'lucide-react-native';

import { supabase } from './src/config/supabase';
import { posthog } from './src/config/posthog';
import { C } from './src/config/constants';
import { styles } from './src/styles';
import { searchImageByName } from './src/api/openfoodfacts';
import { RC_API_KEY } from './src/config/purchases';
import useSubscription from './src/hooks/useSubscription';

import LoginScreen        from './src/screens/LoginScreen';
import OnboardingScreen   from './src/screens/OnboardingScreen';
import ShoppingListScreen from './src/screens/ShoppingListScreen';
import HomeScreen       from './src/screens/HomeScreen';
import FridgeScreen     from './src/screens/FridgeScreen';
import RecipesScreen    from './src/screens/RecipesScreen';
import ProfileScreen    from './src/screens/ProfileScreen';
import ScanScreen       from './src/screens/ScanScreen';
import PaywallScreen    from './src/screens/PaywallScreen';

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

export default function App() {
  const [tab, setTab] = useState('home');
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(null); // null = en cours de chargement
  const [scanOpen, setScanOpen] = useState(false);
  const [paywallOpen, setPaywallOpen]       = useState(false);
  const [shoppingOpen, setShoppingOpen]     = useState(false);
  const [fridgeUrgent, setFridgeUrgent] = useState(false);
  const [fridgeInitialItem, setFridgeInitialItem] = useState(null);
  const [streak, setStreak] = useState(0);

  const { isPro, purchase, restore } = useSubscription();

  useEffect(() => {
    if (Purchases && RC_API_KEY && !RC_API_KEY.includes('XXXX')) {
      Purchases.configure({ apiKey: RC_API_KEY });
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
      else { setFamilyId(null); setItems([]); posthog.reset(); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const setupProfile = async (userId, name = null) => {
    await supabase.rpc('setup_user_profile');
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id, name, streak, last_opened')
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
      fetchItems(profile.family_id);
      posthog.identify(userId, { name: finalName, family_id: profile.family_id });
    }
  };

  const fetchItems = async (famId) => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('family_id', famId)
      .eq('consumed', false);
    if (!data) return;
    const mapped = data.map(i => ({ ...i, days: i.days_left, emoji: i.emoji || '🛒' }));
    setItems(mapped);
    enrichItemImages(mapped);
  };

  const enrichItemImages = async (allItems) => {
    const missing = allItems.filter(i => !i.img_url).slice(0, 20);
    for (const item of missing) {
      const imgUrl = await searchImageByName(`${item.name} ${item.brand || ''}`.trim());
      if (imgUrl) {
        await supabase.from('items').update({ img_url: imgUrl }).eq('id', item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, img_url: imgUrl } : i));
      }
    }
  };

  const scheduleExpiryNotifications = async (currentItems) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const expiring48h = currentItems.filter(i => i.days >= 0 && i.days <= 2);
    if (!expiring48h.length) return;
    const body = expiring48h.length === 1
      ? `${expiring48h[0].emoji} ${expiring48h[0].name} expire ${expiring48h[0].days === 0 ? "aujourd'hui" : expiring48h[0].days === 1 ? 'demain' : 'dans 2 jours'} !`
      : `${expiring48h.length} produits à consommer rapidement : ${expiring48h.map(i => `${i.emoji} ${i.name}`).join(', ')}`;
    const trigger = new Date();
    trigger.setHours(9, 0, 0, 0);
    if (trigger <= new Date()) trigger.setDate(trigger.getDate() + 1);
    await Notifications.scheduleNotificationAsync({
      content: { title: '⚠️ Frigy — Produits à consommer !', body, sound: true },
      trigger,
    });
  };

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted' || !items.length || !user?.id) return;
      const { data } = await supabase.from('profiles').select('notification_prefs').eq('id', user.id).single();
      const prefs = data?.notification_prefs;
      if (!prefs || prefs.pushEnabled !== false) scheduleExpiryNotifications(items);
    })();
  }, [items]);

  const expiring = items.filter(i => i.days <= 4).sort((a, b) => a.days - b.days);

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
          {tab === 'home'    && <HomeScreen items={items} expiring={expiring} onNav={setTab} onScan={() => setScanOpen(true)} onUrgent={() => { setFridgeUrgent(true); setTab('fridge'); }} profileName={profileName} familyId={familyId} onItemPress={item => { setFridgeInitialItem(item); setTab('fridge'); }} onShopping={() => setShoppingOpen(true)} streak={streak} />}
          {tab === 'fridge'  && <FridgeScreen items={items} setItems={setItems} user={user} familyId={familyId} urgentMode={fridgeUrgent} onExitUrgent={() => setFridgeUrgent(false)} initialItem={fridgeInitialItem} onInitialItemConsumed={() => setFridgeInitialItem(null)} onScan={() => setScanOpen(true)} onShopping={() => setShoppingOpen(true)} />}
          {tab === 'recipes' && <RecipesScreen items={items} user={user} isPro={isPro} onPaywall={() => setPaywallOpen(true)} />}
          {tab === 'profile' && <ProfileScreen profileName={profileName} user={user} familyId={familyId} isPro={isPro} onPaywall={() => setPaywallOpen(true)} onNameChange={setProfileName} onPrefsChange={async (prefs) => { if (!prefs.pushEnabled) { await Notifications.cancelAllScheduledNotificationsAsync(); } else if (items.length > 0) { scheduleExpiryNotifications(items); } }} />}

          <View style={styles.tabBar}>
            {[
              { id: 'home',    label: 'Accueil',  Icon: Home },
              { id: 'fridge',  label: 'Stock',    Icon: Refrigerator },
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
                    <t.Icon size={22} color={on ? C.green : C.t3} strokeWidth={on ? 2.5 : 1.8} />
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
              <ScanScreen onClose={() => setScanOpen(false)} setItems={setItems} items={items} user={user} familyId={familyId} isPro={isPro} onPaywall={() => { setScanOpen(false); setPaywallOpen(true); }} />
            </SafeAreaProvider>
          </Modal>

          <Modal visible={paywallOpen} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaProvider>
              <PaywallScreen onClose={() => setPaywallOpen(false)} onSuccess={() => setPaywallOpen(false)} purchase={purchase} restore={restore} />
            </SafeAreaProvider>
          </Modal>

          <Modal visible={shoppingOpen} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaProvider>
              <ShoppingListScreen onClose={() => setShoppingOpen(false)} familyId={familyId} user={user} />
            </SafeAreaProvider>
          </Modal>
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

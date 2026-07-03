import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, Share,
  Linking, Modal, TextInput, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight, Info,
  Leaf, Trash2, Coins,
  User, Bell, HelpCircle,
  Camera, Share2, CheckCircle2, X, Star, Crown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { C } from '../config/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const HELP_CENTER_URL = 'À_REMPLACER_PAR_LE_LIEN_VERCEL';

const PURPLE  = '#8B5CF6';
const GREEN2  = '#27AE60';
const AMBER   = '#F59E0B';

const SCREEN = {
  title:        'Mon Profil',
  badgeLabel:   'Éco-responsable',
  scoreLabel:   'Score anti-gaspillage',
  badgesTitle:  'BADGES',
  invite: {
    title:    'Inviter des amis',
    subtitle: 'Partage Frigy et aide tes proches à économiser',
  },
  logout:       'Se déconnecter',
  shareMessage:
    `Hey ! Je voulais te parler de Frigy, l'app qui m'a changé la vie en cuisine.\n\nDepuis que je l'utilise, je ne jette presque plus rien — l'app me rappelle ce qui va bientôt périmer, me suggère des recettes avec ce que j'ai déjà, et même scanne mes tickets de caisse pour tout enregistrer automatiquement.\n\nEn moyenne, ça économise plus de 30 € par mois rien qu'en évitant le gaspillage.\n\nTélécharge-la, c'est gratuit :\nhttps://apps.apple.com/app/frigy/id6768930083`,
};

const STAT_COLORS = {
  green:  { text: C.green, bg: `${C.green}15` },
  red:    { text: C.red,   bg: `${C.red}12`   },
  purple: { text: PURPLE,  bg: `${PURPLE}12`  },
  green2: { text: GREEN2,  bg: `${GREEN2}12`  },
};


const FRENCH_AVG_WASTE = 0.20;

function getWeekGrade(wasteRate) {
  if (wasteRate < 0.05) return { letter: 'A', color: '#22C55E' };
  if (wasteRate < 0.15) return { letter: 'B', color: '#84CC16' };
  if (wasteRate < 0.25) return { letter: 'C', color: '#F59E0B' };
  if (wasteRate < 0.40) return { letter: 'D', color: '#F97316' };
  return { letter: 'E', color: '#EF4444' };
}

const NOTIF_OPTIONS = [
  { id: 'pushEnabled',          label: 'Notifications push'                },
  { id: 'expirationAlerts',     label: 'Alertes DLC proches'               },
  { id: 'dayBeforeReminder',    label: 'Rappel produits J-1'               },
  { id: 'recipeSuggestions',    label: 'Suggestions de recettes'           },
  { id: 'weeklySavingsSummary', label: 'Résumé économies hebdomadaire'     },
  { id: 'monthlyCo2Impact',     label: 'Impact CO₂ mensuel'                },
];

const MOCK_NOTIFS = {
  pushEnabled: true,
  expirationAlerts: true,
  dayBeforeReminder: true,
  recipeSuggestions: true,
  weeklySavingsSummary: false,
  monthlyCo2Impact: false,
};

const PERSONAL_FIELDS = [
  { id: 'firstName', label: 'Prénom',     placeholder: 'Prénom',      keyboardType: 'default',       autoCapitalize: 'words', editable: true  },
  { id: 'lastName',  label: 'Nom',        placeholder: 'Nom',         keyboardType: 'default',       autoCapitalize: 'words', editable: true  },
  { id: 'phone',     label: 'Téléphone',  placeholder: '+33 6 00 00 00 00', keyboardType: 'phone-pad', autoCapitalize: 'none',  editable: true  },
  { id: 'email',     label: 'Email',      placeholder: 'Email',       keyboardType: 'email-address', autoCapitalize: 'none',  editable: false },
];

// ─── PersonalInfoModal ────────────────────────────────────────────────────────

function PersonalInfoModal({ visible, onClose, initialData, onSave }) {
  const [form, setForm]               = useState({ firstName: '', lastName: '', email: '' });
  const [localAvatar, setLocalAvatar] = useState(null);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (visible) {
      setForm({
        firstName: initialData?.firstName || '',
        lastName:  initialData?.lastName  || '',
        phone:     initialData?.phone     || '',
        email:     initialData?.email     || '',
      });
      setLocalAvatar(initialData?.avatarUri || null);
    }
  }, [visible]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie dans les réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setLocalAvatar(result.assets[0].uri);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ firstName: form.firstName, lastName: form.lastName, phone: form.phone, avatarUri: localAvatar });
    setSaving(false);
    onClose();
  };

  const initial = (form.firstName || '?')[0].toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 }}>
            <X size={18} color={C.t2} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.t1 }}>Informations personnelles</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85}>
              {localAvatar ? (
                <Image source={{ uri: localAvatar }} style={{ width: 96, height: 96, borderRadius: 28 }} />
              ) : (
                <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 38, fontWeight: '900', color: '#fff' }}>{initial}</Text>
                </View>
              )}
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 10, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
                <Camera size={13} color="#fff" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: C.t3, marginTop: 8 }}>Appuie pour modifier la photo</Text>
          </View>

          {/* Fields */}
          <View style={{ gap: 10 }}>
            {PERSONAL_FIELDS.map(field => (
              <View key={field.id} style={{ backgroundColor: field.editable ? C.card : `${C.border}60`, borderRadius: 18, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: field.editable ? 0.05 : 0, shadowRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>{field.label}</Text>
                <TextInput
                  value={form[field.id]}
                  onChangeText={val => field.editable && setForm(prev => ({ ...prev, [field.id]: val }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={C.t4}
                  keyboardType={field.keyboardType}
                  autoCapitalize={field.autoCapitalize}
                  editable={field.editable}
                  style={{ fontSize: 16, color: field.editable ? C.t1 : C.t3, fontWeight: '500' }}
                />
                {!field.editable && (
                  <Text style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>Non modifiable</Text>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ marginTop: 24, backgroundColor: C.green, padding: 16, borderRadius: 24, alignItems: 'center', shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, opacity: saving ? 0.7 : 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── NotificationsModal ───────────────────────────────────────────────────────

function NotificationsModal({ visible, onClose, user, onPrefsChange }) {
  const [notifs, setNotifs] = useState(MOCK_NOTIFS);

  useEffect(() => {
    if (!visible || !user?.id) return;
    supabase.from('profiles').select('notification_prefs').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.notification_prefs) setNotifs({ ...MOCK_NOTIFS, ...data.notification_prefs });
      });
  }, [visible, user?.id]);

  const handleToggle = async (id) => {
    const updated = { ...notifs, [id]: !notifs[id] };
    setNotifs(updated);
    if (user?.id) {
      await supabase.from('profiles').update({ notification_prefs: updated }).eq('id', user.id);
      onPrefsChange?.(updated);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 }}>
            <X size={18} color={C.t2} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.t1 }}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 }}>
            {NOTIF_OPTIONS.map((opt, i) => (
              <View
                key={opt.id}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: i < NOTIF_OPTIONS.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: C.t1, flex: 1 }}>{opt.label}</Text>
                <Switch
                  value={notifs[opt.id]}
                  onValueChange={() => handleToggle(opt.id)}
                  trackColor={{ false: C.border, true: `${C.green}80` }}
                  thumbColor={notifs[opt.id] ? C.green : '#f4f3f4'}
                  ios_backgroundColor={C.border}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen({ profileName, user, familyId, isPro, onPaywall, onNameChange, onPrefsChange, onClearFridge }) {
  const [stats,            setStats]            = useState(null);
  const [localName,        setLocalName]        = useState(profileName || '');
  const [avatarUri,        setAvatarUri]        = useState(null);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [showNotifications,setShowNotifications]= useState(false);

  const initial     = localName ? localName[0].toUpperCase() : 'L';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : 'mai 2026';

  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('name, avatar_url, phone')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.name)       setLocalName(data.name);
        if (data?.avatar_url) setAvatarUri(data.avatar_url);
        if (data?.phone)      setPhone(data.phone);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!familyId) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from('items').select('price, wasted').eq('family_id', familyId).eq('consumed', true),
      supabase.from('items').select('wasted').eq('family_id', familyId).eq('consumed', true).gte('updated_at', weekStart.toISOString()),
    ]).then(([{ data: allData }, { data: weekData }]) => {
      if (!allData) return;
      const saved         = allData.filter(i => !i.wasted);
      const wasted        = allData.filter(i => i.wasted);
      const savedCount    = saved.length;
      const wastedCount   = wasted.length;
      const savings       = saved.reduce((sum, i) => sum + (i.price || 2.5), 0);
      const co2           = savedCount * 0.75;
      const weekSaved     = weekData?.filter(i => !i.wasted).length ?? 0;
      const weekWasted    = weekData?.filter(i => i.wasted).length  ?? 0;
      const weekTotal     = weekSaved + weekWasted;
      const weekWasteRate = weekTotal > 0 ? weekWasted / weekTotal : 0;
      setStats({ savedCount, wastedCount, savings, co2, weekSaved, weekWasted, weekWasteRate });
    });
  }, [familyId]);

  const savedCount    = stats?.savedCount    ?? 0;
  const wastedCount   = stats?.wastedCount   ?? 0;
  const savings       = stats?.savings       ?? 0;
  const co2           = stats?.co2           ?? 0;
  const weekSaved     = stats?.weekSaved     ?? 0;
  const weekWasted    = stats?.weekWasted    ?? 0;
  const weekWasteRate = stats?.weekWasteRate ?? 0;
  const weekTotal     = weekSaved + weekWasted;
  const weekGrade     = weekTotal > 0 ? getWeekGrade(weekWasteRate) : { letter: '—', color: C.t3 };
  const comparisonPct = Math.round((FRENCH_AVG_WASTE - weekWasteRate) * 100);

  const statsData = [
    { id: 'saved',   label: 'Produits sauvés',    value: savedCount,               Icon: Leaf,  colorKey: 'green',  info: 'Produits consommés avant expiration.'             },
    { id: 'wasted',  label: 'Gaspillés',           value: wastedCount,              Icon: Trash2,colorKey: 'red',    info: 'Produits déclarés comme jetés.'                   },
    { id: 'savings', label: 'Économies estimées',  value: `${savings.toFixed(0)} €`,Icon: Coins, colorKey: 'purple', info: 'Calculées à partir des prix enregistrés au scan.' },
    { id: 'co2',     label: 'CO₂ évité',           value: `${co2.toFixed(1)} kg`,   Icon: Leaf,  colorKey: 'green2', info: 'Calculées à partir de moyennes alimentaires.'     },
  ];

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie dans les réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    const publicUrl = await uploadAvatar(uri);
    if (publicUrl) {
      setAvatarUri(publicUrl);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    }
  };

  const uploadAvatar = async (uri) => {
    try {
      const arrayBuffer = await fetch(uri).then(r => r.arrayBuffer());
      const filePath    = `${user.id}.jpg`;
      await supabase.storage.from('avatars').remove([filePath]);
      const { error }   = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (error) { console.log('[Avatar upload]', error.message); return null; }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return `${publicUrl}?t=${Date.now()}`;
    } catch (e) {
      console.log('[Avatar upload exception]', e.message);
      return null;
    }
  };

  const handleSavePersonalInfo = async ({ firstName, lastName, phone: newPhone, avatarUri: newUri }) => {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const updates  = {};
    if (fullName)               updates.name  = fullName;
    if (newPhone !== undefined)  updates.phone = newPhone;

    const isNewLocalAvatar = newUri && newUri.startsWith('file://');
    if (isNewLocalAvatar) {
      const publicUrl = await uploadAvatar(newUri);
      if (publicUrl) { updates.avatar_url = publicUrl; setAvatarUri(publicUrl); }
      else setAvatarUri(newUri);
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) { Alert.alert('Erreur', 'Impossible de sauvegarder les modifications.'); return; }
      if (fullName)               { setLocalName(fullName); onNameChange?.(fullName); }
      if (newPhone !== undefined)  setPhone(newPhone);
    }
  };

  const handleOpenHelpCenter = () => {
    if (!HELP_CENTER_URL || HELP_CENTER_URL.startsWith('À_')) {
      Alert.alert('Centre d\'aide', 'Le centre d\'aide arrive bientôt. Tu peux nous contacter sur Instagram @frigy.app');
      return;
    }
    Linking.openURL(HELP_CENTER_URL).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir le lien.'));
  };

  const handleShareWhatsApp = () => {
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(SCREEN.shareMessage)}`).catch(handleShareMore);
  };

  const handleShareSMS = () => {
    Linking.openURL(`sms:?body=${encodeURIComponent(SCREEN.shareMessage)}`).catch(handleShareMore);
  };

  const handleShareMore = () => Share.share({ message: SCREEN.shareMessage });

  const handleLeaveReview = () => {
    Linking.openURL('https://apps.apple.com/app/id6768930083?action=write-review');
  };

  const handleLogout = () => {
    Alert.alert('Se déconnecter', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleClearFridge = () => {
    Alert.alert(
      'Repartir de zéro',
      'Tous tes produits (frigo, congélateur et placards) seront effacés. Ton historique et tes stats restent intacts.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Dernière confirmation',
              'Cette action est irréversible.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Oui, repartir de zéro', style: 'destructive', onPress: onClearFridge },
              ]
            );
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes tes données (produits, recettes, profil) seront définitivement supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            try {
              if (familyId) {
                await supabase.from('items').delete().eq('family_id', familyId);
                await supabase.from('shopping_items').delete().eq('family_id', familyId);
              }
              if (user?.id) {
                await supabase.from('saved_recipes').delete().eq('user_id', user.id);
                await supabase.from('scan_history').delete().eq('user_id', user.id);
                await supabase.from('profiles').delete().eq('id', user.id);
              }
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer le compte. Contacte-nous à support@frigy.app');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}>

      {/* ── Header ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
        <Text style={{ fontSize: 40, fontWeight: '900', color: C.t1, letterSpacing: -1.5 }}>{SCREEN.title}</Text>
      </View>

      {/* ── User Card ── */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setShowPersonalInfo(true)}
        style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 12, backgroundColor: C.card, borderRadius: 28, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 }}>
        {/* Avatar */}
        <View>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={{ width: 96, height: 96, borderRadius: 28 }} />
          ) : (
            <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 38, fontWeight: '900', color: '#fff' }}>{initial}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handlePickAvatar}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 10, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
            <Camera size={13} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {/* Info */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.t1, letterSpacing: -0.5 }}>{localName || 'Lucas'}</Text>
          <Text style={{ fontSize: 13, color: C.t3 }}>Membre depuis {memberSince}</Text>
          {isPro ? (
            <View style={{ marginTop: 5, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F5C518', borderRadius: 100, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#78350F' }}>✦ Pro</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={onPaywall} style={{ marginTop: 5, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${C.green}15`, borderRadius: 100, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.green }}>Passer à Pro →</Text>
            </TouchableOpacity>
          )}
        </View>
        <ChevronRight size={18} color={C.t4} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Invite Card ── */}
      <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: C.green, borderRadius: 28, padding: 20, shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Share2 size={22} color="#fff" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: -0.4 }}>{SCREEN.invite.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>{SCREEN.invite.subtitle}</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.6)" strokeWidth={2} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'WhatsApp', onPress: handleShareWhatsApp },
            { label: 'SMS',      onPress: handleShareSMS      },
            { label: 'Plus...',  onPress: handleShareMore     },
          ].map(btn => (
            <TouchableOpacity
              key={btn.label}
              onPress={btn.onPress}
              style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Score Card ── */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => Alert.alert('Score hebdomadaire 🌱', 'Ton score se remet à zéro chaque lundi.\n\nNote basée sur ton taux de gaspillage :\nA : < 5%  ·  B : 5–15%  ·  C : 15–25%\nD : 25–40%  ·  E : > 40%\n\nLa moyenne française est ~20%.')}
        style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 28, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ fontSize: 13, color: C.t3 }}>{SCREEN.scoreLabel}</Text>
              <Info size={13} color={C.t4} strokeWidth={1.5} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, letterSpacing: 0.8, marginBottom: 14 }}>CETTE SEMAINE</Text>
            {weekTotal > 0 ? (
              comparisonPct > 0 ? (
                <View style={{ backgroundColor: `${C.green}15`, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>🇫🇷 {comparisonPct}% mieux que la moyenne française</Text>
                </View>
              ) : comparisonPct < 0 ? (
                <View style={{ backgroundColor: '#F9731615', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#F97316' }}>🇫🇷 {Math.abs(comparisonPct)}% au-dessus de la moyenne française</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: `${C.t3}15`, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: C.t3 }}>🇫🇷 Dans la moyenne française</Text>
                </View>
              )
            ) : (
              <View style={{ backgroundColor: `${C.green}12`, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.green }}>Scanne tes premiers produits 🌱</Text>
              </View>
            )}
            <Text style={{ fontSize: 12, color: C.t3 }}>
              {weekSaved} sauvé{weekSaved !== 1 ? 's' : ''} · {weekWasted} gaspillé{weekWasted !== 1 ? 's' : ''} cette semaine
            </Text>
          </View>
          <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: `${weekGrade.color}18`, alignItems: 'center', justifyContent: 'center', marginLeft: 16, borderWidth: 3, borderColor: `${weekGrade.color}30` }}>
            <Text style={{ fontSize: weekTotal > 0 ? 46 : 28, fontWeight: '900', color: weekGrade.color, letterSpacing: -2 }}>{weekGrade.letter}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Stats Grid ── */}
      <View style={{ marginHorizontal: 16, marginBottom: 12, gap: 10 }}>
        {[statsData.slice(0, 2), statsData.slice(2, 4)].map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 10 }}>
            {row.map(stat => {
              const col = STAT_COLORS[stat.colorKey];
              return (
                <TouchableOpacity
                  key={stat.id}
                  onPress={() => Alert.alert(stat.label, stat.info)}
                  style={{ flex: 1, padding: 18, borderRadius: 24, backgroundColor: C.card,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <stat.Icon size={20} color={col.text} strokeWidth={1.8} />
                    <Info size={12} color={C.t4} strokeWidth={1.5} />
                  </View>
                  <Text style={{ fontSize: 32, fontWeight: '900', color: col.text, letterSpacing: -1 }}>{stat.value}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: C.t3, marginTop: 4 }}>{stat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>


      {/* ── Menu Card ── */}
      <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 }}>
        {[
          { id: 'personal', title: 'Informations personnelles', Icon: User,       onPress: () => setShowPersonalInfo(true)  },
          { id: 'notifs',   title: 'Notifications',             Icon: Bell,       onPress: () => setShowNotifications(true) },
          { id: 'help',     title: "Aide & Centre d'aide",      Icon: HelpCircle, onPress: handleOpenHelpCenter             },
          { id: 'review',   title: 'Laisser un avis ⭐',        Icon: Star,       onPress: handleLeaveReview                },
        ].map((item, i, arr) => (
          <TouchableOpacity
            key={item.id}
            onPress={item.onPress}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
              <item.Icon size={20} color={C.t2} strokeWidth={1.8} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.t1 }}>{item.title}</Text>
            <ChevronRight size={16} color={C.t4} strokeWidth={2} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Upgrade banner (only if free) ── */}
      {!isPro && (
        <TouchableOpacity
          onPress={onPaywall}
          style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 24, overflow: 'hidden',
            shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
          <View style={{ backgroundColor: C.t1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={22} color="#F5C518" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: -0.3 }}>Passer à Frigy Pro</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>Essai gratuit 7 jours · 2,99€/mois</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Logout ── */}
      <TouchableOpacity
        onPress={handleLogout}
        style={{ marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 24, alignItems: 'center', borderWidth: 1.5, borderColor: C.red }}>
        <Text style={{ color: C.red, fontWeight: '700', fontSize: 15 }}>{SCREEN.logout}</Text>
      </TouchableOpacity>

      {/* ── Reset + Delete ── */}
      <TouchableOpacity
        onPress={handleClearFridge}
        style={{ marginHorizontal: 16, marginBottom: 4, padding: 12, alignItems: 'center' }}>
        <Text style={{ color: C.t3, fontSize: 13 }}>Repartir de zéro · effacer tous mes produits</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleDeleteAccount}
        style={{ marginHorizontal: 16, marginBottom: 16, padding: 12, alignItems: 'center' }}>
        <Text style={{ color: C.t3, fontSize: 13 }}>Supprimer mon compte</Text>
      </TouchableOpacity>

      {/* ── Sub-screens ── */}
      <PersonalInfoModal
        visible={showPersonalInfo}
        onClose={() => setShowPersonalInfo(false)}
        initialData={{
          firstName: localName.trim().split(' ')[0],
          lastName:  localName.trim().split(' ').slice(1).join(' '),
          phone,
          email:     user?.email || '',
          avatarUri,
        }}
        onSave={handleSavePersonalInfo}
      />
      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        user={user}
        onPrefsChange={onPrefsChange}
      />
    </ScrollView>
  );
}

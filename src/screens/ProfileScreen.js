import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, Share,
  Linking, Modal, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight, Info,
  Leaf, Trash2,
  User, HelpCircle,
  Camera, Share2, X, Star, Crown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { C } from '../config/constants';
import { computeProfileStats } from '../utils/profileStats';
import { isProStatus, isKnownFree } from '../utils/entitlement';

// ─── Constants ────────────────────────────────────────────────────────────────

const HELP_CENTER_URL = 'À_REMPLACER_PAR_LE_LIEN_VERCEL';

const SCREEN = {
  title:        'Mon Profil',
  badgeLabel:   'Éco-responsable',
  badgesTitle:  'BADGES',
  invite: {
    title:    'Inviter des amis',
    subtitle: 'Partage Frigy avec tes proches',
  },
  logout:       'Se déconnecter',
  // N6-10 (CR-11/13) : message neutre. Aucun chiffre d'économie inventé (« 30 € »), aucune assertion
  // causale (« je ne jette plus rien »), aucune promesse de résultat. Description factuelle de l'app.
  shareMessage:
    `Je teste Frigy, une app qui aide à mieux utiliser ce qu'on a déjà à la maison : elle garde une trace de tes produits, te rappelle les dates limites et suggère des recettes.\n\nTélécharge-la, c'est gratuit :\nhttps://apps.apple.com/app/frigy/id6768930083`,
};

const STAT_COLORS = {
  green:  { text: C.green, bg: `${C.green}15` },
  red:    { text: C.red,   bg: `${C.red}12`   },
};

// N6-10 (CR-13) : suppression totale du score/grade (getWeekGrade), de la moyenne nationale
// (FRENCH_AVG_WASTE) et de la comparaison — aucune base de vérité, jamais réintroduire.
// N6-10 (CR-21) : suppression du surface de préférences de notifications (NOTIF_OPTIONS/MOCK_NOTIFS/
// NotificationsModal). Les toggles ne pilotaient aucune capacité réelle (voir App.js). Les prefs DB
// existantes ne sont ni migrées ni supprimées ; seule l'UI mensongère est retirée.

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

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen({ profileName, user, familyId, entitlement, onPaywall, onNameChange, onClearFridge, onClearAll }) {
  const [stats,            setStats]            = useState(null);
  const [localName,        setLocalName]        = useState(profileName || '');
  const [avatarUri,        setAvatarUri]        = useState(null);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);

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
    // N6-10 (2.6) : on ne lit QUE `wasted` (pas `price` → aucun vecteur monétaire), et AUCUNE fenêtre
    // temporelle. `items.updated_at` est un timestamp technique de dernière modification (trigger prod
    // trg_items_updated_at → now()), PAS l'instant de l'événement consommation/gaspillage → il ne peut
    // pas fonder une revendication « cette semaine ». Seuls des comptes GLOBAUX de faits enregistrés.
    supabase.from('items').select('wasted').eq('family_id', familyId).eq('consumed', true)
      .then(({ data: allData }) => {
        if (!allData) return;
        setStats(computeProfileStats(allData));
      });
  }, [familyId]);

  // N6-10 (CR-11/12/13/14) : uniquement des faits ENREGISTRÉS au niveau foyer, GLOBAUX (aucune fenêtre
  // temporelle). AUCUN argent, CO₂, score/grade, comparaison. Compte = lignes (cohortes), pas unités.
  const recordedCount      = stats?.recordedConsumptions ?? 0;
  const declaredWasteCount = stats?.declaredWaste        ?? 0;

  const statsData = [
    { id: 'recorded', label: 'Consommations enregistrées', value: recordedCount,      Icon: Leaf,   colorKey: 'green', info: 'Produits marqués consommés et non déclarés gaspillés (au niveau du foyer). Ce n\'est ni une preuve de sauvetage ni une quantité physique.' },
    { id: 'waste',    label: 'Gaspillages déclarés',        value: declaredWasteCount, Icon: Trash2, colorKey: 'red',   info: 'Produits que tu as déclarés jetés.' },
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

  const confirmClear = (withHistory) => {
    const msg = withHistory
      ? 'Tous tes produits ET tout ton historique (consommations et gaspillages enregistrés) seront définitivement effacés.'
      : 'Tous tes produits actuels seront effacés. Ton historique et tes stats restent intacts.';
    Alert.alert('Dernière confirmation', msg, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: withHistory ? onClearAll : onClearFridge,
      },
    ]);
  };

  const handleClearFridge = () => {
    Alert.alert(
      'Repartir de zéro',
      'Que veux-tu effacer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Produits uniquement',
          onPress: () => confirmClear(false),
        },
        {
          text: 'Produits + historique',
          style: 'destructive',
          onPress: () => confirmClear(true),
        },
      ]
    );
  };

  // N6-10 (2.6, CR-20) : LIBELLÉ = EFFET RÉEL. L'action supprime le CONTENU (items, shopping_items,
  // saved_recipes, scan_history, ligne profiles) puis déconnecte. Elle NE supprime PAS : la photo de
  // profil (objet Storage `avatars`), l'identité Auth, la ligne `families`, le client RevenueCat, ni
  // certaines données techniques locales (AsyncStorage). Donc PAS de « mes données Frigy »/« toutes mes
  // données » (trop large) ni « supprimer mon compte » (faux). Le libellé se borne au set réellement
  // effacé ; la confirmation énumère l'effet ET les exclusions (photo, identifiant, local).
  const handleDeleteAccount = () => {
    Alert.alert(
      'Effacer mes produits, listes et historique ?',
      'Cette action supprimera tes produits, ta liste de courses, tes recettes enregistrées, ton historique et les informations de ton profil, puis te déconnectera.\n\nTa photo de profil et ton identifiant de connexion ne sont pas supprimés.\n\nCertaines données techniques locales peuvent également rester sur cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            // N6-14 (2A.6) : le client Supabase NE LÈVE PAS sur erreur (il renvoie {error}). On inspecte
            // donc CHAQUE résultat : toute erreur → throw → chemin d'échec ci-dessous. AUCUNE erreur
            // d'effacement ne peut atteindre le signOut de succès (sinon on annoncerait « effacé » à tort).
            // Ces requêtes ne sont PAS une transaction unique → un échec = effacement PARTIEL ; l'utilisateur
            // reste authentifié et peut réessayer (les DELETE/UPDATE déjà passés sont idempotents au retry).
            const run = async (p) => { const { error } = await p; if (error) throw error; };
            // ── ÉTAPE 1 : EFFACEMENT DES DONNÉES (chaque {error} → throw ; échec = incomplet) ──
            try {
              if (familyId) {
                await run(supabase.from('items').delete().eq('family_id', familyId));
                await run(supabase.from('shopping_items').delete().eq('family_id', familyId));
              }
              if (user?.id) {
                await run(supabase.from('saved_recipes').delete().eq('user_id', user.id));
                await run(supabase.from('scan_history').delete().eq('user_id', user.id));
                // N6-14 (CR-08) : on NE SUPPRIME PLUS la ligne profiles — cela détruisait l'identité du
                // foyer (family_id) → setup_user_profile recréait une NOUVELLE famille et le cycle de vie
                // « déjà initialisé » était perdu (First Run réapparaissait à tort). On RÉINITIALISE les
                // « informations de profil » du contrat visible, en PRÉSERVANT l'identité de membre (id,
                // family_id, role) et la photo (avatar_url, explicitement conservée par la copie).
                await run(supabase.from('profiles').update({
                  name: null, phone: null, notification_prefs: null,
                  push_token: null, score: 0, streak: 0, last_opened: null,
                }).eq('id', user.id));
              }
            } catch (e) {
              // A. ÉCHEC D'EFFACEMENT : effacement PARTIEL possible. On reste authentifié ; retry autorisé.
              Alert.alert('Suppression incomplète', 'La suppression n\'a pas pu être terminée. Certaines données peuvent déjà avoir été supprimées. Réessaie, ou contacte-nous à support@frigy.app');
              return;
            }
            // ── ÉTAPE 2 : DÉCONNEXION (issue DISTINCTE). Les données SONT effacées à ce point. ──
            let signOutError = null;
            try { const r = await supabase.auth.signOut(); signOutError = (r && r.error) || null; }
            catch (e) { signOutError = e; }
            if (signOutError) {
              // C. DONNÉES EFFACÉES mais DÉCONNEXION ÉCHOUÉE → surface honnêtement (jamais « incomplète »).
              Alert.alert('Données effacées', 'Tes données ont bien été effacées, mais la déconnexion a échoué. Réessaie de te déconnecter.');
            }
            // B. Succès effacement + déconnexion → l'app repasse en écran de connexion (rien à afficher).
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
          {/* N6-11 : badge Pro si KNOWN PRO ; upsell UNIQUEMENT si KNOWN FREE ; UNKNOWN/ERROR → silence
              (ne jamais afficher « Passer à Pro » à un payant dont l'abonnement n'est pas encore établi). */}
          {isProStatus(entitlement) ? (
            <View style={{ marginTop: 5, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F5C518', borderRadius: 100, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#78350F' }}>✦ Pro</Text>
            </View>
          ) : isKnownFree(entitlement) ? (
            <TouchableOpacity onPress={onPaywall} style={{ marginTop: 5, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${C.green}15`, borderRadius: 100, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.green }}>Découvrir Frigy Pro →</Text>
            </TouchableOpacity>
          ) : null}
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

      {/* N6-10 (2.6) : carte hebdomadaire SUPPRIMÉE. `items.updated_at` (timestamp technique de
          dernière modif, trigger prod) n'est pas l'instant de l'événement → aucune revendication
          « cette semaine » n'est fondée. Aucun champ événementiel n'est inventé ; les comptes GLOBAUX
          véridiques ci-dessous suffisent. Silence préféré à une duplication scopée non prouvée. */}

      {/* ── Stats Grid ── */}
      <View style={{ marginHorizontal: 16, marginBottom: 12, gap: 10 }}>
        {[statsData].map((row, ri) => (
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

      {/* ── Upgrade banner : KNOWN FREE seulement ── */}
      {/* N6-11 : le Profil ne duplique AUCUNE métadonnée commerciale (ni prix, ni essai — source unique
          = Paywall autoritaire). Route neutre « Découvrir Frigy Pro » ouvrant le Paywall. UNKNOWN/ERROR/
          PRO → pas de bannière. */}
      {isKnownFree(entitlement) && (
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
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: -0.3 }}>Découvrir Frigy Pro</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>Scan ticket, photo des courses et plus</Text>
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
        style={{ marginHorizontal: 16, marginBottom: 4, paddingVertical: 12, paddingHorizontal: 20,
          alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
          backgroundColor: '#FFF8EE', borderRadius: 16 }}>
        <Trash2 size={14} color="#F59E0B" strokeWidth={2.5} />
        <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600' }}>Repartir de zéro · effacer tous mes produits</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleDeleteAccount}
        style={{ marginHorizontal: 16, marginBottom: 16, padding: 12, alignItems: 'center' }}>
        <Text style={{ color: C.t3, fontSize: 13 }}>Effacer mes produits, listes et historique</Text>
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
    </ScrollView>
  );
}

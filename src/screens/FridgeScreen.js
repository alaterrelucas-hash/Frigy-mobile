import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Image, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Search,
  ChevronLeft,
  Package,
  CalendarDays, AlertTriangle,
  Sparkles, Euro, Utensils, Trash2, Pencil, Inbox, PackageOpen, Plus,
} from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { posthog } from '../config/posthog';
import { C, urgBg, urgLbl, LOC_ITEMS } from '../config/constants';
import { parseDlc, formatDlcInput, getStorageTip, estimateOpeningDays, estimateDays } from '../utils/product';
import { formatQuantityLabel } from '../utils/quantity';
import { withDateValueCorrection } from '../utils/captureProvenance';
import { computeDaysRemaining, getTemporalTier, TEMPORAL_TIER } from '../utils/temporal';
import { passiveTemporalDays, amplifiedTemporalDays } from '../utils/temporalAuthority';
import { useStockTheme } from '../utils/stockTheme';
import { DEV_PREVIEW_STOCK_ENABLED, DEV_PREVIEW_MODE, getDevPreviewItems, getVisualQAItems } from '../utils/devPreviewStock'; // DEV-ONLY — voir ce fichier pour retirer
import { resolveFoodImage } from '../utils/foodLanguage';
import { createConsumeCoordinator } from '../utils/consumptionOutcome';
import { styles } from '../styles';
import StorageScopeControl from '../components/StorageScopeControl';
import InventoryProductRow from '../components/InventoryProductRow';
import InventoryHeader from '../components/InventoryHeader';

const BG = '#F7F9F8';

// N6-04 : libellés de filtre = RELATION temporelle neutre (« quand »), jamais consigne de
// consommation (« À consommer ») ni type de date (« DLC ») — le nom de champ `dlc` n'est pas
// une vérité affichable tant que le type est inconnu. Prédicats inchangés (≤4 / ≤7).
const FILTERS = ['Tous', 'Date proche', 'Sous 7 jours'];

// Masqué le temps de la revue visuelle pour éviter le doublon avec le "+" global
// de la navigation (App.js). Décision finale à prendre avec le Master Navigation —
// remettre à true (ou retirer la condition) une fois cette dette résolue.
const SHOW_STOCK_FAB = false;

const NUTRI_COLORS = { A: '#2ECC71', B: '#8BC34A', C: '#F5B700', D: '#E6A23C', E: '#FF3B30' };

// Food Language d'abord : un produit réel obtient sa primitive résolue (identité →
// confiance → asset) quand elle est fiable. La ligne préfère déjà localImage à
// img_url puis à l'emoji ; il suffit donc d'attacher localImage/localImageRatio ici.
// Résolu une seule fois (au chargement/maj du stock), pas à chaque rendu de ligne.
// Un item qui a déjà une primitive explicite (dataset de calibration) n'est pas
// re-résolu — la résolution floue par nom ne concerne que les produits réels.
function withFoodLanguage(item) {
  if (!item || item.localImage) return item;
  const prim = resolveFoodImage(item);
  return prim ? { ...item, localImage: prim.image, localImageRatio: prim.ratio } : item;
}

// Natural Focus — la lumière suit la PERTINENCE temporelle. Paliers du Color System :
// faible 15 % / moyenne 25 % / forte 40 % (plafond 40 %, jamais saturé). L'overdue
// reçoit une présence dédiée dans la famille Critical (décision produit — teinte
// critique choisie côté row via glowColor), PAS le halo chaud. Sans échéance connue
// et au-delà de J+4 : silence.
function naturalFocusIntensity(days) {
  if (typeof days !== 'number') return 0; // sans échéance connue → aucun halo
  if (days < 0) return 0.10;   // Dépassé — présence critique très discrète : ne doit PAS
                               // masquer un produit clair (crème). Le rouge du point + du
                               // descripteur porte déjà le signal ; le halo n'est qu'un appui.
  if (days === 0) return 0.40; // Aujourd'hui — « le bon moment »
  if (days === 1) return 0.25; // Demain — « attention »
  if (days <= 4) return 0.15;  // Approche / présence
  return 0;                    // Silence
}

/* ── Small reusable components ── */

function FreshnessBar({ days }) {
  const pct = Math.max(5, Math.min((days ?? 14) / 14 * 100, 97));
  const color = (days ?? 14) <= 1 ? '#FF3B30' : (days ?? 14) <= 3 ? '#F5B700' : C.green;
  return (
    <View style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

function NutritionBadge({ grade }) {
  if (!grade) return null;
  const grades = ['A', 'B', 'C', 'D', 'E'];
  const g = grade.toUpperCase();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {grades.map(gr => {
        const isActive = gr === g;
        return (
          <View key={gr} style={{
            width: 12, height: isActive ? 22 : 12, borderRadius: 4,
            backgroundColor: isActive ? NUTRI_COLORS[gr] : (NUTRI_COLORS[gr] + '35'),
            alignItems: 'center', justifyContent: 'center',
          }}>
            {isActive && <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>{gr}</Text>}
          </View>
        );
      })}
    </View>
  );
}

/* ── Main screen ── */

export default function FridgeScreen({
  items, setItems, user, urgentMode, onExitUrgent,
  initialItem, onInitialItemConsumed, onScan, onShopping, stockFontsLoaded,
}) {
  const [q, setQ]                         = useState('');
  const [activeFilter, setActiveFilter]   = useState('Tous');
  const [selectedItem, setSelectedItem]   = useState(null);
  const [editMode, setEditMode]           = useState(false);
  const [editFields, setEditFields]       = useState({});
  const [detailImgError, setDetailImgError] = useState(false);
  const [localItems, setLocalItems]       = useState(items);
  const [activeScope, setActiveScope]     = useState('Frigo');
  const theme = useStockTheme();

  // Typography System Frigy — Source Sans 3 (chargée dans App.js). Tant que le
  // chargement n'est pas terminé, fontFamily reste undefined et le fontWeight
  // (conservé sur chaque style) pilote le rendu via la police système en repli.
  const fonts = {
    regular: stockFontsLoaded ? 'SourceSans3-Regular' : undefined,
    semibold: stockFontsLoaded ? 'SourceSans3-SemiBold' : undefined,
  };

  // DEV-ONLY : remplace temporairement l'affichage par un jeu de démonstration
  // calibré sur la composition du Master (2/3/2), pour comparer sans le biais
  // du volume réel de données. Remplacement, pas ajout — le compte réel et
  // Supabase ne sont jamais touchés (setItems/updateItems continuent de
  // pointer sur `items`, seul l'affichage local change).
  // Jamais actif en production (__DEV__ est toujours false en build release).
  useEffect(() => {
    const useDevPreview = __DEV__ && DEV_PREVIEW_STOCK_ENABLED;
    const base = useDevPreview
      ? (DEV_PREVIEW_MODE === 'qa' ? getVisualQAItems() : getDevPreviewItems())
      : items;
    setLocalItems(base.map(withFoodLanguage));
  }, [items]);

  const updateItems = (updater) => { setItems(updater); setLocalItems(updater); };

  useEffect(() => {
    if (initialItem) { setSelectedItem(initialItem); onInitialItemConsumed?.(); }
  }, [initialItem]);

  // N6-04 (plafond amplifié) : « urgentMode » = urgence de CONSOMMATION forte → exige non
  // seulement une DATE réelle mais un TYPE de date supporté (amplifiedTemporalDays). Type
  // inconnu aujourd'hui → ensemble vide → AUCUN item temporellement urgent (état truthful ;
  // l'architecture du mode reste intacte). Heuristique/estimate/fallback n'y entrent jamais.
  // (`rest` legacy = code mort, retiré.)
  const urgent = localItems
    .map(i => ({ i, d: amplifiedTemporalDays(i) }))
    .filter(x => x.d !== null && x.d <= 4)
    .sort((a, b) => a.d - b.d)
    .map(x => x.i);

  const applyFilter = (list) => {
    let out = list;
    if (q) out = out.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    // N6-04 : filtres temporels (quiet) gatés sur l'autorité — un estimate non ancré / fallback
    // / scalaire périmé (→ null) ne « consomme » ni « DLC proche » (jamais compté via 99).
    if (activeFilter === 'Date proche') out = out.filter(i => (passiveTemporalDays(i) ?? 99) <= 4);
    if (activeFilter === 'Sous 7 jours') out = out.filter(i => (passiveTemporalDays(i) ?? 99) <= 7);
    return out;
  };

  /* ── CRUD ── */
  const openEdit = (item) => {
    setEditFields({ name: item.name, emoji: item.emoji || '🛒', dlcInput: item.dlc && item.dlc !== '—' ? item.dlc : '', location: item.location });
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!selectedItem) return;
    const dlcDays = parseDlc(editFields.dlcInput);
    const updates = {
      name: editFields.name.trim() || selectedItem.name,
      emoji: editFields.emoji || selectedItem.emoji,
      dlc: editFields.dlcInput || '—',
      days_left: dlcDays !== null ? dlcDays : selectedItem.days_left,
      location: editFields.location,
    };
    // N6-08 : correction EXPLICITE de la date par l'utilisateur → dateValue DIRECT. Merge LOSSLESS :
    // ne patche QUE dateValue, préserve quantity/dateType/captureMethod + clés futures. Ne crée
    // aucune autorité pour les assertions non corrigées (legacy reste UNKNOWN ailleurs). Aucun
    // événement causal (consumed/wasted) — une correction ≠ un fait physique (N6-07).
    const dateChanged = (editFields.dlcInput || '—') !== (selectedItem.dlc || '—');
    if (dateChanged) updates.assertion_provenance = withDateValueCorrection(selectedItem.assertion_provenance);
    // Le nom a changé → la primitive Food Language peut ne plus correspondre :
    // on la re-résout (localImage repart de zéro pour laisser withFoodLanguage
    // trancher sur le nouveau nom). Inchangé si le nom est identique.
    const nameChanged = updates.name !== selectedItem.name;
    const remap = (x) => {
      const merged = { ...x, ...updates, days: updates.days_left };
      return nameChanged ? withFoodLanguage({ ...merged, localImage: null, localImageRatio: null }) : merged;
    };
    updateItems(p => p.map(x => x.id === selectedItem.id ? remap(x) : x));
    setSelectedItem(prev => remap(prev));
    setEditMode(false);
    await supabase.from('items').update(updates).eq('id', selectedItem.id);
  };

  // N6-12 (CR-10 + Waste Write Authority) : PERSISTANCE D'ABORD. Un résultat consommé/gaspillé n'est
  // représenté (retrait du stock actif + fermeture modale + analytics) qu'APRÈS une preuve canonique
  // exacte (erreur nulle + 1 ligne dont l'id correspond ; `.select('id')`). Échec/zéro-ligne → l'item
  // RESTE, la modale reste réessayable, AUCUN event analytics. Verrou synchrone : un 2e tap pendant la
  // requête ne déclenche PAS de 2e mutation. Même autorité pour « J'ai mangé ça » et « Gaspillé ».
  const consumeCoordRef = useRef(null);
  if (!consumeCoordRef.current) {
    consumeCoordRef.current = createConsumeCoordinator({
      mutate: (item, wasted) =>
        supabase.from('items').update({ consumed: true, wasted }).eq('id', item.id).select('id'),
    });
  }
  const [consumeBusy, setConsumeBusy] = useState(false);

  const consumeItem = async (item, wasted = false) => {
    const coord = consumeCoordRef.current;
    if (coord.isBusy()) return; // garde synchrone anti double-action
    setConsumeBusy(true);
    Haptics.impactAsync(wasted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    const r = await coord.run(item, wasted);
    setConsumeBusy(false);
    if (r.skipped) return;
    if (!r.ok) {
      Alert.alert('Impossible d\'enregistrer cette action', 'Réessaie.');
      return; // item conservé, modale ouverte, aucun analytics
    }
    // Succès canonique prouvé → alors seulement représenter l'issue.
    updateItems(p => p.filter(x => x.id !== item.id));
    setSelectedItem(null);
    posthog.capture(wasted ? 'product_wasted' : 'product_consumed', {
      name: item.name, category: item.category, days_left: item.days,
      location: item.location, price: item.price || null,
    });
  };

  const decrementUnit = async (item) => {
    const newQty = (item.quantity || 1) - 1;
    if (newQty <= 0) {
      Alert.alert('Épuisé !', `Dernier ${item.name} utilisé. Le marquer comme consommé ?`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Consommé ✅', onPress: async () => {
          updateItems(p => p.filter(x => x.id !== item.id));
          await supabase.from('items').update({ consumed: true }).eq('id', item.id);
        }},
      ]);
    } else {
      updateItems(p => p.map(x => x.id === item.id ? { ...x, quantity: newQty } : x));
      await supabase.from('items').update({ quantity: newQty }).eq('id', item.id);
    }
  };

  const toggleOpened = async (item, newVal) => {
    const today = new Date();
    const updates = { opened: newVal, opened_at: newVal ? today.toISOString().split('T')[0] : null };
    if (newVal) {
      // Sauvegarde la DLC originale avant de la modifier
      updates.original_dlc = item.dlc || '—';
      updates.original_days_left = item.days ?? null;
      const openDays = estimateOpeningDays(item.category, item.name);
      const daysLeft = (item.days != null && item.days < openDays) ? item.days : openDays;
      const exp = new Date(today);
      exp.setDate(exp.getDate() + daysLeft);
      const newDlc = `${String(exp.getDate()).padStart(2,'0')}/${String(exp.getMonth()+1).padStart(2,'0')}/${exp.getFullYear()}`;
      updates.dlc = newDlc;
      updates.days_left = daysLeft;
    } else {
      // Restaure la DLC originale — fallback sur estimateDays si jamais stockée
      updates.dlc = item.original_dlc || '—';
      updates.days_left = item.original_days_left ?? estimateDays(item.category, item.name);
      updates.original_dlc = null;
      updates.original_days_left = null;
    }
    const newDays = updates.days_left;
    updateItems(p => p.map(x => x.id === item.id ? { ...x, ...updates, days: newDays } : x));
    setSelectedItem(prev => ({ ...prev, ...updates, days: newDays }));
    await supabase.from('items').update(updates).eq('id', item.id);
  };

  /* ── Detail modal (inline call to avoid remount) ── */
  const DetailModal = () => {
    if (!selectedItem) return null;
    const item = selectedItem;
    // N6-07 (CR-04) : libellé quantité gaté par l'autorité (deriveQuantityState). Provenance
    // actuelle insuffisante → UNKNOWN → null → aucune ligne « Quantité » (plus de faux « 1 unité »
    // ni de « N/M restants » sur un dénominateur non prouvé). La présence de la ligne stock atteste
    // déjà la cohorte représentée. Autorité KNOWN restaurée par N6-08 (provenance de capture).
    const quantityLabel = formatQuantityLabel(item);
    const dlcFormatted = item.dlc && item.dlc !== '—' ? item.dlc : null;
    // N6-04 : le badge J- COLORÉ (urgBg rouge/orange) est un signal AMPLIFIÉ → exige DATE +
    // type de date supporté (amplifiedTemporalDays). Type inconnu → pas de badge coloré fort
    // (la date factuelle reste visible via dlcFormatted plus bas — relation neutre préservée).
    const detailDays = amplifiedTemporalDays(item);
    const closeModal = () => { setSelectedItem(null); setEditMode(false); };

    return (
      <Modal visible animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1} onPress={editMode ? () => {} : closeModal}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingBottom: 36, paddingHorizontal: 20, paddingTop: 16 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 }} />

                {editMode && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity onPress={() => setEditMode(false)}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.t2 }}>Annuler</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1 }}>Modifier</Text>
                    <TouchableOpacity onPress={saveEdit}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.green, borderRadius: 20 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Sauvegarder</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {editMode ? (
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                      <View style={{ width: 64 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>EMOJI</Text>
                        <TextInput value={editFields.emoji} onChangeText={v => setEditFields(p => ({ ...p, emoji: v }))}
                          style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10,
                            fontSize: 28, textAlign: 'center', backgroundColor: '#FAFAFA' }} maxLength={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>NOM</Text>
                        <TextInput value={editFields.name} onChangeText={v => setEditFields(p => ({ ...p, name: v }))}
                          style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 11,
                            fontSize: 15, color: C.t1, backgroundColor: '#FAFAFA' }} />
                      </View>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>DATE LIMITE (DLC)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <TextInput value={editFields.dlcInput}
                        onChangeText={t => setEditFields(p => ({ ...p, dlcInput: formatDlcInput(t) }))}
                        placeholder="JJ/MM/AAAA" placeholderTextColor={C.t4}
                        keyboardType="numeric" maxLength={10} returnKeyType="done"
                        style={{ flex: 1, borderWidth: 1.5,
                          borderColor: parseDlc(editFields.dlcInput) !== null ? C.green : C.border,
                          borderRadius: 10, padding: 11, fontSize: 15, color: C.t1, backgroundColor: '#FAFAFA' }} />
                      {parseDlc(editFields.dlcInput) !== null && (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 9,
                          backgroundColor: urgBg(parseDlc(editFields.dlcInput)), borderRadius: 10 }}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>J-{parseDlc(editFields.dlcInput)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>EMPLACEMENT</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {LOC_ITEMS.map(l => {
                        const active = editFields.location === l.id;
                        return (
                          <TouchableOpacity key={l.id} onPress={() => setEditFields(p => ({ ...p, location: l.id }))}
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
                              borderWidth: 1.5, borderColor: active ? C.green : C.border,
                              backgroundColor: active ? `${C.green}12` : '#FAFAFA' }}>
                            <l.Icon size={20} color={active ? C.green : C.t3} strokeWidth={active ? 2.5 : 1.8} style={{ marginBottom: 2 }} />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: active ? C.green : C.t3 }}>{l.id}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: `${C.green}15`,
                        alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                        {/* Même précédence que la liste (Food Language d'abord) : la
                            fiche montre la primitive détourée quand elle existe, puis
                            la photo distante, puis l'emoji — jamais un emoji quand une
                            primitive est disponible (§25). Primitive en `contain` pour
                            préserver son ratio, jamais recadrée en cercle. */}
                        {item.localImage
                          ? <Image source={item.localImage} style={{ width: 78, height: 78 }} resizeMode="contain" />
                          : item.img_url && !detailImgError
                          ? <Image source={{ uri: item.img_url }} style={{ width: 100, height: 100, borderRadius: 50 }}
                              resizeMode="cover" onError={() => setDetailImgError(true)} />
                          : <Text style={{ fontSize: 52 }}>{item.emoji}</Text>}
                      </View>
                      {detailDays !== null && (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
                          backgroundColor: urgBg(detailDays), marginBottom: 10 }}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>J-{detailDays}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 22, fontWeight: '800', color: C.t1, textAlign: 'center', marginBottom: 4 }}>{item.name}</Text>
                      <Text style={{ fontSize: 13, color: C.t3 }}>{item.brand ? `${item.brand} · ` : ''}{item.category} · {item.location}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', borderLeftWidth: 3, borderLeftColor: C.yellow,
                      backgroundColor: `${C.yellow}12`, borderRadius: 10, padding: 14, marginBottom: 20, gap: 10, alignItems: 'flex-start' }}>
                      <Sparkles size={16} color={C.yellow} strokeWidth={2} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: C.yellow, marginBottom: 4, letterSpacing: 0.5 }}>CONSEIL DE CONSERVATION</Text>
                        <Text style={{ fontSize: 13, color: C.t2, lineHeight: 19 }}>
                          {item.opened
                            ? `Produit ouvert — à consommer dans les ${estimateOpeningDays(item.category, item.name)} jours. Bien refermer après chaque utilisation.`
                            : getStorageTip(item.category, item.name)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                      <TouchableOpacity onPress={() => consumeItem(item, false)} disabled={consumeBusy}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 18, backgroundColor: `${C.green}18`, opacity: consumeBusy ? 0.5 : 1 }}>
                        <Utensils size={26} color={C.green} strokeWidth={2} style={{ marginBottom: 6 }} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.green }}>J'ai mangé ça</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => consumeItem(item, true)} disabled={consumeBusy}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 18, backgroundColor: '#FF3B3018', opacity: consumeBusy ? 0.5 : 1 }}>
                        <Trash2 size={26} color={C.red} strokeWidth={2} style={{ marginBottom: 6 }} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>Gaspillé</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => openEdit(item)}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 20 }}>
                      <Pencil size={16} color={C.t2} strokeWidth={2} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.t2 }}>Modifier ce produit</Text>
                    </TouchableOpacity>

                    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                      {dlcFormatted && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
                          borderBottomWidth: 1, borderBottomColor: C.border }}>
                          <CalendarDays size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                          <Text style={{ flex: 1, fontSize: 14, color: C.t2 }}>Date d'expiration</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: C.t1 }}>{dlcFormatted}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
                        borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <PackageOpen size={18} color={item.opened ? C.green : C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, color: C.t2 }}>Ouvert</Text>
                          {item.opened && item.opened_at && (
                            <Text style={{ fontSize: 11, color: C.t4, marginTop: 1 }}>
                              depuis le {item.opened_at.split('-').reverse().join('/')}
                            </Text>
                          )}
                        </View>
                        <Switch
                          value={!!item.opened}
                          onValueChange={v => toggleOpened(item, v)}
                          trackColor={{ false: C.border, true: `${C.green}80` }}
                          thumbColor={item.opened ? C.green : '#fff'}
                          ios_backgroundColor={C.border}
                        />
                      </View>

                      {quantityLabel && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
                          borderBottomWidth: item.price ? 1 : 0, borderBottomColor: C.border }}>
                          <Package size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                          <Text style={{ flex: 1, fontSize: 14, color: C.t2 }}>Quantité</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: C.t1 }}>
                            {quantityLabel}
                          </Text>
                        </View>
                      )}
                      {item.price && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                          <Euro size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                          <Text style={{ flex: 1, fontSize: 14, color: C.t2 }}>Prix payé</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: C.t1 }}>{item.price.toFixed(2)} €</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  /* ── Urgent mode (inchangé) ── */
  if (urgentMode) return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {DetailModal()}
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={onExitUrgent}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 14 }}>
          <ChevronLeft size={16} color={C.green} strokeWidth={2.5} />
          <Text style={{ fontSize: 14, color: C.green, fontWeight: '600' }}>Vue par emplacement</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Priorités</Text>
        <View style={styles.searchBar}>
          <Search size={16} color={C.t3} strokeWidth={2} style={{ marginRight: 8 }} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher…"
            style={{ flex: 1, fontSize: 14, color: C.t1 }} placeholderTextColor={C.t4} />
        </View>
      </View>
      {urgent.length > 0 && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.red + '30' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} color={C.red} strokeWidth={2.5} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.red }}>
                PRIORITÉ ({urgent.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase())).length})
              </Text>
            </View>
            <View style={{ flex: 1, height: 1, backgroundColor: C.red + '30' }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {urgent.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase())).map(item => {
              // Jours affichés = projection amplifiée (DATE + type supporté), cohérente avec le set.
              const d = amplifiedTemporalDays(item);
              return (
              <TouchableOpacity key={item.id} onPress={() => { setSelectedItem(item); setDetailImgError(false); }}
                style={[styles.fridgeRow, { marginBottom: 9 }]}>
                <Text style={{ fontSize: 36, marginRight: 12 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productSub}>{item.brand || item.category} · {item.location}</Text>
                  <FreshnessBar days={d} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.urgBadge, { backgroundColor: urgBg(d) }]}>
                    <Text style={styles.urgText}>{urgLbl(d)}</Text>
                  </View>
                  <NutritionBadge grade={item.nutri_grade} />
                </View>
              </TouchableOpacity>
            ); })}
          </ScrollView>
        </View>
      )}
      {localItems.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Inbox size={52} color={C.t4} strokeWidth={1.2} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.t2 }}>Frigo vide</Text>
        </View>
      )}
    </View>
  );

  /* ── Main view — Mon Stock Master v1.0 ── */
  const scopedItems   = localItems.filter(i => i.location === activeScope);
  const filteredScoped = applyFilter(scopedItems);

  // N6-04 (R-02) : tiers Stock normal sur la projection AUTORITAIRE (DATE + heuristique ancrée ;
  // NONE → null → tier « Plus tard »). Un estimate NON ancré / fallback / scalaire périmé
  // n'obtient plus de position PRIORITÉ/PROCHAINEMENT (fin de la fuite via computeDaysRemaining).
  const priorityItems = filteredScoped
    .filter(i => getTemporalTier(passiveTemporalDays(i)) === TEMPORAL_TIER.PRIORITY)
    .sort((a, b) => passiveTemporalDays(a) - passiveTemporalDays(b));
  const soonItems = filteredScoped
    .filter(i => getTemporalTier(passiveTemporalDays(i)) === TEMPORAL_TIER.SOON)
    .sort((a, b) => passiveTemporalDays(a) - passiveTemporalDays(b));
  const laterItems = filteredScoped
    .filter(i => getTemporalTier(passiveTemporalDays(i)) === TEMPORAL_TIER.LATER)
    .sort((a, b) => {
      const da = passiveTemporalDays(a), db = passiveTemporalDays(b);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

  // Natural Focus : intensité par pertinence temporelle — voir naturalFocusIntensity
  // (module) ; calculée par ligne à partir des jours restants.

  // Couleurs de libellé alignées sur le Master : identité fixe par section
  // (statique, jamais conditionnelle au contenu) — le rouge de "priorité" est
  // la teinte propre à la section, pas un signal déclenché par un item dépassé.
  const sections = [
    // N6-04 (plafond sémantique des LIBELLÉS) : le regroupement temporel reste inchangé, mais
    // le libellé décrit la RELATION (« quand ») et non une INSTRUCTION de consommation. Type de
    // date inconnu → jamais « à utiliser en priorité/prochainement » (consigne) ni couleur forte
    // (rouge/orange = claim). Couleur neutre pour les trois sections. (DLC/DDM/expiration : N6-08.)
    { key: TEMPORAL_TIER.PRIORITY, label: 'Date atteinte',   items: priorityItems, labelColor: theme.text1 },
    { key: TEMPORAL_TIER.SOON,     label: 'Prochains jours', items: soonItems,     labelColor: theme.text1 },
    { key: TEMPORAL_TIER.LATER,    label: 'Autres produits', items: laterItems,    labelColor: theme.text1 },
  ];

  const scopeLabel = activeScope === 'Frigo' ? 'le frigo' : activeScope === 'Congélateur' ? 'le congélateur' : 'le placard';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {DetailModal()}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <InventoryHeader
          theme={theme}
          fonts={fonts}
          query={q}
          onQueryChange={setQ}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filters={FILTERS}
        />

        <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 16 }}>
          <StorageScopeControl active={activeScope} onChange={setActiveScope} theme={theme} fonts={fonts} />
        </View>

        {scopedItems.length === 0 ? (
          /* ─── ÉTAT VIDE : espace calme, action simple ─── */
          <View style={{ alignItems: 'center', paddingTop: 36, paddingHorizontal: 32, paddingBottom: 40 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: theme.text2, marginBottom: 6, textAlign: 'center' }}>
              Rien dans {scopeLabel}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, fontWeight: '400', color: theme.text3, textAlign: 'center', lineHeight: 20, marginBottom: 22 }}>
              Ajoute un produit pour commencer à suivre ce qui s'y trouve.
            </Text>
            <TouchableOpacity onPress={onScan}
              style={{ backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 26 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: '#fff' }}>Ajouter un produit</Text>
            </TouchableOpacity>
          </View>
        ) : filteredScoped.length === 0 ? (
          /* ─── ZÉRO RÉSULTAT — distinct de l'espace vide (§31). L'espace contient
                des produits, mais la recherche ou le filtre ne renvoie rien : deux
                situations différentes, deux messages, et toujours un retour simple à
                l'état normal. Contextual Voice : humain, sans alerte. ─── */
          <View style={{ alignItems: 'center', paddingTop: 36, paddingHorizontal: 32, paddingBottom: 40 }}>
            {q ? <Search size={22} color={theme.text4} strokeWidth={1.8} style={{ marginBottom: 12 }} />
               : <Inbox size={22} color={theme.text4} strokeWidth={1.6} style={{ marginBottom: 12 }} />}
            {q ? (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: theme.text2, marginBottom: 6, textAlign: 'center' }}>
                  Aucun produit pour « {q} »
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, fontWeight: '400', color: theme.text3, textAlign: 'center', lineHeight: 20, marginBottom: 22 }}>
                  Vérifie l'orthographe, ou cherche autrement.
                </Text>
                <TouchableOpacity onPress={() => setQ('')}
                  style={{ borderRadius: 14, paddingVertical: 11, paddingHorizontal: 22, borderWidth: 1, borderColor: theme.separator }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.text1 }}>Effacer la recherche</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: theme.text2, marginBottom: 6, textAlign: 'center' }}>
                  Rien à afficher avec ce filtre
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, fontWeight: '400', color: theme.text3, textAlign: 'center', lineHeight: 20, marginBottom: 22 }}>
                  Dans {scopeLabel}, aucun produit ne correspond à « {activeFilter} » pour le moment.
                </Text>
                <TouchableOpacity onPress={() => setActiveFilter('Tous')}
                  style={{ borderRadius: 14, paddingVertical: 11, paddingHorizontal: 22, borderWidth: 1, borderColor: theme.separator }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.text1 }}>Voir tout le stock</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {sections.map(section => section.items.length === 0 ? null : (
              // Pas de fond, pas de radius, pas d'ombre : le fond de l'écran traverse
              // la liste. La hiérarchie vient du titre, de l'espace et des séparateurs.
              // Libellé recalibré sur le Master : traitement Overline compact
              // (UPPERCASE, tracking léger) — le Master prime sur l'échelle Title 2
              // de la Spec quand l'application littérale de celle-ci régresse le rendu.
              <View key={section.key} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, color: section.labelColor }}>
                    {section.label.toUpperCase()}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, fontWeight: '400', color: theme.text4 }}>{section.items.length}</Text>
                </View>
                {section.items.map((item, idx) => (
                  <InventoryProductRow
                    key={item.id}
                    item={item}
                    theme={theme}
                    fonts={fonts}
                    tier={section.key}
                    // N6-04 — séparation des canaux (isolation Home : props consommées ici
                    // seulement ; Home ne les passe pas → comportement legacy inchangé, N6-13) :
                    //  • temporalDays = descripteur NEUTRE « Dans 2 jours » (DATE + heuristique
                    //    ancrée ; NONE → null → « Sans échéance connue »). Relation, pas urgence.
                    //  • temporalEmphasisDays = couleur FORTE rouge/orange = signal AMPLIFIÉ →
                    //    DATE + type supporté (amplifiedTemporalDays ; vide aujourd'hui → neutre).
                    //  • HALO Natural Focus = amplification → même plafond amplifié.
                    temporalDays={passiveTemporalDays(item)}
                    temporalEmphasisDays={amplifiedTemporalDays(item)}
                    focusIntensity={naturalFocusIntensity(amplifiedTemporalDays(item))}
                    isLast={idx === section.items.length - 1}
                    onPress={() => { setSelectedItem(item); setDetailImgError(false); }}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── AJOUT — réutilise le flux Scan/Ajout existant, aucune nouvelle logique ───
          DETTE D'INTÉGRATION (non résolue ici, hors scope de cette passe) : ce FAB
          coexiste avec le bouton "+" central de la navigation globale (App.js). Les
          deux ouvrent le même flux Scan, mais leur cohabitation visuelle devra être
          tranchée avec le Master Navigation, pas dans cette calibration du Stock.
          En attendant cette décision, masqué pour la revue visuelle (SHOW_STOCK_FAB)
          afin d'éviter le doublon avec le "+" global — aucune navigation modifiée. */}
      {SHOW_STOCK_FAB && scopedItems.length > 0 && (
        <TouchableOpacity onPress={onScan}
          style={{
            position: 'absolute', bottom: 20, right: 20,
            width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accent,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
          }}>
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

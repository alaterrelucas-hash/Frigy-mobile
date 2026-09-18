import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Image, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Search,
  ChevronLeft, ChevronRight,
  Package,
  CalendarDays, AlertTriangle, MapPin, PieChart, Tag,
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
import StockUpdateSheet from '../components/stock/StockUpdateSheet';
import RemainingCorrectionSheet from '../components/stock/RemainingCorrectionSheet';
import { applyStockUpdate, setApproximateRemainingLevel } from '../utils/partialOutcomeMutation';
import { makeClientEventId, remainingLabel } from '../utils/stockUpdateSheetLogic';
import { explicitDateType } from '../utils/captureProvenance';
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
  const [updateItem, setUpdateItem]       = useState(null); // produit en cours de mise à jour rapide (StockUpdateSheet)
  const [updateInitialLevel, setUpdateInitialLevel] = useState(null); // pré-sélection UI de la sheet (intention déjà affirmée) — jamais une mutation
  const [correctItem, setCorrectItem]     = useState(null); // produit en cours de correction du reste estimé (fiche)
  const [submitBusy, setSubmitBusy]       = useState(false);
  const [editMode, setEditMode]           = useState(false);
  const [editField, setEditField]         = useState(null); // 'identity'|'date'|'location' — éditeur FOCALISÉ (une info à la fois)
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
  // Éditeur FOCALISÉ (§3) : on n'ouvre QUE le champ touché (identity = nom + emoji ; date ; location).
  // La persistance reste partagée (saveEdit) — les autres champs, non rendus, gardent leur valeur d'origine.
  const openEdit = (item, field = 'identity') => {
    setEditFields({ name: item.name, emoji: item.emoji || '🛒', dlcInput: item.dlc && item.dlc !== '—' ? item.dlc : '', location: item.location });
    setEditField(field);
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
    setEditMode(false); setEditField(null);
    await supabase.from('items').update(updates).eq('id', selectedItem.id);
  };

  // MISE À JOUR CANONIQUE — SOURCE DE VÉRITÉ UNIQUE. Toute issue (partielle OU clôture totale) passe par
  // l'RPC apply_partial_outcome via le wrapper canonique : AUCUN items.update({consumed,wasted}) parallèle
  // ici (fin des deux écritures concurrentes). EMPTY converge vers la clôture TOTALE (consumed=true ;
  // wasted si WASTED ; remaining_level='EMPTY') → plus jamais de HALF résiduel sur une ligne fermée.
  // Partiel → la ligne RESTE active. clientEventId : id STABLE par intention (même payload) → réutilisé au
  // retry réseau (idempotence DB déjà en place) ; un payload différent obtient un nouvel id.
  const submitRef = useRef(null); // { key, id }
  const clientEventIdFor = (itemId, remainingLevel, usedDeclared, wasteDeclared) => {
    const key = `${itemId}|${remainingLevel}|${usedDeclared}|${wasteDeclared}`;
    if (submitRef.current && submitRef.current.key === key) return submitRef.current.id; // retry même intention (même payload)
    const id = makeClientEventId(itemId);
    submitRef.current = { key, id };
    return id;
  };

  // Recharge la vérité serveur d'une ligne (baseline après conflit / fermeture concurrente). Best-effort.
  const refreshItem = async (itemId) => {
    const { data } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle();
    if (!data) return null;
    if (data.consumed) updateItems(p => p.filter(x => x.id !== itemId));
    else updateItems(p => p.map(x => x.id === itemId ? { ...x, ...data, days: data.days_left } : x));
    return data;
  };

  // Échecs — messages calmes, jamais de faux succès. Réseau → sélections + même clientEventId conservés.
  const onOutcomeFailure = (reason, item) => {
    const msg = String(reason || '');
    if (/INCREASE_NOT_ALLOWED/.test(msg)) {
      refreshItem(item.id);
      Alert.alert('Vérifie la quantité', 'Ton stock a peut-être changé. Regarde ce qu’il reste et réessaie.');
    } else if (/ITEM_ALREADY_CLOSED/.test(msg)) {
      refreshItem(item.id); setUpdateItem(null); setCorrectItem(null);
      Alert.alert('Déjà à jour', 'Ce produit n’est plus dans ton stock actif.');
    } else if (/NOT_AUTHORIZED|NOT_AUTHENTICATED/.test(msg)) {
      Alert.alert('Impossible de mettre à jour', 'Cette mise à jour n’a pas pu être enregistrée.');
    } else if (/IDEMPOTENCY_MISMATCH/.test(msg)) {
      submitRef.current = null; // ne PAS retenter avec le même token
      Alert.alert('Réessaie', 'Un souci de synchronisation est survenu. Réessaie.');
    } else {
      Alert.alert('Connexion interrompue', 'Réessaie dans un instant.');
    }
  };

  // Ouverture de la SURFACE UNIQUE de mise à jour. initialLevel = niveau que l'utilisateur VIENT d'affirmer
  // sur une autre surface (« Il n'en reste plus » → EMPTY) : simple pré-sélection d'UI, aucune écriture, aucune
  // cause impliquée. Toute ouverture passe ici et déclare son intention (null par défaut) : aucun état résiduel.
  const openStockUpdate = (item, initialLevel = null) => { setUpdateInitialLevel(initialLevel); setUpdateItem(item); };

  // CTA final du StockUpdateSheet (V2) : remaining-first + déclarations causales QUALITATIVES optionnelles
  // (sollicitées seulement à EMPTY). UNE mutation canonique (apply_stock_update via applyStockUpdate).
  const submitStockUpdate = async (item, { remainingLevel, usedDeclared = false, wasteDeclared = false } = {}) => {
    if (submitBusy) return; // garde anti double-tap
    setSubmitBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const beforeLevel = item.remaining_level != null ? item.remaining_level : null;
    const clientEventId = clientEventIdFor(item.id, remainingLevel, usedDeclared, wasteDeclared);
    const r = await applyStockUpdate(supabase, { itemId: item.id, remainingLevel, usedDeclared, wasteDeclared, beforeLevel, clientEventId });
    setSubmitBusy(false);
    if (!r.ok) { onOutcomeFailure(r.reason, item); return; } // sheet reste ouverte, sélections conservées
    submitRef.current = null;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const returned = r.item && r.item.id ? r.item : null;
    const closes = (r.effect && r.effect.closesRow) || remainingLevel === 'EMPTY';
    if (closes) {
      updateItems(p => p.filter(x => x.id !== item.id));
      // Analytics V2 : UNE clôture, déclarations QUALITATIVES. Jamais de %/€/g ni double comptage d'un mixte.
      posthog.capture('stock_closed', { before_level: beforeLevel, after_level: 'EMPTY', used_declared: usedDeclared, waste_declared: wasteDeclared, name: item.name, category: item.category });
    } else {
      const patch = returned ? { ...returned, days: returned.days_left } : { remaining_level: remainingLevel };
      updateItems(p => p.map(x => x.id === item.id ? { ...x, ...patch } : x));
      posthog.capture('stock_remaining_updated', { before_level: beforeLevel, after_level: remainingLevel, name: item.name, category: item.category });
    }
    setUpdateItem(null);
  };

  // Correction directe du reste estimé depuis la fiche (CORRECTED — jamais consommation/gaspillage).
  const submitRemainingCorrection = async (item, level) => {
    if (submitBusy) return;
    setSubmitBusy(true);
    const clientEventId = makeClientEventId(item.id);
    const r = await setApproximateRemainingLevel(supabase, { itemId: item.id, level, clientEventId });
    setSubmitBusy(false);
    if (!r.ok) { onOutcomeFailure(r.reason, item); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const returned = r.item && r.item.id ? r.item : null;
    const patch = returned ? { ...returned, days: returned.days_left } : { remaining_level: level };
    updateItems(p => p.map(x => x.id === item.id ? { ...x, ...patch } : x));
    setSelectedItem(prev => (prev && prev.id === item.id ? { ...prev, ...patch } : prev));
    setCorrectItem(null);
    posthog.capture('product_remaining_corrected', { level, name: item.name });
  };

  // (decrementUnit retiré : fonction MORTE sans appelant, qui contenait un `update({consumed:true})`
  //  non canonique. La clôture totale passe désormais UNIQUEMENT par apply_partial_outcome(…, EMPTY).)

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

  // STK-02 (CORRECTION ≠ CONSOMMATION/GASPILLAGE) : retirer une ENTRÉE ERRONÉE (doublon, mauvais produit,
  // saisie fautive) SANS la déclarer consommée ni gaspillée — sinon on fabriquerait un faux événement qui
  // polluerait les compteurs Profile (recordedConsumptions/declaredWaste). Distinct de la mise à jour de
  // stock canonique : n'écrit NI `consumed` NI `wasted`, aucun event causal (event neutre `product_removed`).
  // Confirmation destructive obligatoire ; suppression prouvée d'abord (erreur → entrée conservée) puis
  // retrait UI + fermeture. Aucune économie / aucun impact déduit.
  const deleteItem = (item) => {
    Alert.alert(
      'Supprimer cette entrée ?',
      'On retire cette entrée de ton stock. Ce n’est ni consommé ni gaspillé.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('items').delete().eq('id', item.id);
          if (error) { Alert.alert('Impossible de supprimer', 'Réessaie.'); return; }
          updateItems(p => p.filter(x => x.id !== item.id));
          setSelectedItem(null);
          posthog.capture('product_removed', { name: item.name, category: item.category, location: item.location });
        } },
      ],
    );
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
    // §26 : interprétation DLC/DDM affichée UNIQUEMENT si le TYPE de date est autoritaire (N6-08). Type
    // inconnu → jamais « DLC »/« DDM »/« expiration » fabriqué. Réutilise explicitDateType (temporalAuthority/N6).
    const dtype = explicitDateType(item);
    // §27 : « Reste estimé » = état APPROXIMATIF (remaining_level), jamais une quantité exacte. NULL → « Non renseigné ».
    const restLabel = remainingLabel(item.remaining_level != null ? item.remaining_level : null);
    const closeModal = () => { setSelectedItem(null); setEditMode(false); setEditField(null); };

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
                    <TouchableOpacity onPress={() => { setEditMode(false); setEditField(null); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.t2 }}>Annuler</Text>
                    </TouchableOpacity>
                    {/* Titre = champ FOCALISÉ (jamais un « Modifier » global). */}
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1 }}>
                      {editField === 'date' ? 'Modifier la date' : editField === 'location' ? 'Modifier l’emplacement' : 'Modifier le nom'}
                    </Text>
                    <TouchableOpacity onPress={saveEdit}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.green, borderRadius: 20 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Enregistrer</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {editMode ? (
                  <View style={{ marginBottom: 20 }}>
                    {/* §3 ÉDITEUR FOCALISÉ : on ne rend QUE le champ touché. Nom + emoji vont ensemble
                        (identité visuelle du produit, §25). Date et Emplacement sont isolés. */}
                    {editField === 'identity' && (
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                        <View style={{ width: 64 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>EMOJI</Text>
                          <TextInput value={editFields.emoji} onChangeText={v => setEditFields(p => ({ ...p, emoji: v }))}
                            accessibilityLabel="Emoji du produit"
                            style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10,
                              fontSize: 28, textAlign: 'center', backgroundColor: '#FAFAFA' }} maxLength={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>NOM</Text>
                          <TextInput value={editFields.name} onChangeText={v => setEditFields(p => ({ ...p, name: v }))}
                            accessibilityLabel="Nom du produit" autoFocus
                            style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 11,
                              fontSize: 15, color: C.t1, backgroundColor: '#FAFAFA' }} />
                        </View>
                      </View>
                    )}
                    {editField === 'date' && (
                      <>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>DATE LIMITE (DLC)</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <TextInput value={editFields.dlcInput}
                            onChangeText={t => setEditFields(p => ({ ...p, dlcInput: formatDlcInput(t) }))}
                            placeholder="JJ/MM/AAAA" placeholderTextColor={C.t4} accessibilityLabel="Date du produit" autoFocus
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
                      </>
                    )}
                    {editField === 'location' && (
                      <>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>EMPLACEMENT</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {LOC_ITEMS.map(l => {
                            const active = editFields.location === l.id;
                            return (
                              <TouchableOpacity key={l.id} onPress={() => setEditFields(p => ({ ...p, location: l.id }))}
                                accessibilityRole="button" accessibilityLabel={l.id} accessibilityState={{ selected: active }}
                                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
                                  borderWidth: 1.5, borderColor: active ? C.green : C.border,
                                  backgroundColor: active ? `${C.green}12` : '#FAFAFA' }}>
                                <l.Icon size={20} color={active ? C.green : C.t3} strokeWidth={active ? 2.5 : 1.8} style={{ marginBottom: 2 }} />
                                <Text style={{ fontSize: 10, fontWeight: '600', color: active ? C.green : C.t3 }}>{l.id}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}
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

                    {/* ACTION PRIMAIRE — ouvre la MÊME surface unique de mise à jour (StockUpdateSheet).
                        La fiche NE duplique PAS « utilisé/jeté » : une seule logique canonique (§22).
                        Handoff propre : on ferme la fiche AVANT d'ouvrir la sheet (pas d'empilement). */}
                    <TouchableOpacity onPress={() => { closeModal(); openStockUpdate(item); }} activeOpacity={0.85}
                      accessibilityRole="button" accessibilityLabel="Mettre mon stock à jour"
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        paddingVertical: 16, borderRadius: 16, backgroundColor: C.green, marginBottom: 20 }}>
                      <Utensils size={18} color="#fff" strokeWidth={2} />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Mettre mon stock à jour</Text>
                    </TouchableOpacity>

                    {/* INFORMATIONS — « touche l'info que tu veux corriger » (§24). Nom/Emplacement/Date ouvrent
                        l'éditeur direct existant (saveEdit, capacités préservées). Reste estimé ouvre la
                        correction bornée (CORRECTED). Ouvert = interrupteur direct. Quantité (autorité exacte,
                        N6-07) et Prix restent en lecture. Plus de bouton global « Modifier ce produit » (§23). */}
                    <Text style={{ fontSize: 11, fontWeight: '800', color: C.t3, letterSpacing: 0.8, marginBottom: 8 }}>INFORMATIONS</Text>
                    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                      {/* Nom → éditeur direct */}
                      <TouchableOpacity onPress={() => openEdit(item, 'identity')} activeOpacity={0.6}
                        accessibilityRole="button" accessibilityLabel={`Nom, ${item.name}, modifier`}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <Tag size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 14, color: C.t2 }}>Nom</Text>
                        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: C.t1, marginRight: 6 }} numberOfLines={1}>{item.name}</Text>
                        <ChevronRight size={16} color={C.t4} strokeWidth={2} />
                      </TouchableOpacity>
                      {/* Emplacement → éditeur direct */}
                      <TouchableOpacity onPress={() => openEdit(item, 'location')} activeOpacity={0.6}
                        accessibilityRole="button" accessibilityLabel={`Emplacement, ${item.location}, modifier`}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <MapPin size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 14, color: C.t2 }}>Emplacement</Text>
                        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: C.t1, marginRight: 6 }}>{item.location}</Text>
                        <ChevronRight size={16} color={C.t4} strokeWidth={2} />
                      </TouchableOpacity>
                      {/* Date → éditeur direct. Valeur brute + interprétation SEULEMENT si type autoritaire (§26). */}
                      <TouchableOpacity onPress={() => openEdit(item, 'date')} activeOpacity={0.6}
                        accessibilityRole="button" accessibilityLabel={`Date, ${dlcFormatted || 'non renseignée'}, modifier`}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <CalendarDays size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 14, color: C.t2 }}>Date</Text>
                        <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: dlcFormatted ? C.t1 : C.t4 }}>{dlcFormatted || 'Non renseignée'}</Text>
                          {dtype && dlcFormatted && (
                            <Text style={{ fontSize: 11, color: C.t4, marginTop: 1 }}>
                              {dtype}{detailDays !== null && detailDays < 0 ? ' · dépassée — vérifier' : ''}
                            </Text>
                          )}
                        </View>
                        <ChevronRight size={16} color={C.t4} strokeWidth={2} />
                      </TouchableOpacity>
                      {/* Reste estimé → correction bornée (CORRECTED, jamais consommation/gaspillage). NULL → « Non renseigné ». */}
                      <TouchableOpacity onPress={() => { closeModal(); setCorrectItem(item); }} activeOpacity={0.6}
                        accessibilityRole="button" accessibilityLabel={`Reste estimé, ${restLabel}, corriger`}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <PieChart size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 14, color: C.t2 }}>Reste estimé</Text>
                        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: item.remaining_level != null ? C.t1 : C.t4, marginRight: 6 }}>{restLabel}</Text>
                        <ChevronRight size={16} color={C.t4} strokeWidth={2} />
                      </TouchableOpacity>
                      {/* Ouvert — interrupteur direct (contrat opened inchangé). */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
                        borderBottomWidth: (quantityLabel || item.price) ? 1 : 0, borderBottomColor: C.border }}>
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
                      {/* Quantité — AUTORITÉ EXACTE (N6-07), distincte du reste estimé ; affichée seulement si KNOWN. */}
                      {quantityLabel && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
                          borderBottomWidth: item.price ? 1 : 0, borderBottomColor: C.border }}>
                          <Package size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                          {/* §5 : autorité EXACTE au moment de l'ajout (jamais décrémentée), DISTINCTE du reste
                              estimé approximatif. Libellé précis pour ne pas confondre les deux vérités. */}
                          <Text style={{ flex: 1, fontSize: 14, color: C.t2 }}>Quantité ajoutée</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: C.t1 }}>{quantityLabel}</Text>
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

                    {/* STK-02 — CORRECTION : retirer une entrée erronée SANS consommer ni gaspiller. Action
                        tertiaire destructive RETENUE (lien texte rouge, sans icône corbeille pour ne pas se
                        confondre avec « Gaspillé » : Warm Precision, pas de gros panneau). Confirmation
                        obligatoire ; deleteItem n'écrit ni consumed ni wasted. */}
                    <TouchableOpacity onPress={() => deleteItem(item)} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityLabel="Supprimer cette entrée"
                      style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.red }}>Supprimer cette entrée</Text>
                    </TouchableOpacity>
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

  // Surfaces canoniques de mise à jour — montées dans TOUTES les vues (normale ET urgente) pour un
  // comportement de tap COHÉRENT (§4). Une seule définition, rendue à deux endroits.
  const stockSheets = (
    <>
      <StockUpdateSheet
        visible={!!updateItem}
        item={updateItem}
        fonts={fonts}
        submitting={submitBusy}
        onConfirm={(payload) => updateItem && submitStockUpdate(updateItem, payload)}
        onNoChange={() => setUpdateItem(null)}
        onViewProduct={() => { const it = updateItem; setUpdateItem(null); setSelectedItem(it); setDetailImgError(false); }}
        onDismiss={() => setUpdateItem(null)}
        initialRemainingLevel={updateInitialLevel}
      />
      <RemainingCorrectionSheet
        visible={!!correctItem}
        item={correctItem}
        fonts={fonts}
        submitting={submitBusy}
        onConfirm={(level) => correctItem && submitRemainingCorrection(correctItem, level)}
        onGoToUpdate={() => { const it = correctItem; setCorrectItem(null); openStockUpdate(it, 'EMPTY'); }}
        onDismiss={() => setCorrectItem(null)}
      />
    </>
  );

  /* ── Urgent mode ── */
  if (urgentMode) return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {DetailModal()}
      {stockSheets}
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
              // §4 cohérence : même tap produit → même surface (mise à jour rapide) qu'en vue normale.
              return (
              <TouchableOpacity key={item.id} onPress={() => openStockUpdate(item)}
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

      {/* MISE À JOUR RAPIDE + CORRECTION du reste estimé — surfaces canoniques (voir `stockSheets`). */}
      {stockSheets}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <InventoryHeader
          theme={theme}
          fonts={fonts}
          query={q}
          onQueryChange={setQ}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filters={FILTERS}
          onShopping={onShopping}
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
                    // §2/§22 : tap sur un produit actif → surface UNIQUE de mise à jour rapide (pas la fiche).
                    // La fiche (inspecter/corriger) reste accessible depuis « Voir la fiche produit » dans la sheet.
                    onPress={() => openStockUpdate(item)}
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

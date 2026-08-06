import { useState, useEffect } from 'react';
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
import { computeDaysRemaining, getTemporalTier, TEMPORAL_TIER } from '../utils/temporal';
import { useStockTheme } from '../utils/stockTheme';
import { DEV_PREVIEW_STOCK_ENABLED, getDevPreviewItems } from '../utils/devPreviewStock'; // DEV-ONLY — voir ce fichier pour retirer
import { styles } from '../styles';
import StorageScopeControl from '../components/StorageScopeControl';
import InventoryProductRow from '../components/InventoryProductRow';
import InventoryHeader from '../components/InventoryHeader';

const BG = '#F7F9F8';

const FILTERS = ['Tous', 'À consommer', 'DLC proche'];

// Masqué le temps de la revue visuelle pour éviter le doublon avec le "+" global
// de la navigation (App.js). Décision finale à prendre avec le Master Navigation —
// remettre à true (ou retirer la condition) une fois cette dette résolue.
const SHOW_STOCK_FAB = false;

const NUTRI_COLORS = { A: '#2ECC71', B: '#8BC34A', C: '#F5B700', D: '#E6A23C', E: '#FF3B30' };

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
    setLocalItems(useDevPreview ? getDevPreviewItems() : items);
  }, [items]);

  const updateItems = (updater) => { setItems(updater); setLocalItems(updater); };

  useEffect(() => {
    if (initialItem) { setSelectedItem(initialItem); onInitialItemConsumed?.(); }
  }, [initialItem]);

  const urgent = localItems.filter(i => i.days <= 4).sort((a, b) => a.days - b.days);
  const rest   = localItems.filter(i => i.days > 4).sort((a, b) => a.days - b.days);

  const applyFilter = (list) => {
    let out = list;
    if (q) out = out.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    if (activeFilter === 'À consommer') out = out.filter(i => (computeDaysRemaining(i) ?? 99) <= 4);
    if (activeFilter === 'DLC proche')  out = out.filter(i => (computeDaysRemaining(i) ?? 99) <= 7);
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
    updateItems(p => p.map(x => x.id === selectedItem.id ? { ...x, ...updates, days: updates.days_left } : x));
    setSelectedItem(prev => ({ ...prev, ...updates, days: updates.days_left }));
    setEditMode(false);
    await supabase.from('items').update(updates).eq('id', selectedItem.id);
  };

  const consumeItem = async (item, wasted = false) => {
    Haptics.impactAsync(wasted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    updateItems(p => p.filter(x => x.id !== item.id));
    setSelectedItem(null);
    await supabase.from('items').update({ consumed: true, wasted }).eq('id', item.id);
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
    const isPack = (item.total_units || 1) > 1;
    const dlcFormatted = item.dlc && item.dlc !== '—' ? item.dlc : null;
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
                        {item.img_url && !detailImgError
                          ? <Image source={{ uri: item.img_url }} style={{ width: 100, height: 100, borderRadius: 50 }}
                              resizeMode="cover" onError={() => setDetailImgError(true)} />
                          : <Text style={{ fontSize: 52 }}>{item.emoji}</Text>}
                      </View>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
                        backgroundColor: urgBg(item.days), marginBottom: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>J-{item.days}</Text>
                      </View>
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
                      <TouchableOpacity onPress={() => consumeItem(item, false)}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 18, backgroundColor: `${C.green}18` }}>
                        <Utensils size={26} color={C.green} strokeWidth={2} style={{ marginBottom: 6 }} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.green }}>J'ai mangé ça</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => consumeItem(item, true)}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 18, backgroundColor: '#FF3B3018' }}>
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

                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
                        borderBottomWidth: item.price ? 1 : 0, borderBottomColor: C.border }}>
                        <Package size={18} color={C.t3} strokeWidth={1.8} style={{ marginRight: 12 }} />
                        <Text style={{ flex: 1, fontSize: 14, color: C.t2 }}>Quantité</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: C.t1 }}>
                          {isPack ? `${item.quantity}/${item.total_units} restant${item.quantity > 1 ? 's' : ''}` : '1 unité'}
                        </Text>
                      </View>
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
            {urgent.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase())).map(item => (
              <TouchableOpacity key={item.id} onPress={() => { setSelectedItem(item); setDetailImgError(false); }}
                style={[styles.fridgeRow, { marginBottom: 9 }]}>
                <Text style={{ fontSize: 36, marginRight: 12 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productSub}>{item.brand || item.category} · {item.location}</Text>
                  <FreshnessBar days={item.days} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.urgBadge, { backgroundColor: urgBg(item.days) }]}>
                    <Text style={styles.urgText}>{urgLbl(item.days)}</Text>
                  </View>
                  <NutritionBadge grade={item.nutri_grade} />
                </View>
              </TouchableOpacity>
            ))}
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

  const priorityItems = filteredScoped
    .filter(i => getTemporalTier(computeDaysRemaining(i)) === TEMPORAL_TIER.PRIORITY)
    .sort((a, b) => computeDaysRemaining(a) - computeDaysRemaining(b));
  const soonItems = filteredScoped
    .filter(i => getTemporalTier(computeDaysRemaining(i)) === TEMPORAL_TIER.SOON)
    .sort((a, b) => computeDaysRemaining(a) - computeDaysRemaining(b));
  const laterItems = filteredScoped
    .filter(i => getTemporalTier(computeDaysRemaining(i)) === TEMPORAL_TIER.LATER)
    .sort((a, b) => {
      const da = computeDaysRemaining(a), db = computeDaysRemaining(b);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

  // Natural Focus : porte le bon moment (un produit "aujourd'hui"), jamais l'état
  // le plus problématique. Un produit "Date dépassée — vérifier" (days < 0) n'est
  // jamais candidat — le rouge porte déjà la vérification, la lumière n'en rajoute
  // pas. Un seul candidat maximum ; aucun candidat pertinent → aucun focus.
  const focusedItemId = priorityItems.find(i => computeDaysRemaining(i) === 0)?.id ?? null;

  // Couleurs de libellé alignées sur le Master : identité fixe par section
  // (statique, jamais conditionnelle au contenu) — le rouge de "priorité" est
  // la teinte propre à la section, pas un signal déclenché par un item dépassé.
  const sections = [
    { key: TEMPORAL_TIER.PRIORITY, label: 'À utiliser en priorité', items: priorityItems, labelColor: theme.critical },
    { key: TEMPORAL_TIER.SOON,     label: 'À utiliser prochainement', items: soonItems,    labelColor: theme.attention },
    { key: TEMPORAL_TIER.LATER,    label: 'Plus tard',               items: laterItems,    labelColor: theme.text1 },
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

        <View style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 18 }}>
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
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {sections.map(section => section.items.length === 0 ? null : (
              // Pas de fond, pas de radius, pas d'ombre : le fond de l'écran traverse
              // la liste. La hiérarchie vient du titre, de l'espace et des séparateurs.
              // Libellé recalibré sur le Master : traitement Overline compact
              // (UPPERCASE, tracking léger) — le Master prime sur l'échelle Title 2
              // de la Spec quand l'application littérale de celle-ci régresse le rendu.
              <View key={section.key} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
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
                    isFocused={item.id === focusedItemId}
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

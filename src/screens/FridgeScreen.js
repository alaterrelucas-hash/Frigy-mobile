import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Image } from 'react-native';
import {
  Search, ScanLine,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Refrigerator, Snowflake, Package,
  CalendarDays, AlertTriangle,
  Sparkles, Euro, Utensils, Trash2, Pencil, Inbox,
} from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { posthog } from '../config/posthog';
import { C, urgBg, urgLbl, LOC_ITEMS, SCREEN_W } from '../config/constants';
import { parseDlc, formatDlcInput, getStorageTip } from '../utils/product';
import { styles } from '../styles';

const BG    = '#F7F9F8';
const BLUE  = '#4F7DF3';
const AMBER = '#E6A23C';
const GREY  = '#6B7280';
const BORD  = '#E5E7EB';

const STORAGE_TABS = [
  { id: 'Frigo',       label: 'Frigo',        Icon: Refrigerator, color: C.green, bg: '#fff',     secBg: '#F0FBF0' },
  { id: 'Congélateur', label: 'Congélateur',   Icon: Snowflake,    color: BLUE,    bg: '#EFF3FE',  secBg: '#EFF3FE' },
  { id: 'Placard',     label: 'Placard',       Icon: Package,      color: AMBER,   bg: '#FEF6E7',  secBg: '#FEF6E7' },
];

const FILTERS = ['Tous', 'À consommer', 'DLC proche'];

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
  initialItem, onInitialItemConsumed, onScan,
}) {
  const [q, setQ]                         = useState('');
  const [activeFilter, setActiveFilter]   = useState('Tous');
  const [expanded, setExpanded]           = useState(new Set(['Frigo']));
  const [showMore, setShowMore]           = useState({});
  const [selectedItem, setSelectedItem]   = useState(null);
  const [editMode, setEditMode]           = useState(false);
  const [editFields, setEditFields]       = useState({});
  const [detailImgError, setDetailImgError] = useState(false);
  const locScrollRef = useRef(null);
  const [restLoc, setRestLoc]             = useState(0);

  useEffect(() => {
    if (initialItem) { setSelectedItem(initialItem); onInitialItemConsumed?.(); }
  }, [initialItem]);

  const urgent = items.filter(i => i.days <= 4).sort((a, b) => a.days - b.days);
  const rest   = items.filter(i => i.days > 4).sort((a, b) => a.days - b.days);

  const applyFilter = (list) => {
    let out = list;
    if (q) out = out.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    if (activeFilter === 'À consommer') out = out.filter(i => (i.days ?? 99) <= 4);
    if (activeFilter === 'DLC proche')  out = out.filter(i => (i.days ?? 99) <= 7);
    return out;
  };

  const toggleSection = (id) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
    setItems(p => p.map(x => x.id === selectedItem.id ? { ...x, ...updates, days: updates.days_left } : x));
    setSelectedItem(prev => ({ ...prev, ...updates, days: updates.days_left }));
    setEditMode(false);
    await supabase.from('items').update(updates).eq('id', selectedItem.id);
  };

  const consumeItem = async (item, wasted = false) => {
    setItems(p => p.filter(x => x.id !== item.id));
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
          setItems(p => p.filter(x => x.id !== item.id));
          await supabase.from('items').update({ consumed: true }).eq('id', item.id);
        }},
      ]);
    } else {
      setItems(p => p.map(x => x.id === item.id ? { ...x, quantity: newQty } : x));
      await supabase.from('items').update({ quantity: newQty }).eq('id', item.id);
    }
  };

  /* ── ProductCard ── */
  const ProductCard = ({ item, isLast }) => {
    const [imgErr, setImgErr] = useState(false);
    const isPack = (item.total_units || 1) > 1;
    return (
      <TouchableOpacity onPress={() => { setSelectedItem(item); setDetailImgError(false); }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
          borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#F3F4F6' }}>
        {/* image */}
        <View style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: '#F4F6F4',
          alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          {item.img_url && !imgErr
            ? <Image source={{ uri: item.img_url }} style={{ width: 62, height: 62, borderRadius: 11 }}
                resizeMode="cover" onError={() => setImgErr(true)} />
            : <Text style={{ fontSize: 34 }}>{item.emoji || '🛒'}</Text>}
        </View>
        {/* info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.t1, marginBottom: 2 }} numberOfLines={1}>{item.name}</Text>
          <Text style={{ fontSize: 12, color: GREY }} numberOfLines={1}>
            {[item.brand, item.category, item.location].filter(Boolean).join(' · ')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <CalendarDays size={11} color={GREY} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: GREY }}>DLC {item.dlc && item.dlc !== '—' ? item.dlc : 'Non renseignée'}</Text>
          </View>
          {isPack && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: `${C.green}15`, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.green }}>{item.quantity}/{item.total_units}</Text>
              </View>
              <TouchableOpacity onPress={() => decrementUnit(item)}
                style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: `${C.orange}20`,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.orange, lineHeight: 18 }}>−</Text>
              </TouchableOpacity>
            </View>
          )}
          <FreshnessBar days={item.days} />
        </View>
        {/* right badges */}
        <View style={{ alignItems: 'center', gap: 4, marginLeft: 10 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
            backgroundColor: urgBg(item.days ?? 14) }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{urgLbl(item.days ?? 14)}</Text>
          </View>
          <NutritionBadge grade={item.nutri_grade} />
          <ChevronRight size={14} color={C.t4} />
        </View>
      </TouchableOpacity>
    );
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
                        <Text style={{ fontSize: 13, color: C.t2, lineHeight: 19 }}>{getStorageTip(item.category, item.name)}</Text>
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
      {items.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Inbox size={52} color={C.t4} strokeWidth={1.2} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.t2 }}>Frigo vide</Text>
        </View>
      )}
    </View>
  );

  /* ── Main view ── */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {DetailModal()}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* ─── HEADER ─── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1 }}>Mon Stock</Text>
        </View>

        {/* ─── STORAGE TABS ─── */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 }}>
          {STORAGE_TABS.map(tab => {
            const cnt = items.filter(i => i.location === tab.id).length;
            const isActive = expanded.has(tab.id);
            return (
              <TouchableOpacity key={tab.id} onPress={() => toggleSection(tab.id)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 20,
                  backgroundColor: tab.bg,
                  borderWidth: isActive ? 2 : 1,
                  borderColor: isActive ? tab.color : BORD,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}>
                <tab.Icon size={26} color={tab.color} strokeWidth={isActive ? 2.5 : 1.8} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: tab.color, marginBottom: 3 }}>{tab.label}</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: tab.color }}>{cnt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── SEARCH BAR ─── */}
        <View style={{ marginHorizontal: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, height: 54,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,
          borderWidth: 1, borderColor: BORD }}>
          <Search size={18} color="#9CA3AF" strokeWidth={2} style={{ marginRight: 10 }} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un produit…"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, fontSize: 15, color: C.t1 }} />
          <TouchableOpacity onPress={onScan}>
            <ScanLine size={20} color="#9CA3AF" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* ─── FILTER PILLS ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 2 }}
          style={{ marginBottom: 20 }}>
          {FILTERS.map(f => {
            const isActive = activeFilter === f;
            return (
              <TouchableOpacity key={f} onPress={() => setActiveFilter(f)}
                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999,
                  backgroundColor: isActive ? C.green : '#fff',
                  borderWidth: 1, borderColor: isActive ? C.green : BORD }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#fff' : C.t1 }}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── COLLAPSIBLE SECTIONS ─── */}
        {STORAGE_TABS.map(tab => {
          const sectionItems = applyFilter(items.filter(i => i.location === tab.id));
          const isExpanded   = expanded.has(tab.id);
          const isShowMore   = showMore[tab.id];
          const visible      = isShowMore ? sectionItems : sectionItems.slice(0, 5);

          return (
            <View key={tab.id} style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden',
              backgroundColor: '#fff',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }}>

              {/* section header */}
              <TouchableOpacity onPress={() => toggleSection(tab.id)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
                  backgroundColor: tab.secBg }}>
                <tab.Icon size={17} color={tab.color} strokeWidth={2} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: tab.color, letterSpacing: 0.5 }}>
                  {tab.id.toUpperCase()} ({items.filter(i => i.location === tab.id).length})
                </Text>
                {isExpanded
                  ? <ChevronUp size={18} color={GREY} strokeWidth={2} />
                  : <ChevronDown size={18} color={GREY} strokeWidth={2} />}
              </TouchableOpacity>

              {isExpanded && (
                <>
                  {sectionItems.length === 0 ? (
                    <View style={{ padding: 28, alignItems: 'center' }}>
                      <tab.Icon size={32} color={tab.color + '50'} strokeWidth={1.5} style={{ marginBottom: 8 }} />
                      <Text style={{ fontSize: 13, color: GREY }}>Rien dans ce {tab.label.toLowerCase()}</Text>
                    </View>
                  ) : (
                    visible.map((item, i) => (
                      <ProductCard key={item.id} item={item}
                        isLast={i === visible.length - 1 && (sectionItems.length <= 5 || isShowMore)} />
                    ))
                  )}

                  {sectionItems.length > 5 && (
                    <TouchableOpacity onPress={() => setShowMore(p => ({ ...p, [tab.id]: !p[tab.id] }))}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 4, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                      <Text style={{ fontSize: 14, color: GREY, fontWeight: '600' }}>
                        {isShowMore ? 'Voir moins' : 'Voir plus'}
                      </Text>
                      {isShowMore
                        ? <ChevronUp size={14} color={GREY} strokeWidth={2} />
                        : <ChevronDown size={14} color={GREY} strokeWidth={2} />}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
}

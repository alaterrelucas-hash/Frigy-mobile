import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Trash2, ShoppingCart, CheckCircle2, Circle } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import * as Haptics from 'expo-haptics';
import { C } from '../config/constants';

export default function ShoppingListScreen({ onClose, familyId, user }) {
  const [items, setItems]         = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [kbHeight, setKbHeight]   = useState(0);
  const [wastedInsights, setWastedInsights] = useState([]);
  const inputRef                  = useRef(null);
  const insets                    = useSafeAreaInsets();

  const fid = familyId || user?.id;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!fid) { setLoading(false); return; }
    supabase
      .from('shopping_items')
      .select('*')
      .eq('family_id', fid)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) Alert.alert('Erreur chargement', error.message);
        if (data) setItems(data);
        setLoading(false);
      });

    // Analyse de l'historique de gaspillage (60 derniers jours)
    const since = new Date();
    since.setDate(since.getDate() - 60);
    supabase
      .from('items')
      .select('name, emoji, category')
      .eq('family_id', fid)
      .eq('wasted', true)
      .gte('updated_at', since.toISOString())
      .then(({ data }) => {
        if (!data?.length) return;
        const counts = {};
        data.forEach(i => {
          const key = i.name.toLowerCase().trim();
          if (!counts[key]) counts[key] = { name: i.name, emoji: i.emoji || '🛒', count: 0 };
          counts[key].count++;
        });
        const insights = Object.values(counts)
          .filter(i => i.count >= 2)
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);
        setWastedInsights(insights);
      });
  }, [fid]);

  const addItem = async () => {
    const name = input.trim();
    if (!name || !fid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tempId = `temp-${Date.now()}`;
    const tempItem = { id: tempId, family_id: fid, name, quantity: '1', checked: false };
    setItems(prev => [...prev, tempItem]);
    setInput('');
    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ family_id: fid, name, quantity: '1' })
      .select('id, family_id, name, quantity, created_at')
      .single();
    if (error) {
      Alert.alert('Erreur', error.message);
      setItems(prev => prev.filter(i => i.id !== tempId));
      setInput(name);
      return;
    }
    if (data) setItems(prev => prev.map(i => i.id === tempId ? { checked: false, ...data } : i));
  };

  const toggleItem = async (item) => {
    const updated = { ...item, checked: !item.checked };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await supabase.from('shopping_items').update({ checked: updated.checked }).eq('id', item.id);
  };

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('shopping_items').delete().eq('id', id);
  };

  const clearChecked = () => {
    Alert.alert('Supprimer les articles cochés ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          const ids = items.filter(i => i.checked).map(i => i.id);
          if (!ids.length) return;
          setItems(prev => prev.filter(i => !i.checked));
          await supabase.from('shopping_items').delete().in('id', ids);
        },
      },
    ]);
  };

  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i => i.checked);

  const bottomPad = kbHeight > 0 ? kbHeight : insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingBottom: bottomPad }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
          paddingTop: 16, paddingBottom: 12, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1 }}>
              Liste de courses
            </Text>
            <Text style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>
              {unchecked.length} article{unchecked.length !== 1 ? 's' : ''} restant{unchecked.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card,
              alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={C.t2} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Produits à surveiller ── */}
          {wastedInsights.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#F59E0B', letterSpacing: 0.8 }}>
                  ⚠️ TU GASPILLES SOUVENT
                </Text>
              </View>
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 18, padding: 14,
                borderWidth: 1.5, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 12, color: '#92610A', marginBottom: 12, lineHeight: 17 }}>
                  Ces produits reviennent souvent dans tes déchets. Pense à en acheter moins ou à les consommer plus vite.
                </Text>
                {wastedInsights.map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#FDE68A', gap: 10 }}>
                    <Text style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{p.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#78350F' }}>{p.name}</Text>
                      <Text style={{ fontSize: 11, color: '#92610A', marginTop: 1 }}>
                        Gaspillé {p.count} fois ces 2 derniers mois
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { setInput(p.name); inputRef.current?.focus(); }}
                      style={{ paddingHorizontal: 12, paddingVertical: 6,
                        backgroundColor: '#F59E0B', borderRadius: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+ Liste</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {items.length === 0 && !loading && (
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <ShoppingCart size={48} color={C.t4} strokeWidth={1.2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.t2, marginTop: 16 }}>
                Liste vide
              </Text>
              <Text style={{ fontSize: 13, color: C.t3, marginTop: 6, textAlign: 'center' }}>
                Ajoute tes articles ci-dessous
              </Text>
            </View>
          )}

          {unchecked.map(item => (
            <TouchableOpacity key={item.id} onPress={() => toggleItem(item)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06, shadowRadius: 6 }}>
              <Circle size={22} color={C.t4} strokeWidth={1.8} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.t1 }}>{item.name}</Text>
              <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ padding: 4 }}>
                <Trash2 size={16} color={C.t4} strokeWidth={1.8} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {checked.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 10, gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3 }}>
                  DANS LE PANIER ({checked.length})
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              </View>

              {checked.map(item => (
                <TouchableOpacity key={item.id} onPress={() => toggleItem(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, opacity: 0.55,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04, shadowRadius: 4 }}>
                  <CheckCircle2 size={22} color={C.green} strokeWidth={2} />
                  <Text style={{ flex: 1, fontSize: 15, color: C.t2,
                    textDecorationLine: 'line-through' }}>{item.name}</Text>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ padding: 4 }}>
                    <Trash2 size={16} color={C.t4} strokeWidth={1.8} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              <TouchableOpacity onPress={clearChecked}
                style={{ alignItems: 'center', paddingVertical: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: C.red, fontWeight: '600' }}>
                  Supprimer les articles cochés
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Barre d'ajout */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
          backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addItem}
              placeholder="Ajouter un article…"
              placeholderTextColor={C.t4}
              returnKeyType="done"
              autoCorrect={false}
              style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1.5,
                borderColor: input.length > 0 ? C.green : C.border,
                borderRadius: 14, paddingHorizontal: 16,
                paddingVertical: 13, fontSize: 16, color: C.t1 }}
            />
            <TouchableOpacity onPress={addItem}
              style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.green,
                alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={24} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </View>
  );
}

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, Circle, PackagePlus } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import * as Haptics from 'expo-haptics';
import { C } from '../config/constants';
import { readShoppingQty, incShoppingQty, decShoppingQty, toStoredShoppingQty, formatShoppingQty } from '../utils/shoppingQuantity';

export default function ShoppingListScreen({ onClose, familyId, user, onSendToStock, removedShoppingId, onRemovedConsumed }) {
  const [items, setItems]         = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [kbHeight, setKbHeight]   = useState(0);
  const inputRef                  = useRef(null);
  const insets                    = useSafeAreaInsets();
  const pendingQtyRef             = useRef(new Set()); // N6-15 : write quantité en vol (verrou pessimiste par id)
  const pendingDoneRef            = useRef(new Set()); // N6-15 : toggle « dans le panier » en vol (verrou par id)
  const sendingRef                = useRef(new Set()); // N6-15 : handoff en vol (anti double-tap par id)
  const [, forceTick]             = useState(0);

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

    // N6-12 (CR-10) : AUCUNE analyse de gaspillage ici. Un compte brut de lignes `wasted` (sans
    // dénominateur ni instant d'événement réel — `updated_at` = timestamp technique) ne prouve aucune
    // « fréquence » et un signal NÉGATIF n'autorise aucune reco d'achat. Le gaspillage ne pilote pas la
    // liste de courses. Le seul écrivain d'intention d'achat reste `addItem` (saisie explicite). Silence.
  }, [fid]);

  // N6-15 — cleanup Courses piloté par App : App a supprimé la ligne `shopping_items` (DB) après un
  // commit Stock confirmé/reconnu ; on la retire localement (cas modale ouverte : pré-vol reconnu).
  useEffect(() => {
    if (!removedShoppingId) return;
    setItems(prev => prev.filter(i => i.id !== removedShoppingId));
    onRemovedConsumed?.();
  }, [removedShoppingId]);

  const addItem = async () => {
    const name = input.trim();
    if (!name || !fid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tempId = `temp-${Date.now()}`;
    // N6-15 : le champ canonique persisté est `shopping_items.done` (bool, default false) = « dans le
    // panier » — JAMAIS acheté / possédé / en stock. Aucune colonne `checked` n'existe en base.
    const tempItem = { id: tempId, family_id: fid, name, quantity: '1', done: false };
    setItems(prev => [...prev, tempItem]);
    setInput('');
    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ family_id: fid, name, quantity: '1' }) // done omis → DB default false
      .select('id, family_id, name, quantity, done, created_at')
      .single();
    if (error) {
      Alert.alert('Erreur', error.message);
      setItems(prev => prev.filter(i => i.id !== tempId));
      setInput(name);
      return;
    }
    if (data) setItems(prev => prev.map(i => i.id === tempId ? { done: false, ...data } : i));
  };

  // N6-15 — bascule « dans le panier » PESSIMISTE sur le champ canonique `done`. On écrit la DB D'ABORD ;
  // l'UI ne change QU'APRÈS un succès DB confirmé → jamais d'affirmation « dans le panier » non persistée
  // (l'ancien code écrivait une colonne `checked` inexistante → erreur silencieuse, état éphémère perdu au
  // reload). `done=true` = « marqué dans le panier », JAMAIS acheté/possédé/en stock. Verrou par ligne.
  const toggleItem = async (item) => {
    if (pendingDoneRef.current.has(item.id)) return; // verrou par ligne (ignore les taps pendant un write)
    const nextDone = !(item.done === true);
    pendingDoneRef.current.add(item.id); forceTick(t => t + 1);
    const { error } = await supabase.from('shopping_items').update({ done: nextDone }).eq('id', item.id);
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: nextDone } : i)); // UI APRÈS succès
    else Alert.alert('Panier non enregistré', 'Réessaie.'); // UI reste sur la valeur confirmée précédente
    pendingDoneRef.current.delete(item.id); forceTick(t => t + 1);
  };

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('shopping_items').delete().eq('id', id);
  };

  // N6-15 — retrait des articles « dans le panier » (done=true) PESSIMISTE : la suppression locale ne se
  // fait qu'APRÈS un delete DB confirmé. Sélection canonique sur `done` (jamais un alias transitoire).
  const clearChecked = () => {
    Alert.alert('Retirer les articles du panier ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive', onPress: async () => {
          const ids = items.filter(i => i.done === true).map(i => i.id);
          if (!ids.length) return;
          const { error } = await supabase.from('shopping_items').delete().in('id', ids);
          if (!error) setItems(prev => prev.filter(i => !(i.done === true))); // retrait local APRÈS succès DB
          else Alert.alert('Suppression non effectuée', 'Réessaie.'); // lignes conservées (DB + local)
        },
      },
    ]);
  };

  // N6-15 (CR-04) : QUANTITÉ D'INTENTION COURSES. Stepper (jamais < 1). Write PESSIMISTE + verrou par
  // item : on écrit la DB D'ABORD, on ne met à jour l'UI qu'APRÈS succès DB → l'UI ne peut JAMAIS
  // diverger durablement (Q8 dur). Échec → l'UI reste sur la valeur confirmée précédente. Les +/- de
  // l'item sont désactivés tant qu'un write est en vol (pas de course, vérité > vitesse de tap). La
  // colonne DB reste string (bare int) : pas de migration. N'active AUCUN low-stock/score/quantité Stock.
  const updateQty = async (item, next) => {
    if (pendingQtyRef.current.has(item.id)) return; // verrou par item (ignore les taps pendant un write)
    const stored = toStoredShoppingQty(next);
    if (String(item.quantity) === stored) return; // no-op
    pendingQtyRef.current.add(item.id); forceTick(t => t + 1);
    const { error } = await supabase.from('shopping_items').update({ quantity: stored }).eq('id', item.id);
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: stored } : i)); // UI APRÈS succès
    else Alert.alert('Quantité non enregistrée', 'Réessaie.'); // UI reste sur la valeur confirmée
    pendingQtyRef.current.delete(item.id); forceTick(t => t + 1);
  };

  // N6-15 — HANDOFF COURSES → STOCK. Courses INITIE seulement : elle DEMANDE à App d'ouvrir le
  // FORMULAIRE MANUEL CANONIQUE (ScanScreen) préréempli. AUCUN items.insert ici, AUCUN writer Stock ici.
  // `done` (= « dans le panier ») n'entre PAS dans ce chemin (acte explicite distinct). La ligne
  // Courses n'est retirée qu'APRÈS un commit Stock confirmé/reconnu (App → cleanup → removedShoppingId).
  const handleSendToStock = (item) => {
    if (!onSendToStock || sendingRef.current.has(item.id)) return;
    Alert.alert('Ranger dans mon stock ?', `Tu vas confirmer « ${item.name} » dans ton stock (emplacement, quantité, date).`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Continuer', onPress: () => {
          if (sendingRef.current.has(item.id)) return; // double-tap
          sendingRef.current.add(item.id); forceTick(t => t + 1);
          // N6-15 : quantité Courses transmise en CONTEXTE D'AFFICHAGE UNIQUEMENT (normalisée via le
          // lecteur canonique). Elle ne prérègle JAMAIS la quantité Stock ni l'autorité (voir App/Scan).
          onSendToStock({ shoppingItemId: item.id, name: item.name, quantity: readShoppingQty(item.quantity) });
          sendingRef.current.delete(item.id); forceTick(t => t + 1);
        } },
    ]);
  };

  // N6-15 : partition depuis le champ CANONIQUE `done` (= « dans le panier »). Aucun fallback `checked`.
  const unchecked = items.filter(i => i.done !== true); // à acheter / restants
  const checked   = items.filter(i => i.done === true); // DANS LE PANIER

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

          {/* N6-12 (CR-10) : panneau « TU GASPILLES SOUVENT » + « + Liste » SUPPRIMÉ. Aucune reco d'achat
              dérivée d'un signal de gaspillage ; aucune revendication de fréquence non fondée. */}

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
            <View key={item.id}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                borderRadius: 14, padding: 14, marginBottom: 8, gap: 10,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06, shadowRadius: 6 }}>
              {/* N6-15 : SEULE la case à cocher EXPLICITE bascule `done` (dans le panier). Le reste de la
                  ligne (nom, quantité ±, handoff, delete) n'est PLUS un toggle → aucun geste ambigu, aucun
                  parent tappable vers lequel un tap quantité pourrait retomber. */}
              <TouchableOpacity onPress={() => toggleItem(item)}
                accessibilityRole="checkbox" accessibilityState={{ checked: item.done === true }}
                accessibilityLabel="Marquer comme dans le panier"
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 6 }} style={{ padding: 2 }}>
                <Circle size={22} color={C.t4} strokeWidth={1.8} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.t1 }}>{item.name}</Text>
              {/* N6-15 : stepper de quantité D'INTENTION (>=1), neutre, aucune unité. Désactivé pendant un write (pessimiste). */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pendingQtyRef.current.has(item.id) ? 0.4 : 1 }}>
                <TouchableOpacity onPress={() => updateQty(item, decShoppingQty(readShoppingQty(item.quantity)))} disabled={pendingQtyRef.current.has(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} style={{ padding: 2 }}>
                  <Minus size={15} color={C.t3} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={{ minWidth: 16, textAlign: 'center', fontSize: 14, fontWeight: '700', color: C.t2 }}>
                  {readShoppingQty(item.quantity)}
                </Text>
                <TouchableOpacity onPress={() => updateQty(item, incShoppingQty(readShoppingQty(item.quantity)))} disabled={pendingQtyRef.current.has(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} style={{ padding: 2 }}>
                  <Plus size={15} color={C.t3} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              {/* N6-15 : handoff EXPLICITE → writer Stock canonique. Secondaire, sans langage de possession. */}
              <TouchableOpacity onPress={() => handleSendToStock(item)} disabled={sendingRef.current.has(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={{ padding: 4, opacity: sendingRef.current.has(item.id) ? 0.4 : 1 }}
                accessibilityLabel={`Ajouter ${item.name} au stock`}>
                <PackagePlus size={18} color={C.green} strokeWidth={1.9} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ padding: 4 }}>
                <Trash2 size={16} color={C.t4} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
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
                <View key={item.id}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                    borderRadius: 14, padding: 14, marginBottom: 8, gap: 10, opacity: 0.55,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04, shadowRadius: 4 }}>
                  {/* N6-15 : SEULE la case cochée EXPLICITE retire du panier (done=false). Le reste de la
                      ligne n'est PLUS un toggle. */}
                  <TouchableOpacity onPress={() => toggleItem(item)}
                    accessibilityRole="checkbox" accessibilityState={{ checked: item.done === true }}
                    accessibilityLabel="Retirer du panier"
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 6 }} style={{ padding: 2 }}>
                    <CheckCircle2 size={22} color={C.green} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={{ flex: 1, fontSize: 15, color: C.t2,
                    textDecorationLine: 'line-through' }}>{item.name}</Text>
                  {/* Quantité d'intention visible (statique dans le panier), neutre. */}
                  {readShoppingQty(item.quantity) > 1 && (
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.t3 }}>{formatShoppingQty(item.quantity)}</Text>
                  )}
                  {/* Handoff explicite disponible aussi ici — DÉCOUPLÉ de `done` (panier ≠ acheté ≠ stock). */}
                  <TouchableOpacity onPress={() => handleSendToStock(item)} disabled={sendingRef.current.has(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={{ padding: 4, opacity: sendingRef.current.has(item.id) ? 0.4 : 1 }}
                    accessibilityLabel={`Ajouter ${item.name} au stock`}>
                    <PackagePlus size={18} color={C.green} strokeWidth={1.9} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ padding: 4 }}>
                    <Trash2 size={16} color={C.t4} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity onPress={clearChecked}
                style={{ alignItems: 'center', paddingVertical: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: C.red, fontWeight: '600' }}>
                  Retirer les articles du panier
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

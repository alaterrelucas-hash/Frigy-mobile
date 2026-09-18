import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Utensils, Trash2, ChevronRight, Check } from 'lucide-react-native';
import { useStockTheme } from '../../utils/stockTheme';
import { resolveFoodImage } from '../../utils/foodLanguage';
import { REMAINING_STOPS, isLevelSelectable, canSubmit, remainingLabel, causeVisible, sanitizeCauses } from '../../utils/stockUpdateSheetLogic';

// STOCK UPDATE SHEET (Mon Stock, production V2) — REMAINING-FIRST. UNE tâche, UNE surface, UNE validation.
//
// L'utilisateur assertit d'abord « combien en reste-t-il ? » (5 crans → remaining_level). La cause n'est
// demandée QUE si le reste = EMPTY (clôture), via deux bascules INDÉPENDANTES (utilisé / jeté) : les 4 états
// (f,f)(t,f)(f,t)(t,t) sont valides. Hors EMPTY, aucune cause n'est sollicitée ni envoyée. Aucune écriture au
// tap : la mutation canonique (apply_stock_update) part uniquement au CTA, gérée par l'OWNER (onConfirm).
// Ouvrir la sheet n'assertit rien : le baseline connu est montré comme ÉTAT COURANT, distinct d'une sélection.
export default function StockUpdateSheet({
  visible = false, item = null, fonts = {}, onConfirm, onNoChange, onViewProduct, onDismiss, submitting = false,
}) {
  const theme = useStockTheme();
  const baseline = item && item.remaining_level != null ? item.remaining_level : null; // ÉTAT COURANT (jamais une sélection)
  const [selected, setSelected] = useState(null);   // sélection EXPLICITE (null à l'ouverture — aucune assertion)
  const [used, setUsed] = useState(false);
  const [waste, setWaste] = useState(false);

  useEffect(() => { setSelected(null); setUsed(false); setWaste(false); }, [item, visible]);

  if (!item) return null;
  const prim = resolveFoodImage(item);
  const semibold = fonts.semibold;
  const regular = fonts.regular;

  // Choisir un niveau : hors EMPTY, on réinitialise les causes (aucune fuite d'état causal caché).
  const pick = (level) => {
    setSelected(level);
    const s = sanitizeCauses(level, used, waste);
    setUsed(s.usedDeclared); setWaste(s.wasteDeclared);
  };

  const showCause = causeVisible(selected);
  const enabled = canSubmit({ selectedLevel: selected, beforeLevel: baseline }) && !submitting;

  const submit = () => {
    if (!enabled) return;
    const c = sanitizeCauses(selected, used, waste); // garantit (f,f) hors EMPTY
    onConfirm?.({ remainingLevel: selected, usedDeclared: c.usedDeclared, wasteDeclared: c.wasteDeclared });
  };

  const CauseToggle = ({ value, onToggle, Icon, iconColor, label }) => (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}
      accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: 14, borderWidth: value ? 1.5 : 1, borderColor: value ? iconColor : theme.separator,
        backgroundColor: value ? theme.scopeContainerBg : theme.surface, marginBottom: 10 }}>
      <Icon size={21} color={iconColor} strokeWidth={2} />
      <Text style={{ flex: 1, fontFamily: semibold, fontSize: 16, fontWeight: '600', color: theme.text1 }}>{label}</Text>
      {/* case à cocher (multi-sélect, jamais radio) */}
      <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
        borderWidth: value ? 0 : 1.5, borderColor: theme.separator, backgroundColor: value ? iconColor : 'transparent' }}>
        {value && <Check size={15} color={theme.surface} strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingTop: 12, paddingBottom: 30, maxHeight: '90%' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.separator, alignSelf: 'center', marginBottom: 16 }} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 8 }}>
            {/* 1 · IDENTITÉ */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                {prim ? <Image source={prim.image} style={{ width: 52, height: 52 }} resizeMode="contain" accessibilityLabel={item.name} />
                  : <Text style={{ fontSize: 34 }}>{item.emoji || '🍽️'}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: semibold, fontSize: 19, fontWeight: '700', letterSpacing: -0.3, color: theme.text1 }} numberOfLines={1}>{item.name}</Text>
                {!!item.location && <Text style={{ fontFamily: regular, fontSize: 14, color: theme.text2, marginTop: 2 }}>{item.location}</Text>}
              </View>
            </View>

            {/* 2 · RESTE (question première) */}
            <Text style={{ fontFamily: semibold, fontSize: 21, fontWeight: '700', letterSpacing: -0.3, lineHeight: 27, color: theme.text1, marginBottom: 4 }}>
              Combien en reste-t-il ?
            </Text>
            <Text style={{ fontFamily: regular, fontSize: 15, color: theme.text2, lineHeight: 21, marginBottom: 16 }}>
              Une estimation suffit.
            </Text>

            {/* baseline explicite : « Actuellement … » (état courant, pas une sélection) */}
            {baseline != null && (
              <Text style={{ fontFamily: regular, fontSize: 13, color: theme.text3, marginBottom: 8 }}>
                Actuellement : {remainingLabel(baseline)}
              </Text>
            )}

            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
                <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, backgroundColor: theme.separator }} />
                {REMAINING_STOPS.map((s) => {
                  const disabled = !isLevelSelectable(s.level, baseline);
                  const sel = selected === s.level;
                  const isCurrent = selected == null && baseline === s.level; // état courant montré, non sélectionné
                  return (
                    <TouchableOpacity key={s.level} onPress={() => pick(s.level)} disabled={disabled} activeOpacity={0.8}
                      accessibilityRole="button" accessibilityLabel={s.voice + (isCurrent ? ', actuel' : '')} accessibilityState={{ selected: sel, disabled }}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                      <View style={{ width: sel ? 20 : 13, height: sel ? 20 : 13, borderRadius: 10,
                        backgroundColor: sel ? theme.accent : theme.surface,
                        borderWidth: sel ? 0 : (isCurrent ? 2 : 1.5), borderColor: isCurrent ? theme.text3 : theme.separator,
                        opacity: disabled ? 0.3 : 1 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', paddingHorizontal: 6, marginTop: 4 }}>
                {REMAINING_STOPS.map((s) => {
                  const disabled = !isLevelSelectable(s.level, baseline);
                  const sel = selected === s.level;
                  return (
                    <Text key={s.level} style={{ flex: 1, textAlign: 'center', fontFamily: sel ? semibold : regular,
                      fontSize: 13, fontWeight: sel ? '700' : '400', color: sel ? theme.accent : theme.text3, opacity: disabled ? 0.35 : 1 }}>
                      {s.label}
                    </Text>
                  );
                })}
              </View>
            </View>

            <Text style={{ fontFamily: semibold, fontSize: 15, fontWeight: '600', color: selected == null ? theme.text3 : theme.text1, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
              {selected == null ? 'Choisis ce qu’il reste' : remainingLabel(selected)}
            </Text>

            {/* 3 · CAUSE — seulement à la CLÔTURE (EMPTY). Bascules INDÉPENDANTES (jamais radio). */}
            {showCause && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontFamily: semibold, fontSize: 17, fontWeight: '700', color: theme.text1, marginBottom: 4 }}>
                  Qu’est-ce qui s’est passé ?
                </Text>
                <Text style={{ fontFamily: regular, fontSize: 14, color: theme.text2, marginBottom: 14 }}>
                  Tu peux choisir les deux, ou ne rien préciser.
                </Text>
                <CauseToggle value={used} onToggle={() => setUsed(v => !v)} Icon={Utensils} iconColor={theme.accent} label="J’en ai utilisé" />
                <CauseToggle value={waste} onToggle={() => setWaste(v => !v)} Icon={Trash2} iconColor={theme.critical} label="J’en ai jeté" />
              </View>
            )}

            {/* 4 · CTA UNIQUE — état désactivé NON ambigu (jamais un vert pastel « actif »). */}
            <TouchableOpacity onPress={submit} disabled={!enabled} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel="Mettre mon stock à jour" accessibilityState={{ disabled: !enabled }}
              style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8,
                backgroundColor: enabled ? theme.accent : theme.scopeContainerBg,
                borderWidth: enabled ? 0 : 1, borderColor: theme.separator }}>
              <Text style={{ fontFamily: semibold, fontSize: 16, fontWeight: '600', color: enabled ? theme.surface : theme.text3 }}>
                Mettre mon stock à jour
              </Text>
            </TouchableOpacity>

            {/* 5 · RIEN N'A CHANGÉ — no-op explicite (aucune mutation). */}
            <TouchableOpacity onPress={onNoChange} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Rien n’a changé"
              style={{ alignSelf: 'center', marginTop: 14, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 999,
                borderWidth: 1, borderColor: theme.separator, backgroundColor: theme.scopeContainerBg }}>
              <Text style={{ fontFamily: semibold, fontSize: 15, fontWeight: '600', color: theme.text2 }}>Rien n’a changé</Text>
            </TouchableOpacity>

            {/* 6 · VOIR LA FICHE — aucune mutation. */}
            <TouchableOpacity onPress={onViewProduct} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Voir la fiche produit"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 12, marginTop: 2 }}>
              <Text style={{ fontFamily: regular, fontSize: 14, color: theme.text3 }}>Voir la fiche produit</Text>
              <ChevronRight size={15} color={theme.text3} strokeWidth={2} />
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

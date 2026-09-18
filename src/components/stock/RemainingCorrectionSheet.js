import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useStockTheme } from '../../utils/stockTheme';
import { CORRECTION_STOPS, remainingLabel } from '../../utils/stockUpdateSheetLogic';

// RESTE ESTIMÉ — CORRECTION directe depuis la fiche produit. C'est une ASSERTION D'ÉTAT COURANT
// (set_approximate_remaining_level → CORRECTED), JAMAIS un USED/WASTED : ne consomme rien, ne gaspille
// rien, ne clôt pas la ligne. Niveaux directs = QUARTER/HALF/THREE_QUARTERS/FULL (EMPTY EXCLU — « vide »
// exige la causalité USED/WASTED via la mise à jour de stock). Tout sens autorisé (pas de monotonicité).
export default function RemainingCorrectionSheet({
  visible = false, item = null, fonts = {}, onConfirm, onGoToUpdate, onDismiss, submitting = false,
}) {
  const theme = useStockTheme();
  const current = item && item.remaining_level != null ? item.remaining_level : null;
  const [level, setLevel] = useState(current === 'EMPTY' ? null : current);
  useEffect(() => {
    const c = item && item.remaining_level != null ? item.remaining_level : null;
    setLevel(c === 'EMPTY' ? null : c);
  }, [item, visible]);
  if (!item) return null;
  const semibold = fonts.semibold;
  const regular = fonts.regular;
  const enabled = level != null && !submitting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.separator, alignSelf: 'center', marginBottom: 18 }} />

          <Text style={{ fontFamily: semibold, fontSize: 21, fontWeight: '700', letterSpacing: -0.3, color: theme.text1, marginBottom: 4 }}>
            Reste estimé
          </Text>
          <Text style={{ fontFamily: regular, fontSize: 15, color: theme.text2, lineHeight: 21, marginBottom: 18 }}>
            Corrige simplement ce qu’il reste. Une estimation suffit.
          </Text>

          {/* 4 niveaux (Vide exclu). Ligne fine + repères, cohérent avec la mise à jour. */}
          <View style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
              <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, backgroundColor: theme.separator }} />
              {CORRECTION_STOPS.map((s) => {
                const sel = level === s.level;
                return (
                  <TouchableOpacity key={s.level} onPress={() => setLevel(s.level)} activeOpacity={0.8}
                    accessibilityRole="button" accessibilityLabel={s.voice} accessibilityState={{ selected: sel }}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                    <View style={{ width: sel ? 20 : 13, height: sel ? 20 : 13, borderRadius: 10,
                      backgroundColor: sel ? theme.accent : theme.surface, borderWidth: sel ? 0 : 1.5, borderColor: theme.separator }} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', paddingHorizontal: 6, marginTop: 4 }}>
              {CORRECTION_STOPS.map((s) => {
                const sel = level === s.level;
                return (
                  <Text key={s.level} style={{ flex: 1, textAlign: 'center', fontFamily: sel ? semibold : regular,
                    fontSize: 13, fontWeight: sel ? '700' : '400', color: sel ? theme.accent : theme.text3 }}>{s.label}</Text>
                );
              })}
            </View>
          </View>

          <Text style={{ fontFamily: semibold, fontSize: 15, fontWeight: '600', color: level == null ? theme.text3 : theme.text1, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
            {remainingLabel(level)}
          </Text>

          <TouchableOpacity onPress={() => enabled && onConfirm?.(level)} disabled={!enabled} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel="Enregistrer le reste estimé" accessibilityState={{ disabled: !enabled }}
            style={{ borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: theme.accent, opacity: enabled ? 1 : 0.4 }}>
            <Text style={{ fontFamily: semibold, fontSize: 16, fontWeight: '600', color: theme.surface }}>Enregistrer</Text>
          </TouchableOpacity>

          {/* Sortie « il n'en reste plus » → renvoie vers la mise à jour (USED/WASTED → EMPTY), jamais une
              correction EMPTY silencieuse (règle DB : EMPTY passe par la causalité). */}
          <TouchableOpacity onPress={onGoToUpdate} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Il n’en reste plus, mettre mon stock à jour"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 12, marginTop: 6 }}>
            <Text style={{ fontFamily: regular, fontSize: 14, color: theme.text3 }}>Il n’en reste plus</Text>
            <ChevronRight size={15} color={theme.text3} strokeWidth={2} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

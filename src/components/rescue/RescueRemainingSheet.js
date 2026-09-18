import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { useStockTheme } from '../../utils/stockTheme';
import { resolveFoodImage } from '../../utils/foodLanguage';

// RESCUE — ÉTAPE 2 : « combien en reste-t-il ? ». Une SEULE mesure d'inventaire (le RESTANT), jamais deux
// répartitions simultanées. L'événement (USED/DISCARDED) a été choisi à l'étape 1 ; le delta = BEFORE − AFTER
// lui est attribué. DEUX modes explicites (fournis par l'owner, jamais devinés d'après le nom) :
//   COUNT   → sélecteur d'entier (0 … previousRemaining), précision EXACT possible.
//   FRACTION → jauge DISCRÈTE 5 crans (0 / ¼ / ½ / ¾ / plein), toujours APPROXIMATE (« environ »), jamais un %.
// Contrainte de vérité : AFTER ≤ BEFORE (on ne peut pas « retrouver » du stock ici). PRÉSENTATIONNEL : aucun
// import Supabase / coordinateur ; onConfirm(after) est câblé plus tard par un owner. Aucun argent, aucun %.
const FRACTION_STOPS = [
  { value: 0, label: 'Vide', human: 'Vide' },
  { value: 0.25, label: '¼', human: 'Environ 1/4' },
  { value: 0.5, label: 'Moitié', human: 'Environ la moitié' },
  { value: 0.75, label: '¾', human: 'Environ 3/4' },
  { value: 1, label: 'Plein', human: 'Plein' },
];

export default function RescueRemainingSheet({
  visible = false, item = null, quantityMode = 'COUNT', previousRemaining = 1, outcomeType = 'USED',
  fonts = {}, onConfirm, onBack, onDismiss,
}) {
  const theme = useStockTheme();
  const isFraction = quantityMode === 'FRACTION';
  // Défaut = état courant (previousRemaining) ; l'utilisateur DIMINUE. onConfirm ne reçoit que AFTER ≤ BEFORE.
  const [after, setAfter] = useState(previousRemaining);
  if (!item) return null;
  const prim = resolveFoodImage(item);
  const semibold = fonts.semibold;
  const regular = fonts.regular;

  const question = 'Combien en reste-t-il ?';
  const support = isFraction ? 'Choisis à peu près ce qu’il reste.' : 'Mets simplement le nombre à jour.';
  const humanAfter = isFraction
    ? (FRACTION_STOPS.find((s) => s.value === after)?.label || '')
    : `${after} restant${after > 1 ? 's' : ''}`;

  // COUNT : options entières 0 … previousRemaining (AFTER ≤ BEFORE, jamais négatif, jamais au-dessus).
  const countMax = Math.max(0, Math.round(previousRemaining));
  const dec = () => setAfter((a) => Math.max(0, a - 1));
  const inc = () => setAfter((a) => Math.min(countMax, a + 1));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.separator, alignSelf: 'center', marginBottom: 12 }} />

          {/* Retour vers l'étape 1 (navigation) — seule flèche autorisée ici. */}
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Retour"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 }}>
            <ChevronLeft size={18} color={theme.text2} strokeWidth={2} />
            <Text style={{ fontFamily: regular, fontSize: 14, color: theme.text2 }}>Retour</Text>
          </TouchableOpacity>

          {/* Identité compacte (rappel). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              {prim ? <Image source={prim.image} style={{ width: 44, height: 44 }} resizeMode="contain" accessibilityLabel={item.name} />
                : <Text style={{ fontSize: 30 }}>{item.emoji || '🍽️'}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: semibold, fontSize: 17, fontWeight: '700', color: theme.text1 }} numberOfLines={1}>{item.name}</Text>
              {!!item.location && <Text style={{ fontFamily: regular, fontSize: 13, color: theme.text2, marginTop: 1 }}>{item.location}</Text>}
            </View>
          </View>

          {/* Question RESTANT (jamais « quel % as-tu consommé ? »). */}
          <Text style={{ fontFamily: semibold, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28, color: theme.text1, marginBottom: 6 }}>
            {question}
          </Text>
          <Text style={{ fontFamily: regular, fontSize: 15, fontWeight: '400', color: theme.text2, lineHeight: 21, marginBottom: 22 }}>
            {support}
          </Text>

          {isFraction ? (
            /* CONTRÔLE LINÉAIRE DISCRET — 5 positions sur une LIGNE FINE (pas 5 cards, pas de slider 0→100).
               La valeur snappe TOUJOURS sur un des 5 crans (Vide/¼/½/¾/Plein). Sélection = repère accent. AFTER ≤
               BEFORE (crans au-dessus du restant précédent désactivés). Aucun pourcentage, langage « environ ». */
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
                {/* ligne fine continue derrière les repères */}
                <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, backgroundColor: theme.separator }} />
                {FRACTION_STOPS.map((s) => {
                  const disabled = s.value > previousRemaining + 1e-9;
                  const selected = after === s.value;
                  return (
                    <TouchableOpacity key={s.value} onPress={() => setAfter(s.value)} disabled={disabled} activeOpacity={0.8}
                      accessibilityRole="button" accessibilityLabel={s.human}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                      <View style={{ width: selected ? 20 : 13, height: selected ? 20 : 13, borderRadius: 10,
                        backgroundColor: selected ? theme.accent : theme.surface,
                        borderWidth: selected ? 0 : 1.5, borderColor: theme.separator, opacity: disabled ? 0.35 : 1 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* labels des 5 crans — actif légèrement accentué */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 6, marginTop: 4 }}>
                {FRACTION_STOPS.map((s) => {
                  const disabled = s.value > previousRemaining + 1e-9;
                  const selected = after === s.value;
                  return (
                    <Text key={s.value} style={{ flex: 1, textAlign: 'center', fontFamily: selected ? semibold : regular,
                      fontSize: 13, fontWeight: selected ? '700' : '400', color: selected ? theme.accent : theme.text3, opacity: disabled ? 0.4 : 1 }}>
                      {s.label}
                    </Text>
                  );
                })}
              </View>
            </View>
          ) : (
            /* COUNT — stepper entier « − N + », borné [0, previousRemaining]. Affiche « N sur {réf} ». */
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 10 }}>
              <TouchableOpacity onPress={dec} disabled={after <= 0} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Un de moins"
                style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: theme.separator, alignItems: 'center', justifyContent: 'center', opacity: after <= 0 ? 0.35 : 1 }}>
                <Minus size={22} color={theme.text1} strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center', minWidth: 70 }}>
                <Text style={{ fontFamily: semibold, fontSize: 30, fontWeight: '800', color: theme.text1 }}>{after}</Text>
                <Text style={{ fontFamily: regular, fontSize: 13, color: theme.text3, marginTop: 2 }}>sur {countMax}</Text>
              </View>
              <TouchableOpacity onPress={inc} disabled={after >= countMax} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Un de plus"
                style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: theme.separator, alignItems: 'center', justifyContent: 'center', opacity: after >= countMax ? 0.35 : 1 }}>
                <Plus size={22} color={theme.text1} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          )}

          {/* Valeur sélectionnée — simplement le mot (jamais un %, pas de capsule « Il reste : … »). */}
          <Text style={{ fontFamily: semibold, fontSize: 15, fontWeight: '600', color: theme.text1, textAlign: 'center', marginBottom: 20 }}>
            {humanAfter}
          </Text>

          {/* Confirmation — met à jour le stock (DEV : onConfirm reçoit AFTER ; aucune écriture ici). */}
          <TouchableOpacity onPress={() => onConfirm?.({ outcomeType, before: previousRemaining, after, mode: quantityMode })}
            activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Mettre mon stock à jour"
            style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: theme.accent }}>
            <Text style={{ fontFamily: semibold, fontSize: 16, fontWeight: '600', color: theme.surface }}>Mettre mon stock à jour</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { View, Text, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Utensils, Trash2, ChevronRight } from 'lucide-react-native';
import { useStockTheme } from '../../utils/stockTheme';
import { resolveFoodImage } from '../../utils/foodLanguage';

// RESCUE OUTCOME SHEET (Frigy 2027) — surface de RÉCONCILIATION dédiée. UN SEUL rôle : demander
// explicitement ce qu'est devenu un produit que Frigy suivait. Ce N'EST PAS une fiche produit, ni une
// page conservation, ni un éditeur de stock, ni une page recette/impact/courses, ni un écran de
// célébration. Décision : Utilisé | Jeté | Toujours chez moi.
//
// PRÉSENTATIONNEL UNIQUEMENT : aucun import Supabase, aucun coordinateur de consommation. Les callbacks
// (onUsed/onDiscarded/onStillHere) sont fournis par un OWNER qui câblera plus tard l'écriture canonique
// (whole-line / cohorte représentée — jamais de décrément partiel tant que l'autorité de quantité est
// UNKNOWN). Le dismiss (backdrop/swipe) N'ÉCRIT RIEN : l'utilisateur n'a pas répondu.
//
// COULEUR = FONCTION, jamais jugement moral : pas de grand panneau vert « bien » / rouge « mal ». Rangées
// neutres identiques (surface + separator) ; l'icône porte la fonction (accent = utilisé, critical = jeté,
// tokens EXISTANTS, en petit). Aucun hex legacy, aucun nouveau token. Aucun montant/CO₂. Aucun rachat.
export default function RescueOutcomeSheet({
  visible = false, item = null, fonts = {}, onUsed, onDiscarded, onNoChange, onViewProduct, onDismiss,
}) {
  const theme = useStockTheme();
  if (!item) return null;
  const prim = resolveFoodImage(item);
  const semibold = fonts.semibold;
  const regular = fonts.regular;

  // Rangée d'issue TERMINALE : tap = exécute l'action, ne navigue pas → AUCUN chevron. Rangées identiques
  // (même surface/bord/géométrie) ; seule l'icône (couleur = fonction) distingue Utilisé de Jeté.
  const OutcomeRow = ({ Icon, iconColor, label, onPress }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18,
        borderRadius: 16, borderWidth: 1, borderColor: theme.separator, backgroundColor: theme.surface, marginBottom: 12 }}>
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <Text style={{ flex: 1, fontFamily: semibold, fontSize: 17, fontWeight: '600', color: theme.text1 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      {/* Backdrop inerte : tap = DISMISS (aucune mutation). La nav de l'app reste en fond, dimmée. */}
      <Pressable onPress={onDismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34 }}>
          {/* Poignée (drag handle) cohérente avec les sheets Frigy existantes. */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.separator, alignSelf: 'center', marginBottom: 20 }} />

          {/* 1 · IDENTITÉ produit — juste assez pour reconnaître. Aucune claim temporelle, aucun badge « SUIVI ». */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              {prim
                ? <Image source={prim.image} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel={item.name} />
                : <Text style={{ fontSize: 38 }}>{item.emoji || '🍽️'}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: semibold, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: theme.text1 }} numberOfLines={1}>
                {item.name}
              </Text>
              {!!item.location && (
                <Text style={{ fontFamily: regular, fontSize: 14, fontWeight: '400', color: theme.text2, marginTop: 2 }}>
                  {item.location}
                </Text>
              )}
            </View>
          </View>

          {/* 2 · QUESTION — sujet sémantique principal. Formulation SANS genre grammatical (marche pour tout aliment). */}
          <Text style={{ fontFamily: semibold, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28, color: theme.text1, marginBottom: 6 }}>
            Où en est ce produit ?
          </Text>
          <Text style={{ fontFamily: regular, fontSize: 15, fontWeight: '400', color: theme.text2, lineHeight: 21, marginBottom: 20 }}>
            Dis-moi simplement ce qui a changé.
          </Text>

          {/* 3 · DEUX ISSUES (aucun chevron) — icône = fonction, jamais jugement moral. Réconciliation PARTIELLE
              (V1 CORE) : « J'en ai utilisé/jeté » = un ÉVÉNEMENT s'est produit → l'étape 2 demande ce qu'il
              RESTE (compte entier ou jauge fraction). Sans genre. Utilisé et Jeté restent deux types distincts. */}
          <OutcomeRow Icon={Utensils} iconColor={theme.accent} label="J’en ai utilisé" onPress={onUsed} />
          <OutcomeRow Icon={Trash2} iconColor={theme.critical} label="J’en ai jeté" onPress={onDiscarded} />

          {/* 4 · TERTIAIRE — AUCUNE écriture, inventaire inchangé. « Rien n'a changé » (et non « Il m'en reste » :
              avec la réconciliation partielle, un usage partiel PEUT coexister avec du stock restant → « Il m'en
              reste » n'est plus une issue mutuellement exclusive). Bouton GHOST compact, aucun chevron/icône. */}
          <TouchableOpacity onPress={onNoChange} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Rien n’a changé"
            style={{ alignSelf: 'center', marginTop: 4, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 999,
              borderWidth: 1, borderColor: theme.separator, backgroundColor: theme.scopeContainerBg }}>
            <Text style={{ fontFamily: semibold, fontSize: 15, fontWeight: '600', color: theme.text2 }}>Rien n’a changé</Text>
          </TouchableOpacity>

          {/* 5 · NAVIGATION — SEULE action qui ouvre une autre surface → SEUL chevron autorisé. */}
          <TouchableOpacity onPress={onViewProduct} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Voir la fiche produit"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 12, marginTop: 4 }}>
            <Text style={{ fontFamily: regular, fontSize: 14, fontWeight: '400', color: theme.text3 }}>Voir la fiche produit</Text>
            <ChevronRight size={15} color={theme.text3} strokeWidth={2} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

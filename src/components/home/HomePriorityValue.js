import { View, Text } from 'react-native';
import { formatEuro } from '../../utils/rescueValue';

// « CE QUE ÇA VAUT » — CONTEXTE économique du produit prioritaire COURANT. Bloc SECONDAIRE, sous la
// Watch (hiérarchie : priorité → action → watch → valeur). Éditorial / domestique / humain : eyebrow +
// montant + phrase courte, alignés à gauche, posés sur une surface tonale TRÈS subtile (à peine
// différente du fond → ancre douce, intégrée à la page). JAMAIS une card KPI / widget fintech / insight
// IA : aucun gradient, aucune icône, aucun mascotte, aucune 2e image, aucun bord fort, aucune ombre,
// aucun graphique, aucun CTA. Aucune copie nutrition/coaching.
//
// AUTORITÉ (inchangée) : CONFIRMED = montant autorisé (formatEuro non-null) → bloc affiché ; UNKNOWN =
// aucun montant → le bloc DISPARAÎT (return null, aucun placeholder). On dit ce que le nombre VAUT et
// pourquoi ça compte : la perte est un RISQUE (« tu risques de perdre »), jamais une certitude ; jamais
// « économisé »/« à préserver »/« à sauver »/« tu vas perdre »/« tu vas économiser ». Ce n'est PAS le
// futur plan IMPACT (valeur produite dans le temps) : c'est la valeur de CE produit maintenant.
export default function HomePriorityValue({ item, theme, fonts }) {
  if (!item) return null;
  const amount = formatEuro(item.rescueValue);
  if (!amount) return null; // UNKNOWN → bloc absent, la mise en page se replie naturellement

  return (
    // Le bloc POSSÈDE sa respiration : marginTop (~20, depuis le héros) + marginBottom (~28, avant la
    // Watch — un peu plus large : clôt l'histoire du produit COURANT, ouvre la suivante). Quand la valeur
    // est UNKNOWN, le composant renvoie null → les DEUX marges disparaissent avec lui (AUCUN espace
    // fantôme, aucun slot réservé). Surface = separatorSubtle (#ECE8E2) : teinte chaude À PEINE différente
    // du canvas (#FAFBF2) → zone éditoriale groupée, PAS une card/widget. Radius 12, aucun bord/ombre/gradient.
    <View style={{ marginTop: 20, marginBottom: 28, marginHorizontal: 20, backgroundColor: theme.separatorSubtle, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 16 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 0.9, color: theme.text3 || theme.text2, marginBottom: 8 }}>
        CE QUE ÇA VAUT
      </Text>
      {/* Montant = ancre du bloc, TEXTE SOMBRE (jamais vert : couleur = information). Plus grand que le
          corps, mais pas plus que le titre produit prioritaire (28). Format € canonique (sans espace). */}
      <Text accessibilityLabel={`Valeur : ${amount}`}
        style={{ fontFamily: fonts.semibold, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, color: theme.text1, marginBottom: 6 }}>
        {amount}
      </Text>
      {/* Montant RÉINJECTÉ depuis le même `amount` autorisé (jamais codé en dur). Perte = RISQUE. */}
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text2, lineHeight: 20 }}>
        Si tu ne l'utilises pas à temps, c'est {amount} que tu risques de perdre.
      </Text>
    </View>
  );
}

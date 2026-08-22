import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, Modal, Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { resolveFoodImage } from '../../utils/foodLanguage';
import { selectAffinityCandidates } from '../../utils/homeAffinities';
import HomePriorityFocus from './HomePriorityFocus';
import HomeGathering from './HomeGathering';
import HomeIdeaTonight from './HomeIdeaTonight';

// LOW_STOCK — révélation progressive : compose UNIQUEMENT à partir des SIGNALS réels (jamais
// de priorité/recette inventée), en réutilisant les blocs de la Home Active. L'utilisateur ne
// perçoit jamais « LOW STOCK » : Frigy parle d'abord de CE QU'IL SAIT, pas de ce qui lui manque.
//
// Densité visuelle ∝ densité d'intelligence réelle : LOW A = POSSESSION · LOW B = ATTENTION ·
// LOW C = TRANSFORMATION. Aucun CTA d'ajout (le « + » global s'en charge). Aucune phrase qui
// réclame des données. « Ajouter aux courses » (HomeIdeaTonight) = contextuel au manque → gardé.
export default function HomeLowStock({
  items = [], priority, gatheringItems = [], selectedRecipe, missingItems = [], overline,
  signals = {}, theme, fonts, onItemPress, onOpenRecipe, onShopping, onConfirmHave,
}) {
  const { priorityAvailable, recipeAvailable } = signals;
  const SCREEN_W = Dimensions.get('window').width;

  // « Confirmation Intelligente » (LOW A) — état de SESSION uniquement (jamais persisté) :
  //   confirmed = candidats validés « Je l'ai » · rejected = trios écartés « Aucun de ceux-là »
  //   rounds = nb de sets proposés (cap MAX_SETS pour ne jamais harceler l'utilisateur).
  const MAX_SETS = 3;
  const [confirmed, setConfirmed] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [rounds, setRounds] = useState(0);
  const [sheetCand, setSheetCand] = useState(null); // candidat en cours de confirmation (sheet)
  const [qty, setQty] = useState(1);
  const openSheet = (c) => { setQty(1); setSheetCand(c); };
  // Confirmation : ajout RÉEL délégué à onConfirmHave (prod : insert Supabase + recompute) ;
  // retrait optimiste local du module (marche aussi en QA où le stock est une fixture statique).
  const confirmHave = (c, quantity) => {
    onConfirmHave?.(c, { quantity });
    setConfirmed((p) => (p.includes(c.key) ? p : [...p, c.key]));
    setSheetCand(null);
  };
  const rejectSet = (candKeys) => {
    setRejected((p) => [...new Set([...p, ...candKeys])]);
    setRounds((r) => r + 1);
  };

  return (
    <View>
      {/* ── ATTENTION (LOW B/C) : priorité réelle (item ≤ 4 j) — bloc Active réutilisé tel quel,
          halo priorité légitime. Aucun texte ajouté sous la priorité : elle se suffit. ── */}
      {priorityAvailable && (
        <HomePriorityFocus item={priority} theme={theme} fonts={fonts} onPress={() => onItemPress?.(priority)} />
      )}

      {/* ── TRANSFORMATION (LOW C) : recette réellement disponible → Relier → Transformer. ── */}
      {recipeAvailable && (
        <>
          <HomeGathering items={gatheringItems} theme={theme} fonts={fonts} />
          <HomeIdeaTonight recipe={selectedRecipe} missing={missingItems} overline={overline}
            theme={theme} fonts={fonts} onOpenRecipe={onOpenRecipe} onShopping={onShopping} />
        </>
      )}

      {/* ── POSSESSION (LOW A) : aucun signal riche → « voici ce que tu as ». Le(s) produit(s)
          réel(s) sont le protagoniste, traités en composition éditoriale Food Language (pas une
          vignette, pas une card, aucun halo — non urgent). Info secondaire = location RÉELLE
          (item.location) si connue, jamais inventée. Aucune phrase qui parle des besoins de Frigy. ── */}
      {!priorityAvailable && !recipeAvailable && (() => {
        const one = items[0];
        const primary = one ? resolveFoodImage(one) : null;
        // Protagoniste produit : l'image est dimensionnée à sa MORPHOLOGIE réelle (ratio Food
        // Language), pas dans une boîte carrée qui la ferait « flotter » (le riz, ratio 2.54,
        // ne remplissait que ~39 % d'un carré 180 → aspect vignette). Box-fit en préservant
        // l'aspect : présence par l'ÉCHELLE + la COMPOSITION, jamais un halo. Robuste pour tout
        // produit (les assets hauts, ratio < 1, deviennent hauteur-bound au lieu de déborder).
        // Protagoniste produit sizé à sa MORPHOLOGIE réelle (ratio Food Language), box-fit dans
        // une boîte large : présence par l'ÉCHELLE + la COMPOSITION, jamais un halo. Le riz est
        // large et bas (2.54) → grande masse horizontale sous le texte. BOX_H plafonne les assets
        // hauts (ratio < 1, ex. bouteilles) pour qu'ils ne débordent jamais en composition empilée.
        const r = primary?.ratio || 1;
        // Rice en composition DROITE de la surface contexte (texte à GAUCHE, rice bas-droite), partageant
        // la surface — pas un bloc vertical pleine largeur. Largeur ~52 % de la largeur interne surface
        // (SCREEN_W − 2×16 marge − 2×22 pad), plafonnée 200 ; hauteur bornée 120 pour les assets hauts
        // (ratio<1). Contain (jamais croppé), aucun fond/ombre. Le rice reste contexte (« déjà connu »).
        const RW = Math.min(Math.round((SCREEN_W - 76) * 0.52), 200);
        let iw = RW, ih = RW / r;
        if (ih > 120) { ih = 120; iw = 120 * r; }
        const product = items.length === 1 ? (
          // Composition CONTEXTE : identité texte à GAUCHE (JE CONNAIS DÉJÀ / nom / location), rice à
          // DROITE, alignée en bas → texte + matière partagent une seule scène horizontale.
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 8 }}>
                JE CONNAIS DÉJÀ
              </Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 24, fontWeight: '700', letterSpacing: -0.4, lineHeight: 30, color: theme.text1 }} numberOfLines={2}>
                {one.name}
              </Text>
              {!!one.location && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, fontWeight: '400', color: theme.text2, marginTop: 6 }}>
                  {one.location}
                </Text>
              )}
            </View>
            {primary
              ? <Image source={primary.image} style={{ width: iw, height: ih, alignSelf: 'flex-end' }} resizeMode="contain" accessibilityLabel={one.name} />
              : <Text style={{ fontSize: 96 }}>{one.emoji || '🛒'}</Text>}
          </View>
        ) : (
          <View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 14 }}>
              JE CONNAIS DÉJÀ
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {items.slice(0, 3).map((it) => {
                const prim = resolveFoodImage(it);
                return (
                  <TouchableOpacity key={it.id || it.name} activeOpacity={0.7} onPress={() => onItemPress?.(it)}
                    style={{ alignItems: 'center', marginRight: 22, marginBottom: 10 }}>
                    <View style={{ width: 108, height: 108, alignItems: 'center', justifyContent: 'center' }}>
                      {prim
                        ? <Image source={prim.image} style={{ width: 100, height: 100 }} resizeMode="contain" />
                        : <Text style={{ fontSize: 56 }}>{it.emoji || '🛒'}</Text>}
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text2, marginTop: 4, maxWidth: 116, textAlign: 'center' }}>
                      {it.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
        // « Confirmation Intelligente » : candidats déterministes (dataset d'affinités curé),
        // excluant stock / confirmés / rejetés. [] → module masqué (fallback voix), jamais d'aléatoire.
        const candidates = selectAffinityCandidates(items, { excludeKeys: [...confirmed, ...rejected] });
        const showModule = candidates.length > 0 && rounds < MAX_SETS;
        const CELL = (SCREEN_W - 40 - 24) / 3; // CANVAS OUVERT : gouttière 20 chaque côté + 2 gaps de 12
        return (
          // BALANCE (« ouvert par défaut, contenir avec intention ») : LOW a DEUX moments sémantiques.
          //   CONTEXTE FRIGY (pourquoi + ce qu'il connaît déjà) → UNE surface tonale COMPACTE.
          //   ACTION UTILISATEUR (candidats + réponses) → CANVAS OUVERT.
          // Le greeting reste dehors (HomeScreen). Le contraste contenu → ouvert EST l'architecture (aucun
          // 2e surface, aucun halo). L'ancien HALO threshold et l'ancienne surface pleine-tâche sont retirés.
          <View>
            {/* CONTEXTE FRIGY — surface tonale COMPACTE : accentSoft (token Halo, aucun nouveau vert), radius
                28, AUCUNE ombre, AUCUN bord (le fond tonal suffit) ; marge externe 16, padding interne 22.
                S'ARRÊTE après le produit connu. marginTop 18 → ~26px depuis « Bonjour Lucas ». */}
            <View style={{ marginHorizontal: 16, marginTop: 18, backgroundColor: theme.accentSoft,
              borderRadius: 28, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 22 }}>
              {showModule && (
                // SUJET / BUT LOW = « Aide-moi à mieux connaître ton stock » — décrit la TÂCHE d'acquisition de
                // connaissance (pourquoi Frigy demande), pas un manque réel. Typographie FAMILLE Calm (Source
                // Sans 3, 29/700, vert accent, lineHeight 34), 2 lignes. marginBottom 28 → sépare de « JE CONNAIS
                // DÉJÀ ». Gaté showModule (sans candidats → fallback « Je garde ça en tête. »).
                <Text style={{ fontFamily: fonts.semibold, fontSize: 29, fontWeight: '700', letterSpacing: -0.4, lineHeight: 34, color: theme.accent, marginBottom: 28 }}>
                  Aide-moi à mieux connaître{'\n'}ton stock
                </Text>
              )}
              {product}
            </View>

            {showModule ? (
              // ACTION UTILISATEUR — CANVAS OUVERT (hors surface) : question d'action + 3 candidats Food
              // Language + « J'en ai » (contrôles) + sortie. Gouttière page 20. marginTop 30 = passage
              // surface → ouvert (~28–36px). Aucune card candidat, aucun fond, aucun séparateur.
              <View style={{ marginTop: 30 }}>
                {/* QUESTION D'ACTION attachée aux 3 candidats (référent immédiat en dessous). SUBORDONNÉE au
                    titre vert : texte sombre, ~21/600, ni majuscules ni vert ni card. */}
                <Text style={{ fontFamily: fonts.semibold, fontSize: 21, fontWeight: '600', letterSpacing: -0.2, lineHeight: 27, color: theme.text1, paddingHorizontal: 20, marginBottom: 14 }}>
                  Tu as aussi l’un de ceux-là ?
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
                  {candidates.map((c) => {
                    const cr = c.ratio || 1;
                    let iw = CELL, ih = CELL / cr;
                    if (ih > 84) { ih = 84; iw = 84 * cr; }
                    if (iw > CELL) { iw = CELL; ih = CELL / cr; }
                    return (
                      <View key={c.key} style={{ width: CELL, alignItems: 'center' }}>
                        <View style={{ height: 88, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Image source={c.image} style={{ width: iw, height: ih }} resizeMode="contain" accessibilityLabel={c.name} />
                        </View>
                        {/* nom adouci (poids regular) → le module domine, pas chaque nom ; collé à
                            son image (8→6) : image + nom + « Je l'ai » = une petite unité. */}
                        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text1, marginTop: 6, maxWidth: CELL, textAlign: 'center' }}>
                          {c.name}
                        </Text>
                        {/* CTA « J'en ai » — chip SECONDAIRE explicitement tappable (contour + surface
                            très légère, jamais un bouton vert plein) : l'affordance doit être évidente
                            sans dominer l'image. Icône Plus canonique (lucide) + libellé « J'en ai »
                            (valide pour Œufs/Oignon/Tomates). Ouvre la feuille de confirmation
                            canonique (aucune écriture ici). Hit-area ≥44pt via hitSlop. */}
                        <TouchableOpacity onPress={() => openSheet(c)} activeOpacity={0.7}
                          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                          accessibilityRole="button" accessibilityLabel={`${c.name}, j'en ai`}
                          style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
                            borderWidth: 1, borderColor: theme.separator, backgroundColor: theme.surface,
                            borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                          <Plus size={14} color={theme.accent} strokeWidth={2.4} />
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.accent }}>J'en ai</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                {/* Réponse explicite « je n'ai aucun » — action tertiaire, PLUS DISCRÈTE que chaque
                    chip « J'en ai » (texte neutre text2, sans contour/vert) : quieter, sans culpabilité
                    ni warning. Comportement sous-jacent INCHANGÉ (rejectSet → set suivant). */}
                <TouchableOpacity onPress={() => rejectSet(candidates.map((c) => c.key))} activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                  accessibilityRole="button" accessibilityLabel="Je n'ai aucun de ceux-là"
                  style={{ alignSelf: 'center', marginTop: 22, backgroundColor: theme.surface,
                    borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text2 }}>Je n'ai aucun de ceux-là</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Fallback (aucun candidat fiable / sets épuisés) : état LOW A minimal, calme.
              // ACKNOWLEDGEMENT (pas un CTA) — Frigy confirme une valeur ACQUISE, sans rien réclamer.
              <Text style={{ fontFamily: fonts.regular, fontSize: 16, fontWeight: '400', color: theme.text2, lineHeight: 22, paddingHorizontal: 20, marginTop: 28 }}>
                Je garde ça en tête.
              </Text>
            )}

            {/* AUTONOMY HINT — ÉDUCATION (pas du remplissage) : Frigy ne propose jamais TOUT le foyer → il
                apprend à l'utilisateur qu'il peut ajouter le reste lui-même via le + GLOBAL (nav). Complète
                la boucle LOW (connu → suggestions → ajout autonome). Sur CANVAS OUVERT (aucune card), gaté par
                LOW lui-même (aucun tracking « vu »). NON interactif : le + réel est le bouton de la nav — ici
                aucun 2e CTA, aucune flèche. Copie VÉRIFIÉE : le + ouvre ScanScreen qui expose scan code-barres
                (gratuit), photo (Pro) et saisie manuelle (gratuit) → « Photo, scan ou ajout manuel » est vrai.
                Séparateur subtil (separatorSubtle) = changement de rôle (réponse suggérée → ajout autonome). */}
            <View style={{ marginTop: 34, paddingHorizontal: 20 }}>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separatorSubtle, marginBottom: 22 }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Repère + NON-INTERACTIF (pointerEvents none, a11y masqué) : icône + VERTE NUE (aucun
                    conteneur : ni cercle, ni pill, ni fond, ni bord, ni ombre) → simple écho visuel du +
                    global, jamais pris pour un 2e bouton d'ajout. Le VRAI + reste celui de la nav. */}
                <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
                  style={{ marginRight: 10, marginTop: 2 }}>
                  <Plus size={20} color={theme.accent} strokeWidth={2.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 17, fontWeight: '600', letterSpacing: -0.2, color: theme.text1 }}>
                    Tu as autre chose chez toi ?
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, fontWeight: '400', color: theme.text2, lineHeight: 21, marginTop: 3 }}>
                    Ajoute-le avec le + en bas de l’écran.
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, fontWeight: '400', color: theme.text3, marginTop: 2 }}>
                    Photo, scan ou ajout manuel.
                  </Text>
                </View>
              </View>
            </View>

            {/* Sheet léger « Je l'ai » — version accélérée du flow d'ajout : quantité (défaut 1),
                date auto-estimée côté ajout (estimateDays) → aucune donnée fictive. */}
            <Modal visible={!!sheetCand} transparent animationType="slide" onRequestClose={() => setSheetCand(null)}>
              <Pressable onPress={() => setSheetCand(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end' }}>
                <Pressable onPress={() => {}} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.separator, alignSelf: 'center', marginBottom: 20 }} />
                  {sheetCand && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image source={sheetCand.image} style={{ width: 72, height: 56 }} resizeMode="contain" accessibilityLabel={sheetCand.name} />
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: theme.text1, marginLeft: 12 }}>
                          {sheetCand.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: theme.text2 }}>Combien ?</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Moins"
                            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.separator, alignItems: 'center', justifyContent: 'center', opacity: qty <= 1 ? 0.4 : 1 }}>
                            <Text style={{ fontSize: 22, color: theme.text1, lineHeight: 24 }}>−</Text>
                          </TouchableOpacity>
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: theme.text1, minWidth: 36, textAlign: 'center' }}>{qty}</Text>
                          <TouchableOpacity onPress={() => setQty((q) => Math.min(99, q + 1))}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Plus"
                            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.separator, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 22, color: theme.text1, lineHeight: 24 }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => confirmHave(sheetCand, qty)} activeOpacity={0.85}
                        accessibilityRole="button" accessibilityLabel={`Confirmer ${sheetCand.name}`}
                        style={{ marginTop: 28, backgroundColor: theme.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>J'en ai</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Pressable>
              </Pressable>
            </Modal>
          </View>
        );
      })()}
    </View>
  );
}

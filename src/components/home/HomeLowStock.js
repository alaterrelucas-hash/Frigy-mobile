import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, Modal, Pressable } from 'react-native';
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
        const BOX_W = Math.min(SCREEN_W * 0.72, 288); // riz réduit ~18% : contexte, plus héros
        const BOX_H = 150;
        let iw = BOX_W, ih = BOX_W / r;
        if (ih > BOX_H) { ih = BOX_H; iw = BOX_H * r; }
        const product = items.length === 1 ? (
          // Composition EMPILÉE (pas deux colonnes) : identité texte alignée à gauche (gouttière
          // Home), puis le produit en GRANDE présence Food Language centrée sous le texte → une
          // seule scène éditoriale, le regard descend du nom vers la matière.
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 8 }}>
              CE QUE TU AS
            </Text>
            <Text style={{ fontFamily: 'Georgia', fontSize: 28, fontWeight: '700', letterSpacing: -0.28, lineHeight: 34, color: theme.text1 }} numberOfLines={2}>
              {one.name}
            </Text>
            {!!one.location && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, fontWeight: '400', color: theme.text2, marginTop: 6 }}>
                {one.location}
              </Text>
            )}
            {/* TERRITOIRE 1 (connu) — image resserrée sur « Riz / Placard » (16→6) : texte + image
                = UNE unité perceptive franche. */}
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              {primary
                ? <Image source={primary.image} style={{ width: iw, height: ih }} resizeMode="contain" accessibilityLabel={one.name} />
                : <Text style={{ fontSize: 96 }}>{one.emoji || '🛒'}</Text>}
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 0.9, color: theme.text2, marginBottom: 14 }}>
              CE QUE TU AS
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
        const CELL = (SCREEN_W - 40 - 24) / 3; // gouttière 20 chaque côté + 2 gaps de 12
        return (
          // paddingTop 38 → respiration greeting → produit RESSERRÉE : le produit connu = contexte,
          // le module « Confirmation Intelligente » devient le pivot visuel/fonctionnel de LOW A.
          <View style={{ paddingTop: 38 }}>
            {product}
            {showModule ? (
              // MODULE — Frigy utilise ce qu'il CONNAÎT pour apprendre ce que l'utilisateur a DÉJÀ
              // (jamais un achat / une liste de courses). Composition ouverte : titre + 3 produits
              // Food Language + « Je l'ai » (support léger, ni card ni vert plein) + sortie discrète.
              // FRONTIÈRE T1→T2 : grand espace (44, > gaps internes) = séparation SENTIE par le
              // rythme, sans ligne ni card ni fond. TERRITOIRE 2 (à confirmer) = titre + 3 unités.
              <View style={{ marginTop: 44 }}>
                <Text style={{ fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', letterSpacing: -0.2, lineHeight: 25, color: theme.text1, paddingHorizontal: 20 }}>
                  Tu as aussi ça chez toi ?
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 9 }}>
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
                        {/* « Je l'ai » DÉ-CHROMÉ : simple lien texte accent (fin du look « 3 pills UI-kit »).
                            Chrome visible minimal, mais hit-area ≥44pt garantie par hitSlop généreux. */}
                        <TouchableOpacity onPress={() => openSheet(c)} activeOpacity={0.6}
                          hitSlop={{ top: 14, bottom: 14, left: 24, right: 24 }}
                          accessibilityRole="button" accessibilityLabel={`${c.name}, je l'ai`}
                          style={{ marginTop: 6 }}>
                          {/* présence subtile ravivée (13→14, semibold accent conservé) — reste
                              secondaire à l'image + au nom ; toujours ni pill ni fond ni bord. */}
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.accent }}>Je l'ai</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                <TouchableOpacity onPress={() => rejectSet(candidates.map((c) => c.key))} activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button" accessibilityLabel="Aucun de ceux-là"
                  style={{ alignSelf: 'center', marginTop: 20 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', color: theme.accent }}>Aucun de ceux-là</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Fallback (aucun candidat fiable / sets épuisés) : état LOW A minimal, calme.
              // ACKNOWLEDGEMENT (pas un CTA) — Frigy confirme une valeur ACQUISE, sans rien réclamer.
              <Text style={{ fontFamily: fonts.regular, fontSize: 16, fontWeight: '400', color: theme.text2, lineHeight: 22, paddingHorizontal: 20, marginTop: 52 }}>
                Je garde ça en tête.
              </Text>
            )}

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
                        <Text style={{ fontFamily: 'Georgia', fontSize: 24, fontWeight: '700', letterSpacing: -0.24, color: theme.text1, marginLeft: 12 }}>
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
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Je l'ai</Text>
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

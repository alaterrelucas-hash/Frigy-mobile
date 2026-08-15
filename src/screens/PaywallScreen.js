import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle2, Zap, Crown } from 'lucide-react-native';
import { C } from '../config/constants';
import { FREE_ITEMS_LIMIT, PRODUCT_ANNUAL } from '../config/purchases';
import { ENTITLEMENT, isKnownFree, isProStatus } from '../utils/entitlement';
import { OFFER_STATUS } from '../hooks/useProOffer';
import { posthog } from '../config/posthog';

// N6-11 (CR-15/17) : uniquement les VRAIS deltas Pro. Recettes/Stats retirés (aucun gate réel). Le
// nombre du cap Free vient de FREE_ITEMS_LIMIT (jamais dupliqué en dur). Aucune promesse d'essai/prix.
const FEATURES = [
  { label: 'Scan ticket de caisse illimité', sub: 'Extrait tes produits automatiquement'      },
  { label: 'Analyse photo IA',               sub: 'Identifie tes courses en une photo'         },
  { label: 'Produits illimités',             sub: `Limité à ${FREE_ITEMS_LIMIT} en version gratuite` },
];

const planTitle = (periodLabel) =>
  periodLabel === '/an' ? 'Annuel' : periodLabel === '/mois' ? 'Mensuel' : (periodLabel || 'Abonnement');

export default function PaywallScreen({
  onClose, onSuccess, entitlement, entitlementBusy = false, offerStatus, plans = [], onReloadOffer, onRetryEntitlement, purchase, restore,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [buying,     setBuying]     = useState(false);
  const [restoring,  setRestoring]  = useState(false);

  const defaultId = (plans.find(p => p.id === PRODUCT_ANNUAL) || plans[0] || {}).id ?? null;
  const activeId = selectedId ?? defaultId;
  const selectedPlan = plans.find(p => p.id === activeId) || null;

  // N6-11 : l'achat n'est autorisé QUE si l'utilisateur est KNOWN FREE, l'offre est READY, un plan réel
  // est sélectionné, ET aucune opération d'autorité n'est en cours (verrou partagé du hook →
  // pas de purchase/restore/refresh concurrents). UNKNOWN/ERROR/PRO ne vendent jamais.
  const canPurchase = isKnownFree(entitlement) && offerStatus === OFFER_STATUS.READY && !!selectedPlan && !entitlementBusy;

  const handlePurchase = async () => {
    if (!canPurchase || !selectedPlan) return;
    setBuying(true);
    posthog.capture('paywall_purchase_tapped', { plan: selectedPlan.id });
    try {
      const pro = await purchase(selectedPlan.storeProduct); // offre affichée === offre achetée
      if (pro) {
        posthog.capture('subscription_started', { plan: selectedPlan.id });
        onSuccess?.();
        onClose();
      } else {
        // Achat résolu mais entitlement Pro absent → NE PAS fermer comme Pro.
        Alert.alert('Abonnement non détecté', "Ton achat a été traité, mais l'abonnement Pro n'a pas encore été détecté. Essaie « Restaurer mes achats ».");
      }
    } catch (e) {
      if (!e?.message?.includes('userCancelled')) {
        console.error('[Paywall purchase]', e?.message); // diagnostic dev côté console uniquement
        Alert.alert('Achat indisponible', 'Les achats sont momentanément indisponibles. Réessaie plus tard.');
      }
    }
    setBuying(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const pro = await restore();
      if (pro) { onSuccess?.(); onClose(); }
      else Alert.alert('Aucun abonnement trouvé', 'Aucun achat à restaurer sur ce compte.');
    } catch (e) {
      console.error('[Paywall restore]', e?.message);
      Alert.alert('Restauration indisponible', 'Impossible de restaurer pour le moment. Réessaie plus tard.');
    }
    setRestoring(false);
  };

  // ── Bloc commercial selon (entitlement × offre) ──
  const renderCommercial = () => {
    // PRO : ne jamais revendre.
    if (isProStatus(entitlement)) {
      return (
        <View style={{ paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1, textAlign: 'center' }}>Tu es déjà Frigy Pro ✦</Text>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 16, backgroundColor: C.green, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 40 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Continuer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // UNKNOWN : autorité pas encore établie → vérification neutre, aucun CTA d'achat, aucun claim Free.
    if (entitlement === ENTITLEMENT.UNKNOWN) {
      return (
        <View style={{ paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' }}>
          <ActivityIndicator color={C.green} />
          <Text style={{ fontSize: 14, color: C.t3, textAlign: 'center', marginTop: 12 }}>Vérification de ton abonnement…</Text>
        </View>
      );
    }
    // ERROR : ne pas fabriquer Free ; message neutre + réessayer + Restaurer.
    if (entitlement === ENTITLEMENT.ERROR) {
      return (
        <View style={{ paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: C.t3, textAlign: 'center' }}>Impossible de vérifier ton abonnement.</Text>
          <TouchableOpacity onPress={() => onRetryEntitlement?.()} disabled={entitlementBusy} style={{ marginTop: 14, backgroundColor: C.green, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 32, opacity: entitlementBusy ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Réessayer</Text>
          </TouchableOpacity>
          {renderRestore()}
        </View>
      );
    }
    // KNOWN FREE : dépend de l'état OFFRE.
    if (offerStatus === OFFER_STATUS.LOADING) {
      return (
        <View style={{ paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' }}>
          <ActivityIndicator color={C.green} />
          <Text style={{ fontSize: 14, color: C.t3, textAlign: 'center', marginTop: 12 }}>Chargement de l'offre…</Text>
          {renderRestore()}
        </View>
      );
    }
    if (offerStatus === OFFER_STATUS.ERROR || plans.length === 0) {
      return (
        <View style={{ paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: C.t3, textAlign: 'center' }}>Offre momentanément indisponible.</Text>
          <TouchableOpacity onPress={() => onReloadOffer?.()} style={{ marginTop: 14, backgroundColor: C.green, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 32 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Réessayer</Text>
          </TouchableOpacity>
          {renderRestore()}
        </View>
      );
    }
    // FREE + READY : plans réels + CTA décrivant le plan sélectionné.
    return (
      <>
        <View style={{ paddingHorizontal: 20, gap: 10, marginBottom: 8 }}>
          {plans.map(plan => {
            const active = plan.id === activeId;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelectedId(plan.id)}
                style={{ borderRadius: 20, borderWidth: 2.5, borderColor: active ? C.green : '#E5E7EB',
                  backgroundColor: active ? `${C.green}08` : '#FAFAFA', padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                      borderColor: active ? C.green : '#D1D5DB', backgroundColor: active ? C.green : 'transparent',
                      alignItems: 'center', justifyContent: 'center' }}>
                      {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                    </View>
                    <View>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: C.t1 }}>{planTitle(plan.periodLabel)}</Text>
                      {plan.perMonthLabel && (
                        <Text style={{ fontSize: 12, color: C.t3, marginTop: 1 }}>soit {plan.perMonthLabel}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: active ? C.green : C.t1, letterSpacing: -0.5 }}>
                      {plan.localizedPrice}
                    </Text>
                    {plan.periodLabel && <Text style={{ fontSize: 12, color: C.t3 }}>{plan.periodLabel}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={buying || !canPurchase}
            style={{ backgroundColor: C.green, borderRadius: 20, paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
              shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14,
              opacity: (buying || !canPurchase) ? 0.75 : 1 }}>
            {buying
              ? <ActivityIndicator color="#fff" />
              : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Zap size={18} color="#fff" strokeWidth={2.5} />
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
                    {selectedPlan ? `S'abonner · ${selectedPlan.localizedPrice}${selectedPlan.periodLabel || ''}` : 'Choisir Frigy Pro'}
                  </Text>
                </View>
            }
          </TouchableOpacity>
          {renderRestore()}
        </View>
      </>
    );
  };

  const renderRestore = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16 }}>
      <TouchableOpacity onPress={() => Linking.openURL('https://frigy.app/terms')}>
        <Text style={{ fontSize: 12, color: C.green }}>Conditions</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleRestore} disabled={restoring || entitlementBusy}>
        {restoring
          ? <ActivityIndicator size="small" color={C.green} />
          : <Text style={{ fontSize: 12, color: C.green, opacity: entitlementBusy ? 0.6 : 1 }}>Restaurer</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('https://frigy.app/privacy')}>
        <Text style={{ fontSize: 12, color: C.green }}>Confidentialité</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: 'absolute', top: 52, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18,
          backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} color={C.t2} strokeWidth={2.5} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Hero (N6-11 : capacité, pas de promesse d'issue) ── */}
        <View style={{ backgroundColor: C.green, paddingTop: 60, paddingBottom: 36, paddingHorizontal: 28, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Crown size={34} color="#fff" strokeWidth={1.8} />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 34 }}>
            Passe à{'\n'}Frigy Pro
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
            Plus rapide pour ajouter{'\n'}et suivre ce que tu as.
          </Text>
        </View>

        {/* ── Features (vrais deltas seulement) ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8 }}>
          {FEATURES.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18, gap: 14 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: `${C.green}18`,
                alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                <CheckCircle2 size={15} color={C.green} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1 }}>{f.label}</Text>
                <Text style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {renderCommercial()}
      </ScrollView>
    </SafeAreaView>
  );
}

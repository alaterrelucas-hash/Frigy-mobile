import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle2, Zap, Crown } from 'lucide-react-native';
import { C } from '../config/constants';
import { PRODUCT_MONTHLY, PRODUCT_ANNUAL } from '../config/purchases';
import { posthog } from '../config/posthog';

const FEATURES = [
  { label: 'Scan ticket de caisse illimité',  sub: 'Extrait produits + prix automatiquement'   },
  { label: 'Analyse photo IA',                 sub: 'Identifie tes courses en une photo'        },
  { label: 'Recettes IA illimitées',           sub: '3 recettes/mois en version gratuite'       },
  { label: 'Produits illimités',               sub: 'Limité à 20 en version gratuite'           },
  { label: 'Stats & analyses avancées',        sub: 'Historique complet de tes économies'       },
];

const PLANS = [
  {
    id: PRODUCT_ANNUAL,
    label: 'Annuel',
    price: '24,99 €',
    period: '/an',
    monthly: '2,08 €/mois',
    badge: 'MEILLEURE OFFRE · -30%',
    recommended: true,
  },
  {
    id: PRODUCT_MONTHLY,
    label: 'Mensuel',
    price: '2,99 €',
    period: '/mois',
    monthly: null,
    badge: null,
    recommended: false,
  },
];

export default function PaywallScreen({ onClose, onSuccess, purchase, restore }) {
  const [selected,  setSelected]  = useState(PRODUCT_ANNUAL);
  const [buying,    setBuying]    = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async () => {
    setBuying(true);
    posthog.capture('paywall_purchase_tapped', { plan: selected });
    try {
      const pro = await purchase(selected);
      if (pro) {
        posthog.capture('subscription_started', { plan: selected });
        onSuccess?.();
        onClose();
      }
    } catch (e) {
      if (e.message === 'NOT_CONFIGURED') {
        Alert.alert(
          'RevenueCat à configurer',
          'Suis le guide de configuration dans le README pour activer les achats in-app.\n\nTout le code est prêt — il te faut juste :\n1. Créer les produits dans App Store Connect\n2. Configurer RevenueCat\n3. Installer react-native-purchases',
        );
      } else if (!e.message?.includes('userCancelled')) {
        Alert.alert('Erreur', "L'achat a échoué. Réessaie.");
      }
    }
    setBuying(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const pro = await restore();
      if (pro) { onSuccess?.(); onClose(); }
      else Alert.alert('Aucun abonnement trouvé', 'Aucun achat à restaurer sur ce compte Apple.');
    } catch (e) {
      if (e.message === 'NOT_CONFIGURED') Alert.alert('RevenueCat non configuré', 'Les achats in-app ne sont pas encore actifs.');
      else Alert.alert('Erreur', 'Impossible de restaurer. Réessaie.');
    }
    setRestoring(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Close */}
      <TouchableOpacity
        onPress={onClose}
        style={{ position: 'absolute', top: 52, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18,
          backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} color={C.t2} strokeWidth={2.5} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Hero ── */}
        <View style={{ backgroundColor: C.green, paddingTop: 60, paddingBottom: 36, paddingHorizontal: 28, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Crown size={34} color="#fff" strokeWidth={1.8} />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 34 }}>
            Passez à{'\n'}Frigy Pro
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
            Arrêtez de gaspiller,{'\n'}pour de bon.
          </Text>
        </View>

        {/* ── Features ── */}
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

        {/* ── Plans ── */}
        <View style={{ paddingHorizontal: 20, gap: 10, marginBottom: 8 }}>
          {PLANS.map(plan => {
            const active = selected === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelected(plan.id)}
                style={{ borderRadius: 20, borderWidth: 2.5,
                  borderColor: active ? C.green : '#E5E7EB',
                  backgroundColor: active ? `${C.green}08` : '#FAFAFA',
                  padding: 18, position: 'relative', overflow: 'hidden' }}>
                {plan.badge && (
                  <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.green,
                    paddingHorizontal: 12, paddingVertical: 5, borderBottomLeftRadius: 14 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>{plan.badge}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                      borderColor: active ? C.green : '#D1D5DB',
                      backgroundColor: active ? C.green : 'transparent',
                      alignItems: 'center', justifyContent: 'center' }}>
                      {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                    </View>
                    <View>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: C.t1 }}>{plan.label}</Text>
                      {plan.monthly && (
                        <Text style={{ fontSize: 12, color: C.t3, marginTop: 1 }}>soit {plan.monthly}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: active ? C.green : C.t1, letterSpacing: -0.5 }}>
                      {plan.price}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.t3 }}>{plan.period}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── CTA ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={buying}
            style={{ backgroundColor: C.green, borderRadius: 20, paddingVertical: 17,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14,
              opacity: buying ? 0.75 : 1 }}>
            {buying
              ? <ActivityIndicator color="#fff" />
              : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Zap size={18} color="#fff" strokeWidth={2.5} />
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
                    Commencer l'essai gratuit · 7 jours
                  </Text>
                </View>
            }
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', fontSize: 12, color: C.t3, marginTop: 10, lineHeight: 18 }}>
            Annulez à tout moment. Aucun débit pendant l'essai.
          </Text>

          {/* Footer links */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16 }}>
            <TouchableOpacity onPress={() => Linking.openURL('https://frigy.app/terms')}>
              <Text style={{ fontSize: 12, color: C.green }}>Conditions</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRestore} disabled={restoring}>
              {restoring
                ? <ActivityIndicator size="small" color={C.green} />
                : <Text style={{ fontSize: 12, color: C.green }}>Restaurer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://frigy.app/privacy')}>
              <Text style={{ fontSize: 12, color: C.green }}>Confidentialité</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

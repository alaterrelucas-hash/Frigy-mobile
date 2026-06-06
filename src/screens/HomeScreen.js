import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { Bell, User, ChevronRight, PartyPopper, ShoppingCart } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { C, urgBg, urgLbl, CATEGORY_PRICE } from '../config/constants';
import { styles } from '../styles';

const CAT_FR = {
  légume: 'les légumes', fruit: 'les fruits', laitage: 'les laitages',
  viande: 'la viande', poisson: 'le poisson', pain: 'le pain',
  boisson: 'les boissons', surgelé: 'les surgelés', autre: 'les restes',
};
const CAT_EMOJI = {
  légume: '🥦', fruit: '🍎', laitage: '🥛', viande: '🥩',
  poisson: '🐟', pain: '🥖', boisson: '🧃', surgelé: '🧊', autre: '🍱',
};

export default function HomeScreen({ items, expiring, onNav, onUrgent, profileName, onItemPress, familyId, onShopping, streak = 0 }) {
  const firstName = profileName ? profileName.split(' ')[0] : '';
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [wastedInsights, setWastedInsights] = useState(null);

  useEffect(() => {
    if (!familyId) return;
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    supabase
      .from('items')
      .select('price, wasted, category, name, emoji')
      .eq('family_id', familyId)
      .eq('consumed', true)
      .gte('updated_at', start.toISOString())
      .then(({ data }) => {
        if (!data) return;
        const saved = data.filter(i => !i.wasted);
        const wasted = data.filter(i => i.wasted);
        if (wasted.length > 0) {
          const catCount = {};
          wasted.forEach(i => { const k = i.category || 'autre'; catCount[k] = (catCount[k] || 0) + 1; });
          const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
          const prodCount = {};
          wasted.forEach(i => { prodCount[i.name] = (prodCount[i.name] || 0) + 1; });
          const topProd = Object.entries(prodCount).sort((a, b) => b[1] - a[1])[0];
          setWastedInsights({
            topCat: topCat?.[0], topCatCount: topCat?.[1],
            topProd: topProd?.[0], topProdCount: topProd?.[1],
            topProdEmoji: wasted.find(i => i.name === topProd?.[0])?.emoji,
          });
        }
        setMonthlyStats({
          savings: saved.reduce((s, i) => s + (i.price || CATEGORY_PRICE[i.category] || 2.5), 0),
          co2: saved.length * 0.75,
          meals: saved.length,
          wastedCount: wasted.length,
        });
      });
  }, [familyId]);

  return (
    <ScrollView style={[styles.screen, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>

      {/* ─── HEADER ─── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerSub}>{firstName ? `Bonjour ${firstName} 👋` : 'Bonjour 👋'}</Text>
            {streak >= 2 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3E0', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 13 }}>🔥</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#E65100' }}>{streak}j</Text>
              </View>
            )}
          </View>
          <Image source={require('../../assets/logo-text.png')} style={{ height: 48, width: 165 }} resizeMode="contain" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Bell size={18} color={C.t1} strokeWidth={1.8} />
            <View style={{ position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, borderWidth: 1.5, borderColor: '#fff' }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => onNav('profile')}>
            <User size={18} color={C.t1} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── HERO CARD ─── */}
      <View style={styles.heroCard}>
        <View style={{ padding: 20, paddingRight: 158 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.green, letterSpacing: 0.8, marginBottom: 8 }}>⏱ À CONSOMMER</Text>
          <Text style={styles.heroTitle}>
            {expiring.length} produit{expiring.length !== 1 ? 's' : ''}{'\n'}à consommer{'\n'}cette semaine
          </Text>
          <TouchableOpacity style={styles.heroBtn} onPress={onUrgent}>
            <Text style={{ fontWeight: '700', color: C.t1, fontSize: 13 }}>Voir la liste →</Text>
          </TouchableOpacity>
        </View>
        {/* Fridge illustration */}
        <View style={{ position: 'absolute', right: 18, top: 0, bottom: 0, width: 150, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../assets/fridge.png')} style={{ width: 148, height: 175 }} resizeMode="contain" />
        </View>
      </View>

      {/* ─── STATS ROW ─── */}
      <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16,
        flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 }}>
        {[
          { icon: require('../../assets/stat-stock.png'),    value: items.length,  label: 'produits',      sub: 'dans ton frigo',  color: C.green },
          { icon: require('../../assets/stat-savings.png'),  value: expiring.length, label: 'à consommer', sub: 'cette semaine',   color: '#FF4B4B' },
          { icon: require('../../assets/stat-expiring.png'), value: monthlyStats ? `${Math.round(monthlyStats.savings)}€` : '—€',
            label: 'économisés', sub: 'ce mois-ci', color: '#FF9500' },
        ].map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < 2 ? 1 : 0, borderRightColor: C.border, paddingVertical: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: s.color + '18',
              alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Image source={s.icon} style={{ width: 32, height: 32 }} resizeMode="contain" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: s.color, letterSpacing: -0.5 }}>{s.value}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.t1, marginTop: 1 }}>{s.label}</Text>
            <Text style={{ fontSize: 10, color: C.t3, textAlign: 'center' }}>{s.sub}</Text>
          </View>
        ))}
      </View>

      {/* ─── SCORE FRIGO ─── */}
      {(() => {
        const total = (monthlyStats?.meals || 0) + (monthlyStats?.wastedCount || 0);
        if (total < 3) return null;
        const pct = Math.round((monthlyStats.meals / total) * 100);
        const grade = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 50 ? 'C' : 'D';
        const gradeColor = pct >= 85 ? C.green : pct >= 70 ? '#34C759' : pct >= 50 ? '#FF9500' : '#FF3B30';
        return (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff', borderRadius: 20,
            paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: gradeColor + '18',
              alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: gradeColor }}>{grade}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.t1 }}>Score anti-gaspillage</Text>
              <Text style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{pct}% des produits sauvés ce mois</Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 8, overflow: 'hidden' }}>
                <View style={{ height: 4, width: `${pct}%`, borderRadius: 2, backgroundColor: gradeColor }} />
              </View>
            </View>
          </View>
        );
      })()}

      {/* ─── TON ANALYSE ─── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <Text style={styles.sectionTitle}>TON ANALYSE</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
        {/* left: most wasted category */}
        <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8,
          overflow: 'hidden', minHeight: 120 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.t1, lineHeight: 18 }}>Tu gaspilles surtout</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.green, marginTop: 2, marginBottom: 6 }}>
            {wastedInsights?.topCat ? (CAT_FR[wastedInsights.topCat] || wastedInsights.topCat) : 'les légumes'}
          </Text>
          <Text style={{ fontSize: 11, color: C.t3, lineHeight: 15 }}>Essaie de les consommer en priorité 🌱</Text>
          <Text style={{ fontSize: 42, position: 'absolute', right: 6, bottom: 4, opacity: 0.55 }}>
            {wastedInsights?.topCat ? (CAT_EMOJI[wastedInsights.topCat] || '🌿') : '🥗'}
          </Text>
        </View>
        {/* right: most wasted product */}
        <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8,
          overflow: 'hidden', minHeight: 120 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: C.t1, lineHeight: 17 }}>Ton produit le{'\n'}plus gaspillé</Text>
          <View style={{ backgroundColor: C.mint, paddingHorizontal: 8, paddingVertical: 4,
            borderRadius: 8, alignSelf: 'flex-start', marginTop: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.green }} numberOfLines={1}>
              {wastedInsights?.topProd ? wastedInsights.topProd.slice(0, 16) : 'Aucun gaspillage'}
            </Text>
          </View>
          <Text style={{ fontSize: 10, color: C.t3 }}>
            {wastedInsights?.topProdCount
              ? `${wastedInsights.topProdCount} fois gaspillé${wastedInsights.topProdCount > 1 ? 's' : ''} ce mois-ci`
              : 'Super boulot !'}
          </Text>
          <Text style={{ fontSize: 42, position: 'absolute', right: 6, bottom: 4, opacity: 0.6 }}>
            {wastedInsights?.topProdEmoji || '🥬'}
          </Text>
        </View>
      </View>

      {/* ─── PRODUITS PRIORITAIRES ─── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 }}>
        <Text style={styles.sectionTitle}>PRODUITS PRIORITAIRES</Text>
        <TouchableOpacity onPress={() => onNav('fridge')}>
          <Text style={{ fontSize: 13, color: C.green, fontWeight: '600' }}>Voir tout →</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, overflow: 'hidden' }}>
        {expiring.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <PartyPopper size={32} color={C.green} strokeWidth={1.5} />
            <Text style={{ fontSize: 14, color: C.t3, marginTop: 8 }}>Aucun produit urgent</Text>
          </View>
        ) : expiring.slice(0, 4).map((item, i, arr) => (
          <TouchableOpacity key={item.id} onPress={() => onItemPress?.(item)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.bg,
              alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.productSub}>DLC {item.dlc}</Text>
            </View>
            <View style={[styles.urgBadge, { backgroundColor: urgBg(item.days), marginRight: 8 }]}>
              <Text style={styles.urgText}>{urgLbl(item.days)}</Text>
            </View>
            <ChevronRight size={16} color={C.t4} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── LISTE DE COURSES ─── */}
      <TouchableOpacity onPress={onShopping}
        style={{ marginHorizontal: 16, marginBottom: 24, backgroundColor: '#fff', borderRadius: 20,
          padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07, shadowRadius: 10,
          flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.green + '18',
          alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={22} color={C.green} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1 }}>Liste de courses</Text>
          <Text style={{ fontSize: 12, color: C.t3, marginTop: 1 }}>Gérer ta liste d'achats</Text>
        </View>
        <ChevronRight size={18} color={C.t4} />
      </TouchableOpacity>

      {/* ─── TON IMPACT CE MOIS-CI ─── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <Text style={styles.sectionTitle}>TON IMPACT CE MOIS-CI</Text>
        <TouchableOpacity onPress={() => Alert.alert('Comment sont calculées ces métriques ? 🌍', '💲 Économies : somme des prix des produits consommés avant expiration\n\n🌲 CO₂ évités : environ 0,75 kg de CO₂ par produit sauvé\n\n🍽️ Repas sauvés : nombre de produits consommés avant leur date')}>
          <Text style={{ fontSize: 12, color: C.green, marginTop: 2 }}>Comment sont calculées ces métriques ?</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, marginBottom: 28,
        padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10,
        flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 12 }}>
          {[
            { icon: require('../../assets/icon-savings.png'), v: monthlyStats ? `${monthlyStats.savings.toFixed(2).replace('.', ',')} €` : '— €',  l: 'Économisés',   col: C.green,   info: 'Économies 💰',    desc: 'Somme économisée ce mois en ne jetant pas tes produits.' },
            { icon: require('../../assets/icon-co2.png'),     v: monthlyStats ? `${monthlyStats.co2.toFixed(1)} kg` : '— kg',                      l: 'CO₂ évités',   col: C.green,   info: 'CO₂ évité 🌿',   desc: 'Estimation CO₂ évité — 0,75 kg par produit consommé.' },
            { icon: require('../../assets/icon-meals.png'),   v: monthlyStats ? `${monthlyStats.meals}` : '—',                                      l: 'Repas sauvés', col: '#FF9500', info: 'Repas sauvés 🍽️', desc: 'Produits consommés avant expiration ce mois-ci.' },
          ].map((s, i) => (
            <TouchableOpacity key={i} onPress={() => Alert.alert(s.info, s.desc)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.col + '18',
                alignItems: 'center', justifyContent: 'center' }}>
                <Image source={s.icon} style={{ width: 34, height: 34 }} resizeMode="contain" />
              </View>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: s.col, letterSpacing: -0.5 }}>{s.v}</Text>
                <Text style={{ fontSize: 11, color: C.t3 }}>{s.l}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {/* Globe */}
        <View style={{ width: 150, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../assets/planet.png')} style={{ width: 150, height: 150 }} resizeMode="contain" />
        </View>
      </View>

    </ScrollView>
  );
}

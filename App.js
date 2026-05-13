import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView,
         TextInput, Alert, ActivityIndicator, Modal, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── DESIGN SYSTEM ───────────────────────────────────────────────────────────
const C = {
  green: '#2ECC71', greenDk: '#27AE60', mint: '#7EE8C1',
  yellow: '#FFB800', red: '#FF3B30', orange: '#FF9500',
  bg: '#F0F2F5', card: '#FFFFFF',
  t1: '#0D1117', t2: '#374151', t3: '#6B7280', t4: '#C0C8D0',
  border: '#EAECEF',
};

const urgBg = d => d<=1?'#FF3B30':d<=3?'#FF9500':'#FFB800';
const urgLbl = d => d<=0?'J-1':`J-${d}`;

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mswmridpidhqqlxnxhlt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zd21yaWRwaWRocXFseG54aGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODc2MjUsImV4cCI6MjA5Mzg2MzYyNX0.njAP240jTC1NEQ21NL1u6ubTWvczooWi-AVGiKmiKtA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── API HELPERS ─────────────────────────────────────────────────────────────
async function searchOpenFoodFacts(barcode) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const d = await r.json();
    if (d.status !== 1 || !d.product) return null;
    const p = d.product;
    return {
      name: p.product_name_fr || p.product_name || '',
      brand: p.brands || '',
      nutri: ['A','B','C','D','E'].includes((p.nutriscore_grade||'').toUpperCase()) ? (p.nutriscore_grade||'').toUpperCase() : null,
      kcal: p.nutriments?.['energy-kcal_100g'] ? Math.round(p.nutriments['energy-kcal_100g']) : null,
      category: p.categories_tags?.[0]?.replace('en:','').replace(/-/g,' ') || '',
      imgUrl: p.image_front_small_url || p.image_small_url || p.image_url || p.image_front_url || null,
    };
  } catch { return null; }
}

function estimateDays(category, name) {
  const n = (name||'').toLowerCase();
  const c = (category||'').toLowerCase();
  if (n.includes('poulet') || n.includes('volaille') || c.includes('poultry')) return 3;
  if (n.includes('viande') || n.includes('bœuf') || n.includes('boeuf') || n.includes('porc') || c.includes('meat')) return 3;
  if (n.includes('charcuterie') || n.includes('jambon') || n.includes('saucisse')) return 5;
  if (n.includes('poisson') || n.includes('saumon') || n.includes('thon') || c.includes('fish')) return 2;
  if (n.includes('crevette') || n.includes('fruits de mer')) return 2;
  if (n.includes('lait') || c.includes('milk')) return 5;
  if (n.includes('yaourt') || n.includes('yogurt')) return 21;
  if (n.includes('crème') || n.includes('creme')) return 7;
  if (n.includes('beurre')) return 30;
  if (n.includes('fromage') || c.includes('cheese')) return 14;
  if (n.includes('œuf') || n.includes('oeuf') || c.includes('egg')) return 28;
  if (n.includes('fraise') || n.includes('framboise') || n.includes('myrtille')) return 4;
  if (n.includes('salade') || n.includes('épinard') || n.includes('roquette')) return 4;
  if (n.includes('avocat')) return 3;
  if (n.includes('tomate') || n.includes('concombre')) return 7;
  if (n.includes('pomme') || n.includes('poire') || n.includes('orange')) return 14;
  if (c.includes('fruit') || c.includes('vegetable')) return 7;
  if (n.includes('pain') || n.includes('baguette') || n.includes('croissant')) return 3;
  if (n.includes('brioche') || n.includes('viennoiserie')) return 5;
  if (c.includes('prepared') || c.includes('traiteur') || c.includes('ready meal')) return 3;
  if (n.includes('jus') || c.includes('juice')) return 7;
  if (c.includes('beverage') || c.includes('boisson')) return 90;
  if (n.includes('surgelé') || c.includes('frozen')) return 180;
  if (c.includes('pasta') || c.includes('rice') || c.includes('cereal')) return 365;
  if (c.includes('canned') || c.includes('conserve')) return 730;
  return 90;
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('home');
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      setUser(session?.user || null);
      setAuthLoading(false);
      if (session?.user) setupProfile(session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) setupProfile(session.user.id);
      else { setFamilyId(null); setItems([]); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const setupProfile = async (userId, name = null) => {
    await supabase.rpc('setup_user_profile');

    const {data: profile} = await supabase
      .from('profiles')
      .select('id, family_id, name')
      .eq('id', userId)
      .single();

    if (profile?.family_id) {
      if (name && (!profile.name || profile.name === 'Utilisateur')) {
        await supabase.from('profiles').update({name}).eq('id', userId);
      }
      setFamilyId(profile.family_id);
      fetchItems(profile.family_id);
    }
  };

  const fetchItems = async (famId) => {
    const {data} = await supabase
      .from('items')
      .select('*')
      .eq('family_id', famId)
      .eq('consumed', false);
    if (data) setItems(data.map(i => ({
      ...i, days: i.days_left, emoji: i.emoji||'🛒'
    })));
  };

  const [scanOpen, setScanOpen] = useState(false);
  const expiring = items.filter(i => i.days <= 4).sort((a,b) => a.days - b.days);

  if (authLoading) return (
    <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.bg}}>
      <ActivityIndicator color={C.green} size="large"/>
    </View>
  );

  if (!user) return (
    <LoginScreen onLogin={(u, name) => { setUser(u); setupProfile(u.id, name); }}/>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {tab === 'home'    && <HomeScreen items={items} expiring={expiring} onNav={setTab} onScan={() => setScanOpen(true)}/>}
      {tab === 'fridge'  && <FridgeScreen items={items} setItems={setItems} user={user} familyId={familyId}/>}
      {tab === 'recipes' && <RecipesScreen items={items}/>}
      {tab === 'profile' && <ProfileScreen/>}

      <View style={styles.tabBar}>
        {[
          {id:'home',    label:'Accueil', icon:'🏠'},
          {id:'fridge',  label:'Frigo',   icon:'❄️'},
          {id:'scan',    label:'',        icon:'+', isScan:true},
          {id:'recipes', label:'Recettes',icon:'🍽️'},
          {id:'profile', label:'Profil',  icon:'👤'},
        ].map(t => {
          if (t.isScan) return (
            <TouchableOpacity key="scan" style={styles.scanBtn} onPress={() => setScanOpen(true)}>
              <Text style={{fontSize:28,color:'#fff',fontWeight:'900'}}>+</Text>
              {expiring.length > 0 && (
                <View style={styles.badge}>
                  <Text style={{color:'#fff',fontSize:9,fontWeight:'700'}}>{expiring.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
          const on = tab === t.id;
          return (
            <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => setTab(t.id)}>
              <Text style={{fontSize:20}}>{t.icon}</Text>
              <Text style={[styles.tabLabel, on && {color:C.green}]}>{t.label}</Text>
              {on && <View style={styles.tabDot}/>}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={scanOpen} animationType="slide">
        <ScanScreen onClose={() => setScanOpen(false)} setItems={setItems} user={user} familyId={familyId}/>
      </Modal>
    </SafeAreaView>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
const inputStyle = {
  borderWidth:1, borderColor:C.border, borderRadius:12,
  padding:13, fontSize:14, color:C.t1,
  backgroundColor:'#FAFAFA', marginBottom:12,
};

function LoginScreen({onLogin}) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password) { setError('Remplis tous les champs'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'signup') {
        const {data, error:e} = await supabase.auth.signUp({email, password});
        if (e) { setError(e.message); return; }
        if (data.user) onLogin(data.user, name);
        else Alert.alert('✅ Compte créé !', 'Vérifie ton email pour confirmer.');
      } else {
        const {data, error:e} = await supabase.auth.signInWithPassword({email, password});
        if (e) { setError(e.message); return; }
        onLogin(data.user);
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe]}>
      <ScrollView contentContainerStyle={{padding:24, flexGrow:1, justifyContent:'center'}}>
        <View style={{alignItems:'center', marginBottom:36, marginTop:40}}>
          <Text style={{fontSize:52}}>🥗</Text>
          <Text style={{fontSize:28, fontWeight:'800', color:C.t1, marginTop:12}}>Frigy</Text>
          <Text style={{fontSize:15, color:C.t3}}>{mode === 'login' ? 'Bon retour !' : 'Crée ton compte'}</Text>
        </View>

        {mode === 'signup' && (
          <View style={{marginBottom:16}}>
            <Text style={{fontSize:13, fontWeight:'600', color:C.t2, marginBottom:6}}>Ton prénom</Text>
            <TextInput style={{backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:12, padding:14, fontSize:15, color:C.t1}}
              value={name} onChangeText={setName} placeholder="Lucas" placeholderTextColor={C.t4}/>
          </View>
        )}

        <View style={{marginBottom:16}}>
          <Text style={{fontSize:13, fontWeight:'600', color:C.t2, marginBottom:6}}>Email</Text>
          <TextInput style={{backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:12, padding:14, fontSize:15, color:C.t1}}
            value={email} onChangeText={setEmail} placeholder="lucas@frigy.app"
            placeholderTextColor={C.t4} keyboardType="email-address" autoCapitalize="none"/>
        </View>

        <View style={{marginBottom:16}}>
          <Text style={{fontSize:13, fontWeight:'600', color:C.t2, marginBottom:6}}>Mot de passe</Text>
          <TextInput style={{backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:12, padding:14, fontSize:15, color:C.t1}}
            value={password} onChangeText={setPassword} placeholder="••••••••"
            placeholderTextColor={C.t4} secureTextEntry/>
        </View>

        {error !== '' && (
          <View style={{padding:12, backgroundColor:'#FFF0F0', borderRadius:10, marginBottom:14}}>
            <Text style={{color:C.red, fontSize:13}}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={{backgroundColor:C.green, padding:15, borderRadius:14, alignItems:'center'}}
          onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> :
            <Text style={{color:'#fff', fontWeight:'700', fontSize:15}}>
              {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Text>}
        </TouchableOpacity>

        <TouchableOpacity style={{marginTop:16, alignItems:'center'}}
          onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          <Text style={{fontSize:14, color:C.t3}}>
            {mode === 'login' ? 'Pas de compte ? ' : 'Déjà un compte ? '}
            <Text style={{color:C.green, fontWeight:'700'}}>
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({items, expiring, onNav, onScan}) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Bonjour Lucas 👋</Text>
          <Text style={styles.headerTitle}>Frigy</Text>
        </View>
        <View style={styles.notifBtn}>
          <Text style={{fontSize:18}}>🔔</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={{flex:1}}>
          <Text style={styles.heroTitle}>
            {expiring.length} produit{expiring.length>1?'s':''}{'\n'}à consommer{'\n'}cette semaine
          </Text>
          <TouchableOpacity style={styles.heroBtn} onPress={() => onNav('fridge')}>
            <Text style={{fontWeight:'700',color:C.t1,fontSize:13}}>Voir la liste</Text>
          </TouchableOpacity>
        </View>
        <View style={{flexDirection:'row'}}>
          {expiring.slice(0,3).map((item,i) => (
            <View key={item.id} style={[styles.heroEmoji, {marginLeft: i>0?-14:0}]}>
              <Text style={{fontSize:22}}>{item.emoji}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{flexDirection:'row', gap:10, marginBottom:14}}>
        {[
          {label:'En stock', value:items.length, sub:'produits', col:C.green},
          {label:'Urgents',  value:expiring.length, sub:'à consommer', col:C.red},
          {label:'Économies',value:'32€', sub:'ce mois', col:C.yellow},
        ].map(s => (
          <View key={s.label} style={[styles.card, {flex:1, padding:12}]}>
            <Text style={{fontSize:20,fontWeight:'800',color:s.col}}>{s.value}</Text>
            <Text style={{fontSize:10,color:C.t3,marginTop:2}}>{s.sub}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>PRODUITS PRIORITAIRES</Text>
      <View style={styles.card}>
        {expiring.slice(0,4).map((item,i,arr) => (
          <View key={item.id} style={[styles.productRow, i<arr.length-1 && styles.rowBorder]}>
            <Text style={{fontSize:36,marginRight:12}}>{item.emoji}</Text>
            <View style={{flex:1}}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productSub}>DLC {item.dlc}</Text>
            </View>
            <View style={[styles.urgBadge, {backgroundColor:urgBg(item.days)}]}>
              <Text style={styles.urgText}>{urgLbl(item.days)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, {marginTop:14}]}>IMPACT CE MOIS-CI</Text>
      <View style={styles.card}>
        <View style={{padding:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
          <View style={{gap:14}}>
            {[
              {e:'💰', v:'32,40 €', l:'Économisés', col:C.green},
              {e:'🌿', v:'8,7 kg',  l:'CO₂ évités', col:'#27AE60'},
              {e:'🍽️', v:'24',     l:'Repas sauvés',col:C.yellow},
            ].map(s => (
              <View key={s.l} style={{flexDirection:'row', alignItems:'center', gap:10}}>
                <View style={{width:36,height:36,borderRadius:10,backgroundColor:s.col+'20',alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:18}}>{s.e}</Text>
                </View>
                <View>
                  <Text style={{fontSize:20,fontWeight:'700',color:s.col}}>{s.v}</Text>
                  <Text style={{fontSize:11,color:C.t3}}>{s.l}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={{fontSize:64}}>🌍</Text>
        </View>
      </View>
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── FRIDGE SCREEN ────────────────────────────────────────────────────────────
function FridgeScreen({items, setItems, user}) {
  const [loc, setLoc] = useState('Frigo');
  const [q, setQ] = useState('');
  const shown = items
    .filter(i => i.location === loc && (!q || i.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a,b) => a.days - b.days);

  return (
    <View style={styles.screen}>
      <View style={{padding:16}}>
        <Text style={styles.screenTitle}>Mon Frigo</Text>
        <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
          {[{id:'Frigo',icon:'❄️'},{id:'Congélateur',icon:'🧊'},{id:'Placard',icon:'🗄️'}].map(l => {
            const cnt = items.filter(i => i.location === l.id).length;
            const on = loc === l.id;
            return (
              <TouchableOpacity key={l.id} onPress={() => setLoc(l.id)}
                style={[styles.locTab, on && styles.locTabActive]}>
                <Text style={{fontSize:22,marginBottom:4}}>{l.icon}</Text>
                <Text style={[styles.locTabLabel, on && {color:C.t1,fontWeight:'700'}]}>{l.id}</Text>
                <Text style={{fontSize:10,color:C.t3}}>{cnt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.searchBar}>
          <Text style={{fontSize:16,marginRight:8}}>🔍</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher…"
            style={{flex:1,fontSize:14,color:C.t1}} placeholderTextColor={C.t4}/>
        </View>
      </View>
      <ScrollView style={{flex:1, paddingHorizontal:16}}>
        {shown.length === 0 && (
          <View style={{alignItems:'center', paddingTop:60}}>
            <Text style={{fontSize:52,marginBottom:12}}>📭</Text>
            <Text style={{fontSize:15,fontWeight:'600',color:C.t2}}>Rien ici</Text>
            <Text style={{fontSize:13,color:C.t3,marginTop:4}}>Scanne tes courses pour commencer</Text>
          </View>
        )}
        {shown.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.fridgeRow, {marginBottom:9}]}
            onLongPress={() => {
              Alert.alert('Supprimer ?', `Retirer ${item.name} du frigo ?`, [
                {text:'Annuler', style:'cancel'},
                {text:'Supprimer', style:'destructive', onPress: async () => {
                  setItems(p => p.filter(x => x.id !== item.id));
                  await supabase.from('items').delete().eq('id', item.id);
                }}
              ]);
            }}>
            <Text style={{fontSize:36,marginRight:12}}>{item.emoji}</Text>
            <View style={{flex:1}}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productSub}>{item.brand||item.category} · {item.quantity} {item.unit}</Text>
              <View style={{height:3,backgroundColor:'#EAECEF',borderRadius:2,marginTop:6,overflow:'hidden'}}>
                <View style={{height:'100%',backgroundColor:urgBg(item.days),
                  width:`${Math.min(item.days/14,1)*100}%`,borderRadius:2}}/>
              </View>
            </View>
            <View style={{alignItems:'flex-end',gap:6}}>
              <View style={[styles.urgBadge, {backgroundColor:urgBg(item.days)}]}>
                <Text style={styles.urgText}>{urgLbl(item.days)}</Text>
              </View>
              {item.nutri_grade && (
                <View style={{width:22,height:22,borderRadius:6,backgroundColor:'#34C759',alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:10,fontWeight:'700',color:'#fff'}}>{item.nutri_grade}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
        <View style={{height:20}}/>
      </ScrollView>
    </View>
  );
}

// ─── RECIPES SCREEN ───────────────────────────────────────────────────────────
function RecipesScreen({items}) {
  const recipes = [
    {name:'Gâteau moelleux aux pommes', time:'20 min', diff:'Facile', emoji:'🍰', saves:'4,20'},
    {name:'Pâtes crémeuses champignons', time:'25 min', diff:'Facile', emoji:'🍝', saves:'5,80'},
    {name:'Saumon à l\'aneth', time:'15 min', diff:'Facile', emoji:'🐟', saves:'6,40'},
    {name:'Smoothie fraises-banane', time:'5 min', diff:'Très facile', emoji:'🍓', saves:'2,50'},
  ];
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={{padding:16}}>
        <Text style={styles.screenTitle}>Recettes pour toi</Text>
        <Text style={{fontSize:13,color:C.t3,marginBottom:16}}>Basées sur tes produits</Text>
        {recipes.map((r,i) => (
          <TouchableOpacity key={i} style={[styles.card, {marginBottom:12,overflow:'hidden'}]}>
            <View style={{height:120,backgroundColor:'#F0FFF4',alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:56}}>{r.emoji}</Text>
            </View>
            <View style={{padding:14}}>
              <Text style={{fontSize:16,fontWeight:'700',color:C.t1,marginBottom:4}}>{r.name}</Text>
              <View style={{flexDirection:'row',gap:8}}>
                <View style={{paddingHorizontal:10,paddingVertical:4,backgroundColor:`${C.green}18`,borderRadius:100}}>
                  <Text style={{fontSize:11,color:C.green,fontWeight:'600'}}>{r.time}</Text>
                </View>
                <View style={{paddingHorizontal:10,paddingVertical:4,backgroundColor:'#FFF9E6',borderRadius:100}}>
                  <Text style={{fontSize:11,color:'#8B6914',fontWeight:'600'}}>−{r.saves}€</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
function ProfileScreen() {
  return (
    <ScrollView style={styles.screen}>
      <View style={{padding:16}}>
        <Text style={styles.screenTitle}>Mon profil</Text>
        <View style={styles.card}>
          <View style={{padding:18,flexDirection:'row',gap:14,alignItems:'center'}}>
            <View style={{width:58,height:58,borderRadius:18,backgroundColor:C.green,alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:24,fontWeight:'800',color:'#fff'}}>L</Text>
            </View>
            <View>
              <Text style={{fontSize:18,fontWeight:'700',color:C.t1}}>Lucas</Text>
              <Text style={{fontSize:12,color:C.t3,marginTop:2}}>Membre depuis janvier 2025</Text>
              <View style={{marginTop:7,paddingHorizontal:10,paddingVertical:3,backgroundColor:`${C.green}15`,borderRadius:100,alignSelf:'flex-start'}}>
                <Text style={{fontSize:11,fontWeight:'600',color:C.green}}>🌱 Éco-responsable</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, {marginTop:12,padding:18}]}>
          <Text style={{fontSize:12,color:C.t3,marginBottom:4}}>Score anti-gaspillage</Text>
          <Text style={{fontSize:40,fontWeight:'800',color:C.t1,marginBottom:10}}>780</Text>
          <View style={{height:8,backgroundColor:'#EAECEF',borderRadius:4,overflow:'hidden'}}>
            <View style={{height:'100%',backgroundColor:C.green,width:'76%',borderRadius:4}}/>
          </View>
          <Text style={{fontSize:11,color:C.t3,marginTop:6}}>Level 5 · 220 pts pour le niveau 6</Text>
        </View>

        <View style={{flexDirection:'row',gap:10,marginTop:12,flexWrap:'wrap'}}>
          {[{e:'🌱',l:'Zéro Gaspi',col:C.green},{e:'🔥',l:'7j Streak',col:C.red},
            {e:'♻️',l:'Éco-Warrior',col:'#27AE60'},{e:'👨‍🍳',l:'Chef IA',col:C.yellow}].map(b => (
            <View key={b.l} style={{flex:1,minWidth:70,padding:12,borderRadius:13,
              backgroundColor:`${b.col}10`,alignItems:'center'}}>
              <Text style={{fontSize:26,marginBottom:5}}>{b.e}</Text>
              <Text style={{fontSize:11,fontWeight:'600',color:b.col}}>{b.l}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={{margin:16,padding:15,borderRadius:14,alignItems:'center',borderWidth:1.5,borderColor:'#FF3B30'}}
        onPress={async() => { await supabase.auth.signOut(); }}>
        <Text style={{color:'#FF3B30',fontWeight:'700',fontSize:15}}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── SCAN SCREEN ──────────────────────────────────────────────────────────────
const EDGE_FN_URL = 'https://mswmridpidhqqlxnxhlt.supabase.co/functions/v1/analyze-photo';

function ScanScreen({onClose, setItems, user, familyId}) {
  const [mode, setMode] = useState('choice');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState('Frigo');

  // Photo mode
  const [photoLoading, setPhotoLoading] = useState(false);
  const [detectedProducts, setDetectedProducts] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [photoLocation, setPhotoLocation] = useState('Frigo');
  const [saving, setSaving] = useState(false);

  const handleBarcode = async ({data}) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    try {
      const off = await searchOpenFoodFacts(data);
      if (off && off.name) {
        setResult({
          barcode: data, name: off.name, brand: off.brand,
          nutri: off.nutri, kcal: off.kcal, emoji: '🛒',
          days: estimateDays(off.category, off.name),
          category: off.category, imgUrl: off.imgUrl, source: 'OpenFoodFacts',
        });
      } else {
        setResult({barcode:data, name:'Produit inconnu', brand:'', emoji:'🛒', days:30, source:'Manuel'});
      }
    } catch(e) {
      Alert.alert('Erreur', 'Impossible de lire ce code-barres');
      setScanned(false);
    }
    setLoading(false);
  };

  const addProduct = async () => {
    if (!result) return;
    const newItem = {
      family_id: familyId,
      added_by: user?.id,
      name: result.name,
      emoji: result.emoji || '🛒',
      brand: result.brand || '',
      category: result.category || 'Épicerie',
      location,
      quantity: 1,
      unit: '',
      dlc: '—',
      days_left: result.days || 30,
      nutri_grade: result.nutri || null,
      kcal: result.kcal || null,
      img_url: result.imgUrl || null,
      barcode: result.barcode || null,
      consumed: false,
    };
    const {data, error} = await supabase.from('items').insert(newItem).select().single();
    if (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le produit.');
      return;
    }
    setItems(p => [...p, {...data, days: data.days_left}]);
    const locLabel = location === 'Frigo' ? 'le frigo' : location === 'Congélateur' ? 'le congélateur' : 'le placard';
    Alert.alert('✅ Ajouté !', `${result.name} rangé dans ${locLabel}.`);
    onClose();
  };

  if (mode === 'choice') return (
    <SafeAreaView style={[styles.safe, {backgroundColor:C.bg}]}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20}}>
        <Text style={styles.screenTitle}>Ajouter des produits</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={{fontSize:18,color:C.t2}}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{padding:16}}>
        {[
          {id:'barcode', e:'📊', label:'Scanner code-barres', desc:'Pointe vers le code-barres — reconnaissance instantanée', tag:'RECOMMANDÉ', col:C.green},
          {id:'photo',   e:'📷', label:'Photo des courses',   desc:'Prends en photo plusieurs produits à la fois', tag:'RAPIDE', col:C.yellow},
        ].map(m => (
          <TouchableOpacity key={m.id} onPress={() => {
            if (m.id === 'barcode') {
              if (!permission?.granted) requestPermission();
              setMode('scanner');
            } else {
              setMode('photo');
            }
          }} style={[styles.card, {marginBottom:12,padding:18,flexDirection:'row',gap:14,alignItems:'center'}]}>
            <View style={{width:52,height:52,borderRadius:15,backgroundColor:`${m.col}15`,alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:24}}>{m.e}</Text>
            </View>
            <View style={{flex:1}}>
              <View style={{flexDirection:'row',gap:8,alignItems:'center',marginBottom:4}}>
                <Text style={{fontSize:15,fontWeight:'600',color:C.t1}}>{m.label}</Text>
                <View style={{paddingHorizontal:8,paddingVertical:2,backgroundColor:`${m.col}15`,borderRadius:100}}>
                  <Text style={{fontSize:9,fontWeight:'700',color:m.col}}>{m.tag}</Text>
                </View>
              </View>
              <Text style={{fontSize:12,color:C.t3}}>{m.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  if (mode === 'scanner') {
    if (!permission?.granted) return (
      <SafeAreaView style={[styles.safe,{alignItems:'center',justifyContent:'center',padding:30}]}>
        <Text style={{fontSize:18,fontWeight:'700',color:C.t1,marginBottom:12,textAlign:'center'}}>
          Accès caméra requis
        </Text>
        <TouchableOpacity style={styles.greenBtn} onPress={requestPermission}>
          <Text style={{color:'#fff',fontWeight:'700',fontSize:15}}>Autoriser</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

    if (result) return (
      <SafeAreaView style={[styles.safe, {backgroundColor:C.bg}]}>
        <View style={{padding:20}}>
          <Text style={styles.screenTitle}>Produit détecté ✅</Text>
        </View>
        <ScrollView style={{padding:16}}>
          <View style={[styles.card, {padding:20,alignItems:'center',marginBottom:16}]}>
            {result.imgUrl
              ? <Image source={{uri:result.imgUrl}} style={{width:120,height:120,borderRadius:16,marginBottom:12}} resizeMode="contain"/>
              : <Text style={{fontSize:60,marginBottom:12}}>{result.emoji}</Text>
            }
            <Text style={{fontSize:20,fontWeight:'700',color:C.t1,marginBottom:4,textAlign:'center'}}>{result.name}</Text>
            {result.brand && <Text style={{fontSize:14,color:C.t3,marginBottom:8}}>{result.brand}</Text>}
            <View style={{flexDirection:'row',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
              <View style={{paddingHorizontal:12,paddingVertical:4,backgroundColor:`${C.green}15`,borderRadius:100}}>
                <Text style={{fontSize:12,color:C.green,fontWeight:'600'}}>
                  {result.source === 'OpenFoodFacts' ? '🌐 OpenFoodFacts' : '🔍 Inconnu'}
                </Text>
              </View>
              {result.nutri && (
                <View style={{paddingHorizontal:12,paddingVertical:4,backgroundColor:'#34C75920',borderRadius:100}}>
                  <Text style={{fontSize:12,color:'#34C759',fontWeight:'600'}}>Nutri-Score {result.nutri}</Text>
                </View>
              )}
              {result.kcal && (
                <View style={{paddingHorizontal:12,paddingVertical:4,backgroundColor:'#F0F0F0',borderRadius:100}}>
                  <Text style={{fontSize:12,color:C.t3}}>{result.kcal} kcal/100g</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.card, {padding:16, marginBottom:12}]}>
            <Text style={{fontSize:12,fontWeight:'700',color:C.t3,marginBottom:10}}>OÙ LE RANGER ?</Text>
            <View style={{flexDirection:'row',gap:8}}>
              {[{id:'Frigo',icon:'❄️'},{id:'Congélateur',icon:'🧊'},{id:'Placard',icon:'🗄️'}].map(l => (
                <TouchableOpacity key={l.id} onPress={() => setLocation(l.id)}
                  style={{flex:1,alignItems:'center',padding:10,borderRadius:12,
                    borderWidth:1.5,
                    borderColor: location===l.id ? C.green : C.border,
                    backgroundColor: location===l.id ? `${C.green}12` : C.card}}>
                  <Text style={{fontSize:22,marginBottom:4}}>{l.icon}</Text>
                  <Text style={{fontSize:11,fontWeight:'600',
                    color: location===l.id ? C.green : C.t3}}>{l.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.greenBtn} onPress={addProduct}>
            <Text style={{color:'#fff',fontWeight:'700',fontSize:15}}>✅ Ranger dans {location === 'Frigo' ? 'le frigo' : location === 'Congélateur' ? 'le congélateur' : 'le placard'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.greenBtn, {backgroundColor:'transparent',marginTop:10}]}
            onPress={() => {setResult(null); setScanned(false);}}>
            <Text style={{color:C.green,fontWeight:'700',fontSize:15}}>← Scanner un autre</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );

    return (
      <View style={{flex:1,backgroundColor:'#000'}}>
        <CameraView style={{flex:1}} facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcode}
          barcodeScannerSettings={{barcodeTypes:['ean13','ean8','code128','qr']}}/>
        <SafeAreaView style={{position:'absolute',top:0,left:0,right:0,bottom:0}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',padding:20}}>
              <TouchableOpacity onPress={onClose} style={{backgroundColor:'rgba(0,0,0,0.5)',
                width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:'#fff',fontSize:18}}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
              {loading ? (
                <View style={{backgroundColor:'rgba(0,0,0,0.7)',padding:20,borderRadius:16,alignItems:'center'}}>
                  <ActivityIndicator color={C.green} size="large"/>
                  <Text style={{color:'#fff',marginTop:10,fontWeight:'600'}}>Recherche OpenFoodFacts…</Text>
                </View>
              ) : (
                <View style={{width:260,height:180,borderRadius:20,borderWidth:2,
                  borderColor:C.green,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:'#fff',fontSize:14,opacity:.7}}>Pointe vers le code-barres</Text>
                </View>
              )}
            </View>
            <View style={{padding:20,alignItems:'center'}}>
              <Text style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>EAN-13 · EAN-8 · QR Code · Code128</Text>
            </View>
          </SafeAreaView>
      </View>
    );
  }

  const launchPhoto = async (fromCamera) => {
    setPhotoLoading(true);
    try {
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync({quality:0.7, allowsEditing:false})
        : await ImagePicker.launchImageLibraryAsync({quality:0.7, mediaTypes:['images']});

      if (picked.canceled) { setPhotoLoading(false); return; }

      const base64 = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
        encoding: 'base64',
      });

      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({imageBase64: base64, mimeType: 'image/jpeg'}),
      });
      const {products} = await res.json();
      const withIds = (products||[]).map((p,i) => ({...p, _id: i.toString(), location: 'Frigo'}));
      setDetectedProducts(withIds);
      setSelectedIds(withIds.map(p => p._id));
    } catch(e) {
      Alert.alert('Erreur', 'Impossible d\'analyser la photo.');
    }
    setPhotoLoading(false);
  };

  const updateProductLocation = (id, loc) => {
    setDetectedProducts(prev => prev.map(p => p._id === id ? {...p, location: loc} : p));
  };

  const savePhotoProducts = async () => {
    const toSave = (detectedProducts||[]).filter(p => selectedIds.includes(p._id));
    if (!toSave.length) return;
    setSaving(true);
    const rows = toSave.map(p => ({
      family_id: familyId,
      added_by: user?.id,
      name: p.name,
      emoji: p.emoji || '🛒',
      brand: p.brand || '',
      category: p.category || 'Épicerie',
      location: p.location || 'Frigo',
      quantity: 1,
      unit: '',
      dlc: p.dlc || '—',
      days_left: p.days_left || 30,
      nutri_grade: null,
      consumed: false,
    }));
    const {data, error} = await supabase.from('items').insert(rows).select();
    if (error) { Alert.alert('Erreur', 'Impossible de sauvegarder.'); setSaving(false); return; }
    setItems(prev => [...prev, ...(data||[]).map(i => ({...i, days: i.days_left}))]);
    Alert.alert('✅ Ajouté !', `${rows.length} produit${rows.length>1?'s':''} rangé${rows.length>1?'s':''}.`);
    setSaving(false);
    setDetectedProducts(null);
    setSelectedIds([]);
  };

  if (mode === 'photo') {
    if (photoLoading) return (
      <SafeAreaView style={[styles.safe,{alignItems:'center',justifyContent:'center'}]}>
        <ActivityIndicator color={C.green} size="large"/>
        <Text style={{marginTop:16,fontSize:15,fontWeight:'600',color:C.t2}}>Claude analyse ta photo…</Text>
        <Text style={{marginTop:6,fontSize:13,color:C.t3}}>Ça prend 5 à 10 secondes</Text>
      </SafeAreaView>
    );

    if (detectedProducts) return (
      <SafeAreaView style={[styles.safe,{backgroundColor:C.bg}]}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20}}>
          <Text style={styles.screenTitle}>{detectedProducts.length} produit{detectedProducts.length>1?'s':''} détecté{detectedProducts.length>1?'s':''}</Text>
          <TouchableOpacity onPress={() => setDetectedProducts(null)} style={styles.closeBtn}>
            <Text style={{fontSize:18,color:C.t2}}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{flex:1,paddingHorizontal:16}}>
          {detectedProducts.map(p => {
            const sel = selectedIds.includes(p._id);
            return (
              <View key={p._id} style={[styles.card,{marginBottom:8,padding:12,opacity:sel?1:0.45}]}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom: sel ? 10 : 0}}>
                  <TouchableOpacity onPress={() => setSelectedIds(prev =>
                    sel ? prev.filter(x => x !== p._id) : [...prev, p._id]
                  )} style={{marginRight:10}}>
                    <View style={{width:24,height:24,borderRadius:6,borderWidth:2,
                      borderColor: sel ? C.green : C.t4,
                      backgroundColor: sel ? C.green : 'transparent',
                      alignItems:'center',justifyContent:'center'}}>
                      {sel && <Text style={{color:'#fff',fontSize:13,fontWeight:'800'}}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={{fontSize:28,marginRight:10}}>{p.emoji}</Text>
                  <View style={{flex:1}}>
                    <Text style={styles.productName}>{p.name}</Text>
                    {p.brand && <Text style={styles.productSub}>{p.brand}</Text>}
                    {p.dlc && <Text style={{fontSize:11,color:C.green,fontWeight:'600'}}>DLC {p.dlc}</Text>}
                  </View>
                </View>
                {sel && (
                  <View style={{flexDirection:'row',gap:6}}>
                    {[{id:'Frigo',icon:'❄️'},{id:'Congélateur',icon:'🧊'},{id:'Placard',icon:'🗄️'}].map(l => (
                      <TouchableOpacity key={l.id} onPress={() => updateProductLocation(p._id, l.id)}
                        style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',
                          gap:4,paddingVertical:6,borderRadius:8,borderWidth:1.5,
                          borderColor: p.location===l.id ? C.green : C.border,
                          backgroundColor: p.location===l.id ? `${C.green}12` : '#FAFAFA'}}>
                        <Text style={{fontSize:14}}>{l.icon}</Text>
                        <Text style={{fontSize:10,fontWeight:'600',color: p.location===l.id ? C.green : C.t3}}>{l.id}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={[styles.greenBtn,{marginTop:4,marginBottom:10}]} onPress={savePhotoProducts} disabled={saving||selectedIds.length===0}>
            {saving ? <ActivityIndicator color="#fff"/> :
              <Text style={{color:'#fff',fontWeight:'700',fontSize:15}}>
                ✅ Ranger {selectedIds.length} produit{selectedIds.length>1?'s':''}
              </Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.greenBtn,{backgroundColor:'transparent',marginBottom:20}]} onPress={() => setDetectedProducts(null)}>
            <Text style={{color:C.green,fontWeight:'700',fontSize:15}}>← Reprendre une photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );

    return (
      <SafeAreaView style={[styles.safe,{backgroundColor:C.bg}]}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20}}>
          <Text style={styles.screenTitle}>Photo des courses</Text>
          <TouchableOpacity onPress={() => setMode('choice')} style={styles.closeBtn}>
            <Text style={{fontSize:18,color:C.t2}}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={{flex:1,padding:16,gap:12}}>
          <TouchableOpacity onPress={() => launchPhoto(true)}
            style={[styles.card,{padding:22,flexDirection:'row',gap:14,alignItems:'center'}]}>
            <Text style={{fontSize:36}}>📸</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:16,fontWeight:'700',color:C.t1,marginBottom:3}}>Prendre une photo</Text>
              <Text style={{fontSize:13,color:C.t3}}>Pose tes courses sur une table et photographie-les</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => launchPhoto(false)}
            style={[styles.card,{padding:22,flexDirection:'row',gap:14,alignItems:'center'}]}>
            <Text style={{fontSize:36}}>🖼️</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:16,fontWeight:'700',color:C.t1,marginBottom:3}}>Depuis la galerie</Text>
              <Text style={{fontSize:13,color:C.t3}}>Choisis une photo déjà prise</Text>
            </View>
          </TouchableOpacity>
          <View style={{marginTop:8,padding:14,backgroundColor:`${C.green}12`,borderRadius:14}}>
            <Text style={{fontSize:12,color:'#27AE60',lineHeight:18}}>
              💡 Claude IA reconnaît tous les produits visibles et lit les dates de péremption automatiquement
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:         {flex:1, backgroundColor:C.bg},
  screen:       {flex:1, backgroundColor:C.bg},
  screenTitle:  {fontSize:24, fontWeight:'800', color:C.t1, letterSpacing:-0.5, marginBottom:4},
  sectionTitle: {fontSize:11, fontWeight:'700', color:C.t3, letterSpacing:0.5, marginBottom:10},
  header:       {flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingBottom:14},
  headerSub:    {fontSize:13, color:C.t3},
  headerTitle:  {fontSize:22, fontWeight:'800', color:C.t1, letterSpacing:-0.5},
  notifBtn:     {width:42, height:42, borderRadius:13, backgroundColor:C.card,
                 alignItems:'center', justifyContent:'center',
                 shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:.06, shadowRadius:4},
  heroCard:     {marginHorizontal:16, marginBottom:14, borderRadius:20, padding:22,
                 backgroundColor:'#CBFADF', flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                 shadowColor:C.green, shadowOffset:{width:0,height:4}, shadowOpacity:.2, shadowRadius:12},
  heroTitle:    {fontSize:26, fontWeight:'800', color:C.t1, lineHeight:32, marginBottom:16},
  heroBtn:      {backgroundColor:'rgba(255,255,255,0.8)', paddingHorizontal:18, paddingVertical:9,
                 borderRadius:100, alignSelf:'flex-start'},
  heroEmoji:    {width:48, height:48, borderRadius:13, backgroundColor:'rgba(255,255,255,0.7)',
                 alignItems:'center', justifyContent:'center',
                 borderWidth:2, borderColor:'rgba(255,255,255,0.7)'},
  card:         {backgroundColor:C.card, borderRadius:18, marginHorizontal:16,
                 shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.07, shadowRadius:8},
  productRow:   {flexDirection:'row', alignItems:'center', padding:14},
  rowBorder:    {borderBottomWidth:1, borderBottomColor:C.border},
  productName:  {fontSize:14, fontWeight:'600', color:C.t1, marginBottom:2},
  productSub:   {fontSize:12, color:C.t3},
  urgBadge:     {paddingHorizontal:10, paddingVertical:5, borderRadius:10},
  urgText:      {color:'#fff', fontSize:12, fontWeight:'700'},
  tabBar:       {flexDirection:'row', alignItems:'center', justifyContent:'space-around',
                 backgroundColor:'#fff', paddingVertical:8, paddingBottom:Platform.OS==='ios'?20:8,
                 borderTopWidth:1, borderTopColor:C.border},
  tabItem:      {alignItems:'center', gap:2, paddingHorizontal:14},
  tabLabel:     {fontSize:10, color:C.t4},
  tabDot:       {width:5, height:5, borderRadius:3, backgroundColor:C.green, marginTop:-2},
  scanBtn:      {width:56, height:56, borderRadius:20, backgroundColor:C.green,
                 alignItems:'center', justifyContent:'center',
                 shadowColor:C.green, shadowOffset:{width:0,height:4}, shadowOpacity:.4, shadowRadius:10},
  badge:        {position:'absolute', top:-3, right:-3, width:18, height:18, borderRadius:9,
                 backgroundColor:C.red, alignItems:'center', justifyContent:'center',
                 borderWidth:2, borderColor:'#fff'},
  locTab:       {flex:1, alignItems:'center', padding:12, borderRadius:14, backgroundColor:'rgba(0,0,0,0.04)'},
  locTabActive: {backgroundColor:C.card, shadowColor:'#000', shadowOffset:{width:0,height:2},
                 shadowOpacity:.06, shadowRadius:6},
  locTabLabel:  {fontSize:11, color:C.t3, marginTop:2},
  searchBar:    {flexDirection:'row', alignItems:'center', padding:11, borderRadius:13,
                 backgroundColor:C.card, borderWidth:1, borderColor:C.border, marginBottom:12},
  fridgeRow:    {flexDirection:'row', alignItems:'center', padding:13, backgroundColor:C.card,
                 borderRadius:16, shadowColor:'#000', shadowOffset:{width:0,height:2},
                 shadowOpacity:.06, shadowRadius:8},
  greenBtn:     {backgroundColor:C.green, padding:15, borderRadius:14, alignItems:'center',
                 shadowColor:C.green, shadowOffset:{width:0,height:4}, shadowOpacity:.3, shadowRadius:10},
  closeBtn:     {width:38, height:38, borderRadius:12, backgroundColor:C.card,
                 alignItems:'center', justifyContent:'center',
                 borderWidth:1, borderColor:C.border},
});

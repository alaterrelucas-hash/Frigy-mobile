import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mswmridpidhqqlxnxhlt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zd21yaWRwaWRocXFseG54aGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODc2MjUsImV4cCI6MjA5Mzg2MzYyNX0.njAP240jTC1NEQ21NL1u6ubTWvczooWi-AVGiKmiKtA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const C = { green:'#2ECC71', red:'#FF3B30', bg:'#F0F2F5', card:'#FFF', t1:'#0D1117', t2:'#374151', t3:'#6B7280', t4:'#C0C8D0', border:'#EAECEF' };

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password) { setError('Remplis tous les champs'); return; }
    setLoading(true); setError('');
    if (mode === 'login') {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) setError(e.message);
      else onLogin(data.user);
    } else {
      const { data, error: e } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (e) setError(e.message);
      else if (data.user) onLogin(data.user);
      else setError('Verifie ton email !');
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }} contentContainerStyle={{ padding:24 }}>
      <View style={{ alignItems:'center', marginBottom:36, marginTop:40 }}>
        <Text style={{ fontSize:52 }}>🥬</Text>
        <Text style={{ fontSize:28, fontWeight:'800', color:C.t1, marginTop:12 }}>Frigy</Text>
        <Text style={{ fontSize:15, color:C.t3 }}>{mode === 'login' ? 'Bon retour !' : 'Cree ton compte'}</Text>
      </View>
      {mode === 'signup' && (
        <View style={{ marginBottom:16 }}>
          <Text style={{ fontSize:13, fontWeight:'600', color:C.t2, marginBottom:6 }}>Ton prenom</Text>
          <TextInput style={{ backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:13, padding:13, fontSize:15, color:C.t1 }}
            value={name} onChangeText={setName} placeholder="Lucas" placeholderTextColor={C.t4} />
        </View>
      )}
      <View style={{ marginBottom:16 }}>
        <Text style={{ fontSize:13, fontWeight:'600', color:C.t2, marginBottom:6 }}>Email</Text>
        <TextInput style={{ backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:13, padding:13, fontSize:15, color:C.t1 }}
          value={email} onChangeText={setEmail} placeholder="lucas@frigy.app"
          placeholderTextColor={C.t4} keyboardType="email-address" autoCapitalize="none" />
      </View>
      <View style={{ marginBottom:16 }}>
        <Text style={{ fontSize:13, fontWeight:'600', color:C.t2, marginBottom:6 }}>Mot de passe</Text>
        <TextInput style={{ backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:13, padding:13, fontSize:15, color:C.t1 }}
          value={password} onChangeText={setPassword} placeholder="••••••••"
          placeholderTextColor={C.t4} secureTextEntry />
      </View>
      {error !== '' && (
        <View style={{ padding:12, backgroundColor:'#FFF0F0', borderRadius:10, marginBottom:14 }}>
          <Text style={{ color:C.red, fontSize:13 }}>{error}</Text>
        </View>
      )}
      <TouchableOpacity style={{ backgroundColor:C.green, padding:15, borderRadius:14, alignItems:'center' }}
        onPress={handleAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> :
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>
            {mode === 'login' ? 'Se connecter' : 'Creer mon compte'}
          </Text>}
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop:16, alignItems:'center' }}
        onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
        <Text style={{ fontSize:14, color:C.t3 }}>
          {mode === 'login' ? 'Pas de compte ? ' : 'Deja un compte ? '}
          <Text style={{ color:C.green, fontWeight:'700' }}>
            {mode === 'login' ? 'Creer un compte' : 'Se connecter'}
          </Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

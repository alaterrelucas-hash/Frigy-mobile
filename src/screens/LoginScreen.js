import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../config/supabase';
import { C } from '../config/constants';
import { styles } from '../styles';

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError('');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { data, error: e } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (e) { setError(e.message); return; }
      // Apple fournit le nom uniquement au 1er login
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : null;
      onLogin(data.user, fullName);
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError("Connexion Apple impossible. Réessaie ou utilise email/mot de passe.");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) { setError('Remplis tous les champs'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email, password });
        if (e) { setError(e.message); return; }
        if (data.user) onLogin(data.user, name);
        else Alert.alert('✅ Compte créé !', 'Vérifie ton email pour confirmer.');
      } else {
        const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) { setError(e.message); return; }
        onLogin(data.user);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">

        <View style={{ alignItems: 'center', marginBottom: 36, marginTop: 40 }}>
          <Image
            source={require('../../assets/logo-text.png')}
            style={{ width: 160, height: 56 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 15, color: C.t3, marginTop: 10 }}>
            {mode === 'login' ? 'Bon retour !' : 'Crée ton compte'}
          </Text>
        </View>

        {/* Sign in with Apple */}
        {appleAvailable && (
          <View style={{ marginBottom: 20 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={mode === 'login'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={{ width: '100%', height: 50 }}
              onPress={handleAppleSignIn}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ marginHorizontal: 12, fontSize: 12, color: C.t3 }}>ou</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
          </View>
        )}

        {mode === 'signup' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.t2, marginBottom: 6 }}>Ton prénom</Text>
            <TextInput
              style={{ backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 15, color: C.t1 }}
              value={name} onChangeText={setName} placeholder="Lucas" placeholderTextColor={C.t4}
            />
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.t2, marginBottom: 6 }}>Email</Text>
          <TextInput
            style={{ backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 15, color: C.t1 }}
            value={email} onChangeText={setEmail} placeholder="lucas@frigy.app"
            placeholderTextColor={C.t4} keyboardType="email-address" autoCapitalize="none"
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.t2, marginBottom: 6 }}>Mot de passe</Text>
          <TextInput
            style={{ backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 15, color: C.t1 }}
            value={password} onChangeText={setPassword} placeholder="••••••••"
            placeholderTextColor={C.t4} secureTextEntry
          />
        </View>

        {error !== '' && (
          <View style={{ padding: 12, backgroundColor: '#FFF0F0', borderRadius: 10, marginBottom: 14 }}>
            <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={{ backgroundColor: C.green, padding: 15, borderRadius: 14, alignItems: 'center' }}
          onPress={handleAuth} disabled={loading || appleLoading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 16, alignItems: 'center' }}
          onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          <Text style={{ fontSize: 14, color: C.t3 }}>
            {mode === 'login' ? 'Pas de compte ? ' : 'Déjà un compte ? '}
            <Text style={{ color: C.green, fontWeight: '700' }}>
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

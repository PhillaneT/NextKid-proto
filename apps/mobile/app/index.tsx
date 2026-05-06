import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Sign in failed', error.message);
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', (await supabase.auth.getUser()).data.user!.id)
          .single();
        router.replace((profile?.full_name ? '/(tabs)' : '/onboarding') as never);
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert('Sign up failed', error.message);
      } else {
        Alert.alert('Check your email', 'We sent you a confirmation link. Come back here to sign in after confirming.');
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Coral top banner */}
      <View style={styles.topBanner}>
        <Text style={styles.brand}>NextKid</Text>
        <Text style={styles.tagline}>South Africa&apos;s school marketplace</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Sign in to your account' : 'Join the marketplace'}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#979797"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#979797"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.switchLink}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const CORAL = '#BE1E2D';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  topBanner: {
    backgroundColor: CORAL, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32,
  },
  brand: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  card: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, flex: 1, marginTop: -12,
  },
  title: { color: '#111', fontSize: 22, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  subtitle: { color: '#979797', fontSize: 14, marginBottom: 24 },
  label: { color: '#111', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: '#f4f4f4', borderWidth: 1, borderColor: '#dedede',
    borderRadius: 12, padding: 14, color: '#111', fontSize: 15, marginBottom: 14,
  },
  button: {
    backgroundColor: CORAL, borderRadius: 30, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#dedede' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#979797', fontSize: 13 },
  switchLink: { color: CORAL, fontWeight: '600' },
});

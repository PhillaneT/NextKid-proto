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
      <View style={styles.card}>
        <Text style={styles.brand}>NextKid</Text>
        <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Sign in to your account' : 'Join the marketplace'}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#555"
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
          placeholderTextColor="#555"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#111', borderRadius: 16, padding: 28, borderWidth: 1, borderColor: '#222' },
  brand: { color: '#a855f7', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 28 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, marginBottom: 16,
  },
  button: {
    backgroundColor: '#7c3aed', borderRadius: 10, padding: 15,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#444' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#888', fontSize: 13 },
  switchLink: { color: '#7c3aed', fontWeight: '600' },
});

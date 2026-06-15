import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { auth } from '../services/firebase';
import { colors, radius, shadow } from '../theme';

const AuthScreen = () => {
  const [phone, setPhone] = useState('+225');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  const handlePhoneSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert('Erreur', 'Entre ton numéro de téléphone');
      return;
    }
    setLoading(true);
    try {
      const result = await auth().signInWithPhoneNumber(phone.replace(/\s/g, ''));
      setConfirmation(result);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp.trim() || !confirmation) {
      Alert.alert('Erreur', 'Entre le code reçu');
      return;
    }
    setLoading(true);
    try {
      await confirmation.confirm(otp);
    } catch (error: any) {
      Alert.alert('Erreur', 'Code incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <Image
          source={require('../assets/logo_clean.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>BabyPhone CIV</Text>
        <Text style={styles.subtitle}>
          Gardez une oreille sur bébé, où que vous soyez
        </Text>
      </View>

      <View style={styles.card}>
        {!confirmation ? (
          <>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+225 07 00 00 00 00"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              editable={!loading}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handlePhoneSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Recevoir le code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Code reçu par SMS</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="••••••"
              placeholderTextColor={colors.muted}
              value={otp}
              onChangeText={setOtp}
              editable={!loading}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleOtpSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Se connecter</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setConfirmation(null);
                setOtp('');
              }}
              disabled={loading}
            >
              <Text style={styles.linkText}>← Changer de numéro</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.footer}>🇨🇮 Fait en Côte d'Ivoire</Text>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: 24,
  },
  hero: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 150, height: 150, marginBottom: 8 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.greenDark,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 22,
    ...shadow,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.greenDark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    fontSize: 17,
    color: colors.text,
    marginBottom: 16,
  },
  otpInput: { letterSpacing: 8, textAlign: 'center', fontSize: 22 },
  button: {
    backgroundColor: colors.green,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  linkText: {
    color: colors.orange,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 28,
    fontSize: 13,
  },
});

export default AuthScreen;

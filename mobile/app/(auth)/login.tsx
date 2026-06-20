import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FieldErrors = Partial<Record<'email' | 'password', string>>;

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
    title: { fontSize: 32, fontWeight: 'bold', color: c.text, textAlign: 'center', marginBottom: spacing.xs },
    subtitle: { fontSize: fontSizes.sm, color: c.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
    form: { gap: spacing.sm },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSizes.md,
      color: c.text,
    },
    inputError: { borderColor: c.error },
    errorText: { fontSize: fontSizes.xs, color: c.error, marginTop: -spacing.xs },
    button: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    linkButton: { alignItems: 'center', paddingVertical: spacing.sm },
    linkText: { color: c.primary, fontSize: fontSizes.sm },
  });

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const setTokens = useAuthStore((s) => s.setTokens);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogin = async () => {
    const result = LoginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post<{
        data: { accessToken: string; refreshToken: string };
      }>('/auth/login', result.data);
      await setTokens(data.data.accessToken, data.data.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: { message?: string } })?.error?.message ?? 'Login failed'
        : 'Login failed';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Daily Learn</Text>
          <Text style={styles.subtitle}>Build better habits, one question at a time.</Text>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            </TouchableOpacity>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkButton} accessibilityRole="link">
                <Text style={styles.linkText}>{"Don't have an account? Register"}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

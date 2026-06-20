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

const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>;

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

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const setTokens = useAuthStore((s) => s.setTokens);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleRegister = async () => {
    const result = RegisterSchema.safeParse({ email, password, confirmPassword });
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
      }>('/auth/register', { email: result.data.email, password: result.data.password });
      await setTokens(data.data.accessToken, data.data.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: { message?: string } })?.error?.message ??
          'Registration failed'
        : 'Registration failed';
      Alert.alert('Registration Failed', msg);
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your daily learning journey.</Text>

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
              placeholder="Password (min 8 characters)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {errors.confirmPassword ? (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              onPress={handleRegister}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.linkButton} accessibilityRole="link">
                <Text style={styles.linkText}>Already have an account? Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

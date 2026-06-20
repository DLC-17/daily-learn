import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.lg },
    heading: {
      fontSize: fontSizes.xxl,
      fontWeight: 'bold',
      color: c.text,
      marginBottom: spacing.lg,
    },
    section: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    sectionLabel: {
      fontSize: fontSizes.xs,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    rowFirst: { borderTopWidth: 0 },
    rowLabel: { flex: 1, fontSize: fontSizes.md, color: c.text },
    signOutCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    signOutRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    signOutText: { fontSize: fontSizes.md, fontWeight: '600', color: c.error },
  });

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const isDark = useThemeStore((s) => s.isDark);
  const toggle = useThemeStore((s) => s.toggle);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.heading}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={[styles.row, styles.rowFirst]}>
            <Text style={styles.rowLabel}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={() => void toggle()}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.signOutCard}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

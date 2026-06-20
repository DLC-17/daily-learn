import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGradientColors } from '../hooks/useColors';

interface Props {
  children: ReactNode;
  applyTopInset?: boolean;
}

export function ScreenWrapper({ children, applyTopInset = true }: Props) {
  const insets = useSafeAreaInsets();
  const gradientColors = useGradientColors();
  return (
    <LinearGradient
      colors={gradientColors}
      style={[styles.container, applyTopInset ? { paddingTop: insets.top } : null]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

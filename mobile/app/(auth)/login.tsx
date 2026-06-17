import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../constants/theme';

// Full implementation in Domain I
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Learn</Text>
      <Text style={styles.subtitle}>Login — coming in Domain I</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});

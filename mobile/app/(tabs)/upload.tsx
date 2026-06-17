import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../constants/theme';

// Full implementation in Domain J
export default function UploadScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload</Text>
      <Text style={styles.subtitle}>File upload & question generation — coming in Domain J</Text>
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
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});

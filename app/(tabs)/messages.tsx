import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, spacing } from '@/constants/theme';

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mensajes</Text>
      <Text style={styles.subtitle}>
        Lista de conversaciones comprador-vendedor, con confirmación de lectura (✓✓).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkSoft,
  },
});

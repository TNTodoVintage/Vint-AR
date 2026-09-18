import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, spacing } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.subtitle}>
        Publicaciones activas, historial de ventas y calificación recibida.
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

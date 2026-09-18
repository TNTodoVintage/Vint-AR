import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, spacing } from '@/constants/theme';

export default function NewListingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Publicar artículo</Text>
      <Text style={styles.subtitle}>
        Fotos reordenables, categoría, estado, talle, precio, ubicación y descripción.
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
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkSoft,
  },
});

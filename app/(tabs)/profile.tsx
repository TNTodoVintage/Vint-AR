import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const name = (session?.user.user_metadata?.name as string | undefined) || 'Sin nombre';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>{session?.user.email}</Text>

      <Text style={styles.section}>
        Publicaciones activas, historial de ventas y calificación recibida.
      </Text>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
  },
  section: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkSoft,
  },
  signOutButton: {
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.brick,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.brick,
  },
});

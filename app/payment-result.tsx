import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';

const COPY: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }> = {
  success: {
    icon: 'checkmark-circle',
    color: colors.olive,
    title: '¡Pago realizado!',
    body: 'Tu pago quedó retenido de forma segura. Se lo liberamos al vendedor apenas confirmes que te llegó el artículo.',
  },
  pending: {
    icon: 'time-outline',
    color: colors.mustard,
    title: 'Pago en proceso',
    body: 'Mercado Pago todavía está procesando tu pago. Te avisamos apenas se confirme.',
  },
  failure: {
    icon: 'close-circle',
    color: colors.brick,
    title: 'No se pudo procesar el pago',
    body: 'Algo falló con Mercado Pago. Podés volver a intentarlo desde la publicación.',
  },
};

export default function PaymentResultScreen() {
  const { status } = useLocalSearchParams<{ order_id?: string; status?: string }>();
  const copy = COPY[status ?? ''] ?? COPY.pending;

  return (
    <View style={styles.container}>
      <Ionicons name={copy.icon} size={64} color={copy.color} />
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <Pressable style={styles.button} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.buttonText}>Volver a Vint AR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.olive,
    borderRadius: radii.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.paperElevated,
  },
});

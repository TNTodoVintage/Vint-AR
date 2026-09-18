import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import type { Listing } from '@/types/database';

export function formatPrice(price: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price);
}

interface Props {
  listing: Pick<Listing, 'id' | 'title' | 'price' | 'location' | 'condition' | 'photo_urls'>;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function ListingCard({ listing, isFavorite, onToggleFavorite }: Props) {
  const photo = listing.photo_urls?.[0];

  return (
    <View style={styles.card}>
      <Link href={{ pathname: '/listing/[id]', params: { id: listing.id } }} asChild>
        <Pressable style={styles.pressable}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text style={styles.price}>{formatPrice(Number(listing.price))}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[listing.location, listing.condition].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
      </Link>
      {onToggleFavorite ? (
        <Pressable style={styles.favoriteButton} onPress={onToggleFavorite}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={16}
            color={colors.brick}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.paperElevated,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressable: {
    flex: 1,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.line,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.line,
  },
  info: {
    padding: spacing.sm,
    gap: 3,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  price: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.mustard,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.xs + 4,
    right: spacing.xs + 4,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(247,243,233,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

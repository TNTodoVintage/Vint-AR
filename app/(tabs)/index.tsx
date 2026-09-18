import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { Text, View } from '@/components/Themed';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Category, Listing } from '@/types/database';

const CATEGORIES: Array<Category | 'Todos'> = [
  'Todos',
  'Ropa',
  'Calzado',
  'Accesorios',
  'Hogar vintage',
];

type FeedListing = Pick<
  Listing,
  'id' | 'title' | 'price' | 'category' | 'condition' | 'location' | 'photo_urls'
>;

export default function FeedScreen() {
  const { session } = useAuth();
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('Todos');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    const [listingsResult, favoritesResult] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, price, category, condition, location, photo_urls')
        .eq('status', 'activo')
        .order('created_at', { ascending: false }),
      session
        ? supabase.from('favorites').select('listing_id').eq('user_id', session.user.id)
        : Promise.resolve({
            data: [] as { listing_id: string }[],
            error: null as { message: string } | null,
          }),
    ]);

    if (listingsResult.error) {
      setErrorMessage(listingsResult.error.message);
    } else {
      setListings(listingsResult.data ?? []);
    }

    if (!favoritesResult.error) {
      setFavoriteIds(new Set((favoritesResult.data ?? []).map((f) => f.listing_id)));
    }
  }, [session]);

  const hasLoadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) setIsLoading(true);
      load().finally(() => {
        hasLoadedOnce.current = true;
        setIsLoading(false);
      });
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!session) return;
      const userId = session.user.id;
      const alreadyFavorite = favoriteIds.has(listingId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (alreadyFavorite) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      let error: { message: string } | null;
      if (alreadyFavorite) {
        ({ error } = await supabase
          .from('favorites')
          .delete()
          .eq('listing_id', listingId)
          .eq('user_id', userId));
      } else {
        ({ error } = await supabase
          .from('favorites')
          .insert({ listing_id: listingId, user_id: userId }));
      }

      if (error) {
        // revert on failure
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (alreadyFavorite) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      }
    },
    [favoriteIds, session]
  );

  const filteredListings =
    activeCategory === 'Todos'
      ? listings
      : listings.filter((l) => l.category === activeCategory);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Vint AR</Text>
      </View>

      <FlatList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsList}
        renderItem={({ item }) => {
          const active = item === activeCategory;
          return (
            <Pressable
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveCategory(item)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.olive} />
        </View>
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>No pudimos cargar el feed: {errorMessage}</Text>
        </View>
      ) : filteredListings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {listings.length === 0
              ? 'Todavía no hay publicaciones. ¡Sé el primero en publicar!'
              : 'No hay publicaciones en esta categoría.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.olive}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              isFavorite={favoriteIds.has(item.id)}
              onToggleFavorite={session ? () => toggleFavorite(item.id) : undefined}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  logo: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.olive,
  },
  chipsList: {
    flexGrow: 0,
  },
  chipsRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  chipActive: {
    backgroundColor: colors.olive,
    borderColor: colors.olive,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.paperElevated,
  },
  grid: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.brick,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});

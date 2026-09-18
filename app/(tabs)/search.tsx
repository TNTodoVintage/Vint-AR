import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View as RNView } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { LocationPicker } from '@/components/LocationPicker';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Listing } from '@/types/database';

type ResultListing = Pick<
  Listing,
  'id' | 'title' | 'price' | 'location' | 'condition' | 'photo_urls' | 'created_at'
>;

type SortBy = 'reciente' | 'precio_asc' | 'precio_desc';

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'reciente', label: 'Más reciente' },
  { key: 'precio_asc', label: 'Menor precio' },
  { key: 'precio_desc', label: 'Mayor precio' },
];

const LISTING_COLUMNS = 'id, title, price, location, condition, photo_urls, created_at';

export default function SearchScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [city, setCity] = useState('');
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('reciente');
  const [results, setResults] = useState<ResultListing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      const trimmedQuery = query.trim();
      const min = Number(minPrice);
      const max = Number(maxPrice);
      const trimmedCity = city.trim();

      const applyFilters = (q: any) => {
        let next = q.eq('status', 'activo');
        if (trimmedCity) next = next.ilike('location', `%${trimmedCity}%`);
        if (minPrice && Number.isFinite(min)) next = next.gte('price', min);
        if (maxPrice && Number.isFinite(max)) next = next.lte('price', max);
        if (sortBy === 'reciente') next = next.order('created_at', { ascending: false });
        if (sortBy === 'precio_asc') next = next.order('price', { ascending: true });
        if (sortBy === 'precio_desc') next = next.order('price', { ascending: false });
        return next;
      };

      let matches: ResultListing[] = [];

      if (!trimmedQuery) {
        const { data } = await applyFilters(
          supabase.from('listings').select(LISTING_COLUMNS)
        );
        matches = data ?? [];
      } else {
        const [{ data: byTitle }, { data: matchingSellers }] = await Promise.all([
          applyFilters(
            supabase.from('listings').select(LISTING_COLUMNS).ilike('title', `%${trimmedQuery}%`)
          ),
          supabase.from('profiles').select('id').ilike('name', `%${trimmedQuery}%`),
        ]);

        const sellerIds = (matchingSellers ?? []).map((p) => p.id);
        let bySeller: ResultListing[] = [];
        if (sellerIds.length > 0) {
          const { data } = await applyFilters(
            supabase.from('listings').select(LISTING_COLUMNS).in('seller_id', sellerIds)
          );
          bySeller = data ?? [];
        }

        const merged = new Map<string, ResultListing>();
        [...(byTitle ?? []), ...bySeller].forEach((item) => merged.set(item.id, item));
        matches = Array.from(merged.values());
        if (sortBy === 'reciente') matches.sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (sortBy === 'precio_asc') matches.sort((a, b) => Number(a.price) - Number(b.price));
        if (sortBy === 'precio_desc') matches.sort((a, b) => Number(b.price) - Number(a.price));
      }

      const { data: favoritesData } = session
        ? await supabase.from('favorites').select('listing_id').eq('user_id', session.user.id)
        : { data: [] as { listing_id: string }[] };

      if (!cancelled) {
        setResults(matches);
        setFavoriteIds(new Set((favoritesData ?? []).map((f) => f.listing_id)));
        setIsLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, minPrice, maxPrice, city, sortBy, session]);

  const toggleFavorite = async (listingId: string) => {
    if (!session) return;
    const already = favoriteIds.has(listingId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (already) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    if (already) {
      await supabase
        .from('favorites')
        .delete()
        .eq('listing_id', listingId)
        .eq('user_id', session.user.id);
    } else {
      await supabase.from('favorites').insert({ listing_id: listingId, user_id: session.user.id });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Buscar</Text>
        <RNView style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Título o vendedor"
            placeholderTextColor={colors.inkSoft}
            value={query}
            onChangeText={setQuery}
          />
        </RNView>

        <RNView style={styles.filtersRow}>
          <TextInput
            style={[styles.filterInput, styles.flex1]}
            placeholder="Precio mín"
            placeholderTextColor={colors.inkSoft}
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
          />
          <TextInput
            style={[styles.filterInput, styles.flex1]}
            placeholder="Precio máx"
            placeholderTextColor={colors.inkSoft}
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
          />
          <Pressable
            style={[styles.filterInput, styles.flex1, styles.cityButton]}
            onPress={() => setIsLocationPickerVisible(true)}>
            <Text
              style={city ? styles.cityButtonText : styles.cityButtonPlaceholder}
              numberOfLines={1}>
              {city || 'Ciudad'}
            </Text>
            {city ? (
              <Pressable onPress={() => setCity('')} hitSlop={8}>
                <Ionicons name="close-circle" size={15} color={colors.inkSoft} />
              </Pressable>
            ) : null}
          </Pressable>
        </RNView>

        <RNView style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
              onPress={() => setSortBy(opt.key)}>
              <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </RNView>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.olive} />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No encontramos publicaciones con esos filtros.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              isFavorite={favoriteIds.has(item.id)}
              onToggleFavorite={session ? () => toggleFavorite(item.id) : undefined}
            />
          )}
        />
      )}

      <LocationPicker
        visible={isLocationPickerVisible}
        onClose={() => setIsLocationPickerVisible(false)}
        onSelect={setCity}
      />
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
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flex1: {
    flex: 1,
  },
  filterInput: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  cityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  cityButtonText: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  cityButtonPlaceholder: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  sortChipActive: {
    backgroundColor: colors.olive,
    borderColor: colors.olive,
  },
  sortChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  sortChipTextActive: {
    color: colors.paperElevated,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  grid: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View as RNView } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Listing, Profile } from '@/types/database';

type OwnListing = Pick<
  Listing,
  'id' | 'title' | 'price' | 'condition' | 'location' | 'photo_urls' | 'status'
>;

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<OwnListing[]>([]);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'activas' | 'vendidas'>('activas');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;

    const [{ data: profileData }, { data: listingsData }, { data: ratingsData }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase
          .from('listings')
          .select('id, title, price, condition, location, photo_urls, status')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('ratings').select('stars').eq('seller_id', userId),
      ]);

    setProfile(profileData ?? null);
    setListings(listingsData ?? []);
    if (ratingsData && ratingsData.length > 0) {
      const avg = ratingsData.reduce((sum, r) => sum + r.stars, 0) / ratingsData.length;
      setRating({ avg, count: ratingsData.length });
    } else {
      setRating(null);
    }
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.olive} />
      </View>
    );
  }

  const activeListings = listings.filter((l) => l.status === 'activo');
  const soldListings = listings.filter((l) => l.status === 'vendido');
  const shownListings = activeTab === 'activas' ? activeListings : soldListings;
  const name = profile?.name || 'Sin nombre';

  return (
    <FlatList
      style={styles.container}
      data={shownListings}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <RNView style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </RNView>
            <Text style={styles.name}>{name}</Text>
            {profile?.location ? <Text style={styles.location}>{profile.location}</Text> : null}
            <RNView style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={colors.mustard} />
              <Text style={styles.ratingText}>
                {rating ? `${rating.avg.toFixed(1)} · ${rating.count} calificaciones` : 'Sin calificaciones todavía'}
              </Text>
            </RNView>
          </View>

          <RNView style={styles.statsRow}>
            <RNView style={styles.stat}>
              <Text style={styles.statNumber}>{activeListings.length}</Text>
              <Text style={styles.statLabel}>Activas</Text>
            </RNView>
            <RNView style={styles.statDivider} />
            <RNView style={styles.stat}>
              <Text style={styles.statNumber}>{soldListings.length}</Text>
              <Text style={styles.statLabel}>Vendidas</Text>
            </RNView>
            <RNView style={styles.statDivider} />
            <RNView style={styles.stat}>
              <Text style={[styles.statNumber, styles.statNumberMustard]}>
                {rating ? rating.avg.toFixed(1) : '—'}
              </Text>
              <Text style={styles.statLabel}>Calificación</Text>
            </RNView>
          </RNView>

          <RNView style={styles.tabsRow}>
            <Pressable
              style={[styles.tab, activeTab === 'activas' && styles.tabActive]}
              onPress={() => setActiveTab('activas')}>
              <Text style={[styles.tabText, activeTab === 'activas' && styles.tabTextActive]}>
                Activas
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'vendidas' && styles.tabActive]}
              onPress={() => setActiveTab('vendidas')}>
              <Text style={[styles.tabText, activeTab === 'vendidas' && styles.tabTextActive]}>
                Vendidas
              </Text>
            </Pressable>
          </RNView>

          {shownListings.length === 0 ? (
            <Text style={styles.emptyText}>
              {activeTab === 'activas'
                ? 'Todavía no tenés publicaciones activas.'
                : 'Todavía no vendiste nada.'}
            </Text>
          ) : null}
        </>
      }
      renderItem={({ item }) => <ListingCard listing={item} />}
      ListFooterComponent={
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    color: colors.olive,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    marginTop: spacing.xs,
  },
  location: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  stat: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.line,
  },
  statNumber: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
  },
  statNumberMustard: {
    color: colors.mustard,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.olive,
  },
  tabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  tabTextActive: {
    fontFamily: fonts.bodySemiBold,
    color: colors.paperElevated,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  grid: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  signOutButton: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.brick,
    borderRadius: radii.sm,
    paddingVertical: 12,
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.brick,
  },
});

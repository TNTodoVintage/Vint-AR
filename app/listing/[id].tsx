import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { formatPrice } from '@/components/ListingCard';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Listing, Profile, Rating } from '@/types/database';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [soldToBuyer, setSoldToBuyer] = useState<Profile | null>(null);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isSoldModalVisible, setIsSoldModalVisible] = useState(false);
  const [buyers, setBuyers] = useState<Profile[]>([]);
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);
  const [isMarkingSold, setIsMarkingSold] = useState(false);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [draftStars, setDraftStars] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: listingData } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (!listingData) {
      setListing(null);
      setIsLoading(false);
      return;
    }
    setListing(listingData);

    const [{ data: sellerData }, { data: ratingsData }, favoriteResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', listingData.seller_id).single(),
      supabase.from('ratings').select('stars').eq('seller_id', listingData.seller_id),
      session
        ? supabase
            .from('favorites')
            .select('listing_id')
            .eq('listing_id', id)
            .eq('user_id', session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setSeller(sellerData ?? null);

    if (listingData.sold_to) {
      const { data: buyerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', listingData.sold_to)
        .single();
      setSoldToBuyer(buyerData ?? null);
    } else {
      setSoldToBuyer(null);
    }

    if (ratingsData && ratingsData.length > 0) {
      const avg = ratingsData.reduce((sum, r) => sum + r.stars, 0) / ratingsData.length;
      setRating({ avg, count: ratingsData.length });
    } else {
      setRating(null);
    }
    setIsFavorite(!!favoriteResult.data);

    const isBuyerOfThisSale = session && listingData.sold_to === session.user.id;
    if (isBuyerOfThisSale) {
      const { data: myRatingData } = await supabase
        .from('ratings')
        .select('*')
        .eq('seller_id', listingData.seller_id)
        .eq('rater_id', session.user.id)
        .maybeSingle();
      setMyRating(myRatingData ?? null);
    } else {
      setMyRating(null);
    }

    setIsLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleFavorite = async () => {
    if (!session || !listing) return;
    const next = !isFavorite;
    setIsFavorite(next);
    if (next) {
      await supabase
        .from('favorites')
        .insert({ listing_id: listing.id, user_id: session.user.id });
    } else {
      await supabase
        .from('favorites')
        .delete()
        .eq('listing_id', listing.id)
        .eq('user_id', session.user.id);
    }
  };

  const onShare = () => {
    if (!listing) return;
    Share.share({
      message: `Mirá "${listing.title}" en Vint AR — ${formatPrice(Number(listing.price))}`,
    });
  };

  const startConversation = async () => {
    if (!session || !listing) return;
    setIsStartingChat(true);
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', session.user.id)
        .maybeSingle();

      if (existing) {
        router.push({ pathname: '/chat/[conversationId]', params: { conversationId: existing.id } });
        return;
      }

      const { data: created, error } = await supabase
        .from('conversations')
        .insert({
          listing_id: listing.id,
          buyer_id: session.user.id,
          seller_id: listing.seller_id,
        })
        .select('id')
        .single();

      if (error || !created) return;
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId: created.id } });
    } finally {
      setIsStartingChat(false);
    }
  };

  const openSoldModal = async () => {
    if (!listing || !session) return;
    setIsSoldModalVisible(true);
    setIsLoadingBuyers(true);
    const { data: conversations } = await supabase
      .from('conversations')
      .select('buyer_id')
      .eq('listing_id', listing.id)
      .eq('seller_id', session.user.id);

    const buyerIds = [...new Set((conversations ?? []).map((c) => c.buyer_id))];
    if (buyerIds.length === 0) {
      setBuyers([]);
      setIsLoadingBuyers(false);
      return;
    }
    const { data: buyerProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', buyerIds);
    setBuyers(buyerProfiles ?? []);
    setIsLoadingBuyers(false);
  };

  const markAsSold = async (buyerId: string) => {
    if (!listing) return;
    setIsMarkingSold(true);
    const { error } = await supabase
      .from('listings')
      .update({ status: 'vendido', sold_to: buyerId, sold_at: new Date().toISOString() })
      .eq('id', listing.id);
    setIsMarkingSold(false);
    if (!error) {
      setIsSoldModalVisible(false);
      load();
    }
  };

  const submitRating = async () => {
    if (!listing || !session || draftStars === 0) return;
    setIsSubmittingRating(true);
    const { error } = await supabase.from('ratings').insert({
      seller_id: listing.seller_id,
      rater_id: session.user.id,
      stars: draftStars,
      comment: draftComment.trim() || null,
    });
    setIsSubmittingRating(false);
    if (!error) {
      setDraftStars(0);
      setDraftComment('');
      load();
    }
  };

  const onScrollPhotos = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPhotoIndex(index);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.olive} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.subtitle}>No encontramos esta publicación.</Text>
      </View>
    );
  }

  const isOwner = session?.user.id === listing.seller_id;
  const photos = listing.photo_urls ?? [];

  return (
    <View style={styles.container}>
      <ScrollView>
        <RNView style={styles.photoWrap}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollPhotos}>
              {photos.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{ width: SCREEN_WIDTH, height: 300 }}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <RNView style={[styles.photoPlaceholder, { width: SCREEN_WIDTH }]} />
          )}

          {photos.length > 1 ? (
            <RNView style={styles.dots}>
              {photos.map((url, i) => (
                <RNView key={url} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </RNView>
          ) : null}

          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </Pressable>

          <RNView style={styles.topRightActions}>
            {session ? (
              <Pressable style={styles.iconButton} onPress={toggleFavorite}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={17}
                  color={colors.brick}
                />
              </Pressable>
            ) : null}
            <Pressable style={styles.iconButton} onPress={onShare}>
              <Ionicons name="share-outline" size={17} color={colors.ink} />
            </Pressable>
          </RNView>

          {listing.status === 'vendido' ? (
            <RNView style={styles.soldBadge}>
              <Text style={styles.soldBadgeText}>Vendido</Text>
            </RNView>
          ) : null}
        </RNView>

        <View style={styles.info}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>{formatPrice(Number(listing.price))}</Text>
          <RNView style={styles.metaRow}>
            {listing.size ? <MetaChip label={`Talle ${listing.size}`} /> : null}
            <MetaChip label={listing.condition} />
            {listing.location ? <MetaChip label={listing.location} /> : null}
          </RNView>
        </View>

        {seller ? (
          <View style={styles.sellerCard}>
            <RNView style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>
                {(seller.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </RNView>
            <RNView style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{seller.name ?? 'Sin nombre'}</Text>
              {rating ? (
                <RNView style={styles.ratingRow}>
                  <Ionicons name="star" size={11} color={colors.mustard} />
                  <Text style={styles.ratingText}>
                    {rating.avg.toFixed(1)} · {rating.count} calificaciones
                  </Text>
                </RNView>
              ) : (
                <Text style={styles.ratingText}>Sin calificaciones todavía</Text>
              )}
            </RNView>
          </View>
        ) : null}

        {session && listing.status === 'vendido' && listing.sold_to === session.user.id ? (
          <View style={styles.ratingCard}>
            {myRating ? (
              <>
                <Text style={styles.label}>TU CALIFICACIÓN</Text>
                <RNView style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= myRating.stars ? 'star' : 'star-outline'}
                      size={18}
                      color={colors.mustard}
                    />
                  ))}
                </RNView>
                {myRating.comment ? (
                  <Text style={styles.descriptionText}>{myRating.comment}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.label}>CALIFICÁ A ESTE VENDEDOR</Text>
                <RNView style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setDraftStars(n)} hitSlop={6}>
                      <Ionicons
                        name={n <= draftStars ? 'star' : 'star-outline'}
                        size={26}
                        color={colors.mustard}
                      />
                    </Pressable>
                  ))}
                </RNView>
                <TextInput
                  style={styles.ratingInput}
                  placeholder="Contá cómo fue la compra (opcional)"
                  placeholderTextColor={colors.inkSoft}
                  value={draftComment}
                  onChangeText={setDraftComment}
                  multiline
                />
                <Pressable
                  style={[styles.ratingSubmit, draftStars === 0 && styles.ratingSubmitDisabled]}
                  onPress={submitRating}
                  disabled={draftStars === 0 || isSubmittingRating}>
                  {isSubmittingRating ? (
                    <ActivityIndicator color={colors.paperElevated} />
                  ) : (
                    <Text style={styles.messageButtonText}>Enviar calificación</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {listing.description ? (
          <View style={styles.description}>
            <Text style={styles.label}>DESCRIPCIÓN</Text>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {isOwner ? (
          listing.status === 'vendido' ? (
            <RNView style={styles.ownerNotice}>
              <Text style={styles.ownerNoticeText}>
                {soldToBuyer ? `Vendido a ${soldToBuyer.name ?? 'un comprador'}` : 'Vendido'}
              </Text>
            </RNView>
          ) : (
            <Pressable style={styles.soldButton} onPress={openSoldModal}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.paperElevated} />
              <Text style={styles.messageButtonText}>Marcar como vendido</Text>
            </Pressable>
          )
        ) : session ? (
          <Pressable style={styles.messageButton} onPress={startConversation} disabled={isStartingChat}>
            {isStartingChat ? (
              <ActivityIndicator color={colors.paperElevated} />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={16} color={colors.paperElevated} />
                <Text style={styles.messageButtonText}>Enviar mensaje</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={isSoldModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsSoldModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsSoldModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>¿A quién le vendiste?</Text>
            {isLoadingBuyers ? (
              <ActivityIndicator color={colors.olive} style={styles.modalLoading} />
            ) : buyers.length === 0 ? (
              <Text style={styles.modalEmpty}>
                Todavía nadie te escribió por este artículo. Necesitás al menos una conversación
                para elegir el comprador.
              </Text>
            ) : (
              buyers.map((buyer) => (
                <Pressable
                  key={buyer.id}
                  style={styles.buyerRow}
                  onPress={() => markAsSold(buyer.id)}
                  disabled={isMarkingSold}>
                  <RNView style={styles.sellerAvatar}>
                    <Text style={styles.sellerAvatarText}>
                      {(buyer.name ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </RNView>
                  <Text style={styles.buyerName}>{buyer.name ?? 'Sin nombre'}</Text>
                  {isMarkingSold ? <ActivityIndicator color={colors.olive} /> : null}
                </Pressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <RNView style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </RNView>
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
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
  },
  photoWrap: {
    position: 'relative',
  },
  photoPlaceholder: {
    height: 300,
    backgroundColor: colors.line,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(33,31,26,0.25)',
  },
  dotActive: {
    backgroundColor: colors.olive,
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(247,243,233,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightActions: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(247,243,233,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldBadge: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.brick,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  soldBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.paperElevated,
  },
  info: {
    padding: spacing.md,
    gap: 6,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  price: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.mustard,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  sellerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: colors.olive,
  },
  sellerInfo: {
    flex: 1,
    gap: 2,
  },
  sellerName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  ratingCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
    gap: spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingInput: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  ratingSubmit: {
    alignItems: 'center',
    backgroundColor: colors.olive,
    borderRadius: radii.sm,
    paddingVertical: 12,
  },
  ratingSubmitDisabled: {
    opacity: 0.5,
  },
  description: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  descriptionText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.olive,
    borderRadius: radii.sm,
    paddingVertical: 13,
  },
  messageButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.paperElevated,
  },
  ownerNotice: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  ownerNoticeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  soldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.olive,
    borderRadius: radii.sm,
    paddingVertical: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(33,31,26,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    marginBottom: spacing.xs,
  },
  modalLoading: {
    paddingVertical: spacing.lg,
  },
  modalEmpty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 19,
    paddingBottom: spacing.md,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  buyerName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface ConversationRow {
  id: string;
  listingTitle: string;
  otherName: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: boolean;
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  if (isToday) return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export default function MessagesScreen() {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;

    const { data: rows } = await supabase
      .from('conversations')
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('last_at', { ascending: false, nullsFirst: false });

    if (!rows || rows.length === 0) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    const listingIds = [...new Set(rows.map((r) => r.listing_id))];
    const otherIds = [
      ...new Set(rows.map((r) => (r.buyer_id === userId ? r.seller_id : r.buyer_id))),
    ];

    const [{ data: listings }, { data: profiles }] = await Promise.all([
      supabase.from('listings').select('id, title').in('id', listingIds),
      supabase.from('profiles').select('id, name').in('id', otherIds),
    ]);

    const listingTitleById = new Map((listings ?? []).map((l) => [l.id, l.title]));
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name ?? 'Sin nombre']));

    setConversations(
      rows.map((r) => {
        const isBuyer = r.buyer_id === userId;
        const otherId = isBuyer ? r.seller_id : r.buyer_id;
        return {
          id: r.id,
          listingTitle: listingTitleById.get(r.listing_id) ?? 'Publicación',
          otherName: nameById.get(otherId) ?? 'Sin nombre',
          lastMessage: r.last_message,
          lastAt: r.last_at,
          unread: isBuyer ? r.buyer_unread : r.seller_unread,
        };
      })
    );
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Todavía no tenés conversaciones.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/chat/[conversationId]', params: { conversationId: item.id } })
              }>
              <RNView style={styles.avatar}>
                <Text style={styles.avatarText}>{item.otherName.charAt(0).toUpperCase()}</Text>
              </RNView>
              <RNView style={styles.rowInfo}>
                <RNView style={styles.rowTop}>
                  <Text style={[styles.name, item.unread && styles.nameUnread]} numberOfLines={1}>
                    {item.otherName}
                  </Text>
                  <Text style={styles.time}>{formatTime(item.lastAt)}</Text>
                </RNView>
                <Text style={styles.listingTitle} numberOfLines={1}>
                  {item.listingTitle}
                </Text>
                <Text
                  style={[styles.preview, item.unread && styles.previewUnread]}
                  numberOfLines={1}>
                  {item.lastMessage ?? 'Sin mensajes todavía'}
                </Text>
              </RNView>
              {item.unread ? <RNView style={styles.dot} /> : null}
            </Pressable>
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
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: colors.olive,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    flexShrink: 1,
  },
  nameUnread: {
    fontFamily: fonts.bodySemiBold,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  listingTitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  previewUnread: {
    fontFamily: fonts.bodySemiBold,
    color: colors.ink,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.brick,
  },
});

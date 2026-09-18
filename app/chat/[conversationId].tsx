import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { formatPrice } from '@/components/ListingCard';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/database';

interface ConversationHeader {
  listingTitle: string;
  listingPrice: number;
  otherName: string;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const listRef = useRef<FlatList>(null);

  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId || !session) return;

    const { data: conversation } = await supabase
      .from('conversations')
      .select('listing_id, buyer_id, seller_id')
      .eq('id', conversationId)
      .single();

    if (conversation) {
      const isBuyer = conversation.buyer_id === session.user.id;
      const otherId = isBuyer ? conversation.seller_id : conversation.buyer_id;

      const [{ data: listing }, { data: other }] = await Promise.all([
        supabase.from('listings').select('title, price').eq('id', conversation.listing_id).single(),
        supabase.from('profiles').select('name').eq('id', otherId).single(),
      ]);

      if (listing && other) {
        setHeader({
          listingTitle: listing.title,
          listingPrice: Number(listing.price),
          otherName: other.name ?? 'Sin nombre',
        });
      }

      if (isBuyer) {
        await supabase
          .from('conversations')
          .update({ buyer_unread: false })
          .eq('id', conversationId);
      } else {
        await supabase
          .from('conversations')
          .update({ seller_unread: false })
          .eq('id', conversationId);
      }
    }

    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setMessages(messagesData ?? []);
    setIsLoading(false);
  }, [conversationId, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !session || !conversationId) return;
    setIsSending(true);
    setDraft('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, from_id: session.user.id, text })
      .select('*')
      .single();
    setIsSending(false);
    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.olive} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <RNView style={styles.headerInfo}>
          <Text style={styles.headerName}>{header?.otherName ?? '...'}</Text>
          {header ? (
            <Text style={styles.headerListing} numberOfLines={1}>
              {header.listingTitle} · {formatPrice(header.listingPrice)}
            </Text>
          ) : null}
        </RNView>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.from_id === session?.user.id;
          return (
            <RNView style={[styles.messageRow, mine && styles.messageRowMine]}>
              <RNView style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
              </RNView>
            </RNView>
          );
        }}
      />

      <RNView style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Escribir un mensaje..."
          placeholderTextColor={colors.inkSoft}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={onSend} disabled={isSending || !draft.trim()}>
          <Ionicons name="send" size={16} color={colors.paperElevated} />
        </Pressable>
      </RNView>
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  headerListing: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
  },
  messagesList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '76%',
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  bubbleTheirs: {
    backgroundColor: colors.paperElevated,
  },
  bubbleMine: {
    backgroundColor: colors.olive,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.ink,
  },
  bubbleTextMine: {
    color: colors.paperElevated,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

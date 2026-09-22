export type Category = 'Ropa' | 'Calzado' | 'Accesorios' | 'Hogar vintage';
export type Condition = 'Nuevo con etiqueta' | 'Muy bueno' | 'Bueno' | 'Con detalles';
export type ListingStatus = 'activo' | 'vendido';

export type Profile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  location: string | null;
  push_token: string | null;
  created_at: string;
}

export type ProfileInsert = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  location?: string | null;
  push_token?: string | null;
  created_at?: string;
}

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  category: Category;
  condition: Condition;
  size: string | null;
  description: string | null;
  location: string | null;
  photo_urls: string[] | null;
  status: ListingStatus;
  sold_to: string | null;
  sold_at: string | null;
  created_at: string;
}

export type ListingInsert = {
  id?: string;
  seller_id: string;
  title: string;
  price: number;
  category: Category;
  condition: Condition;
  size?: string | null;
  description?: string | null;
  location?: string | null;
  photo_urls?: string[] | null;
  status?: ListingStatus;
  sold_to?: string | null;
  sold_at?: string | null;
  created_at?: string;
}

export type Favorite = {
  listing_id: string;
  user_id: string;
  created_at: string;
}

export type FavoriteInsert = {
  listing_id: string;
  user_id: string;
  created_at?: string;
}

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export type BlockInsert = {
  blocker_id: string;
  blocked_id: string;
  created_at?: string;
}

export type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message: string | null;
  last_at: string | null;
  buyer_unread: boolean;
  seller_unread: boolean;
  buyer_last_read_at: string | null;
  seller_last_read_at: string | null;
}

export type ConversationInsert = {
  id?: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message?: string | null;
  last_at?: string | null;
  buyer_unread?: boolean;
  seller_unread?: boolean;
  buyer_last_read_at?: string | null;
  seller_last_read_at?: string | null;
}

export type Message = {
  id: string;
  conversation_id: string;
  from_id: string;
  text: string;
  created_at: string;
}

export type MessageInsert = {
  id?: string;
  conversation_id: string;
  from_id: string;
  text: string;
  created_at?: string;
}

export type Rating = {
  seller_id: string;
  rater_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

export type RatingInsert = {
  seller_id: string;
  rater_id: string;
  stars: number;
  comment?: string | null;
  created_at?: string;
}

export type ReportTargetType = 'listing' | 'user';
export type ReportStatus = 'pendiente' | 'revisado';

export type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  comment: string | null;
  status: ReportStatus;
  created_at: string;
}

export type ReportInsert = {
  id?: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  comment?: string | null;
  status?: ReportStatus;
  created_at?: string;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'confirmed'
  | 'released'
  | 'rejected'
  | 'cancelled';

export type Order = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: OrderStatus;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  buyer_confirmed_at: string | null;
  released_at: string | null;
  created_at: string;
}

// The app never inserts/updates orders directly (only the Edge Functions do,
// with the service role key) — this exists only so the Tables map below has
// a structurally complete entry.
export type OrderInsert = {
  id?: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status?: OrderStatus;
  mp_preference_id?: string | null;
  mp_payment_id?: string | null;
  buyer_confirmed_at?: string | null;
  released_at?: string | null;
  created_at?: string;
}

// Database shape for @supabase/supabase-js's typed client. Shaped like the
// output of `supabase gen types typescript` (each table needs Relationships,
// each schema needs Views/Functions) so the postgrest-js generics resolve.
// Row/Insert/Update are `type` aliases, not `interface`s: postgrest-js's
// excess-property check on insert()/update() fails to infer against an
// interface here (it works against a structurally identical type alias).
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<Profile>;
        Relationships: [];
      };
      listings: {
        Row: Listing;
        Insert: ListingInsert;
        Update: Partial<Listing>;
        Relationships: [];
      };
      favorites: {
        Row: Favorite;
        Insert: FavoriteInsert;
        Update: Partial<Favorite>;
        Relationships: [];
      };
      blocks: {
        Row: Block;
        Insert: BlockInsert;
        Update: Partial<Block>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: ConversationInsert;
        Update: Partial<Conversation>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: Partial<Message>;
        Relationships: [];
      };
      ratings: {
        Row: Rating;
        Insert: RatingInsert;
        Update: Partial<Rating>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: ReportInsert;
        Update: Partial<Report>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: Partial<Order>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_own_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      confirm_order_received: {
        Args: { target_order_id: string };
        Returns: undefined;
      };
    };
  };
}

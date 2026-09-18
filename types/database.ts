export type Category = 'Ropa' | 'Calzado' | 'Accesorios' | 'Hogar vintage';
export type Condition = 'Nuevo con etiqueta' | 'Muy bueno' | 'Bueno' | 'Con detalles';
export type ListingStatus = 'activo' | 'vendido';

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  location: string | null;
  created_at: string;
}

export interface Listing {
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

export interface Favorite {
  listing_id: string;
  user_id: string;
  created_at: string;
}

export interface Conversation {
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

export interface Message {
  id: string;
  conversation_id: string;
  from_id: string;
  text: string;
  created_at: string;
}

export interface Rating {
  seller_id: string;
  rater_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

// Minimal Database shape for @supabase/supabase-js typed client.
// Extend with Insert/Update variants and Views/Functions as the schema grows.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      listings: {
        Row: Listing;
        Insert: Partial<Listing> & { seller_id: string; title: string; price: number; category: Category; condition: Condition };
        Update: Partial<Listing>;
      };
      favorites: { Row: Favorite; Insert: Favorite; Update: Partial<Favorite> };
      conversations: {
        Row: Conversation;
        Insert: Partial<Conversation> & { listing_id: string; buyer_id: string; seller_id: string };
        Update: Partial<Conversation>;
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & { conversation_id: string; from_id: string; text: string };
        Update: Partial<Message>;
      };
      ratings: {
        Row: Rating;
        Insert: Partial<Rating> & { seller_id: string; rater_id: string; stars: number };
        Update: Partial<Rating>;
      };
    };
  };
}

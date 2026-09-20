import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { LargeSecureStore } from '@/lib/secure-store-adapter';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  );
}

// Guards the web static export (pre-rendered in Node, no `window`) from
// crashing on Supabase's session storage lookup, which runs at import time.
const isBrowserOrNative = typeof window !== 'undefined';

// Native: session tokens are encrypted at rest via the OS keychain/keystore
// (see secure-store-adapter.ts), not plain AsyncStorage. Web: no SecureStore
// API exists, so fall back to Supabase's own default (localStorage) by
// omitting `storage` — only guarded against the SSR/export case above.
const storage =
  Platform.OS === 'web' ? undefined : isBrowserOrNative ? new LargeSecureStore() : undefined;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: isBrowserOrNative,
    persistSession: isBrowserOrNative,
    detectSessionInUrl: false,
  },
});

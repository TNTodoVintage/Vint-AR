import { DefaultTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
} from '@expo-google-fonts/work-sans';

import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useRegisterPushToken } from '@/lib/push-notifications';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

const vintArTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.olive,
    background: colors.paper,
    card: colors.paperElevated,
    text: colors.ink,
    border: colors.line,
    notification: colors.brick,
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={vintArTheme}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();

  useRegisterPushToken(session?.user.id ?? null);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { type?: string; conversationId?: string; listingId?: string }
        | undefined;
      if (!data) return;
      if (data.type === 'message' && data.conversationId) {
        router.push({
          pathname: '/chat/[conversationId]',
          params: { conversationId: data.conversationId },
        });
      } else if (data.type === 'order' && data.listingId) {
        router.push({ pathname: '/listing/[id]', params: { id: data.listingId } });
      }
    });
    return () => subscription.remove();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="listing/new"
        options={{ presentation: 'modal', title: 'Publicar artículo' }}
      />
      <Stack.Screen name="listing/[id]" options={{ title: '' }} />
      <Stack.Screen name="chat/[conversationId]" options={{ title: 'Chat' }} />
      <Stack.Screen
        name="payment-result"
        options={{ presentation: 'modal', title: '', headerShown: false }}
      />
    </Stack>
  );
}

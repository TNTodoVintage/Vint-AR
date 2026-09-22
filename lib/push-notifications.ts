import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Las notificaciones remotas no funcionan dentro de Expo Go desde el SDK 53
// de Expo — solo en una build de desarrollo o producción instalada en el
// dispositivo. `Constants.appOwnership === 'expo'` es como detectamos que
// estamos corriendo dentro de Expo Go, para no intentarlo ahí y fallar en
// silencio con un error de la librería en vez de uno nuestro.
async function getPushToken(): Promise<string | null> {
  if (Constants.appOwnership === 'expo') return null;
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#3D4A34',
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    console.warn('No se pudo obtener el push token', error);
    return null;
  }
}

export function useRegisterPushToken(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getPushToken().then((token) => {
      if (cancelled || !token) return;
      supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

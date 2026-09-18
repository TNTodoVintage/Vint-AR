import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { LocationPicker } from '@/components/LocationPicker';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Category, Condition } from '@/types/database';

const CATEGORIES: Category[] = ['Ropa', 'Calzado', 'Accesorios', 'Hogar vintage'];
const CONDITIONS: Condition[] = [
  'Nuevo con etiqueta',
  'Muy bueno',
  'Bueno',
  'Con detalles',
];
const MAX_PHOTOS = 6;

interface Photo {
  uri: string;
  mimeType?: string;
}

export default function NewListingScreen() {
  const { session } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [size, setSize] = useState('');
  const [location, setLocation] = useState('');
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Necesitamos permiso para acceder a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_PHOTOS - photos.length),
      quality: 0.7,
    });
    if (result.canceled) return;
    const picked = result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType }));
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const uploadPhotos = async (userId: string) => {
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const arraybuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
      const extension = photo.mimeType?.split('/')[1] ?? 'jpg';
      const path = `${userId}/${Date.now()}-${i}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(path, arraybuffer, {
          contentType: photo.mimeType ?? 'image/jpeg',
        });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from('listing-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const onSubmit = async () => {
    if (!session) return;
    if (!title.trim() || !price || !category || !condition) {
      setError('Completá título, precio, categoría y estado.');
      return;
    }
    const priceNumber = Number(price);
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      setError('El precio no es válido.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = await uploadPhotos(session.user.id);
      const { error: insertError } = await supabase.from('listings').insert({
        seller_id: session.user.id,
        title: title.trim(),
        price: priceNumber,
        category,
        condition,
        size: size.trim() || null,
        location: location.trim() || null,
        description: description.trim() || null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      });
      if (insertError) throw new Error(insertError.message);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos publicar el artículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Publicar artículo</Text>
        <Pressable onPress={onSubmit} disabled={isSubmitting} hitSlop={12}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.mustard} />
          ) : (
            <Text style={styles.publishAction}>Publicar</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>FOTOS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <RNView style={styles.photoRow}>
              {photos.map((photo, index) => (
                <RNView key={photo.uri} style={styles.photoThumb}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => removePhoto(index)}
                    hitSlop={8}>
                    <Ionicons name="close" size={12} color={colors.paperElevated} />
                  </Pressable>
                  <RNView style={styles.photoReorder}>
                    <Pressable onPress={() => movePhoto(index, -1)} hitSlop={6}>
                      <Ionicons name="chevron-back" size={14} color={colors.paperElevated} />
                    </Pressable>
                    <Pressable onPress={() => movePhoto(index, 1)} hitSlop={6}>
                      <Ionicons name="chevron-forward" size={14} color={colors.paperElevated} />
                    </Pressable>
                  </RNView>
                </RNView>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable style={styles.photoAdd} onPress={pickPhotos}>
                  <Ionicons name="camera-outline" size={22} color={colors.inkSoft} />
                </Pressable>
              ) : null}
            </RNView>
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>TÍTULO</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Campera de jean oversize"
            placeholderTextColor={colors.inkSoft}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <RNView style={styles.rowFields}>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.label}>PRECIO</Text>
            <TextInput
              style={styles.input}
              placeholder="$"
              placeholderTextColor={colors.inkSoft}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
          </View>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.label}>TALLE</Text>
            <TextInput
              style={styles.input}
              placeholder="M"
              placeholderTextColor={colors.inkSoft}
              value={size}
              onChangeText={setSize}
            />
          </View>
        </RNView>

        <View style={styles.field}>
          <Text style={styles.label}>CATEGORÍA</Text>
          <RNView style={styles.chipsWrap}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}>
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </RNView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ESTADO</Text>
          <RNView style={styles.chipsWrap}>
            {CONDITIONS.map((cond) => (
              <Pressable
                key={cond}
                style={[styles.chip, condition === cond && styles.chipActive]}
                onPress={() => setCondition(cond)}>
                <Text style={[styles.chipText, condition === cond && styles.chipTextActive]}>
                  {cond}
                </Text>
              </Pressable>
            ))}
          </RNView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>UBICACIÓN</Text>
          <Pressable style={styles.locationButton} onPress={() => setIsLocationPickerVisible(true)}>
            <Ionicons name="location-outline" size={16} color={colors.inkSoft} />
            <Text style={location ? styles.locationValue : styles.locationPlaceholder}>
              {location || 'Elegir ubicación'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>DESCRIPCIÓN</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Contá el estado, la talla real y cualquier detalle que ayude a decidir la compra."
            placeholderTextColor={colors.inkSoft}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <LocationPicker
        visible={isLocationPickerVisible}
        onClose={() => setIsLocationPickerVisible(false)}
        onSelect={setLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
  },
  publishAction: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.mustard,
  },
  form: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  flex1: {
    flex: 1,
  },
  rowFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  locationValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  locationPlaceholder: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: radii.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.line,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(33,31,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoReorder: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoAdd: {
    width: 76,
    height: 76,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.inkSoft,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  chipActive: {
    backgroundColor: colors.olive,
    borderColor: colors.olive,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.paperElevated,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.brick,
  },
});

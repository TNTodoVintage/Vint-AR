import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text } from '@/components/Themed';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ReportTargetType } from '@/types/database';

const REASONS = [
  'Es spam o publicidad engañosa',
  'Contenido inapropiado',
  'Sospecha de estafa',
  'Artículo falsificado',
  'Otro motivo',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
}

export function ReportModal({ visible, onClose, targetType, targetId, targetLabel }: Props) {
  const { session } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const reset = () => {
    setReason(null);
    setComment('');
    setIsDone(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async () => {
    if (!session || !reason) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      comment: comment.trim() || null,
    });
    setIsSubmitting(false);
    if (!error) {
      setIsDone(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {isDone ? (
            <>
              <Text style={styles.title}>Gracias por avisarnos</Text>
              <Text style={styles.subtitle}>Vamos a revisar el reporte a la brevedad.</Text>
              <Pressable style={styles.submitButton} onPress={close}>
                <Text style={styles.submitButtonText}>Cerrar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {targetType === 'listing' ? 'Reportar publicación' : 'Reportar vendedor'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {targetLabel}
              </Text>

              <RNView style={styles.reasonsList}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r}
                    style={styles.reasonRow}
                    onPress={() => setReason(r)}>
                    <RNView style={[styles.radio, reason === r && styles.radioActive]} />
                    <Text style={styles.reasonText}>{r}</Text>
                  </Pressable>
                ))}
              </RNView>

              <TextInput
                style={styles.commentInput}
                placeholder="Contanos más (opcional)"
                placeholderTextColor={colors.inkSoft}
                value={comment}
                onChangeText={setComment}
                multiline
              />

              <Pressable
                style={[styles.submitButton, !reason && styles.submitButtonDisabled]}
                onPress={onSubmit}
                disabled={!reason || isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color={colors.paperElevated} />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar reporte</Text>
                )}
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(33,31,26,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  reasonsList: {
    gap: 2,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  radioActive: {
    borderColor: colors.brick,
    backgroundColor: colors.brick,
  },
  reasonText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  commentInput: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: spacing.xs,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.brick,
    borderRadius: radii.sm,
    paddingVertical: 13,
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.paperElevated,
  },
});

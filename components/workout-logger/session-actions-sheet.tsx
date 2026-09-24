import React, { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StrengthLedgerBottomSheet, type StrengthLedgerBottomSheetHandle } from '@/components/sheets/StrengthLedgerBottomSheet';
import { KeyboardScrollView } from '@/components/keyboard/KeyboardSurface';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_SHEET_DRAG_REGION_HEIGHT } from '@/lib/bottom-sheet-gesture';

type Action = 'add' | 'remove' | 'rest' | 'finish' | 'cancel';
type Props = {
  visible: boolean;
  canEditComposition: boolean;
  removeUnavailableReason?: string;
  onDismiss: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onRest: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

/** Presentation only: the Logger retains every permission and action handler. */
export function SessionActionsSheet(props: Props) {
  const sheet = useRef<StrengthLedgerBottomSheetHandle>(null);
  const selected = useRef<Action | null>(null);
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  const desiredHeight = contentHeight
    ? contentHeight + BOTTOM_SHEET_DRAG_REGION_HEIGHT + Math.max(insets.bottom, 10) + 2
    : (props.canEditComposition ? 550 : 442) * Math.max(1, fontScale);
  const handlers = { add: props.onAdd, remove: props.onRemove, rest: props.onRest, finish: props.onFinish, cancel: props.onCancel };
  const choose = (action: Action) => {
    if (selected.current || ((action === 'add' || action === 'remove') && !props.canEditComposition)
        || (action === 'remove' && props.removeUnavailableReason)) return;
    selected.current = action;
    sheet.current?.dismiss();
  };
  const dismiss = () => {
    const action = selected.current;
    selected.current = null;
    props.onDismiss();
    // Let the menu close before presenting the existing editor/confirmation.
    if (action) setTimeout(() => handlers[action](), 0);
  };
  return <StrengthLedgerBottomSheet ref={sheet} visible={props.visible} accessibilityLabel="Session actions"
    testID="active-session-actions" onDismiss={dismiss}
    heightFraction={Math.min(0.86, desiredHeight / height)}>
    <KeyboardScrollView contentContainerStyle={s.content} onContentSizeChange={(_width, value) => setContentHeight(value)}>
      <Text accessibilityRole="header" style={s.title}>Session actions</Text>
      <View accessibilityLabel="Session controls">
        <Text accessibilityRole="header" style={s.sectionLabel}>SESSION</Text>
        {props.canEditComposition ? <>
          <ActionRow label="Add Movement" icon="add-outline" onPress={() => choose('add')} />
          <ActionRow label="Remove Movement" icon="remove-outline" onPress={() => choose('remove')}
            unavailableReason={props.removeUnavailableReason} />
        </> : null}
        <ActionRow label="Rest Timer" icon="timer-outline" onPress={() => choose('rest')} last />
      </View>
      <View style={s.completion} accessibilityLabel="Session completion">
        <Text accessibilityRole="header" style={s.sectionLabel}>COMPLETION</Text>
        <ActionRow label="Finish Session" icon="checkmark-circle-outline" tone="completion" onPress={() => choose('finish')} last />
      </View>
      <View style={s.dangerZone} accessibilityLabel="Danger zone">
        <Text accessibilityRole="header" style={s.sectionLabel}>DANGER ZONE</Text>
        <ActionRow label="Cancel Session" icon="trash-outline" tone="danger" onPress={() => choose('cancel')}
          description="Discards this Session and its logged Sets." last />
      </View>
    </KeyboardScrollView>
  </StrengthLedgerBottomSheet>;
}

function ActionRow({ label, icon, onPress, unavailableReason, description, tone = 'neutral', last = false }: {
  label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void;
  unavailableReason?: string; description?: string; tone?: 'neutral' | 'completion' | 'danger'; last?: boolean;
}) {
  const color = unavailableReason ? SLColors.textMuted : tone === 'danger' ? SLColors.accentRed : SLColors.textPrimary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={unavailableReason || description}
    accessibilityState={{ disabled: !!unavailableReason }} disabled={!!unavailableReason} onPress={onPress}
    pressScale={0.99} disabledOpacity={1} style={({ pressed }) => [s.row, !last && s.divider,
      tone === 'completion' && s.finishRow, pressed && s.pressed]}>
    <Ionicons name={icon} size={22} color={tone === 'completion' ? SLColors.success : tone === 'neutral' ? SLColors.iconMuted : color} />
    <View style={s.copy}>
      <Text style={[s.actionLabel, { color }, tone === 'completion' && s.finishLabel]}>{label}</Text>
      {unavailableReason ? <Text style={s.reason}>{unavailableReason}</Text> : null}
      {description ? <Text style={s.reason}>{description}</Text> : null}
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 12 },
  title: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.sansBold, fontSize: 23, lineHeight: 29, marginBottom: 20 },
  sectionLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.7, marginBottom: 6 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 4 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle },
  copy: { flex: 1, gap: 4 },
  actionLabel: { fontFamily: SLFontFamilies.sansMedium, fontSize: 17, lineHeight: 24 },
  reason: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 18 },
  completion: { marginTop: 22 },
  finishRow: { backgroundColor: 'rgba(143,178,154,0.09)', borderWidth: 1, borderColor: 'rgba(143,178,154,0.24)', borderRadius: 12, paddingHorizontal: 14, minHeight: 56 },
  finishLabel: { fontFamily: SLFontFamilies.sansSemiBold },
  dangerZone: { marginTop: 26, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard },
  pressed: { backgroundColor: SLColors.highlightObject },
});

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SLColors } from '@/constants/theme';
import {
  resolveCompactDropdownLayout,
  type CompactDropdownAnchor,
} from '@/lib/compact-dropdown';
import { SLMotionPressable } from './sl-motion';
import { Text } from './sl-text';

export type SLCompactDropdownOption<TValue extends string | number> = {
  value: TValue;
  label: string;
  accessibilityLabel?: string;
};

type SLCompactDropdownProps<TValue extends string | number> = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  maxMenuHeight?: number;
  menuTestID?: string;
  minMenuWidth?: number;
  onValueChange: (value: TValue) => void;
  options: ReadonlyArray<SLCompactDropdownOption<TValue>>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  value: TValue;
};

const ROW_HEIGHT = 48;
const MENU_VERTICAL_PADDING = 8;

export function SLCompactDropdown<TValue extends string | number>({
  accessibilityHint,
  accessibilityLabel,
  icon,
  label,
  maxMenuHeight = 304,
  menuTestID,
  minMenuWidth = 188,
  onValueChange,
  options,
  style,
  testID,
  value,
}: SLCompactDropdownProps<TValue>) {
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<CompactDropdownAnchor | null>(null);
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();

  const open = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  }, []);
  const close = useCallback(() => setVisible(false), []);
  const estimatedHeight = options.length * ROW_HEIGHT + MENU_VERTICAL_PADDING * 2;
  const menuLayout = useMemo(() => anchor ? resolveCompactDropdownLayout({
    anchor,
    estimatedHeight,
    insets,
    minWidth: minMenuWidth,
    preferredMaxHeight: maxMenuHeight,
    viewportHeight,
    viewportWidth,
  }) : null, [anchor, estimatedHeight, insets, maxMenuHeight, minMenuWidth, viewportHeight, viewportWidth]);

  return (
    <>
      <View collapsable={false} ref={anchorRef} style={[styles.anchor, style]}>
        <SLMotionPressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ expanded: visible }}
          onPress={open}
          style={[styles.trigger, visible && styles.triggerOpen]}
          testID={testID}
        >
          {icon ? <Ionicons color={SLColors.accentViolet} name={icon} size={16} /> : null}
          <Text numberOfLines={1} style={styles.triggerLabel}>{label}</Text>
          <Ionicons color={SLColors.textMuted} name={visible ? 'chevron-up' : 'chevron-down'} size={14} />
        </SLMotionPressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={close}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={visible && !!menuLayout}
      >
        <View accessibilityViewIsModal style={styles.modalRoot}>
          <SLMotionPressable
            accessibilityLabel="Close dropdown"
            onPress={close}
            pressScale={1}
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}-backdrop` : undefined}
          />
          {menuLayout ? (
            <View
              style={[
                styles.menu,
                {
                  left: menuLayout.left,
                  maxHeight: menuLayout.maxHeight,
                  top: menuLayout.top,
                  width: menuLayout.width,
                },
              ]}
              testID={menuTestID}
            >
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.menuContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={options.length * ROW_HEIGHT > menuLayout.maxHeight}
              >
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <SLMotionPressable
                      accessibilityLabel={option.accessibilityLabel || option.label}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected }}
                      key={String(option.value)}
                      onPress={() => {
                        close();
                        if (!selected) {
                          void Haptics.selectionAsync().catch(() => undefined);
                          onValueChange(option.value);
                        }
                      }}
                      style={[styles.option, selected && styles.optionSelected]}
                      testID={testID ? `${testID}-option-${String(option.value)}` : undefined}
                    >
                      <Ionicons
                        color={selected ? SLColors.accentViolet : 'transparent'}
                        name="checkmark"
                        size={17}
                      />
                      <Text numberOfLines={1} style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                    </SLMotionPressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { minWidth: 0 },
  trigger: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 14, 24, 0.92)',
    borderColor: SLColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  triggerOpen: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.accentViolet },
  triggerLabel: { color: SLColors.textStrong, flex: 1, fontSize: 11, fontWeight: '800', minWidth: 0 },
  modalRoot: { flex: 1 },
  menu: {
    backgroundColor: '#0D0B13',
    borderColor: SLColors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 18,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.46,
    shadowRadius: 18,
  },
  menuContent: { paddingVertical: MENU_VERTICAL_PADDING },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: ROW_HEIGHT,
    paddingHorizontal: 12,
  },
  optionSelected: { backgroundColor: SLColors.accentSoft },
  optionLabel: { color: SLColors.text, flex: 1, fontSize: 14, fontWeight: '700', minWidth: 0 },
  optionLabelSelected: { color: SLColors.accentViolet },
});

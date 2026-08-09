import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';

export const LOGGER_WHEEL_ROW_HEIGHT = 44;
export const LOGGER_WHEEL_VISIBLE_ROWS = 5;
export const LOGGER_WHEEL_COMPACT_ROW_HEIGHT = 32;
export const LOGGER_WHEEL_COMPACT_VISIBLE_ROWS = 3;

export type LoggerWheelDensity = 'standard' | 'compact';

export type LoggerWheelColumnConfig = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  suffix?: string;
  accessibilityValue?: (value: string) => string;
  formatValue?: (value: string) => string;
  disabled?: boolean;
};

function LoggerWheelColumn({ column, density, grouped, onSettle }: { column: LoggerWheelColumnConfig; density: LoggerWheelDensity; grouped: boolean; onSettle: () => void }) {
  const wheelRef = useRef<ScrollView | null>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);
  const rowHeight = density === 'compact' ? LOGGER_WHEEL_COMPACT_ROW_HEIGHT : LOGGER_WHEEL_ROW_HEIGHT;
  const visibleRows = density === 'compact' ? LOGGER_WHEEL_COMPACT_VISIBLE_ROWS : LOGGER_WHEEL_VISIBLE_ROWS;
  const centerPadding = rowHeight * Math.floor(visibleRows / 2);
  const framePadding = density === 'compact' ? 3 : SLSpacing.sm;
  const firstValidValue = column.options.find((option) => option !== '') || column.options[0] || '';
  const selectedValue = column.value && column.options.includes(column.value) ? column.value : firstValidValue;
  const selectedIndex = Math.max(0, column.options.indexOf(selectedValue));

  useEffect(() => {
    if (isInteracting.current) return;
    const index = Math.max(0, column.options.indexOf(selectedValue));
    requestAnimationFrame(() => {
      wheelRef.current?.scrollTo({
        y: index * rowHeight,
        animated: false,
      });
    });
  }, [column.options, rowHeight, selectedValue]);

  useEffect(() => () => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
  }, []);

  const updateValue = (index: number) => {
    const next = column.options[Math.max(0, Math.min(column.options.length - 1, index))];
    if (next != null && next !== selectedValue) column.onChange(next);
  };

  const settleToOffset = (offsetY: number) => {
    const index = Math.max(0, Math.min(column.options.length - 1, Math.round(offsetY / rowHeight)));
    updateValue(index);
    const targetY = index * rowHeight;
    if (Math.abs(offsetY - targetY) > 1) {
      wheelRef.current?.scrollTo({ y: targetY, animated: true });
    }
    onSettle();
  };

  const settleAfterQuietDrag = (offsetY: number) => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = setTimeout(() => {
      isInteracting.current = false;
      settleToOffset(offsetY);
    }, 90);
  };

  const adjustForAccessibility = (direction: -1 | 1) => {
    if (column.disabled) return;
    const nextIndex = Math.max(0, Math.min(column.options.length - 1, selectedIndex + direction));
    if (nextIndex === selectedIndex) return;
    updateValue(nextIndex);
    wheelRef.current?.scrollTo({ y: nextIndex * rowHeight, animated: true });
    onSettle();
  };

  const displayedValue = (column.formatValue?.(selectedValue) ?? selectedValue) || '—';
  const spokenValue = column.accessibilityValue?.(selectedValue)
    ?? `${displayedValue}${column.suffix ? ` ${column.suffix}` : ''}`;
  const accessibilityActions = [
    ...(selectedIndex < column.options.length - 1 ? [{ name: 'increment' as const }] : []),
    ...(selectedIndex > 0 ? [{ name: 'decrement' as const }] : []),
  ];

  return (
    <View
      accessible
      accessibilityActions={accessibilityActions}
      accessibilityLabel={column.accessibilityLabel || column.label}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: !!column.disabled }}
      accessibilityValue={{ text: spokenValue }}
      onAccessibilityAction={(event) => adjustForAccessibility(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[
        styles.column,
        density === 'compact' && (grouped ? styles.columnCompactGrouped : styles.columnCompact),
        column.disabled && styles.disabled,
      ]}
    >
      {column.label ? <Text style={[styles.columnLabel, density === 'compact' && styles.columnLabelCompact]}>{column.label}</Text> : null}
      <View style={[styles.scrollFrame, density === 'compact' && styles.scrollFrameCompact, { height: (rowHeight * visibleRows) + (framePadding * 2), paddingVertical: framePadding }]}>
        {density === 'compact' ? <View pointerEvents="none" style={[styles.columnSelectionPlane, { top: framePadding + centerPadding, height: rowHeight }]} /> : null}
        <ScrollView
          ref={wheelRef}
          nestedScrollEnabled
          directionalLockEnabled
          scrollEnabled={!column.disabled}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: centerPadding, paddingBottom: centerPadding },
          ]}
          showsVerticalScrollIndicator={false}
          snapToInterval={rowHeight}
          snapToAlignment="start"
          decelerationRate="normal"
          onScrollBeginDrag={() => {
            isInteracting.current = true;
            if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
          }}
          onMomentumScrollBegin={() => {
            isInteracting.current = true;
            if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
          }}
          onMomentumScrollEnd={(event) => {
            isInteracting.current = false;
            settleToOffset(event.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={(event) => settleAfterQuietDrag(event.nativeEvent.contentOffset.y)}
          onScroll={(event) => {
            const index = Math.max(0, Math.min(column.options.length - 1, Math.round(event.nativeEvent.contentOffset.y / rowHeight)));
            updateValue(index);
          }}
          scrollEventThrottle={16}
        >
          {column.options.map((option, index) => {
            const selected = option === selectedValue;
            const display = (column.formatValue?.(option) ?? option) || '—';
            return (
              <TouchableOpacity
                accessible={false}
                disabled={column.disabled}
                key={`${column.key}-${option || index}`}
                style={[styles.option, { height: rowHeight }]}
                onPress={() => {
                  if (option !== column.value) column.onChange(option);
                  wheelRef.current?.scrollTo({ y: index * rowHeight, animated: true });
                  onSettle();
                }}
              >
                <Text style={[styles.optionText, density === 'compact' && styles.optionTextCompact, selected && styles.optionTextActive, selected && density === 'compact' && styles.optionTextActiveCompact]}>
                  {display}{column.suffix ? ` ${column.suffix}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function LoggerWheelPicker({ columns, density = 'standard', grouped = false, style }: { columns: LoggerWheelColumnConfig[]; density?: LoggerWheelDensity; grouped?: boolean; style?: StyleProp<ViewStyle> }) {
  const rowHeight = density === 'compact' ? LOGGER_WHEEL_COMPACT_ROW_HEIGHT : LOGGER_WHEEL_ROW_HEIGHT;
  const visibleRows = density === 'compact' ? LOGGER_WHEEL_COMPACT_VISIBLE_ROWS : LOGGER_WHEEL_VISIBLE_ROWS;
  const confirmSelection = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };
  return (
    <View style={[styles.columns, density === 'compact' && styles.columnsCompact, grouped && styles.columnsGrouped, style]}>
      {density === 'standard' ? <View pointerEvents="none" style={[styles.selectionPlane, { top: SLSpacing.xl + SLSpacing.sm + (rowHeight * Math.floor(visibleRows / 2)), height: rowHeight }]} /> : null}
      {columns.map((column) => <LoggerWheelColumn key={column.key} column={column} density={density} grouped={grouped} onSettle={confirmSelection} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    gap: SLSpacing.sm,
    marginTop: SLSpacing.xxxl,
    position: 'relative',
  },
  columnsCompact: {
    marginTop: SLSpacing.xxs,
  },
  columnsGrouped: {
    gap: 0,
  },
  selectionPlane: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderSelected,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  columnCompact: {
    overflow: 'hidden',
    paddingTop: SLSpacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.surfaceMedia,
  },
  columnCompactGrouped: {
    overflow: 'hidden',
  },
  columnLabel: {
    color: SLColors.textSubtle,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textAlign: 'center',
    marginBottom: 8,
  },
  columnLabelCompact: {
    marginBottom: 0,
    paddingHorizontal: SLSpacing.xs,
  },
  scrollFrame: {
    paddingVertical: SLSpacing.sm,
    overflow: 'hidden',
  },
  scrollFrameCompact: {
    position: 'relative',
  },
  columnSelectionPlane: {
    position: 'absolute',
    left: SLSpacing.xs,
    right: SLSpacing.xs,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    borderRadius: SLRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  optionText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
    opacity: 0.3,
  },
  optionTextActive: {
    color: SLColors.textStrong,
    fontSize: SLTypography.commandTitle.fontSize,
    fontWeight: '900',
    letterSpacing: -0.25,
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  optionTextCompact: {
    fontSize: 13,
  },
  optionTextActiveCompact: {
    fontSize: 18,
    letterSpacing: 0,
    transform: [{ scale: 1 }],
  },
  disabled: {
    opacity: 0.45,
  },
});

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
export const LOGGER_WHEEL_COMPACT_ROW_HEIGHT = 36;
export const LOGGER_WHEEL_COMPACT_VISIBLE_ROWS = 3;
export const LOGGER_WHEEL_SHEET_ROW_HEIGHT = 56;
export const LOGGER_WHEEL_SHEET_VISIBLE_ROWS = 5;
export const LOGGER_WHEEL_SHEET_LABEL_HEIGHT = 28;

export type LoggerWheelDensity = 'standard' | 'compact' | 'sheet';

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

function wheelGeometry(density: LoggerWheelDensity) {
  if (density === 'sheet') {
    return {
      framePadding: 4,
      rowHeight: LOGGER_WHEEL_SHEET_ROW_HEIGHT,
      visibleRows: LOGGER_WHEEL_SHEET_VISIBLE_ROWS,
    };
  }
  if (density === 'compact') {
    return {
      framePadding: 3,
      rowHeight: LOGGER_WHEEL_COMPACT_ROW_HEIGHT,
      visibleRows: LOGGER_WHEEL_COMPACT_VISIBLE_ROWS,
    };
  }
  return {
    framePadding: SLSpacing.sm,
    rowHeight: LOGGER_WHEEL_ROW_HEIGHT,
    visibleRows: LOGGER_WHEEL_VISIBLE_ROWS,
  };
}

function LoggerWheelColumn({ column, density, grouped, onSettle, reserveSheetLabel }: { column: LoggerWheelColumnConfig; density: LoggerWheelDensity; grouped: boolean; onSettle: () => void; reserveSheetLabel: boolean }) {
  const wheelRef = useRef<ScrollView | null>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);
  const { framePadding, rowHeight, visibleRows } = wheelGeometry(density);
  const centerPadding = rowHeight * Math.floor(visibleRows / 2);
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
        density === 'sheet' && styles.columnSheet,
        column.disabled && styles.disabled,
      ]}
    >
      {density === 'sheet' && reserveSheetLabel ? (
        <View style={styles.sheetLabelBand}>
          {column.label ? <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.columnLabel, styles.columnLabelSheet]}>{column.label}</Text> : null}
        </View>
      ) : column.label ? <Text style={[styles.columnLabel, density === 'compact' && styles.columnLabelCompact]}>{column.label}</Text> : null}
      <View style={[styles.scrollFrame, density !== 'standard' && styles.scrollFrameCompact, density === 'sheet' && styles.scrollFrameSheet, { height: (rowHeight * visibleRows) + (framePadding * 2), paddingVertical: framePadding }]}>
        {density !== 'standard' ? <View pointerEvents="none" style={[styles.columnSelectionPlane, density === 'sheet' && styles.columnSelectionPlaneSheet, { top: framePadding + centerPadding, height: rowHeight }]} /> : null}
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
            const distance = Math.abs(index - selectedIndex);
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
                <Text
                  maxFontSizeMultiplier={density === 'sheet' ? 1.25 : undefined}
                  numberOfLines={1}
                  style={[
                    styles.optionText,
                    density === 'compact' && styles.optionTextCompact,
                    density === 'sheet' && styles.optionTextSheet,
                    density === 'sheet' && distance === 1 && styles.optionTextSheetNear,
                    density === 'sheet' && distance >= 2 && styles.optionTextSheetFar,
                    selected && styles.optionTextActive,
                    selected && density === 'compact' && styles.optionTextActiveCompact,
                    selected && density === 'sheet' && styles.optionTextActiveSheet,
                  ]}
                >
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

export function LoggerWheelPicker({ columns, density = 'standard', grouped = false, separator, style }: { columns: LoggerWheelColumnConfig[]; density?: LoggerWheelDensity; grouped?: boolean; separator?: string; style?: StyleProp<ViewStyle> }) {
  const { framePadding, rowHeight, visibleRows } = wheelGeometry(density);
  const centerPadding = rowHeight * Math.floor(visibleRows / 2);
  const reserveSheetLabel = density === 'sheet' && columns.some((column) => Boolean(column.label));
  const confirmSelection = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };
  return (
    <View style={[styles.columns, density === 'compact' && styles.columnsCompact, density === 'sheet' && styles.columnsSheet, grouped && styles.columnsGrouped, style]}>
      {density === 'standard' ? <View pointerEvents="none" style={[styles.selectionPlane, { top: SLSpacing.xl + SLSpacing.sm + (rowHeight * Math.floor(visibleRows / 2)), height: rowHeight }]} /> : null}
      {columns.map((column, index) => (
        <React.Fragment key={column.key}>
          {index > 0 && separator ? (
            <View pointerEvents="none" style={[styles.separatorColumn, reserveSheetLabel && styles.separatorColumnWithLabel]}>
              <View style={[styles.separatorFrame, { height: (rowHeight * visibleRows) + (framePadding * 2) }]}>
                <View style={[styles.separatorSelectedRow, { top: framePadding + centerPadding, height: rowHeight }]}>
                  <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.separatorText}>{separator}</Text>
                </View>
              </View>
            </View>
          ) : null}
          <LoggerWheelColumn column={column} density={density} grouped={grouped} onSettle={confirmSelection} reserveSheetLabel={reserveSheetLabel} />
        </React.Fragment>
      ))}
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
  columnsSheet: {
    alignItems: 'flex-start',
    gap: SLSpacing.xs,
    marginTop: SLSpacing.sm,
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
  columnSheet: {
    minWidth: 0,
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
  sheetLabelBand: {
    height: LOGGER_WHEEL_SHEET_LABEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnLabelSheet: {
    marginBottom: 0,
    color: SLColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  scrollFrame: {
    paddingVertical: SLSpacing.sm,
    overflow: 'hidden',
  },
  scrollFrameCompact: {
    position: 'relative',
  },
  scrollFrameSheet: {
    width: '100%',
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
  columnSelectionPlaneSheet: {
    left: 2,
    right: 2,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(116,58,185,0.24)',
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
    color: SLColors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
    opacity: 0.56,
  },
  optionTextActiveCompact: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  optionTextSheet: {
    color: SLColors.textSecondary,
    fontSize: 20,
    lineHeight: 28,
    opacity: 0.56,
  },
  optionTextSheetNear: {
    color: SLColors.textPrimary,
    fontSize: 22,
    opacity: 0.76,
  },
  optionTextSheetFar: {
    fontSize: 18,
    opacity: 0.38,
  },
  optionTextActiveSheet: {
    color: SLColors.textStrong,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.4,
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  separatorColumn: {
    width: 30,
    flexShrink: 0,
  },
  separatorColumnWithLabel: {
    paddingTop: LOGGER_WHEEL_SHEET_LABEL_HEIGHT,
  },
  separatorFrame: {
    position: 'relative',
    width: '100%',
  },
  separatorSelectedRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorText: {
    color: SLColors.textStrong,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
});

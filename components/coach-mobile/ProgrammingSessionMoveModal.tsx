import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/sl-text';
import {
  SLColors,
  SLFontFamilies,
  SLRadius,
  SLShadows,
  SLTypography,
} from '@/constants/theme';

type Props = {
  action?: 'copy' | 'move';
  visible: boolean;
  sessionTitle: string;
  currentDate: string;
  minimumDate?: string | null;
  maximumDate?: string | null;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (targetDate: string) => void | Promise<void>;
};

export function ProgrammingSessionMoveModal({
  action = 'move',
  visible,
  sessionTitle,
  currentDate,
  minimumDate,
  maximumDate,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const initial = parseDateOnly(currentDate) || new Date();
  const [monthCursor, setMonthCursor] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(toDateOnly(initial));

  useEffect(() => {
    if (!visible) return;
    const next = parseDateOnly(currentDate) || new Date();
    setMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelectedDate(toDateOnly(next));
  }, [currentDate, visible]);

  const days = useMemo(() => calendarDaysForMonth(monthCursor), [monthCursor]);
  const monthLabel = monthCursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const actionLabel = action === 'copy' ? 'Copy Session' : 'Move Session';
  const busyLabel = action === 'copy' ? 'Copying...' : 'Moving...';
  const close = () => {
    if (!busy) onCancel();
  };
  const inAllowedRange = (dateValue: string) => {
    if (minimumDate && dateValue < minimumDate) return false;
    if (maximumDate && dateValue > maximumDate) return false;
    return true;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>{actionLabel}</Text>
              <Text numberOfLines={2} style={styles.title}>{sessionTitle}</Text>
              <Text style={styles.currentDate}>
                Currently {formatFullDate(currentDate)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${action === 'copy' ? 'Copy' : 'Move'} Session`}
              disabled={busy}
              onPress={close}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={19} color={SLColors.textStrong} />
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              disabled={busy}
              onPress={() => setMonthCursor((value) => (
                new Date(value.getFullYear(), value.getMonth() - 1, 1)
              ))}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={19} color={SLColors.textStrong} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              disabled={busy}
              onPress={() => setMonthCursor((value) => (
                new Date(value.getFullYear(), value.getMonth() + 1, 1)
              ))}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={19} color={SLColors.textStrong} />
            </Pressable>
          </View>

          <View style={styles.weekdays}>
            {['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'].map((day) => (
              <Text key={day} style={styles.weekday}>{day}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((day, index) => {
              const dateValue = day ? toDateOnly(day) : '';
              const selected = dateValue === selectedDate;
              const enabled = Boolean(day && inAllowedRange(dateValue));
              return (
                <Pressable
                  key={`${dateValue || 'empty'}-${index}`}
                  accessibilityRole={day ? 'button' : undefined}
                  accessibilityLabel={day ? formatFullDate(dateValue) : undefined}
                  accessibilityState={day ? { disabled: !enabled, selected } : undefined}
                  disabled={!enabled || busy}
                  onPress={() => setSelectedDate(dateValue)}
                  style={({ pressed }) => [
                    styles.day,
                    selected && styles.daySelected,
                    day && !enabled && styles.dayDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                    {day ? day.getDate() : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Text style={styles.selectedDate}>{formatFullDate(selectedDate)}</Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={close}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${action === 'copy' ? 'Copy' : 'Move'} Session to selected date`}
                disabled={busy}
                onPress={() => onConfirm(selectedDate)}
                style={({ pressed }) => [
                  styles.primary,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                {busy ? <ActivityIndicator size="small" color={SLColors.success} /> : null}
                <Text style={styles.primaryText}>{busy ? busyLabel : actionLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    parsed.getFullYear() !== Number(match[1])
    || parsed.getMonth() !== Number(match[2]) - 1
    || parsed.getDate() !== Number(match[3])
  ) return null;
  return parsed;
}

function toDateOnly(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatFullDate(value?: string | null) {
  const parsed = parseDateOnly(value);
  if (!parsed) return 'Choose a date';
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calendarDaysForMonth(monthCursor: Date) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth() + 1,
    0
  ).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modal: {
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    borderRadius: SLRadius.xl,
    backgroundColor: 'rgba(18, 14, 22, 0.99)',
    ...SLShadows.shadowSheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    ...SLTypography.label,
    color: SLColors.accentViolet,
    textTransform: 'uppercase',
  },
  title: {
    ...SLTypography.sectionTitle,
    marginTop: 2,
    color: SLColors.textStrong,
  },
  currentDate: {
    ...SLTypography.body,
    marginTop: 4,
    color: SLColors.textMuted,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(5, 5, 5, 0.28)',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
  },
  monthLabel: {
    ...SLTypography.sectionTitle,
    color: SLColors.textStrong,
  },
  weekdays: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderHairline,
  },
  weekday: {
    width: `${100 / 7}%`,
    color: SLColors.textSubtle,
    textAlign: 'center',
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
  },
  daySelected: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.62)',
    backgroundColor: 'rgba(167, 139, 250, 0.24)',
  },
  dayDisabled: {
    opacity: 0.22,
  },
  dayText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  dayTextSelected: {
    color: SLColors.textStrong,
  },
  footer: {
    gap: 11,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderHairline,
  },
  selectedDate: {
    ...SLTypography.body,
    color: SLColors.textMuted,
  },
  error: {
    ...SLTypography.body,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.30)',
    borderRadius: SLRadius.md,
    color: SLColors.danger,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
  },
  secondaryText: {
    ...SLTypography.body,
    color: SLColors.textMuted,
    fontFamily: SLFontFamilies.sansBold,
  },
  primary: {
    flex: 1.45,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.30)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(167, 203, 181, 0.14)',
  },
  primaryText: {
    ...SLTypography.body,
    color: SLColors.success,
    fontFamily: SLFontFamilies.sansBold,
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.72,
  },
});

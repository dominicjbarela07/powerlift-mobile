import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

export function MovementCompleteSummary({
  title,
  meta,
  top,
  onExpand,
}: {
  title: string;
  meta: string;
  top?: string | null;
  onExpand: () => void;
}) {
  return (
    <View style={styles.completedMovementSummary}>
      <View style={styles.completedMovementHeader}>
        <Text style={styles.completedMovementTitle}>{title}</Text>
        <View style={styles.completedMovementBadge}>
          <Text style={styles.completedMovementBadgeText}>Complete</Text>
        </View>
      </View>
      <Text style={styles.completedMovementMeta}>{meta}</Text>
      {top ? <Text style={styles.completedMovementTop}>{top}</Text> : null}
      <TouchableOpacity style={styles.completedMovementAction} onPress={onExpand}>
        <Text style={styles.completedMovementActionText}>View / Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

export function LogSheetUnitToggle({
  unit,
  onChange,
}: {
  unit: 'kg' | 'lb';
  onChange: (unit: 'kg' | 'lb') => void;
}) {
  return (
    <View style={styles.unitTogglePill}>
      {(['kg', 'lb'] as const).map((option) => {
        const active = unit === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.unitToggleOption, active && styles.unitToggleOptionActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.unitToggleText, active && styles.unitToggleTextActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function CoreWheelLogButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.coreWheelButton} onPress={onPress}>
      <Text style={styles.coreWheelButtonText}>Log Set</Text>
    </TouchableOpacity>
  );
}

export function CoreRepeatLastButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.coreRepeatLastButton} onPress={onPress}>
      <Text style={styles.coreRepeatLastButtonText}>Repeat Last</Text>
    </TouchableOpacity>
  );
}

export function LoggedSetRow({
  actualText,
  canEdit,
  onEdit,
  style,
}: {
  actualText: React.ReactNode;
  canEdit?: boolean;
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.loggedRowInline, style]}>
      <Text style={styles.actualTextInline}>{actualText}</Text>
      {canEdit && onEdit ? (
        <TouchableOpacity style={styles.inlineEditButtonInline} onPress={onEdit}>
          <Text style={styles.inlineEditButtonText}>Edit</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  completedMovementSummary: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.16)',
    backgroundColor: 'rgba(34,197,94,0.045)',
  },
  completedMovementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  completedMovementTitle: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
  },
  completedMovementBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  completedMovementBadgeText: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  completedMovementMeta: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 7,
  },
  completedMovementTop: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
  },
  completedMovementAction: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.22)',
    backgroundColor: 'rgba(91,79,207,0.09)',
  },
  completedMovementActionText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '900',
  },
  unitTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,20,36,0.82)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
  },
  unitToggleOption: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleOptionActive: {
    backgroundColor: '#5B4FCF',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  unitToggleText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  unitToggleTextActive: {
    color: '#E5E7EB',
  },
  coreWheelButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.28)',
    backgroundColor: 'rgba(91,79,207,0.92)',
  },
  coreWheelButtonText: {
    color: '#F5F3FF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  coreRepeatLastButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.24)',
    backgroundColor: 'rgba(91,79,207,0.10)',
  },
  coreRepeatLastButtonText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '900',
  },
  loggedRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 4,
  },
  actualTextInline: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineEditButtonInline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(15,20,36,0.80)',
  },
  inlineEditButtonText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
});

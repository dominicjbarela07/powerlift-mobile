import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLButton } from '@/components/ui';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';

export type NewCoachExperiencePayload = {
  workspace?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  preview_label?: string;
  sections?: Array<{
    label?: string;
    items?: string[];
  }>;
  primary_action?: {
    type?: string;
    label?: string;
  };
  secondary_action?: {
    type?: string;
    label?: string;
  };
};

type Props = {
  experience?: NewCoachExperiencePayload | null;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
};

export function NewCoachExperience({ experience, onPrimaryPress, onSecondaryPress }: Props) {
  const router = useRouter();
  if (!experience) return null;
  const sections = Array.isArray(experience.sections) ? experience.sections : [];
  const primaryLabel = experience.primary_action?.label || 'Invite your first athlete';
  const secondaryLabel = experience.secondary_action?.label || 'Explore coaching tools';
  const defaultPrimaryPress = () => {
    if (experience.primary_action?.type === 'invite_athlete') {
      router.push('/(tabs)/coach-invite-athlete' as any);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles-outline" size={22} color={SLColors.accentMuted} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{experience.eyebrow || 'Future workspace'}</Text>
          <Text style={styles.title}>{experience.title || 'Your coaching workspace starts here'}</Text>
          {experience.description ? <Text style={styles.description}>{experience.description}</Text> : null}
        </View>
      </View>

      <View style={styles.previewShell}>
        <View style={styles.previewHead}>
          <Text style={styles.previewLabel}>{experience.preview_label || 'Preview'}</Text>
          <Text style={styles.exampleLabel}>Example</Text>
        </View>

        {sections.map((section, idx) => (
          <View key={`${section.label || 'section'}-${idx}`} style={styles.previewPanel}>
            <Text style={styles.panelTitle}>{section.label || 'Workspace'}</Text>
            {(section.items || []).slice(0, 4).map((item, itemIdx) => (
              <View key={`${item}-${itemIdx}`} style={styles.previewItem}>
                <View style={styles.previewDot} />
                <Text style={styles.previewText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <SLButton label={primaryLabel} onPress={onPrimaryPress || defaultPrimaryPress} variant="primary" />
        {secondaryLabel ? (
          <SLButton label={secondaryLabel} onPress={onSecondaryPress || (() => {})} variant="secondary" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLColors.surface,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    gap: SLSpacing.lg,
    padding: SLSpacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    gap: SLSpacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: SLColors.accentVioletSoft,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroCopy: {
    flex: 1,
    gap: SLSpacing.xs,
  },
  eyebrow: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.cardTitle.fontFamily,
    fontSize: SLTypography.title.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 27,
  },
  description: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.body.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
  },
  previewShell: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    gap: SLSpacing.sm,
    padding: SLSpacing.md,
  },
  previewHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  exampleLabel: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  previewPanel: {
    backgroundColor: SLColors.surfaceMuted,
    borderColor: SLColors.borderHairline,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    gap: SLSpacing.sm,
    padding: SLSpacing.md,
  },
  panelTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
  },
  previewItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  previewDot: {
    backgroundColor: SLColors.accent,
    borderRadius: SLRadius.pill,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  previewText: {
    color: SLColors.text,
    flex: 1,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
  },
  actions: {
    gap: SLSpacing.sm,
  },
});

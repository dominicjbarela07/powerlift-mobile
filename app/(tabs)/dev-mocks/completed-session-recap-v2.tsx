import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { CompletedSessionRecap } from '@/components/coach-mobile/CompletedSessionRecap';
import type { CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import { createWorkoutDetailFixture } from '@/dev-mocks/fixtures/workout-detail';

export default function CompletedSessionRecapV2Preview() {
  const router = useRouter();
  const { initialTab, showAll, sparse, viewer } = useLocalSearchParams<{
    initialTab?: string;
    showAll?: string;
    sparse?: string;
    viewer?: string;
  }>();
  if (!__DEV__) return null;
  const fixture = createWorkoutDetailFixture('completed-recap-v2', 'post_session');
  const recap = (fixture.workout as typeof fixture.workout & { completed_recap: CompletedSessionRecapPayload }).completed_recap;
  const previewRecap: CompletedSessionRecapPayload = sparse === '1'
    ? {
        ...recap,
        session: {
          ...recap.session,
          movement_count: 0,
          set_count: 0,
          video_count: 0,
          total_volume_kg: 0,
        },
        performed_movements: [],
        muscle_focus: null,
      }
    : recap;
  return (
    <>
      <StatusBar style="light" />
      <CompletedSessionRecap
        recap={previewRecap}
        preferredUnits={fixture.athlete.preferred_units}
        viewerMode={viewer === 'coach' ? 'coach' : 'athlete'}
        coachReview={viewer === 'coach' ? {
          draft: {
            coach_feedback: recap.coach_feedback.feedback || '',
            coach_note: 'Review bar speed and keep the next exposure unchanged.',
            review_outcome: 'on_track',
            review_priority: 'normal',
            followup_adjust_programming: false,
            followup_message_athlete: false,
            followup_consider_tm: false,
            followup_monitor_next: true,
            send_feedback_message: false,
          },
          outcomes: [{ value: 'on_track', label: 'On Track' }, { value: 'adjust', label: 'Adjust' }],
          priorities: [{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }],
          onSave: () => {},
        } : null}
        initialTab={initialTab === 'plan' ? 'plan' : 'performed'}
        initialShowAllMovements={showAll === '1'}
        onClose={() => router.replace('/(tabs)/dev-mocks')}
      />
    </>
  );
}

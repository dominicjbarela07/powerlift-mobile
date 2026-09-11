import React from 'react';

import TrainingIndexScreen from '@/app/(tabs)/workout';
import { useCoachAthleteWorkspace } from '@/components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceContext';

export default function AthleteWorkspaceTrainingRoute() {
  const workspace = useCoachAthleteWorkspace();
  return <TrainingIndexScreen key={workspace.subjectKey} />;
}

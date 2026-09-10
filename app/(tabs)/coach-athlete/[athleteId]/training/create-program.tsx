import React from 'react';

import CreateProgramScreen from '@/app/(tabs)/workout/create-program';
import { useCoachAthleteWorkspace } from '@/components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceContext';

export default function AthleteWorkspaceProgramRoute() {
  const workspace = useCoachAthleteWorkspace();
  return <CreateProgramScreen key={workspace.subjectKey} />;
}

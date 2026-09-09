import { Slot } from 'expo-router';
import React from 'react';

import { CoachAthleteWorkspaceProvider } from '@/components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceContext';
import { CoachAthleteWorkspaceShell } from '@/components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceShell';

export default function CoachAthleteWorkspaceLayout() {
  return (
    <CoachAthleteWorkspaceProvider>
      <CoachAthleteWorkspaceShell><Slot /></CoachAthleteWorkspaceShell>
    </CoachAthleteWorkspaceProvider>
  );
}

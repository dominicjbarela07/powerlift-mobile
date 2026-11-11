import { useLocalSearchParams } from 'expo-router';
import React, { createContext, type ReactNode, useContext, useMemo } from 'react';

type AthleteLedgerSubject = {
  athleteId?: number;
  isWorkspaceScoped: boolean;
  valid: boolean;
  returnPath?: string;
  routeParams: Record<string, string | undefined>;
};

const SubjectContext = createContext<AthleteLedgerSubject>({
  athleteId: undefined,
  isWorkspaceScoped: false,
  valid: true,
  routeParams: {},
});

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
export function AthleteLedgerSubjectProvider({ children }: { children: ReactNode }) {
  const params = useLocalSearchParams<{
    athleteId?: string | string[];
    athlete_id?: string | string[];
    workspaceAthleteId?: string | string[];
    returnToWorkspace?: string | string[];
    workspaceReturn?: string | string[];
  }>();
  const values = [first(params.workspaceAthleteId), first(params.athleteId), first(params.athlete_id)]
    .filter((value): value is string => Boolean(value));
  const ids = [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
  const isWorkspaceScoped = first(params.returnToWorkspace) === '1';
  const valid = !isWorkspaceScoped || (ids.length === 1 && values.every((value) => Number(value) === ids[0]));
  const athleteId = valid ? ids[0] : undefined;
  const destination = ['evidence', 'performance', 'brief'].includes(first(params.workspaceReturn) || '')
    ? first(params.workspaceReturn) : 'brief';
  const returnPath = isWorkspaceScoped && athleteId
    ? `/(tabs)/coach-athlete/${athleteId}/${destination}`
    : undefined;
  const value = useMemo<AthleteLedgerSubject>(() => ({
    athleteId,
    isWorkspaceScoped,
    valid,
    returnPath,
    routeParams: athleteId ? {
      athleteId: String(athleteId),
      athlete_id: String(athleteId),
      workspaceAthleteId: isWorkspaceScoped ? String(athleteId) : undefined,
      returnToWorkspace: isWorkspaceScoped ? '1' : undefined,
      workspaceReturn: isWorkspaceScoped ? destination : undefined,
    } : {},
  }), [athleteId, destination, isWorkspaceScoped, returnPath, valid]);
  return <SubjectContext.Provider value={value}>{children}</SubjectContext.Provider>;
}

export function useAthleteLedgerSubject() {
  return useContext(SubjectContext);
}

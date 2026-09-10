import { useLocalSearchParams, useRouter } from 'expo-router';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { ensureCoachAthleteThread, fetchJson } from '@/lib/api';
import type { CoachAthleteSummaryResponse } from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';
import { useCoachPerformance } from './useCoachPerformance';

export type WorkspaceDestination = 'brief' | 'training' | 'performance' | 'reviews' | 'messages';

export type CoachAthleteWorkspaceBootstrap = {
  ok: boolean;
  error?: string;
  generated_at?: string;
  subject: {
    coach_user_id: number;
    coach_id: number;
    athlete_id: number;
    relationship_id: number;
    relationship_generation: string;
    workspace_generation: string;
    workspace_mode?: string | null;
    account_state?: string | null;
    subject_key: string;
    capabilities: Record<string, boolean>;
  };
  athlete: {
    id: number;
    name: string;
    avatar_url?: string | null;
    avatar_uploaded_at?: string | null;
    profilePhotoUrl?: string | null;
    profilePhotoVersion?: string | null;
    sex?: string | null;
    preferred_units?: string | null;
    is_self?: boolean;
  };
  current_training?: Record<string, any> | null;
  athlete_context: {
    federation?: string | null;
    weight_class?: string | null;
    equipment_access?: string | null;
    injury_notes?: string | null;
    mobility_limitations?: string | null;
    preferred_cues?: string | null;
    timezone?: string | null;
  };
  conversation: {
    thread_id?: number | null;
    latest_athlete_message?: WorkspaceMessagePreview | null;
    latest_coach_reply?: WorkspaceMessagePreview | null;
  };
  check_ins: {
    submitted_unreviewed_count: number;
    items: Array<{
      submission_id: number;
      form_id: number;
      title: string;
      submitted_at?: string | null;
    }>;
  };
};

type WorkspaceMessagePreview = {
  id: number;
  body_preview?: string | null;
  created_at?: string | null;
  sender_id?: number | null;
};

type TrainingState = {
  selectedDate: string | null;
  blockId: number | null;
  week: number | null;
  scrollY: number;
};

type ReviewState = {
  segment: 'queue' | 'followup' | 'history';
  itemKeys: string[];
  position: number;
  scrollY: number;
};

type WorkspaceValue = ReturnType<typeof useCoachPerformance> & {
  athleteId: number;
  bootstrap: CoachAthleteWorkspaceBootstrap | null;
  summary: CoachAthleteSummaryResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  subjectKey: string;
  performanceScrollY: number;
  setPerformanceScrollY: (value: number) => void;
  trainingState: TrainingState;
  setTrainingState: React.Dispatch<React.SetStateAction<TrainingState>>;
  reviewState: ReviewState;
  setReviewState: React.Dispatch<React.SetStateAction<ReviewState>>;
  messageThreadId: number | null;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  ensureMessageThread: () => Promise<number | null>;
  reload: (silent?: boolean) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const EMPTY_TRAINING_STATE: TrainingState = {
  selectedDate: null,
  blockId: null,
  week: null,
  scrollY: 0,
};

const EMPTY_REVIEW_STATE: ReviewState = {
  segment: 'queue',
  itemKeys: [],
  position: 0,
  scrollY: 0,
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function CoachAthleteWorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useLocalSearchParams<{ athleteId?: string | string[] }>();
  const router = useRouter();
  const { user, workspaceKey } = useAuth();
  const athleteId = Number(first(params.athleteId) || 0);
  const accountId = Number(user?.id ?? user?.user_id ?? 0);
  const requestNamespace = `${workspaceKey}:${accountId}:${athleteId}`;
  const namespaceRef = useRef(requestNamespace);
  const subjectKeyRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const [bootstrap, setBootstrap] = useState<CoachAthleteWorkspaceBootstrap | null>(null);
  const [summary, setSummary] = useState<CoachAthleteSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState>(EMPTY_TRAINING_STATE);
  const [reviewState, setReviewState] = useState<ReviewState>(EMPTY_REVIEW_STATE);
  const [messageThreadId, setMessageThreadId] = useState<number | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [performanceScrollY, setPerformanceScrollY] = useState(0);

  useEffect(() => {
    namespaceRef.current = requestNamespace;
    controllerRef.current?.abort();
    sequenceRef.current += 1;
    setBootstrap(null);
    subjectKeyRef.current = null;
    setSummary(null);
    setPerformanceScrollY(0);
    setTrainingState(EMPTY_TRAINING_STATE);
    setReviewState(EMPTY_REVIEW_STATE);
    setMessageThreadId(null);
    setMessageDraft('');
    setError(null);
    setLoading(true);
  }, [requestNamespace]);

  const leaveRevokedWorkspace = useCallback(() => {
    controllerRef.current?.abort();
    setBootstrap(null);
    subjectKeyRef.current = null;
    setSummary(null);
    setMessageThreadId(null);
    setMessageDraft('');
    router.replace({ pathname: '/(tabs)/coach-dashboard', params: { roster: '1' } } as any);
  }, [router]);

  const reload = useCallback(async (silent = false) => {
    if (!Number.isInteger(athleteId) || athleteId <= 0 || !accountId) {
      setError('Athlete workspace identity is missing.');
      setLoading(false);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const sequence = ++sequenceRef.current;
    const namespace = requestNamespace;
    const isCurrent = () => (
      !controller.signal.aborted
      && sequenceRef.current === sequence
      && namespaceRef.current === namespace
    );
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const bootstrapResponse = await fetchJson<CoachAthleteWorkspaceBootstrap>(
        `/coach/mobile/athletes/${athleteId}/workspace/bootstrap`,
        { method: 'GET', auth: true, signal: controller.signal },
      );
      if (!isCurrent()) return;
      if (bootstrapResponse.status === 401) {
        router.replace('/login');
        return;
      }
      if (bootstrapResponse.status === 403 || bootstrapResponse.status === 404) {
        leaveRevokedWorkspace();
        return;
      }
      const nextBootstrap = bootstrapResponse.json;
      if (!bootstrapResponse.ok || !nextBootstrap?.ok) {
        throw new Error(nextBootstrap?.error || 'Athlete workspace is unavailable.');
      }
      if (
        Number(nextBootstrap.subject.coach_user_id) !== accountId
        || Number(nextBootstrap.subject.athlete_id) !== athleteId
        || !nextBootstrap.subject.relationship_generation
        || !nextBootstrap.subject.workspace_generation
        || !nextBootstrap.subject.subject_key
      ) {
        leaveRevokedWorkspace();
        return;
      }

      if (subjectKeyRef.current && subjectKeyRef.current !== nextBootstrap.subject.subject_key) {
        setTrainingState(EMPTY_TRAINING_STATE);
        setReviewState(EMPTY_REVIEW_STATE);
        setMessageDraft('');
        setPerformanceScrollY(0);
      }
      // Open the verified shell immediately. Summary and bounded Performance
      // may load independently after relationship authorization is resolved.
      setBootstrap({
        ...nextBootstrap,
        athlete: { ...nextBootstrap.athlete, ...normalizeProfilePhotoPayload(nextBootstrap.athlete) },
      });
      subjectKeyRef.current = nextBootstrap.subject.subject_key;
      setMessageThreadId(Number(nextBootstrap.conversation.thread_id || 0) || null);

      const summaryResponse = await fetchJson<CoachAthleteSummaryResponse>(
        `/coach/mobile/athletes/${athleteId}/summary?view=v3&period=4W`,
        { method: 'GET', auth: true, signal: controller.signal },
      );
      if (!isCurrent()) return;
      if (summaryResponse.status === 403 || summaryResponse.status === 404) {
        leaveRevokedWorkspace();
        return;
      }
      if (!summaryResponse.ok || !summaryResponse.json?.ok) {
        throw new Error(summaryResponse.json?.error || 'Athlete evidence is unavailable.');
      }
      setBootstrap({
        ...nextBootstrap,
        athlete: { ...nextBootstrap.athlete, ...normalizeProfilePhotoPayload(nextBootstrap.athlete) },
      });
      subjectKeyRef.current = nextBootstrap.subject.subject_key;
      setSummary({
        ...summaryResponse.json,
        athlete: {
          ...summaryResponse.json.athlete,
          ...normalizeProfilePhotoPayload(summaryResponse.json.athlete),
        },
      });
      setMessageThreadId(Number(nextBootstrap.conversation.thread_id || 0) || null);
    } catch (caught: any) {
      if (!isCurrent() || caught?.name === 'AbortError') return;
      setError(caught?.message || 'Athlete workspace could not be loaded.');
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accountId, athleteId, leaveRevokedWorkspace, requestNamespace, router]);

  useEffect(() => {
    void reload(false);
    return () => controllerRef.current?.abort();
  }, [reload]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload(true);
    });
    return () => subscription.remove();
  }, [reload]);

  const identityMatches = Boolean(
    bootstrap
    && namespaceRef.current === requestNamespace
    && Number(bootstrap.subject.coach_user_id) === accountId
    && Number(bootstrap.subject.athlete_id) === athleteId,
  );
  const verifiedBootstrap = identityMatches ? bootstrap : null;
  const verifiedSummary = identityMatches
    && Number(summary?.athlete?.id || 0) === athleteId
    ? summary
    : null;
  const verifiedMessageThreadId = verifiedBootstrap ? messageThreadId : null;
  const performanceState = useCoachPerformance(verifiedBootstrap?.subject.subject_key, athleteId, leaveRevokedWorkspace);

  const ensureMessageThread = useCallback(async () => {
    if (verifiedMessageThreadId) return verifiedMessageThreadId;
    const expectedSubject = verifiedBootstrap?.subject.subject_key;
    if (!expectedSubject) return null;
    const result = await ensureCoachAthleteThread(athleteId);
    if (
      !result.ok
      || !result.thread_id
      || expectedSubject !== subjectKeyRef.current
      || namespaceRef.current !== requestNamespace
    ) {
      if (result.error === 'Forbidden') leaveRevokedWorkspace();
      return null;
    }
    setMessageThreadId(result.thread_id);
    return result.thread_id;
  }, [athleteId, leaveRevokedWorkspace, requestNamespace, verifiedBootstrap?.subject.subject_key, verifiedMessageThreadId]);

  const subjectKey = `${requestNamespace}:${verifiedBootstrap?.subject.subject_key || 'resolving'}`;
  const value = useMemo<WorkspaceValue>(() => ({
    ...performanceState,
    performanceScrollY: verifiedBootstrap ? performanceScrollY : 0,
    setPerformanceScrollY,
    athleteId,
    bootstrap: verifiedBootstrap,
    summary: verifiedSummary,
    loading,
    refreshing,
    error,
    subjectKey,
    trainingState: verifiedBootstrap ? trainingState : EMPTY_TRAINING_STATE,
    setTrainingState,
    reviewState: verifiedBootstrap ? reviewState : EMPTY_REVIEW_STATE,
    setReviewState,
    messageThreadId: verifiedMessageThreadId,
    messageDraft: verifiedBootstrap ? messageDraft : '',
    setMessageDraft,
    ensureMessageThread,
    reload,
  }), [
    performanceState,
    performanceScrollY,
    athleteId,
    ensureMessageThread,
    error,
    loading,
    messageDraft,
    verifiedBootstrap,
    verifiedMessageThreadId,
    verifiedSummary,
    refreshing,
    reload,
    reviewState,
    subjectKey,
    trainingState,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useCoachAthleteWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useCoachAthleteWorkspace must be used inside CoachAthleteWorkspaceProvider.');
  return value;
}

export function useOptionalCoachAthleteWorkspace() {
  return useContext(WorkspaceContext);
}

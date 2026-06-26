import type { AuthUser } from '@/context/AuthContext';

export type MobileLifecycleRoute =
  | 'login'
  | 'verify_email'
  | 'workspace_setup'
  | 'billing_activation'
  | 'pending_invite'
  | 'coach_app'
  | 'individual_app'
  | 'athlete_app'
  | 'recoverable_error';

export type MobileLifecycleResolution = {
  route: MobileLifecycleRoute;
  isIndividual: boolean;
  isUnlinkedAthlete: boolean;
};

export function isIndividualUser(user: AuthUser | null | undefined): boolean {
  return !!(
    user?.is_coach &&
    (user.workspace_mode === 'individual' ||
      user.is_individual_workspace === true ||
      user.is_self_coached === true)
  );
}

export function resolveMobileLifecycle({
  user,
  token,
  hasRecoverableError = false,
}: {
  user: AuthUser | null;
  token?: string | null;
  hasRecoverableError?: boolean;
}): MobileLifecycleResolution {
  if (hasRecoverableError && token && !user) {
    return { route: 'recoverable_error', isIndividual: false, isUnlinkedAthlete: false };
  }

  if (!token || !user) {
    return { route: 'login', isIndividual: false, isUnlinkedAthlete: false };
  }

  const isIndividual = isIndividualUser(user);
  const isUnlinkedAthlete = !user.is_coach && (!user.has_linked_athlete || !user.athlete_id);

  if (user.verification_required === true && user.email_verified === false) {
    return { route: 'verify_email', isIndividual, isUnlinkedAthlete };
  }

  if (user.is_coach && user.billing_required === true) {
    return { route: 'billing_activation', isIndividual, isUnlinkedAthlete };
  }

  if (isIndividual) {
    return { route: 'individual_app', isIndividual, isUnlinkedAthlete };
  }

  if (!user.is_coach) {
    return {
      route: isUnlinkedAthlete ? 'pending_invite' : 'athlete_app',
      isIndividual,
      isUnlinkedAthlete,
    };
  }

  return { route: 'coach_app', isIndividual, isUnlinkedAthlete };
}


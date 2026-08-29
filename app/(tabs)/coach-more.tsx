import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useCoachMoreNavigation } from '@/components/navigation/CoachMoreNavigationSheet';

/**
 * Compatibility bridge for historical /coach-more links.
 * Normal navigation opens the shared sheet without changing routes.
 */
export default function CoachMoreCompatibilityRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const { open } = useCoachMoreNavigation();
  const launchedRef = useRef(false);

  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    const athleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
    const athleteName = Array.isArray(params.athleteName) ? params.athleteName[0] : params.athleteName;
    open({
      ...(athleteId ? { athleteId: String(athleteId) } : {}),
      ...(athleteName ? { athleteName: String(athleteName) } : {}),
    });
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/coach-dashboard');
    }, 0);
    return () => clearTimeout(timer);
  }, [open, params.athleteId, params.athleteName, router]);

  return null;
}

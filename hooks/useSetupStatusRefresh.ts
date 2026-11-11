import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** Reconcile delayed verification/checkout while visible, with bounded retries. */
export function useSetupStatusRefresh(refresh: () => Promise<void>) {
  useFocusEffect(useCallback(() => {
    let active = true;
    let running = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (!active || running || AppState.currentState !== 'active') return;
      running = true;
      try { await refresh(); } catch { /* Visible retry and contextual help remain available. */ }
      finally {
        running = false;
        if (active && ++attempts < 4) timer = setTimeout(check, attempts * 5000);
      }
    };
    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { clearTimeout(timer); return; }
      attempts = 0;
      clearTimeout(timer);
      void check();
    });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, [refresh]));
}

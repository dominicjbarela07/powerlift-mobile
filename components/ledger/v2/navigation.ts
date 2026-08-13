import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useLedgerV2Navigation() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ledger_fixture?: string | string[] }>();
  const rawFixture = Array.isArray(params.ledger_fixture) ? params.ledger_fixture[0] : params.ledger_fixture;
  const fixture = __DEV__ && (rawFixture === 'mature' || rawFixture === 'sparse') ? rawFixture : null;
  const href = useCallback((path: string) => {
    if (!fixture) return path;
    return `${path}${path.includes('?') ? '&' : '?'}ledger_fixture=${fixture}`;
  }, [fixture]);
  const push = useCallback((path: string) => router.push(href(path) as never), [href, router]);
  const replace = useCallback((path: string) => router.replace(href(path) as never), [href, router]);
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else replace('/(tabs)/ledger/home');
  }, [replace, router]);
  return { router, fixture, href, push, replace, back };
}

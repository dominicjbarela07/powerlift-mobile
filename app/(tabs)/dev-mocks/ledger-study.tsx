import React from 'react';
import { useRouter } from 'expo-router';
import LedgerDesignStudy from '@/components/ledger-study/LedgerDesignStudy';

export default function LedgerStudyRoute() {
  const router = useRouter();
  if (!__DEV__) return null;
  return <LedgerDesignStudy embedded onExit={() => router.back()} />;
}

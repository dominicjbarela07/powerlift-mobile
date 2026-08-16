import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function CoachRosterRoute() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const filter = Array.isArray(params.filter) ? params.filter[0] : params.filter;

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/coach-dashboard',
        params: { roster: '1', ...(filter ? { filter } : {}) },
      } as any}
    />
  );
}

// app/(tabs)/workouts.tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function WorkoutsRedirect() {
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/workout',
        params,
      }}
    />
  );
}

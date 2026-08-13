import AsyncStorage from '@react-native-async-storage/async-storage';

import { createCompletedSetSwipeTooltipStorage } from './completed-set-swipe-tooltip-core';

const storage = createCompletedSetSwipeTooltipStorage(AsyncStorage);

export const hasCompletedSetSwipeTooltipBeenShown = (workoutId: string | number) => storage.hasBeenShown(workoutId);
export const markCompletedSetSwipeTooltipShown = (workoutId: string | number) => storage.markShown(workoutId);

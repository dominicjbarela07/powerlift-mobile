import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLoggerFeedbackStorage } from './logger-feedback-storage-core';
import type { LoggerRecognitionEvent } from './logger-feedback';

const storage = createLoggerFeedbackStorage(AsyncStorage);

export const loadLoggerFeedbackStorage = (workoutId: string | number) => storage.load(workoutId);
export const persistPendingRecognition = (workoutId: string | number, events: LoggerRecognitionEvent[]) => storage.persist(workoutId, events);
export const markRecognitionConsumed = (workoutId: string | number, deliveryId: string) => storage.consume(workoutId, deliveryId);
export const invalidateRecognitionForSet = (workoutId: string | number, sourceSetLogId: number) => storage.invalidateSet(workoutId, sourceSetLogId);
export const invalidateRecognitionEvents = (workoutId: string | number, eventIds: number[]) => storage.invalidateEvents(workoutId, eventIds);

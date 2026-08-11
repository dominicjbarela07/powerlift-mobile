import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ACCESSORY_CATALOG_REVIEW_USER_ID,
  type AccessoryReviewStore,
  createAccessoryReviewStore,
  reconcileAccessoryReviewStore,
} from '@/lib/accessory-catalog-review';

export function accessoryReviewStorageKey(userId = ACCESSORY_CATALOG_REVIEW_USER_ID): string {
  return `strength-ledger:accessory-catalog-review:v1:user:${userId}`;
}

export async function loadAccessoryReviewStore(
  userId = ACCESSORY_CATALOG_REVIEW_USER_ID,
): Promise<AccessoryReviewStore> {
  const serialized = await AsyncStorage.getItem(accessoryReviewStorageKey(userId));
  if (!serialized) return createAccessoryReviewStore(userId);
  try {
    return reconcileAccessoryReviewStore(JSON.parse(serialized), userId);
  } catch {
    return createAccessoryReviewStore(userId);
  }
}

export async function saveAccessoryReviewStore(store: AccessoryReviewStore): Promise<void> {
  await AsyncStorage.setItem(accessoryReviewStorageKey(store.user_id), JSON.stringify(store));
}

export async function resetAccessoryReviewStore(
  userId = ACCESSORY_CATALOG_REVIEW_USER_ID,
): Promise<AccessoryReviewStore> {
  await AsyncStorage.removeItem(accessoryReviewStorageKey(userId));
  return createAccessoryReviewStore(userId);
}

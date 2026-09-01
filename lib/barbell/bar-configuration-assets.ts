export type BarConfigurationAssetIdentity = '35lb' | '45lb' | '55lb' | 'custom';
export type CollarConfigurationAssetIdentity = 'none' | 'competition' | 'custom';

const BAR_CONFIGURATION_ASSETS: Record<
  BarConfigurationAssetIdentity,
  Record<CollarConfigurationAssetIdentity, number>
> = {
  '35lb': {
    none: require('@/assets/images/warmup-configuration/bars/bar-35lb-none.png'),
    competition: require('@/assets/images/warmup-configuration/bars/bar-35lb-competition.png'),
    custom: require('@/assets/images/warmup-configuration/bars/bar-35lb-custom-collars.png'),
  },
  '45lb': {
    none: require('@/assets/images/warmup-configuration/bars/bar-45lb-none.png'),
    competition: require('@/assets/images/warmup-configuration/bars/bar-45lb-competition.png'),
    custom: require('@/assets/images/warmup-configuration/bars/bar-45lb-custom-collars.png'),
  },
  '55lb': {
    none: require('@/assets/images/warmup-configuration/bars/bar-55lb-none.png'),
    competition: require('@/assets/images/warmup-configuration/bars/bar-55lb-competition.png'),
    custom: require('@/assets/images/warmup-configuration/bars/bar-55lb-custom-collars.png'),
  },
  custom: {
    none: require('@/assets/images/warmup-configuration/bars/bar-custom-none.png'),
    competition: require('@/assets/images/warmup-configuration/bars/bar-custom-competition.png'),
    custom: require('@/assets/images/warmup-configuration/bars/bar-custom-custom-collars.png'),
  },
};

export function normalizeBarConfigurationAssetIdentity(barKey: string): BarConfigurationAssetIdentity {
  if (barKey === 'kg_15' || barKey === 'lb_35') return '35lb';
  if (barKey === 'kg_20' || barKey === 'lb_45') return '45lb';
  if (barKey === 'kg_25' || barKey === 'lb_55') return '55lb';
  return 'custom';
}

export function normalizeCollarConfigurationAssetIdentity(collarKey: string): CollarConfigurationAssetIdentity {
  if (collarKey === 'none') return 'none';
  if (collarKey === 'competition') return 'competition';
  return 'custom';
}

export function resolveBarConfigurationAsset(barKey: string, collarKey: string): number {
  const barIdentity = normalizeBarConfigurationAssetIdentity(barKey);
  const collarIdentity = normalizeCollarConfigurationAssetIdentity(collarKey);
  return BAR_CONFIGURATION_ASSETS[barIdentity][collarIdentity];
}

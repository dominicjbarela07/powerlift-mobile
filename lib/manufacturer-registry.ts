export type ManufacturerLogoAssetKey =
  | 'hammer-strength'
  | 'life-fitness'
  | 'prime-fitness'
  | 'arsenal-strength'
  | 'rogers-athletic'
  | 'atlantis'
  | 'nautilus'
  | 'precor'
  | 'hoist'
  | 'legend-fitness'
  | 'rogue'
  | 'sorinex'
  | 'elitefts'
  | 'technogym'
  | 'panatta'
  | 'cybex'
  | 'matrix'
  | 'nebula'
  | 'bodymasters'
  | 'gym80'
  | 'eleiko'
  | 'keiser'
  | 'freemotion'
  | 'star-trac'
  | 'torque-fitness'
  | 'sportsart'
  | 'newtech'
  | 'glutebuilder'
  | 'mega-mass'
  | 'icarian'
  | 'gymleco'
  | 'pit-shark'
  | 'watson';

export type ManufacturerRegistryEntry = Readonly<{
  key: string;
  displayName: string;
  aliases: readonly string[];
  logoAssetKey: ManufacturerLogoAssetKey | null;
  logoSurface?: 'dark' | 'light';
  opticalScale: number;
}>;

export type ResolvedManufacturerBrand = Readonly<{
  key: string | null;
  displayName: string;
  logoAssetKey: ManufacturerLogoAssetKey | null;
  logoSurface: 'dark' | 'light';
  opticalScale: number;
  usesFallback: boolean;
}>;

/**
 * Canonical, UI-independent manufacturer identity registry.
 *
 * A null logoAssetKey is intentional: the history UI renders a labeled fallback
 * until official artwork can be sourced and documented.
 */
export const MANUFACTURER_REGISTRY: readonly ManufacturerRegistryEntry[] = Object.freeze([
  {
    key: 'hammer-strength',
    displayName: 'Hammer Strength',
    aliases: ['hammer strength', 'hammerstrength'],
    logoAssetKey: 'hammer-strength',
    opticalScale: 0.92,
  },
  {
    key: 'life-fitness',
    displayName: 'Life Fitness',
    aliases: ['life fitness', 'lifefitness'],
    logoAssetKey: 'life-fitness',
    opticalScale: 0.9,
  },
  {
    key: 'prime-fitness',
    displayName: 'Prime Fitness',
    aliases: ['prime fitness usa', 'prime fitness', 'prime'],
    logoAssetKey: 'prime-fitness',
    opticalScale: 0.9,
  },
  {
    key: 'arsenal-strength',
    displayName: 'Arsenal Strength',
    aliases: ['arsenal strength', 'my arsenal strength', 'arsenal'],
    logoAssetKey: 'arsenal-strength',
    opticalScale: 0.88,
  },
  {
    key: 'rogers-athletic',
    displayName: 'Rogers Athletic',
    aliases: ['rogers athletic', 'rogers pendulum', 'pendulum strength'],
    logoAssetKey: 'rogers-athletic',
    opticalScale: 0.9,
  },
  {
    key: 'technogym',
    displayName: 'Technogym',
    aliases: ['technogym', 'techno gym'],
    logoAssetKey: 'technogym',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'atlantis',
    displayName: 'Atlantis',
    aliases: ['atlantis strength', 'atlantis'],
    logoAssetKey: 'atlantis',
    opticalScale: 0.92,
  },
  {
    key: 'panatta',
    displayName: 'Panatta',
    aliases: ['panatta sport', 'panatta'],
    logoAssetKey: 'panatta',
    opticalScale: 0.9,
  },
  {
    key: 'cybex',
    displayName: 'Cybex',
    aliases: ['cybex international', 'cybex'],
    logoAssetKey: 'cybex',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'matrix',
    displayName: 'Matrix',
    aliases: ['matrix fitness', 'matrix'],
    logoAssetKey: 'matrix',
    opticalScale: 0.9,
  },
  {
    key: 'nautilus',
    displayName: 'Nautilus',
    aliases: ['nautilus commercial', 'nautilus'],
    logoAssetKey: 'nautilus',
    opticalScale: 0.92,
  },
  {
    key: 'precor',
    displayName: 'Precor',
    aliases: ['precor incorporated', 'precor'],
    logoAssetKey: 'precor',
    opticalScale: 0.92,
  },
  {
    key: 'hoist',
    displayName: 'Hoist',
    aliases: ['hoist fitness', 'hoist'],
    logoAssetKey: 'hoist',
    opticalScale: 0.9,
  },
  {
    key: 'legend-fitness',
    displayName: 'Legend Fitness',
    aliases: ['legend fitness', 'legend'],
    logoAssetKey: 'legend-fitness',
    opticalScale: 0.88,
  },
  {
    key: 'rogue',
    displayName: 'Rogue',
    aliases: ['rogue fitness', 'rogue'],
    logoAssetKey: 'rogue',
    opticalScale: 0.88,
  },
  {
    key: 'sorinex',
    displayName: 'Sorinex',
    aliases: ['sorinex exercise equipment', 'sorinex'],
    logoAssetKey: 'sorinex',
    opticalScale: 0.88,
  },
  {
    key: 'elitefts',
    displayName: 'EliteFTS',
    aliases: ['elite fts', 'elitefts'],
    logoAssetKey: 'elitefts',
    opticalScale: 0.9,
  },
  {
    key: 'strive',
    displayName: 'Strive',
    aliases: ['strive fitness', 'strive'],
    logoAssetKey: null,
    opticalScale: 1,
  },
  {
    key: 'nebula',
    displayName: 'Nebula',
    aliases: ['nebula fitness', 'nebula'],
    logoAssetKey: 'nebula',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'bodymasters',
    displayName: 'Bodymasters',
    aliases: ['body masters', 'bodymasters'],
    logoAssetKey: 'bodymasters',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'gym80',
    displayName: 'gym80',
    aliases: ['gym 80', 'gym80'],
    logoAssetKey: 'gym80',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'eleiko',
    displayName: 'Eleiko',
    aliases: ['eleiko sport', 'eleiko'],
    logoAssetKey: 'eleiko',
    opticalScale: 0.9,
  },
  {
    key: 'keiser',
    displayName: 'Keiser',
    aliases: ['keiser fitness', 'keiser'],
    logoAssetKey: 'keiser',
    opticalScale: 0.9,
  },
  {
    key: 'freemotion',
    displayName: 'FreeMotion',
    aliases: ['free motion fitness', 'freemotion fitness', 'freemotion'],
    logoAssetKey: 'freemotion',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'star-trac',
    displayName: 'Star Trac',
    aliases: ['star trac', 'startrac'],
    logoAssetKey: 'star-trac',
    opticalScale: 0.9,
  },
  {
    key: 'torque-fitness',
    displayName: 'Torque Fitness',
    aliases: ['torque fitness', 'torque'],
    logoAssetKey: 'torque-fitness',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'sportsart',
    displayName: 'SportsArt',
    aliases: ['sports art', 'sportsart'],
    logoAssetKey: 'sportsart',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'newtech',
    displayName: 'Newtech',
    aliases: ['newtech strength equipment', 'new tech strength', 'newtech'],
    logoAssetKey: 'newtech',
    logoSurface: 'light',
    opticalScale: 0.9,
  },
  {
    key: 'glutebuilder',
    displayName: 'GluteBuilder',
    aliases: ['glutebuilder', 'glute builder', 'glute builder fitness'],
    logoAssetKey: 'glutebuilder',
    opticalScale: 0.9,
  },
  {
    key: 'mega-mass',
    displayName: 'Mega Mass',
    aliases: [
      'mega mass',
      'megamass',
      'mega mass fitness',
      'megamass fitness',
      'mega mass strength',
      'megamass strength',
    ],
    logoAssetKey: 'mega-mass',
    opticalScale: 0.9,
  },
  {
    key: 'icarian',
    displayName: 'Icarian',
    aliases: ['icarian', 'icarian fitness', 'precor icarian'],
    logoAssetKey: 'icarian',
    logoSurface: 'light',
    opticalScale: 0.94,
  },
  {
    key: 'gymleco',
    displayName: 'Gymleco',
    aliases: ['gymleco', 'gym leco', 'gymleco fitness'],
    logoAssetKey: 'gymleco',
    opticalScale: 0.94,
  },
  {
    key: 'pit-shark',
    displayName: 'Pit Shark',
    aliases: ['pit shark', 'pitshark', 'pit shark strength', 'pit shark equipment'],
    logoAssetKey: 'pit-shark',
    logoSurface: 'light',
    opticalScale: 0.92,
  },
  {
    key: 'watson',
    displayName: 'Watson',
    aliases: ['watson', 'watson gym equipment'],
    logoAssetKey: 'watson',
    logoSurface: 'light',
    opticalScale: 0.94,
  },
]);

export function normalizeManufacturerIdentity(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const MANUFACTURER_MATCHERS = MANUFACTURER_REGISTRY
  .flatMap((entry) => entry.aliases.map((alias) => ({
    entry,
    normalizedAlias: normalizeManufacturerIdentity(alias),
  })))
  .sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length);

export function resolveManufacturerBrand(
  manufacturerName: string | null | undefined,
): ResolvedManufacturerBrand {
  const normalized = normalizeManufacturerIdentity(manufacturerName);
  const match = normalized
    ? MANUFACTURER_MATCHERS.find(({ normalizedAlias }) => (
      normalized === normalizedAlias
      || normalized.startsWith(`${normalizedAlias} `)
      || normalized.endsWith(` ${normalizedAlias}`)
      || normalized.includes(` ${normalizedAlias} `)
    ))
    : null;

  if (match) {
    return {
      key: match.entry.key,
      displayName: match.entry.displayName,
      logoAssetKey: match.entry.logoAssetKey,
      logoSurface: match.entry.logoSurface || 'dark',
      opticalScale: match.entry.opticalScale,
      usesFallback: !match.entry.logoAssetKey,
    };
  }

  const fallbackName = String(manufacturerName || '').trim() || 'Unknown manufacturer';
  return {
    key: null,
    displayName: fallbackName,
    logoAssetKey: null,
    logoSurface: 'dark',
    opticalScale: 1,
    usesFallback: true,
  };
}

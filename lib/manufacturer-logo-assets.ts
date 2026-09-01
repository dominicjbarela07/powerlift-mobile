import type { ImageSourcePropType } from 'react-native';

import type { ManufacturerLogoAssetKey } from '@/lib/manufacturer-registry';

/**
 * Static require calls are required by Metro. Manufacturer matching remains in
 * manufacturer-registry.ts so consumers never hardcode asset paths.
 */
export const MANUFACTURER_LOGO_ASSETS: Readonly<
  Record<ManufacturerLogoAssetKey, ImageSourcePropType>
> = Object.freeze({
  'hammer-strength': require('@/assets/images/manufacturer-logos/runtime/hammer-strength.png'),
  'life-fitness': require('@/assets/images/manufacturer-logos/runtime/life-fitness.png'),
  'prime-fitness': require('@/assets/images/manufacturer-logos/runtime/prime-fitness.png'),
  'arsenal-strength': require('@/assets/images/manufacturer-logos/runtime/arsenal-strength.png'),
  'rogers-athletic': require('@/assets/images/manufacturer-logos/runtime/rogers-athletic.png'),
  atlantis: require('@/assets/images/manufacturer-logos/runtime/atlantis.png'),
  nautilus: require('@/assets/images/manufacturer-logos/runtime/nautilus.png'),
  precor: require('@/assets/images/manufacturer-logos/runtime/precor.png'),
  hoist: require('@/assets/images/manufacturer-logos/runtime/hoist.png'),
  'legend-fitness': require('@/assets/images/manufacturer-logos/runtime/legend-fitness.png'),
  rogue: require('@/assets/images/manufacturer-logos/runtime/rogue.png'),
  sorinex: require('@/assets/images/manufacturer-logos/runtime/sorinex.png'),
  elitefts: require('@/assets/images/manufacturer-logos/runtime/elitefts.png'),
  technogym: require('@/assets/images/manufacturer-logos/runtime/technogym.png'),
  panatta: require('@/assets/images/manufacturer-logos/runtime/panatta.png'),
  cybex: require('@/assets/images/manufacturer-logos/runtime/cybex.png'),
  matrix: require('@/assets/images/manufacturer-logos/runtime/matrix.png'),
  nebula: require('@/assets/images/manufacturer-logos/runtime/nebula.png'),
  bodymasters: require('@/assets/images/manufacturer-logos/runtime/bodymasters.png'),
  gym80: require('@/assets/images/manufacturer-logos/runtime/gym80.png'),
  eleiko: require('@/assets/images/manufacturer-logos/runtime/eleiko.png'),
  keiser: require('@/assets/images/manufacturer-logos/runtime/keiser.png'),
  freemotion: require('@/assets/images/manufacturer-logos/runtime/freemotion.png'),
  'star-trac': require('@/assets/images/manufacturer-logos/runtime/star-trac.png'),
  'torque-fitness': require('@/assets/images/manufacturer-logos/runtime/torque-fitness.png'),
  sportsart: require('@/assets/images/manufacturer-logos/runtime/sportsart.png'),
  newtech: require('@/assets/images/manufacturer-logos/runtime/newtech.png'),
  glutebuilder: require('@/assets/images/manufacturer-logos/runtime/glutebuilder.png'),
  'mega-mass': require('@/assets/images/manufacturer-logos/runtime/mega-mass.png'),
  icarian: require('@/assets/images/manufacturer-logos/runtime/icarian.png'),
  gymleco: require('@/assets/images/manufacturer-logos/runtime/gymleco.png'),
  'pit-shark': require('@/assets/images/manufacturer-logos/runtime/pit-shark.png'),
  watson: require('@/assets/images/manufacturer-logos/runtime/watson.png'),
});

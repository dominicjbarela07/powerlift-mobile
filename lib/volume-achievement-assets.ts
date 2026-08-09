import type { ImageSourcePropType } from 'react-native';
import type { ImageContentPosition } from 'expo-image';

import type { VolumeAchievementPhotoId } from '@/lib/volume-achievements';

export type VolumeAchievementPhotoAsset = {
  source: ImageSourcePropType;
  creditLine: string;
  licenseShort: string;
  sourcePage: string;
};

export type VolumeAchievementPhotoTreatment = {
  fitMode: 'cover' | 'contain';
  focalPosition: ImageContentPosition;
  overlayStrength: 'soft' | 'medium';
  imageScale: number;
  textGradientStrength: 'CC' | 'D8' | 'E6';
};

export type PresentedVolumeAchievementPhoto = VolumeAchievementPhotoAsset & VolumeAchievementPhotoTreatment;

/**
 * Subject-aware crop metadata stays beside the asset registry rather than in
 * presentation JSX. Portrait/vertical subjects use contain; broad vehicles and
 * environments use cover with an intentional focal bias.
 */
export const VOLUME_ACHIEVEMENT_PHOTO_TREATMENTS: Readonly<Record<VolumeAchievementPhotoId, VolumeAchievementPhotoTreatment>> = {
  'airbus-a320': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'boeing-737-800': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'highway-semi': { fitMode: 'cover', focalPosition: { right: '18%', bottom: '30%' }, overlayStrength: 'medium', imageScale: 1.08, textGradientStrength: 'E6' },
  'r160-subway-car': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'shuttle-orbiter': { fitMode: 'cover', focalPosition: { left: '50%', top: '48%' }, overlayStrength: 'soft', imageScale: 1.03, textGradientStrength: 'D8' },
  'blue-whale': { fitMode: 'cover', focalPosition: { left: '52%', top: '52%' }, overlayStrength: 'soft', imageScale: 1.06, textGradientStrength: 'E6' },
  'c17-globemaster': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'shuttle-solid-rocket-booster': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'heavy-mikado': { fitMode: 'cover', focalPosition: { left: '42%', top: '50%' }, overlayStrength: 'medium', imageScale: 1.03, textGradientStrength: 'E6' },
  'statue-of-liberty': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'old-hickory-rotor': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'airbus-a380': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'international-space-station': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'lower-granite-rotor': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'boeing-747-8f': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'saturn-v-sii': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'christ-the-redeemer': { fitMode: 'contain', focalPosition: 'top center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'belaz-75710': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'john-day-generator': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'shuttle-external-tank': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'space-shuttle-stack': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'hoover-dam-generator': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'balao-submarine': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'saturn-v-sic': { fitMode: 'contain', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'national-security-cutter': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
  'uss-nautilus': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'nasa-crawler-transporter': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'medium', imageScale: 1, textGradientStrength: 'D8' },
  'shuttle-transport-assembly': { fitMode: 'cover', focalPosition: 'center', overlayStrength: 'soft', imageScale: 1, textGradientStrength: 'D8' },
};

export const VOLUME_ACHIEVEMENT_PHOTOS: Readonly<Record<VolumeAchievementPhotoId, VolumeAchievementPhotoAsset>> = {
  'airbus-a320': {
    source: require('@/assets/images/volume-achievements/100k-airbus-a320.webp'),
    creditLine: 'Photo: Julian Herzog',
    licenseShort: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Lufthansa_Airbus_A320-211_D-AIQT_01.jpg',
  },
  'boeing-737-800': {
    source: require('@/assets/images/volume-achievements/100k-boeing-737-800.webp'),
    creditLine: 'Photo: Peter Haas',
    licenseShort: 'CC BY-SA 3.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Gear_Actuation-Boeing-737-800_EL-AL_approaching_VIE-DSC_3259w.jpg',
  },
  'highway-semi': {
    source: require('@/assets/images/volume-achievements/100k-highway-semi.webp'),
    creditLine: 'Photo: Carl Davies / CSIRO',
    licenseShort: 'CC BY 3.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:CSIRO_ScienceImage_3497_Truck_on_highway_rural_NSW.jpg',
  },
  'r160-subway-car': {
    source: require('@/assets/images/volume-achievements/100k-r160-subway-car.webp'),
    creditLine: 'Photo: GK tramrunner RU',
    licenseShort: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:NYC_Subway_R160_Car.jpg',
  },
  'shuttle-orbiter': {
    source: require('@/assets/images/volume-achievements/250k-shuttle-orbiter.webp'),
    creditLine: 'Photo: NASA / Tony Gray & Tim Powers',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:ShuttleDiscovery_landing.jpg',
  },
  'blue-whale': {
    source: require('@/assets/images/volume-achievements/250k-blue-whale.webp'),
    creditLine: 'Photo: Carina Gsottbauer',
    licenseShort: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:2023-08-04_Blue_whale_Isfjord_Svalbard_01.jpg',
  },
  'c17-globemaster': {
    source: require('@/assets/images/volume-achievements/250k-c17-globemaster.webp'),
    creditLine: 'Photo: U.S. Air Force',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:C-17_test_sortie.jpg',
  },
  'shuttle-solid-rocket-booster': {
    source: require('@/assets/images/volume-achievements/250k-shuttle-srb.webp'),
    creditLine: 'Photo: NASA',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:KAMAG_transporting_moving_a_Space_Shuttle_Solid_Rocket_Boosters_(214587).jpg',
  },
  'heavy-mikado': {
    source: require('@/assets/images/volume-achievements/500k-heavy-mikado.webp'),
    creditLine: 'Photo: Aaron Headly',
    licenseShort: 'CC BY 2.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Chicago,_Burlington_and_Quincy_No._4963_at_the_Illinois_Railway_Museum_-_May_2023.jpg',
  },
  'statue-of-liberty': {
    source: require('@/assets/images/volume-achievements/500k-statue-of-liberty.webp'),
    creditLine: 'Photo: Dietmar Rabich',
    licenseShort: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:New_York_City_(New_York,_USA),_Statue_of_Liberty_--_2012_--_6660.jpg',
  },
  'old-hickory-rotor': {
    source: require('@/assets/images/volume-achievements/500k-old-hickory-rotor.webp'),
    creditLine: 'Representative rotor photo: Eric Deng',
    licenseShort: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Bi-Hai_Power_Plant03.jpg',
  },
  'airbus-a380': {
    source: require('@/assets/images/volume-achievements/500k-airbus-a380.webp'),
    creditLine: 'Photo: Joe Ravi',
    licenseShort: 'CC BY-SA 3.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Air_France_A380_F-HPJA.jpg',
  },
  'international-space-station': {
    source: require('@/assets/images/volume-achievements/1m-international-space-station.webp'),
    creditLine: 'Photo: NASA',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:STS-134_International_Space_Station_after_undocking.jpg',
  },
  'lower-granite-rotor': {
    source: require('@/assets/images/volume-achievements/1m-lower-granite-rotor.webp'),
    creditLine: 'Representative rotor photo: Mazbln',
    licenseShort: 'CC BY-SA 3.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Goldisthal_Rotor-Blechpaket.jpg',
  },
  'boeing-747-8f': {
    source: require('@/assets/images/volume-achievements/1m-boeing-747-8f.webp'),
    creditLine: 'Photo: 4300streetcar',
    licenseShort: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Atlas_Air_Boeing_747-8F_departing_Taoyuan_February_2026.jpg',
  },
  'saturn-v-sii': {
    source: require('@/assets/images/volume-achievements/1m-saturn-v-sii.webp'),
    creditLine: 'Photo: NASA Stennis Space Center',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:S-II_Stage_of_Saturn_V_Rocket_(67-701-c).jpeg',
  },
  'christ-the-redeemer': {
    source: require('@/assets/images/volume-achievements/2m-christ-redeemer.webp'),
    creditLine: 'Photo: Pinterpandai',
    licenseShort: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Guardian_of_Rio,_The_Iconic_Christ_Statue.jpg',
  },
  'belaz-75710': {
    source: require('@/assets/images/volume-achievements/2m-belaz-75710.webp'),
    creditLine: 'Image: Hasan Hüseyin Kulak',
    licenseShort: 'CC BY 3.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:BelAZ_75710_1.png',
  },
  'john-day-generator': {
    source: require('@/assets/images/volume-achievements/2m-john-day-generator.webp'),
    creditLine: 'Photo: Bonneville Power Administration',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:John_Day_Dam_(11955928563).jpg',
  },
  'shuttle-external-tank': {
    source: require('@/assets/images/volume-achievements/2m-shuttle-external-tank.webp'),
    creditLine: 'Photo: NASA',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:S125-E-005085_-_Space_Shuttle_External_tank_after_separation_from_Atlantis_during_STS-125.jpg',
  },
  'space-shuttle-stack': {
    source: require('@/assets/images/volume-achievements/5m-space-shuttle-stack.webp'),
    creditLine: 'Photo: NASA',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Space_Shuttle_Columbia_launching.jpg',
  },
  'hoover-dam-generator': {
    source: require('@/assets/images/volume-achievements/5m-hoover-generators.webp'),
    creditLine: 'Photo: Swickouski',
    licenseShort: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Hoover_Dam_generators_001.jpg',
  },
  'balao-submarine': {
    source: require('@/assets/images/volume-achievements/5m-balao-submarine.webp'),
    creditLine: 'Photo: Robert Linsdell',
    licenseShort: 'CC BY 2.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:USS_Bowfin_Submarine_Museum_%26_Park,_Pearl_Harbor,_Honolulu_(503653)_(20588889142).jpg',
  },
  'saturn-v-sic': {
    source: require('@/assets/images/volume-achievements/5m-saturn-v-sic.webp'),
    creditLine: 'Photo: NASA / MSFC',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Saturn_V_S-IC-T_Stage_Heads_to_Test_Stand.jpg',
  },
  'national-security-cutter': {
    source: require('@/assets/images/volume-achievements/10m-national-security-cutter.webp'),
    creditLine: 'Photo: U.S. Coast Guard / RDML Ronald Rabago',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:USCGC_Bertholf_WMSL-750.jpg',
  },
  'uss-nautilus': {
    source: require('@/assets/images/volume-achievements/10m-uss-nautilus.webp'),
    creditLine: 'Photo: U.S. Navy',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:USS_Nautilus_(SSN-571)_underway_at_sea_in_June_1965.jpg',
  },
  'nasa-crawler-transporter': {
    source: require('@/assets/images/volume-achievements/10m-nasa-crawler.webp'),
    creditLine: 'Photo: NASA / KSC',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:NASA_Crawler_Transporter_2_on_the_crawlerway.jpg',
  },
  'shuttle-transport-assembly': {
    source: require('@/assets/images/volume-achievements/10m-shuttle-transport.webp'),
    creditLine: 'Photo: NASA',
    licenseShort: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:STS-86_Rollout_-_GPN-2000-000799.jpg',
  },
};

export function volumeAchievementPhoto(photoId: VolumeAchievementPhotoId): PresentedVolumeAchievementPhoto {
  return { ...VOLUME_ACHIEVEMENT_PHOTOS[photoId], ...VOLUME_ACHIEVEMENT_PHOTO_TREATMENTS[photoId] };
}

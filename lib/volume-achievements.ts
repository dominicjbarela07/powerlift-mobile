export type VolumeDisplayUnit = 'lb' | 'kg';
export type VolumeAchievementState = 'achieved' | 'current' | 'locked';
export type VolumeAchievementContextId = 'total' | 'squat' | 'bench' | 'deadlift';
export type VolumeAchievementImportance = 'foundational' | 'major' | 'elite';
export type VolumeComparisonGlyph = 'airliner' | 'shuttle' | 'locomotive' | 'station' | 'tug' | 'mining-shovel' | 'liner';
export type VolumeComparisonRelation = 'slightly_below' | 'approximately_equal' | 'slightly_above';
export type VolumeAchievementPhotoId =
  | 'airbus-a320'
  | 'boeing-737-800'
  | 'highway-semi'
  | 'r160-subway-car'
  | 'shuttle-orbiter'
  | 'blue-whale'
  | 'c17-globemaster'
  | 'shuttle-solid-rocket-booster'
  | 'heavy-mikado'
  | 'statue-of-liberty'
  | 'old-hickory-rotor'
  | 'airbus-a380'
  | 'international-space-station'
  | 'lower-granite-rotor'
  | 'boeing-747-8f'
  | 'saturn-v-sii'
  | 'christ-the-redeemer'
  | 'belaz-75710'
  | 'john-day-generator'
  | 'shuttle-external-tank'
  | 'space-shuttle-stack'
  | 'hoover-dam-generator'
  | 'balao-submarine'
  | 'saturn-v-sic'
  | 'national-security-cutter'
  | 'uss-nautilus'
  | 'nasa-crawler-transporter'
  | 'shuttle-transport-assembly';

export type VolumeComparisonSource = {
  label: string;
  url: string;
  reference: string;
};

export type VolumeFunFactCategory = 'aviation-first' | 'operations' | 'preservation' | 'orbital-life' | 'engineering' | 'reuse' | 'endurance' | 'scale' | 'wildlife' | 'transit';

export type VolumeFunFact = {
  id: string;
  text: string;
  category: VolumeFunFactCategory;
  source: VolumeComparisonSource;
  alternate?: {
    text: string;
    source: VolumeComparisonSource;
  };
};

export type VolumeComparisonCandidate = {
  id: string;
  title: string;
  approximateWeightLb: number;
  weightConfiguration: string;
  relation: VolumeComparisonRelation;
  whyItMaps: string;
  recommendedCopy: string;
  achievedCopy: string;
  targetCopy: string;
  description: string;
  perspectiveFact: string;
  glyph: VolumeComparisonGlyph;
  photoId: VolumeAchievementPhotoId;
  funFact: VolumeFunFact;
  source: VolumeComparisonSource;
  additionalSources?: readonly VolumeComparisonSource[];
};

export type VolumeAchievementMilestone = {
  thresholdLb: number;
  compactLabel: string;
  importance: VolumeAchievementImportance;
  primaryComparisonId: string;
  comparisons: readonly VolumeComparisonCandidate[];
};

const VOLUME_COMPARISON_INDEX_BY_CONTEXT: Readonly<Record<VolumeAchievementContextId, number>> = {
  total: 0,
  squat: 1,
  bench: 2,
  deadlift: 3,
};

export type DerivedVolumeMilestone = VolumeAchievementMilestone & {
  state: VolumeAchievementState;
};

export type VolumeAchievementProgress = {
  currentLb: number;
  achieved: VolumeAchievementMilestone | null;
  next: VolumeAchievementMilestone | null;
  remainingLb: number;
  segmentProgress: number;
  milestones: DerivedVolumeMilestone[];
};

export type VolumeComparisonPresentation = {
  state: VolumeAchievementState;
  isUnlocked: boolean;
  isLatestAchieved: boolean;
  isCurrentTarget: boolean;
  isFutureLocked: boolean;
  visibleTitle: string | null;
  visibleImage: VolumeAchievementPhotoId | null;
  visibleFunFact: VolumeFunFact | null;
  visibleDetailAccess: boolean;
  comparison: VolumeComparisonCandidate | null;
};

const KG_PER_LB = 0.45359237;

/**
 * Canonical pound-based lifetime-volume ladder. Each threshold has one stable
 * primary comparison and reviewed alternatives for future deterministic use.
 */
export const VOLUME_ACHIEVEMENT_MILESTONES: readonly VolumeAchievementMilestone[] = [
  {
    thresholdLb: 100_000,
    compactLabel: '100K',
    importance: 'foundational',
    primaryComparisonId: 'airbus-a320-operating-empty',
    comparisons: [
      {
        id: 'airbus-a320-operating-empty',
        title: 'Airbus A320',
        approximateWeightLb: 90_927,
        weightConfiguration: 'Operating empty weight for the reference A320 configuration.',
        relation: 'slightly_below',
        whyItMaps: 'The 100K milestone is about 9% more than this reference operating empty weight.',
        recommendedCopy: 'About the operating empty weight of an Airbus A320.',
        achievedCopy: 'You have moved more than the operating empty weight of an Airbus A320.',
        targetCopy: 'Reach the operating-empty-weight scale of an Airbus A320.',
        description: 'Airbus lists a reference A320 operating empty weight of 90,927 lb; airline configurations vary.',
        perspectiveFact: 'That is the aircraft with its operating equipment, but without payload or usable fuel.',
        funFact: {
          id: 'a320-first-commercial-fly-by-wire',
          text: 'The A320 was the first fly-by-wire airliner to enter commercial service.',
          category: 'aviation-first',
          source: {
            label: 'Airbus, 25 years of aircraft family commonality',
            url: 'https://www.airbus.com/en/newsroom/news/2016-09-airbus-innovation-at-work-25-years-of-aircraft-family-commonality',
            reference: 'Airbus identifies the A320 as the first fly-by-wire airliner to enter commercial service.',
          },
          alternate: {
            text: 'The first A320 flight lasted three hours and 23 minutes.',
            source: {
              label: 'Airbus, 30 years young and still going strong',
              url: 'https://www.airbus.com/en/newsroom/news/2017-02-30-years-youngand-still-going-strong',
              reference: 'The first A320 flight on February 22, 1987 lasted 3 hours and 23 minutes.',
            },
          },
        },
        glyph: 'airliner',
        photoId: 'airbus-a320',
        source: {
          label: 'Airbus A320 Aircraft Characteristics',
          url: 'https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-12/ac_a320_1223.pdf',
          reference: 'Reference A320 operating empty weight: 90,927 lb.',
        },
      },
      {
        id: 'boeing-737-800-operating-empty',
        title: 'Boeing 737-800',
        approximateWeightLb: 91_300,
        weightConfiguration: 'Typical operating empty weight.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 10% above the published typical operating empty weight.',
        recommendedCopy: 'More than the typical operating empty weight of a Boeing 737-800.',
        achievedCopy: 'You have moved more than the typical operating empty weight of a Boeing 737-800.',
        targetCopy: 'Build beyond the typical empty scale of a Boeing 737-800.',
        description: 'Boeing lists a typical operating empty weight of 91,300 lb for the 737-800.',
        perspectiveFact: 'Operating empty weight excludes usable fuel and payload.',
        funFact: {
          id: '737-empty-excludes-payload',
          text: 'Its operating empty weight excludes passengers, cargo, and usable fuel.',
          category: 'operations',
          source: {
            label: 'Boeing 737 Airplane Characteristics',
            url: 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/737NG_REV_B.pdf',
            reference: 'Boeing separates operating empty weight from payload and usable fuel in its planning data.',
          },
        },
        glyph: 'airliner',
        photoId: 'boeing-737-800',
        source: {
          label: 'Boeing 737 Airplane Characteristics',
          url: 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/737NG_REV_B.pdf',
          reference: '737-800 typical operating empty weight: 91,300 lb.',
        },
      },
      {
        id: 'interstate-semitrailer-gross-limit',
        title: 'Fully loaded highway semi',
        approximateWeightLb: 80_000,
        weightConfiguration: 'Federal gross vehicle weight limit on the Interstate System, subject to exceptions.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is 25% beyond the standard federal Interstate gross limit.',
        recommendedCopy: 'More than a fully loaded semi at the standard Interstate weight limit.',
        achievedCopy: 'You have moved more than a fully loaded semi at the standard Interstate weight limit.',
        targetCopy: 'Move beyond the scale of a fully loaded highway semi.',
        description: 'The standard federal Interstate gross vehicle weight limit is 80,000 lb, with statutory exceptions.',
        perspectiveFact: 'This is combined truck, trailer, cargo, fuel, and occupants—not cargo alone.',
        funFact: {
          id: 'semi-combined-gross-weight',
          text: 'The 80,000-pound limit covers the truck, trailer, cargo, fuel, and occupants together.',
          category: 'operations',
          source: {
            label: 'U.S. Department of Transportation truck weights testimony',
            url: 'https://www.transportation.gov/testimony/truck-weights-and-lengths-assessing-impacts-existing-laws-and-regulations',
            reference: 'USDOT describes the federal Interstate gross vehicle weight limit as 80,000 pounds.',
          },
        },
        glyph: 'liner',
        photoId: 'highway-semi',
        source: {
          label: 'U.S. Department of Transportation truck weights testimony',
          url: 'https://www.transportation.gov/testimony/truck-weights-and-lengths-assessing-impacts-existing-laws-and-regulations',
          reference: 'Federal Interstate gross vehicle weight limit: 80,000 lb.',
        },
      },
      {
        id: 'nyc-r160-subway-car',
        title: 'New York City subway car',
        approximateWeightLb: 85_200,
        weightConfiguration: 'Single R160 subway car in operating configuration.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 17% above one R160 car’s listed weight.',
        recommendedCopy: 'More than a New York City R160 subway car.',
        achievedCopy: 'You have moved more than a New York City R160 subway car.',
        targetCopy: 'Move beyond the scale of a New York City subway car.',
        description: 'MTA technical material lists an R160 car at approximately 85,200 lb.',
        perspectiveFact: 'This comparison is one car, not a complete multi-car train.',
        funFact: {
          id: 'r160-one-car-not-train',
          text: 'A single R160 car is only one vehicle in a much longer subway train.',
          category: 'transit',
          source: {
            label: 'MTA R160 fleet technical reference',
            url: 'https://new.mta.info/document/9141',
            reference: 'The MTA reference identifies R160 car dimensions and operating weight by individual car.',
          },
        },
        glyph: 'liner',
        photoId: 'r160-subway-car',
        source: {
          label: 'MTA R160 fleet technical reference',
          url: 'https://new.mta.info/document/9141',
          reference: 'Approximate R160 car weight: 85,200 lb.',
        },
      },
    ],
  },
  {
    thresholdLb: 250_000,
    compactLabel: '250K',
    importance: 'foundational',
    primaryComparisonId: 'space-shuttle-orbiter-landing',
    comparisons: [
      {
        id: 'space-shuttle-orbiter-landing',
        title: 'Space Shuttle orbiter',
        approximateWeightLb: 242_000,
        weightConfiguration: 'Representative orbiter landing mass after a mission.',
        relation: 'approximately_equal',
        whyItMaps: 'The representative landing mass is within about 3% of the milestone.',
        recommendedCopy: 'About the landing mass of a Space Shuttle orbiter.',
        achievedCopy: 'You have moved about the landing mass of a Space Shuttle orbiter.',
        targetCopy: 'Match the landing scale of a Space Shuttle orbiter.',
        description: 'NASA lists a representative orbiter landing mass of roughly 242,000 lb.',
        perspectiveFact: 'Landing mass is far lower than the mass of the complete fueled launch system.',
        funFact: {
          id: 'shuttle-unpowered-glider-landing',
          text: 'The orbiter returned from space as an unpowered glider.',
          category: 'operations',
          source: {
            label: 'NASA Glenn, Space Shuttle as a Glider',
            url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/space-shuttle-as-a-glider/',
            reference: 'NASA explains that no propellant remained available to the main engines during descent, so the shuttle returned as an unpowered glider.',
          },
          alternate: {
            text: 'Reentry slowed the orbiter from about 17,300 mph to roughly 250 mph at landing.',
            source: {
              label: 'NASA Glenn, Space Shuttle as a Glider',
              url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/space-shuttle-as-a-glider/',
              reference: 'NASA cites a descent from about 17,300 mph to about 250 mph at landing.',
            },
          },
        },
        glyph: 'shuttle',
        photoId: 'shuttle-orbiter',
        source: {
          label: 'NASA Orbiter Fleet reference',
          url: 'https://www3.nasa.gov/centers/kennedy/pdf/146681main_OrbiterFleet2003R.pdf',
          reference: 'Representative orbiter landing mass: 242,000 lb.',
        },
      },
      {
        id: 'blue-whale-adult',
        title: 'Adult blue whale',
        approximateWeightLb: 300_000,
        weightConfiguration: 'Representative adult mass within NOAA’s published range.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is about 83% of this representative adult mass.',
        recommendedCopy: 'Nearly the mass of an adult blue whale.',
        achievedCopy: 'You have moved nearly the mass of an adult blue whale.',
        targetCopy: 'Approach the scale of an adult blue whale.',
        description: 'NOAA says blue whales can weigh more than 330,000 lb; individuals vary widely.',
        perspectiveFact: 'It is the largest animal known to have lived on Earth.',
        funFact: {
          id: 'blue-whale-largest-animal',
          text: 'Blue whales are the largest animals known to have lived on Earth.',
          category: 'wildlife',
          source: {
            label: 'NOAA Fisheries, Blue Whale',
            url: 'https://www.fisheries.noaa.gov/species/blue-whale',
            reference: 'NOAA identifies the blue whale as the largest animal on the planet.',
          },
        },
        glyph: 'liner',
        photoId: 'blue-whale',
        source: {
          label: 'NOAA Fisheries, Blue Whale',
          url: 'https://www.fisheries.noaa.gov/species/blue-whale',
          reference: 'Adults can weigh more than 330,000 lb; 300,000 lb is a representative comparison value.',
        },
      },
      {
        id: 'c17-operating-empty',
        title: 'C-17 Globemaster III',
        approximateWeightLb: 282_500,
        weightConfiguration: 'Aircraft operating weight without payload.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is about 88% of the aircraft’s operating weight.',
        recommendedCopy: 'Nearly the operating weight of a C-17 Globemaster III.',
        achievedCopy: 'You have moved nearly the operating weight of a C-17 Globemaster III.',
        targetCopy: 'Approach the operating weight of a C-17 Globemaster III.',
        description: 'The U.S. Air Force lists the C-17 operating weight at 282,500 lb.',
        perspectiveFact: 'Its maximum payload is listed separately from the aircraft operating weight.',
        funFact: {
          id: 'c17-reverse-taxi',
          text: 'The C-17 can use thrust reversers to back up while taxiing on the ground.',
          category: 'operations',
          source: {
            label: 'U.S. Air Force, C-17 Globemaster III',
            url: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104523/c-17-globemaster-iii/',
            reference: 'The Air Force describes the C-17 using thrust reversers to back and turn on narrow taxiways.',
          },
        },
        glyph: 'airliner',
        photoId: 'c17-globemaster',
        source: {
          label: 'U.S. Air Force, C-17 Globemaster III',
          url: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104523/c-17-globemaster-iii/',
          reference: 'Operating weight: 282,500 lb.',
        },
      },
      {
        id: 'shuttle-solid-rocket-booster-empty',
        title: 'Space Shuttle solid rocket booster',
        approximateWeightLb: 192_000,
        weightConfiguration: 'One solid rocket booster before propellant loading.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 30% above one empty booster.',
        recommendedCopy: 'More than an empty Space Shuttle solid rocket booster.',
        achievedCopy: 'You have moved more than an empty Space Shuttle solid rocket booster.',
        targetCopy: 'Move beyond the empty scale of a Shuttle solid rocket booster.',
        description: 'NASA lists each empty Shuttle solid rocket booster at approximately 192,000 lb.',
        perspectiveFact: 'Loaded propellant raised each booster’s liftoff weight far beyond its empty mass.',
        funFact: {
          id: 'srb-recovered-by-ship',
          text: 'After launch, Shuttle boosters parachuted into the Atlantic for recovery by ship.',
          category: 'reuse',
          source: {
            label: 'NASA, Solid Rocket Booster history',
            url: 'https://www.nasa.gov/space-shuttle-recordation/srb/',
            reference: 'NASA documents booster splashdown, ship recovery, refurbishment, and reuse.',
          },
        },
        glyph: 'shuttle',
        photoId: 'shuttle-solid-rocket-booster',
        source: {
          label: 'NASA, Solid Rocket Booster history',
          url: 'https://www.nasa.gov/space-shuttle-recordation/srb/',
          reference: 'One empty booster weighed approximately 192,000 lb.',
        },
      },
    ],
  },
  {
    thresholdLb: 500_000,
    compactLabel: '500K',
    importance: 'major',
    primaryComparisonId: 'cbq-4963-heavy-mikado',
    comparisons: [
      {
        id: 'cbq-4963-heavy-mikado',
        title: 'Heavy Mikado locomotive',
        approximateWeightLb: 384_780,
        weightConfiguration: 'Preserved CB&Q 4963 locomotive weight, without a train consist.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 30% beyond the locomotive’s listed weight.',
        recommendedCopy: 'More than a heavy Mikado freight locomotive.',
        achievedCopy: 'You have moved more than a heavy Mikado freight locomotive.',
        targetCopy: 'Move beyond the scale of a heavy Mikado freight locomotive.',
        description: 'Illinois Railway Museum lists CB&Q 4963, a heavy 2-8-2 Mikado, at 384,780 lb.',
        perspectiveFact: 'This is the locomotive alone, not the freight cars it was built to pull.',
        funFact: {
          id: 'mikado-scrapyard-preservation',
          text: 'No. 4963 sat in a scrapyard for decades before joining the museum in 1990.',
          category: 'preservation',
          source: {
            label: 'Illinois Railway Museum, CB&Q 4963',
            url: 'https://www.irm.org/player/cbq4963/',
            reference: 'The museum says the locomotive sat in a scrap yard for decades after retirement and was acquired in 1990.',
          },
          alternate: {
            text: 'The “Mikado” name came from early 2-8-2 locomotives designed for Japanese railroads.',
            source: {
              label: 'Illinois Railway Museum, CB&Q 4963',
              url: 'https://www.irm.org/player/cbq4963/',
              reference: 'The museum traces the Mikado name to early examples designed for Japanese railroads.',
            },
          },
        },
        glyph: 'locomotive',
        photoId: 'heavy-mikado',
        source: {
          label: 'Illinois Railway Museum, CB&Q 4963',
          url: 'https://www.irm.org/player/cbq4963/',
          reference: 'CB&Q 4963 locomotive weight: 384,780 lb.',
        },
      },
      {
        id: 'statue-of-liberty-statue',
        title: 'Statue of Liberty',
        approximateWeightLb: 560_000,
        weightConfiguration: 'Copper and iron statue, excluding pedestal and foundation.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is about 89% of the National Park Service estimate.',
        recommendedCopy: 'Nearly the estimated weight of the Statue of Liberty itself.',
        achievedCopy: 'You have moved nearly the estimated weight of the Statue of Liberty itself.',
        targetCopy: 'Approach the weight of the Statue of Liberty itself.',
        description: 'The National Park Service estimates the statue at 560,000 lb, excluding its pedestal and foundation.',
        perspectiveFact: 'The pedestal is vastly heavier and is intentionally excluded.',
        funFact: {
          id: 'statue-copper-skin-thickness',
          text: 'The Statue of Liberty’s copper skin is only three thirty-seconds of an inch thick.',
          category: 'engineering',
          source: {
            label: 'National Park Service Statue of Liberty facts',
            url: 'https://home.nps.gov/stli/learn/statue-of-liberty-facts.htm',
            reference: 'The National Park Service lists the copper sheeting thickness as 3/32 inch.',
          },
        },
        glyph: 'station',
        photoId: 'statue-of-liberty',
        source: {
          label: 'National Park Service Statue of Liberty facts',
          url: 'https://home.nps.gov/stli/learn/statue-of-liberty-facts.htm',
          reference: 'Statue weight estimate: 560,000 lb; pedestal: 52 million lb.',
        },
      },
      {
        id: 'old-hickory-generator-rotor',
        title: 'Hydroelectric generator rotor',
        approximateWeightLb: 504_000,
        weightConfiguration: 'Single Old Hickory Dam generator rotor.',
        relation: 'approximately_equal',
        whyItMaps: 'The listed rotor weight is less than 1% above the milestone.',
        recommendedCopy: 'About the weight of a hydroelectric generator rotor.',
        achievedCopy: 'You have moved about the weight of a hydroelectric generator rotor.',
        targetCopy: 'Match the scale of a hydroelectric generator rotor.',
        description: 'The U.S. Army Corps of Engineers lists the Old Hickory rotor at 504,000 lb.',
        perspectiveFact: 'This is one rotating component inside the generating unit.',
        funFact: {
          id: 'old-hickory-single-rotor',
          text: 'This half-million-pound comparison is only the generator’s rotating component.',
          category: 'engineering',
          source: {
            label: 'U.S. Army Corps of Engineers, Old Hickory rotor',
            url: 'https://www.lrd.usace.army.mil/News/Multimedia/igphoto/2003826284/',
            reference: 'The Army Corps identifies the photographed generator rotor as weighing 504,000 pounds.',
          },
        },
        glyph: 'station',
        photoId: 'old-hickory-rotor',
        source: {
          label: 'U.S. Army Corps of Engineers, Old Hickory rotor',
          url: 'https://www.lrd.usace.army.mil/News/Multimedia/igphoto/2003826284/',
          reference: 'Generator rotor weight: 504,000 lb.',
        },
      },
      {
        id: 'airbus-a380-operating-empty',
        title: 'Airbus A380',
        approximateWeightLb: 610_700,
        weightConfiguration: 'Typical operating empty weight.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is about 82% of the reference operating empty weight.',
        recommendedCopy: 'Nearly the operating empty weight of an Airbus A380.',
        achievedCopy: 'You have moved nearly the operating empty weight of an Airbus A380.',
        targetCopy: 'Approach the empty scale of an Airbus A380.',
        description: 'Airbus lists a reference A380 operating empty weight of approximately 610,700 lb.',
        perspectiveFact: 'Cargo and usable fuel are excluded from operating empty weight.',
        funFact: {
          id: 'a380-full-length-double-deck',
          text: 'The A380 is the only passenger aircraft with two full-length decks.',
          category: 'aviation-first',
          source: {
            label: 'Airbus A380 product facts',
            url: 'https://www.airbus.com/en/products-services/commercial-aircraft/passenger-aircraft/a380',
            reference: 'Airbus describes the A380 as the only full-length double-deck passenger aircraft.',
          },
        },
        glyph: 'airliner',
        photoId: 'airbus-a380',
        source: {
          label: 'Airbus A380 Aircraft Characteristics',
          url: 'https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-12/ac_a380_1223.pdf',
          reference: 'Reference operating empty weight: approximately 610,700 lb.',
        },
      },
    ],
  },
  {
    thresholdLb: 1_000_000,
    compactLabel: '1M',
    importance: 'major',
    primaryComparisonId: 'international-space-station',
    comparisons: [
      {
        id: 'international-space-station',
        title: 'International Space Station',
        approximateWeightLb: 925_335,
        weightConfiguration: 'NASA published station mass; visiting vehicles and supplies change it over time.',
        relation: 'approximately_equal',
        whyItMaps: 'The milestone is about 8% above NASA’s published station mass.',
        recommendedCopy: 'Roughly the mass of the International Space Station.',
        achievedCopy: 'You have moved roughly the mass of the International Space Station.',
        targetCopy: 'Build toward the mass of the International Space Station.',
        description: 'NASA lists the station at 925,335 lb; its exact mass changes with vehicles and supplies.',
        perspectiveFact: 'The comparison is mass, even though the station is effectively weightless in orbit.',
        funFact: {
          id: 'iss-sixteen-sunrises',
          text: 'Its crew experiences 16 sunrises and 16 sunsets every day.',
          category: 'orbital-life',
          source: {
            label: 'NASA ISS Facts and Figures',
            url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
            reference: 'NASA says the station completes 16 Earth orbits and travels through 16 sunrises and sunsets in 24 hours.',
          },
          alternate: {
            text: 'The station travels the equivalent distance to the Moon and back in about a day.',
            source: {
              label: 'NASA ISS Facts and Figures',
              url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
              reference: 'NASA says the station travels a Moon-and-back-equivalent distance in about one day.',
            },
          },
        },
        glyph: 'station',
        photoId: 'international-space-station',
        source: {
          label: 'NASA ISS Facts and Figures',
          url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
          reference: 'Published ISS mass: 925,335 lb.',
        },
      },
      {
        id: 'lower-granite-generator-rotor',
        title: 'Lower Granite generator rotor',
        approximateWeightLb: 960_000,
        weightConfiguration: 'Single 480-ton hydroelectric generator rotor.',
        relation: 'approximately_equal',
        whyItMaps: 'The milestone is only about 4% above the rotor’s listed weight.',
        recommendedCopy: 'About the weight of a 480-ton hydroelectric generator rotor.',
        achievedCopy: 'You have moved about the weight of a 480-ton hydroelectric generator rotor.',
        targetCopy: 'Match the scale of a giant hydroelectric generator rotor.',
        description: 'The U.S. Army Corps of Engineers identifies the Lower Granite rotor as a 480-ton component.',
        perspectiveFact: 'The rotor is only one part of a complete generating unit.',
        funFact: {
          id: 'lower-granite-single-rotor',
          text: 'A single Lower Granite generator rotor weighs about 480 short tons.',
          category: 'engineering',
          source: {
            label: 'U.S. Army Corps of Engineers, Lower Granite rotor',
            url: 'https://www.nwd.usace.army.mil/media/images/igphoto/2002601116/',
            reference: 'The Army Corps identifies the generator rotor as a 480-ton component.',
          },
        },
        glyph: 'station',
        photoId: 'lower-granite-rotor',
        source: {
          label: 'U.S. Army Corps of Engineers, Lower Granite rotor',
          url: 'https://www.nwd.usace.army.mil/media/images/igphoto/2002601116/',
          reference: 'Rotor weight: 480 short tons, or 960,000 lb.',
        },
      },
      {
        id: 'boeing-747-8f-maximum-taxi',
        title: 'Fully loaded Boeing 747-8 Freighter',
        approximateWeightLb: 990_000,
        weightConfiguration: 'Maximum taxi weight.',
        relation: 'approximately_equal',
        whyItMaps: 'The published maximum taxi weight is within 1% of the milestone.',
        recommendedCopy: 'About the maximum taxi weight of a Boeing 747-8 Freighter.',
        achievedCopy: 'You have moved about the maximum taxi weight of a Boeing 747-8 Freighter.',
        targetCopy: 'Match the maximum ground-weight scale of a Boeing 747-8 Freighter.',
        description: 'Boeing lists a 990,000 lb maximum taxi weight for the 747-8F reference configuration.',
        perspectiveFact: 'Maximum taxi weight includes the aircraft, payload, and fuel before takeoff burn.',
        funFact: {
          id: '747-taxi-weight-includes-fuel',
          text: 'Maximum taxi weight includes payload and fuel before the aircraft begins takeoff.',
          category: 'operations',
          source: {
            label: 'Boeing 747-8 Airplane Characteristics',
            url: 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/748_REV_C.pdf?pubDate=20251230',
            reference: 'Boeing distinguishes maximum taxi weight from takeoff and operating empty weights.',
          },
        },
        glyph: 'airliner',
        photoId: 'boeing-747-8f',
        source: {
          label: 'Boeing 747-8 Airplane Characteristics',
          url: 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/748_REV_C.pdf?pubDate=20251230',
          reference: '747-8F maximum taxi weight: 990,000 lb.',
        },
      },
      {
        id: 'saturn-v-sii-stage-fueled',
        title: 'Fueled Saturn V second stage',
        approximateWeightLb: 1_060_000,
        weightConfiguration: 'Saturn V S-II second stage loaded with liquid hydrogen and liquid oxygen.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is within about 6% of the fueled stage weight.',
        recommendedCopy: 'About the fueled weight of a Saturn V second stage.',
        achievedCopy: 'You have moved about the fueled weight of a Saturn V second stage.',
        targetCopy: 'Match the fueled scale of a Saturn V second stage.',
        description: 'NASA lists the loaded S-II stage at approximately 1.06 million lb.',
        perspectiveFact: 'Most of that stage weight was liquid hydrogen and liquid oxygen propellant.',
        funFact: {
          id: 'sii-five-engines',
          text: 'Five J-2 engines powered the Saturn V’s liquid-hydrogen second stage.',
          category: 'engineering',
          source: {
            label: 'NASA Saturn V Flight Manual',
            url: 'https://history.nasa.gov/afj/ap12fj/pdf/a12_sa507-flightmanual.pdf',
            reference: 'The Saturn V flight manual describes the S-II stage and its five J-2 engines.',
          },
        },
        glyph: 'shuttle',
        photoId: 'saturn-v-sii',
        source: {
          label: 'NASA Saturn V Flight Manual',
          url: 'https://history.nasa.gov/afj/ap12fj/pdf/a12_sa507-flightmanual.pdf',
          reference: 'Loaded S-II stage weight: approximately 1.06 million lb.',
        },
      },
    ],
  },
  {
    thresholdLb: 2_000_000,
    compactLabel: '2M',
    importance: 'elite',
    primaryComparisonId: 'christ-the-redeemer-monument',
    comparisons: [
      {
        id: 'christ-the-redeemer-monument',
        title: 'Christ the Redeemer monument',
        approximateWeightLb: 2_524_000,
        weightConfiguration: 'Rio city’s 1,145-metric-ton whole-monument figure; narrower statue-only estimates are lower.',
        relation: 'slightly_above',
        whyItMaps: 'Two million pounds sits between the roughly 1.4-million-lb statue-only and 2.52-million-lb whole-monument figures.',
        recommendedCopy: 'In the weight range of the Christ the Redeemer monument.',
        achievedCopy: 'You have moved weight in the range of the Christ the Redeemer monument.',
        targetCopy: 'Enter the weight range of the Christ the Redeemer monument.',
        description: 'Published figures differ by scope: about 635 metric tonnes for the statue and 1,145 metric tonnes for the whole monument.',
        perspectiveFact: 'The apparent discrepancy comes from whether the figure covers the statue alone or the broader monument.',
        funFact: {
          id: 'redeemer-three-hundred-projectors',
          text: 'A documented lighting upgrade used 300 LED projectors on the monument.',
          category: 'engineering',
          source: {
            label: 'City of Rio de Janeiro, Christ the Redeemer lighting',
            url: 'https://www.rio.rj.gov.br/web/guest/exibeconteudo?id=4758140',
            reference: 'The city describes a remotely managed lighting system using 300 LED projectors.',
          },
          alternate: {
            text: 'The 38-meter monument stands atop the 710-meter Corcovado mountain.',
            source: {
              label: 'City of Rio de Janeiro, Christ the Redeemer lighting',
              url: 'https://www.rio.rj.gov.br/web/guest/exibeconteudo?id=4758140',
              reference: 'The city lists the monument at 38 meters and Corcovado at 710 meters.',
            },
          },
        },
        glyph: 'station',
        photoId: 'christ-the-redeemer',
        source: {
          label: 'City of Rio de Janeiro, Christ the Redeemer',
          url: 'https://www.rio.rj.gov.br/web/guest/exibeconteudo?id=4758140',
          reference: 'Whole monument: 1,145 metric tonnes, approximately 2.52 million lb.',
        },
        additionalSources: [{
          label: 'Google Arts & Culture, Christ the Redeemer',
          url: 'https://artsandculture.google.com/story/5-spectacular-views-of-christ-the-redeemer/1wWx7Kj3uDgz7w?hl=en',
          reference: 'Statue-only estimate: 635 metric tonnes, approximately 1.40 million lb.',
        }],
      },
      {
        id: 'belaz-75710-fully-loaded',
        title: 'Fully loaded BelAZ 75710',
        approximateWeightLb: 1_785_744,
        weightConfiguration: 'Maximum vehicle weight with its rated payload.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 12% above the truck’s maximum vehicle weight.',
        recommendedCopy: 'More than a fully loaded BelAZ 75710 haul truck.',
        achievedCopy: 'You have moved more than a fully loaded BelAZ 75710 haul truck.',
        targetCopy: 'Move beyond the loaded scale of a BelAZ 75710 haul truck.',
        description: 'BelAZ lists a 360,000 kg empty weight and 450,000 kg payload, totaling 810,000 kg.',
        perspectiveFact: 'This is one haul truck with its full rated payload.',
        funFact: {
          id: 'belaz-four-wheel-drive',
          text: 'The BelAZ 75710 drives all four of its enormous wheels.',
          category: 'scale',
          source: {
            label: 'BelAZ 75710 specifications',
            url: 'https://belaz.by/en/products/products-belaz/dumpers/dump-trucks-with-electromechanical-transmission/dumpers-series-7571/',
            reference: 'The manufacturer lists the 75710 with four-wheel electromechanical drive.',
          },
        },
        glyph: 'liner',
        photoId: 'belaz-75710',
        source: {
          label: 'BelAZ 75710 specifications',
          url: 'https://belaz.by/en/products/products-belaz/dumpers/dump-trucks-with-electromechanical-transmission/dumpers-series-7571/',
          reference: 'Empty weight plus payload: 810,000 kg, approximately 1,785,744 lb.',
        },
      },
      {
        id: 'john-day-generator',
        title: 'John Day hydro generator',
        approximateWeightLb: 2_328_000,
        weightConfiguration: 'Complete 1,164-ton generating unit cited by the U.S. Army Corps of Engineers.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is about 86% of the cited generator weight.',
        recommendedCopy: 'Nearly the weight of a John Day hydroelectric generator.',
        achievedCopy: 'You have moved nearly the weight of a John Day hydroelectric generator.',
        targetCopy: 'Approach the scale of a John Day hydroelectric generator.',
        description: 'A U.S. Army Corps engineering manual cites a John Day generator weight of 1,164 tons.',
        perspectiveFact: 'This is a single power-generation machine inside a much larger dam complex.',
        funFact: {
          id: 'john-day-one-generator',
          text: 'The 1,164-ton figure covers one generator inside the much larger dam complex.',
          category: 'engineering',
          source: {
            label: 'U.S. Army Corps Engineer Manual 1110-2-3001',
            url: 'https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-3001.pdf',
            reference: 'The Army Corps manual cites a 1,164-ton generator at John Day.',
          },
        },
        glyph: 'station',
        photoId: 'john-day-generator',
        source: {
          label: 'U.S. Army Corps Engineer Manual 1110-2-3001',
          url: 'https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-3001.pdf',
          reference: 'John Day generator weight: 1,164 short tons, or 2,328,000 lb.',
        },
      },
      {
        id: 'space-shuttle-external-tank-full',
        title: 'Fueled Shuttle external tank',
        approximateWeightLb: 1_667_677,
        weightConfiguration: 'Space Shuttle external tank at liftoff, filled with propellants.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 20% above NASA’s cited gross liftoff weight.',
        recommendedCopy: 'More than a fully fueled Space Shuttle external tank.',
        achievedCopy: 'You have moved more than a fully fueled Space Shuttle external tank.',
        targetCopy: 'Move beyond the liftoff scale of a fueled Shuttle external tank.',
        description: 'NASA lists the external tank at 1,667,677 lb gross weight at liftoff.',
        perspectiveFact: 'Nearly all of that mass was liquid hydrogen and liquid oxygen propellant.',
        funFact: {
          id: 'external-tank-not-reused',
          text: 'The external tank was the only major Shuttle component that was not reused.',
          category: 'reuse',
          source: {
            label: 'NASA Space Shuttle reference',
            url: 'https://www.nasa.gov/reference/the-space-shuttle/',
            reference: 'NASA describes the external tank as the only major Shuttle component not reused.',
          },
        },
        glyph: 'shuttle',
        photoId: 'shuttle-external-tank',
        source: {
          label: 'NASA Space Shuttle reference',
          url: 'https://www.nasa.gov/reference/the-space-shuttle/',
          reference: 'External tank gross liftoff weight: 1,667,677 lb.',
        },
      },
    ],
  },
  {
    thresholdLb: 5_000_000,
    compactLabel: '5M',
    importance: 'elite',
    primaryComparisonId: 'space-shuttle-launch-stack',
    comparisons: [
      {
        id: 'space-shuttle-launch-stack',
        title: 'Space Shuttle launch stack',
        approximateWeightLb: 4_500_000,
        weightConfiguration: 'Complete fueled orbiter, external tank, and solid rocket boosters at liftoff.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 11% beyond NASA’s cited liftoff mass.',
        recommendedCopy: 'More than a complete Space Shuttle at liftoff.',
        achievedCopy: 'You have moved more than a complete Space Shuttle at liftoff.',
        targetCopy: 'Move beyond the liftoff mass of a complete Space Shuttle.',
        description: 'NASA describes the fully assembled Space Shuttle system as about 4.5 million lb at liftoff.',
        perspectiveFact: 'This includes the fueled tank and both solid rocket boosters—not only the orbiter.',
        funFact: {
          id: 'shuttle-booster-recovery-reuse',
          text: 'Its solid rocket boosters parachuted into the Atlantic for recovery and reuse.',
          category: 'reuse',
          source: {
            label: 'NASA, The Space Shuttle',
            url: 'https://www.nasa.gov/reference/the-space-shuttle/',
            reference: 'NASA says the boosters parachuted into the Atlantic, were recovered by ship, refurbished, and reused.',
          },
          alternate: {
            text: 'The two boosters produced 5.3 million pounds of thrust together.',
            source: {
              label: 'NASA, Solid Rocket Booster history',
              url: 'https://www.nasa.gov/space-shuttle-recordation/srb/',
              reference: 'NASA lists combined booster thrust as 5,300,000 pounds.',
            },
          },
        },
        glyph: 'shuttle',
        photoId: 'space-shuttle-stack',
        source: {
          label: 'NASA Space Shuttle reference',
          url: 'https://www.nasa.gov/reference/the-space-shuttle/',
          reference: 'Complete Space Shuttle liftoff weight: approximately 4.5 million lb.',
        },
      },
      {
        id: 'hoover-dam-generator',
        title: 'Hoover Dam generator',
        approximateWeightLb: 4_000_000,
        weightConfiguration: 'Single complete hydroelectric generator.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is 25% above the Bureau of Reclamation’s cited generator weight.',
        recommendedCopy: 'More than a complete Hoover Dam generator.',
        achievedCopy: 'You have moved more than a complete Hoover Dam generator.',
        targetCopy: 'Move beyond the scale of a Hoover Dam generator.',
        description: 'The Bureau of Reclamation says each generator at Hoover Dam weighs 4 million lb.',
        perspectiveFact: 'The generator is one machine within the dam’s larger powerplant.',
        funFact: {
          id: 'hoover-seventeen-generators',
          text: 'Hoover Dam’s powerplant contains 17 main generating units.',
          category: 'engineering',
          source: {
            label: 'U.S. Bureau of Reclamation Hoover Dam facts',
            url: 'https://www.usbr.gov/lc/hooverdam/faqs/powerfaq.html',
            reference: 'The Bureau of Reclamation lists 17 main generators in the Hoover powerplant.',
          },
        },
        glyph: 'station',
        photoId: 'hoover-dam-generator',
        source: {
          label: 'U.S. Bureau of Reclamation Hoover Dam facts',
          url: 'https://www.usbr.gov/lc/hooverdam/educate/kidfacts.html',
          reference: 'Weight of each generator: 4 million lb.',
        },
      },
      {
        id: 'balao-class-submarine-submerged',
        title: 'Balao-class submarine',
        approximateWeightLb: 4_830_000,
        weightConfiguration: 'Representative World War II Balao-class submarine submerged displacement.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is within about 4% of the representative submerged displacement.',
        recommendedCopy: 'About the submerged displacement of a Balao-class submarine.',
        achievedCopy: 'You have moved about the submerged displacement of a Balao-class submarine.',
        targetCopy: 'Match the submerged scale of a Balao-class submarine.',
        description: 'National Park Service material lists USS Bowfin at 2,415 short tons submerged, about 4.83 million lb.',
        perspectiveFact: 'Submerged displacement is the mass of water displaced while the vessel is underwater.',
        funFact: {
          id: 'bowfin-museum-submarine',
          text: 'USS Bowfin is preserved beside the Pearl Harbor National Memorial.',
          category: 'preservation',
          source: {
            label: 'National Park Service, USS Bowfin',
            url: 'https://www.nps.gov/places/uss-bowfin-submarine-museum-and-park.htm',
            reference: 'The National Park Service identifies USS Bowfin as a preserved Balao-class submarine at Pearl Harbor.',
          },
        },
        glyph: 'liner',
        photoId: 'balao-submarine',
        source: {
          label: 'National Park Service, USS Bowfin',
          url: 'https://www.nps.gov/places/uss-bowfin-submarine-museum-and-park.htm',
          reference: 'Representative submerged displacement: 2,415 short tons, or 4,830,000 lb.',
        },
      },
      {
        id: 'saturn-v-sic-stage-fueled',
        title: 'Fueled Saturn V first stage',
        approximateWeightLb: 5_030_000,
        weightConfiguration: 'Saturn V S-IC first stage loaded with kerosene and liquid oxygen.',
        relation: 'approximately_equal',
        whyItMaps: 'The milestone is within about 1% of the loaded first-stage weight.',
        recommendedCopy: 'About the fueled weight of a Saturn V first stage.',
        achievedCopy: 'You have moved about the fueled weight of a Saturn V first stage.',
        targetCopy: 'Match the fueled scale of a Saturn V first stage.',
        description: 'NASA’s Saturn V flight manual lists the loaded S-IC stage at approximately 5.03 million lb.',
        perspectiveFact: 'Five F-1 engines powered this first stage during launch.',
        funFact: {
          id: 'sic-five-f1-engines',
          text: 'Five F-1 engines powered the Saturn V’s first stage at liftoff.',
          category: 'engineering',
          source: {
            label: 'NASA Saturn V Flight Manual',
            url: 'https://history.nasa.gov/afj/ap12fj/pdf/a12_sa507-flightmanual.pdf',
            reference: 'The Saturn V flight manual describes the S-IC first stage and its five F-1 engines.',
          },
        },
        glyph: 'shuttle',
        photoId: 'saturn-v-sic',
        source: {
          label: 'NASA Saturn V Flight Manual',
          url: 'https://history.nasa.gov/afj/ap12fj/pdf/a12_sa507-flightmanual.pdf',
          reference: 'Loaded S-IC stage weight: approximately 5.03 million lb.',
        },
      },
    ],
  },
  {
    thresholdLb: 10_000_000,
    compactLabel: '10M',
    importance: 'elite',
    primaryComparisonId: 'national-security-cutter-full-load',
    comparisons: [
      {
        id: 'national-security-cutter-full-load',
        title: 'National Security Cutter',
        approximateWeightLb: 10_080_000,
        weightConfiguration: 'Full-load displacement of 4,500 long tons.',
        relation: 'approximately_equal',
        whyItMaps: 'The full-load displacement is within 1% of the milestone.',
        recommendedCopy: 'About the full-load displacement of a National Security Cutter.',
        achievedCopy: 'You have moved about the full-load displacement of a National Security Cutter.',
        targetCopy: 'Match the full-load displacement of a National Security Cutter.',
        description: 'The U.S. Coast Guard lists the cutter at 4,500 long tons full-load displacement, about 10.08 million lb.',
        perspectiveFact: 'Displacement is the vessel’s actual mass, unlike gross tonnage, which measures enclosed volume.',
        funFact: {
          id: 'nsc-long-endurance-cycle',
          text: 'Its 148-person crew can operate on 60- to 90-day patrol cycles.',
          category: 'endurance',
          source: {
            label: 'U.S. Coast Guard National Security Cutter profile',
            url: 'https://www.dcms.uscg.mil/Our-Organization/Assistant-Commandant-for-Acquisitions-CG-9/Programs/Surface-Programs/National-Security-Cutter-Copy/',
            reference: 'The Coast Guard lists a crew of 148 and endurance of 60- to 90-day cycles.',
          },
          alternate: {
            text: 'Its published range is 12,000 nautical miles.',
            source: {
              label: 'U.S. Coast Guard National Security Cutter profile',
              url: 'https://www.dcms.uscg.mil/Our-Organization/Assistant-Commandant-for-Acquisitions-CG-9/Programs/Surface-Programs/National-Security-Cutter-Copy/',
              reference: 'The Coast Guard lists a range of 12,000 nautical miles.',
            },
          },
        },
        glyph: 'liner',
        photoId: 'national-security-cutter',
        source: {
          label: 'U.S. Coast Guard National Security Cutter program',
          url: 'https://www.dcms.uscg.mil/Our-Organization/Assistant-Commandant-for-Acquisitions-CG-9/Programs/Surface-Programs/National-Security-Cutter-Copy/',
          reference: 'Full-load displacement: 4,500 long tons, equivalent to 10,080,000 lb.',
        },
      },
      {
        id: 'uss-nautilus-submerged',
        title: 'USS Nautilus submerged',
        approximateWeightLb: 8_184_000,
        weightConfiguration: 'Published submerged displacement of 4,092 tons, conservatively converted at 2,000 lb per ton.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is at least 22% above the conservative conversion; a long-ton interpretation would be about 9.17 million lb.',
        recommendedCopy: 'More than the submerged displacement of USS Nautilus.',
        achievedCopy: 'You have moved more than the submerged displacement of USS Nautilus.',
        targetCopy: 'Move beyond the submerged displacement of USS Nautilus.',
        description: 'A U.S. Navy reference lists USS Nautilus at 4,092 tons submerged displacement.',
        perspectiveFact: 'The source does not label the ton convention, so the catalog uses the lower short-ton conversion.',
        funFact: {
          id: 'nautilus-north-pole',
          text: 'USS Nautilus became the first vessel to cross beneath the North Pole.',
          category: 'aviation-first',
          source: {
            label: 'U.S. Navy, USS Nautilus history',
            url: 'https://www.history.navy.mil/browse-by-topic/ships/submarines/uss-nautilus.html',
            reference: 'Naval History and Heritage Command records the first submerged transit beneath the North Pole.',
          },
        },
        glyph: 'liner',
        photoId: 'uss-nautilus',
        source: {
          label: 'U.S. Navy Naval Nuclear Propulsion Program reference',
          url: 'https://www.navsea.navy.mil/Portals/103/Documents/PSNSY_IMF/News%20Releases/2013%20Naval%20Nuclear%20Propulsion%20Program.pdf',
          reference: 'Submerged displacement: 4,092 tons; conservative short-ton conversion: 8,184,000 lb.',
        },
      },
      {
        id: 'space-shuttle-crawler-transport',
        title: 'Shuttle transport assembly',
        approximateWeightLb: 12_000_000,
        weightConfiguration: 'Space Shuttle, mobile launch platform, and crawler-transporter during rollout.',
        relation: 'slightly_above',
        whyItMaps: 'The milestone is about 83% of the complete rollout assembly.',
        recommendedCopy: 'Nearly the mass of the complete Shuttle rollout assembly.',
        achievedCopy: 'You have moved nearly the mass of the complete Shuttle rollout assembly.',
        targetCopy: 'Approach the mass of a complete Shuttle rollout assembly.',
        description: 'NASA technical material cites approximately 12 million lb for the crawler, platform, and Space Shuttle stack together.',
        perspectiveFact: 'This includes both the launch vehicle and the ground hardware carrying it to the pad.',
        funFact: {
          id: 'shuttle-rollout-complete-assembly',
          text: 'The rollout assembly combined the Shuttle, launch platform, and crawler-transporter.',
          category: 'operations',
          source: {
            label: 'NASA Technical Reports Server, Shuttle transport system',
            url: 'https://ntrs.nasa.gov/citations/20130010400',
            reference: 'NASA describes the combined crawler, mobile launch platform, and Shuttle stack during rollout.',
          },
        },
        glyph: 'shuttle',
        photoId: 'shuttle-transport-assembly',
        source: {
          label: 'NASA Technical Reports Server, Shuttle transport system',
          url: 'https://ntrs.nasa.gov/citations/20130010400',
          reference: 'Combined crawler, mobile launch platform, and Shuttle stack: approximately 12 million lb.',
        },
      },
      {
        id: 'nasa-crawler-transporter',
        title: 'NASA crawler-transporter',
        approximateWeightLb: 6_600_000,
        weightConfiguration: 'Unloaded crawler-transporter vehicle.',
        relation: 'slightly_below',
        whyItMaps: 'The milestone is about 52% beyond the crawler’s listed mass.',
        recommendedCopy: 'More than the mass of NASA’s crawler-transporter.',
        achievedCopy: 'You have moved more than the mass of NASA’s crawler-transporter.',
        targetCopy: 'Move beyond the mass of NASA’s crawler-transporter.',
        description: 'NASA lists each crawler-transporter at approximately 6.6 million lb.',
        perspectiveFact: 'That figure is before adding the mobile launcher and launch vehicle payload.',
        funFact: {
          id: 'crawler-speed-loaded',
          text: 'Loaded with launch hardware, the crawler travels at about one mile per hour.',
          category: 'operations',
          source: {
            label: 'NASA Exploration Ground Systems, the Crawlers',
            url: 'https://www.nasa.gov/humans-in-space/exploration-ground-systems/the-crawlers/',
            reference: 'NASA lists crawler speed at one mile per hour when loaded.',
          },
        },
        glyph: 'liner',
        photoId: 'nasa-crawler-transporter',
        source: {
          label: 'NASA Exploration Ground Systems, the Crawlers',
          url: 'https://www.nasa.gov/humans-in-space/exploration-ground-systems/the-crawlers/',
          reference: 'Crawler-transporter weight: approximately 6.6 million lb.',
        },
      },
    ],
  },
] as const;

export const VOLUME_ACHIEVEMENT_THRESHOLDS_LB = VOLUME_ACHIEVEMENT_MILESTONES.map(({ thresholdLb }) => thresholdLb);

if (!VOLUME_ACHIEVEMENT_THRESHOLDS_LB.every((threshold, index, values) => index === 0 || threshold > values[index - 1])) {
  throw new Error('Volume achievement thresholds must be strictly ascending.');
}

export function primaryVolumeComparison(milestone: VolumeAchievementMilestone): VolumeComparisonCandidate {
  const comparison = milestone.comparisons.find(({ id }) => id === milestone.primaryComparisonId);
  if (!comparison) throw new Error(`Missing primary volume comparison: ${milestone.primaryComparisonId}`);
  return comparison;
}

/**
 * Assigns one stable comparison slot to each product context. This is
 * deliberately deterministic: revisiting the same lift shows the same object,
 * while Total, Squat, Bench, and Deadlift never reuse one another's object at
 * the same threshold.
 */
export function volumeComparisonForContext(
  milestone: VolumeAchievementMilestone,
  contextId: VolumeAchievementContextId,
): VolumeComparisonCandidate {
  const comparison = milestone.comparisons[VOLUME_COMPARISON_INDEX_BY_CONTEXT[contextId]];
  if (!comparison) {
    throw new Error(`${milestone.compactLabel} must define four volume comparisons; missing ${contextId}.`);
  }
  return comparison;
}

export function volumeComparisonById(
  milestone: VolumeAchievementMilestone,
  comparisonId: string,
): VolumeComparisonCandidate {
  const comparison = milestone.comparisons.find(({ id }) => id === comparisonId);
  if (!comparison) throw new Error(`Missing volume comparison: ${comparisonId}`);
  return comparison;
}

export function safeVolumeLb(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

export function deriveVolumeAchievement(valueLb: number | null | undefined): VolumeAchievementProgress {
  const currentLb = safeVolumeLb(valueLb);
  const achieved = [...VOLUME_ACHIEVEMENT_MILESTONES].reverse().find(({ thresholdLb }) => thresholdLb <= currentLb) ?? null;
  const next = VOLUME_ACHIEVEMENT_MILESTONES.find(({ thresholdLb }) => thresholdLb > currentLb) ?? null;
  const priorThresholdLb = achieved?.thresholdLb ?? 0;
  const segmentProgress = next
    ? Math.max(0, Math.min(1, (currentLb - priorThresholdLb) / (next.thresholdLb - priorThresholdLb)))
    : 1;

  return {
    currentLb,
    achieved,
    next,
    remainingLb: next ? Math.max(0, next.thresholdLb - currentLb) : 0,
    segmentProgress,
    milestones: VOLUME_ACHIEVEMENT_MILESTONES.map((milestone) => ({
      ...milestone,
      state: milestone.thresholdLb <= currentLb ? 'achieved' : milestone.thresholdLb === next?.thresholdLb ? 'current' : 'locked',
    })),
  };
}

/**
 * The single reveal boundary for comparison content. Components consume this
 * presentation state instead of deciding independently which metadata is safe
 * to expose. A comparison only enters the visible model after its threshold is
 * reached.
 */
export function deriveVolumeComparisonPresentation(
  milestone: VolumeAchievementMilestone,
  contextId: VolumeAchievementContextId,
  valueLb: number | null | undefined,
): VolumeComparisonPresentation {
  const progress = deriveVolumeAchievement(valueLb);
  const derivedMilestone = progress.milestones.find(({ thresholdLb }) => thresholdLb === milestone.thresholdLb);
  if (!derivedMilestone) throw new Error(`Unknown volume achievement threshold: ${milestone.thresholdLb}`);

  const isUnlocked = derivedMilestone.state === 'achieved';
  const comparison = isUnlocked ? volumeComparisonForContext(milestone, contextId) : null;
  return {
    state: derivedMilestone.state,
    isUnlocked,
    isLatestAchieved: isUnlocked && progress.achieved?.thresholdLb === milestone.thresholdLb,
    isCurrentTarget: derivedMilestone.state === 'current',
    isFutureLocked: derivedMilestone.state === 'locked',
    visibleTitle: comparison?.title ?? null,
    visibleImage: comparison?.photoId ?? null,
    visibleFunFact: comparison?.funFact ?? null,
    visibleDetailAccess: isUnlocked,
    comparison,
  };
}

export function volumeSharePercent(valueLb: number | null | undefined, totalLb: number | null | undefined): number {
  const safeTotal = safeVolumeLb(totalLb);
  if (safeTotal === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((safeVolumeLb(valueLb) / safeTotal) * 100)));
}

export function poundsToDisplayValue(valueLb: number, unit: VolumeDisplayUnit): number {
  return unit === 'lb' ? Math.round(valueLb) : Math.round(valueLb * KG_PER_LB);
}

export function formatVolumeValue(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatVolumeLb(valueLb: number, unit: VolumeDisplayUnit): string {
  return `${formatVolumeValue(poundsToDisplayValue(valueLb, unit))} ${unit.toUpperCase()}`;
}

export function formatCompactVolumeLb(valueLb: number, unit: VolumeDisplayUnit): string {
  const value = poundsToDisplayValue(valueLb, unit);
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return formatVolumeValue(value);
}

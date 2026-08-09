import { plateStackCatalogKeyForWeight } from './barbell/plate-stack-render-geometry';

export const MILESTONE_VISIBLE_CELL_COUNT = 4;
export const MILESTONE_CELL_GAP = 4;
export const MILESTONE_RAIL_INSET = 4;
export const OTHER_MILESTONE_VISIBLE_COUNT = 5;

export type PlateClubUnit = 'lb' | 'kg';

export const GYM_WEIGHT_INCREMENT = {
  lb: 5,
  kg: 2.5,
} as const;

const KG_PER_LB = 0.45359237;

/**
 * Selects the existing plate-model composition for a load on a 20 kg bar.
 * The returned number is a renderer lookup key, not a unit conversion.
 */
export function kgTotalToPlateModelTotalLb(totalWeightKg: number) {
  return plateStackCatalogKeyForWeight(totalWeightKg, 'kg');
}

export function roundToGymWeight(value: number, unit: PlateClubUnit) {
  if (!Number.isFinite(value)) throw new Error(`Unsupported ${unit} weight: ${value}`);
  const increment = GYM_WEIGHT_INCREMENT[unit];
  return Math.round(value / increment) * increment;
}

/** Whether a displayed total can be represented by the approved bar-and-plate renderer. */
export function canRenderGymTotal(totalWeight: number, unit: PlateClubUnit) {
  if (!Number.isFinite(totalWeight)) return false;
  const rounded = roundToGymWeight(totalWeight, unit);
  return unit === 'kg' ? rounded >= 20 : rounded >= 45;
}

/** Derives either display unit from one canonical PR stored in pounds. */
export function displayWeightFromCanonicalLb(weightLb: number, unit: PlateClubUnit) {
  const converted = unit === 'lb' ? weightLb : weightLb * KG_PER_LB;
  return roundToGymWeight(converted, unit);
}

/**
 * Produces a total understood by the existing plate renderer while preserving
 * the physical plate composition of the active unit system.
 */
export function gymTotalToPlateModelTotalLb(totalWeight: number, unit: PlateClubUnit) {
  const rounded = roundToGymWeight(totalWeight, unit);
  if (unit === 'kg') return kgTotalToPlateModelTotalLb(rounded);
  return plateStackCatalogKeyForWeight(rounded, 'lb');
}

function formatClubCount(count: number) {
  if (Number.isInteger(count)) return String(count);
  return `${Math.floor(count)}½`;
}

/** Human-readable club naming for the native ladder in each display unit. */
export function plateClubLabel(totalWeight: number, unit: PlateClubUnit) {
  if (unit === 'kg') {
    if (totalWeight === 40) return 'Half Plate Club';
    if (totalWeight >= 60 && (totalWeight - 60) % 20 === 0) {
      return `${formatClubCount(1 + ((totalWeight - 60) / 40))} Plate Club`;
    }
    return 'Plate Club';
  }

  const lbLadder = [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585, 635, 675, 725, 765, 815, 855, 895];
  const index = lbLadder.indexOf(totalWeight);
  if (index === 0) return 'Half Plate Club';
  if (index > 0) return `${formatClubCount(1 + ((index - 1) / 2))} Plate Club`;
  return 'Plate Club';
}

export function milestoneCellWidth(viewportWidth: number) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0;
  const reservedSpace = (MILESTONE_RAIL_INSET * 2)
    + (MILESTONE_CELL_GAP * (MILESTONE_VISIBLE_CELL_COUNT - 1));
  return Math.max(0, Math.floor((viewportWidth - reservedSpace) / MILESTONE_VISIBLE_CELL_COUNT));
}

export function milestoneWindowStart(values: number[], current: number) {
  if (values.length <= MILESTONE_VISIBLE_CELL_COUNT) return 0;
  const nextIndex = values.findIndex((value) => value > current);
  const anchorIndex = nextIndex >= 0 ? nextIndex : values.length - 1;
  return Math.max(
    0,
    Math.min(anchorIndex - 2, values.length - MILESTONE_VISIBLE_CELL_COUNT),
  );
}

export function milestoneScrollOffset(startIndex: number, cellWidth: number) {
  if (startIndex <= 0 || cellWidth <= 0) return 0;
  return startIndex * (cellWidth + MILESTONE_CELL_GAP);
}

/**
 * Keeps the active target near the center while guaranteeing a fixed,
 * non-scrolling five-stop window for the compact Other Milestones cards.
 */
export function otherMilestoneWindow(values: number[], current: number) {
  if (values.length <= OTHER_MILESTONE_VISIBLE_COUNT) return values;
  const nextIndex = values.findIndex((value) => value > current);
  const anchorIndex = nextIndex >= 0 ? nextIndex : values.length - 1;
  const startIndex = Math.max(
    0,
    Math.min(
      anchorIndex - 2,
      values.length - OTHER_MILESTONE_VISIBLE_COUNT,
    ),
  );
  return values.slice(startIndex, startIndex + OTHER_MILESTONE_VISIBLE_COUNT);
}

/** Progress from the latest achieved threshold to the active target. */
export function progressBetweenMilestones(current: number, values: number[], target: number) {
  const targetIndex = values.indexOf(target);
  const prior = targetIndex > 0 ? values[targetIndex - 1] : 0;
  if (target <= prior) return 0;
  return Math.max(0, Math.min(1, (current - prior) / (target - prior)));
}

export function remainingToMilestone(current: number, target?: number) {
  if (target === undefined) return 0;
  return Number(Math.max(0, target - current).toFixed(2));
}

export function readablePlateClubLabel(label: string) {
  if (label === 'Plate Club') return label;
  const suffix = ' Plate Club';
  return label.endsWith(suffix)
    ? `${label.slice(0, -suffix.length)}\nPlate Club`
    : label;
}

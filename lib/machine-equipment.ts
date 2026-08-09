import { equipmentPresentationLabel } from './equipment-presentation';

export type MachineEquipmentType = 'plate_loaded' | 'selectorized';

export const MACHINE_EQUIPMENT_TYPES: readonly {
  key: MachineEquipmentType;
  label: string;
}[] = Object.freeze([
  { key: 'plate_loaded', label: equipmentPresentationLabel('plate_loaded_machine') },
  { key: 'selectorized', label: equipmentPresentationLabel('selectorized_machine') },
]);

export function machineEquipmentTypeForValue(
  value: string | null | undefined,
): MachineEquipmentType {
  return String(value || '').toLowerCase().includes('plate')
    ? 'plate_loaded'
    : 'selectorized';
}

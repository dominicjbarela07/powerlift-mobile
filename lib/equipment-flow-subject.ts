import { resolveLoggerMovementIdentity, type LoggerMovementIdentityItem } from './logger-movement-identity';
import { MACHINE_EQUIPMENT_TYPES, type MachineEquipmentType } from './machine-equipment';

export type EquipmentFlowSubject = Readonly<{
  itemId: number;
  movementDefinitionId: number;
  movementKey: string;
  displayName: string;
  domain: 'machine' | 'cable';
  allowedTypes: readonly MachineEquipmentType[];
}>;
type Item = LoggerMovementIdentityItem & { effective_movement_definition_id?: number | null };
const stale = () => new Error('This movement changed. Close Equipment and reopen it from the movement you want to configure.');

/** Equipment owns the pressed item's existing exact subject. Discovery labels,
 * programmed text and physical equipment IDs cannot reconstruct that subject. */
export function equipmentFlowSubject(item: Item): EquipmentFlowSubject {
  const resolved = resolveLoggerMovementIdentity(item);
  const identity = resolved.effective;
  if (resolved.kind !== 'accessory' || !identity || !Number.isInteger(identity.id)
      || identity.id <= 0 || !identity.key || identity.key.startsWith('machine_equipment_')
      || !identity.display_name || !Number.isInteger(item.id) || item.id <= 0) {
    throw new Error('This movement needs a confirmed identity before equipment can be selected. Refresh the Session.');
  }
  for (const id of [item.effective_movement_definition_id, item.performed_canonical_movement_identity?.id]) {
    if (id != null && Number(id) !== identity.id) throw stale();
  }
  if (!item.performed_canonical_movement_identity && (item.is_substituted
      || (item.performed_movement_identity?.id === identity.id && item.movement_identity?.id !== identity.id))) throw stale();
  const taxonomy = identity.material_parameters?.accessory_taxonomy;
  const family = String(identity.execution_family || taxonomy?.execution_family || '').toUpperCase();
  const equipment = String(identity.equipment_type || '').toLowerCase();
  if ((family === 'MACHINE' && equipment === 'cable')
      || (family && !['MACHINE', 'CABLE', 'ASSISTED'].includes(family))) throw stale();
  const domain = family === 'CABLE' || equipment === 'cable' ? 'cable'
    : family === 'MACHINE' || ['machine', 'selectorized_machine', 'plate_loaded_machine', 'selectorized', 'plate_loaded', 'smith_machine'].includes(equipment) ? 'machine' : null;
  if (!domain || identity.requires_equipment_configuration === false || taxonomy?.requires_equipment_configuration === false) {
    throw new Error('This movement does not support machine or cable equipment setup. Use Swap to choose a different movement.');
  }
  return Object.freeze({ itemId: item.id, movementDefinitionId: identity.id, movementKey: identity.key,
    displayName: identity.display_name, domain,
    allowedTypes: Object.freeze(equipment === 'plate_loaded_machine' ? ['plate_loaded'] as const
      : equipment === 'selectorized_machine' ? ['selectorized'] as const
      : ['plate_loaded', 'selectorized'] as const) });
}

export function assertEquipmentFlowSubject(subject: EquipmentFlowSubject, item: Item | null | undefined) {
  if (!item) throw stale();
  const current = equipmentFlowSubject(item);
  if (current.itemId !== subject.itemId || current.movementDefinitionId !== subject.movementDefinitionId
      || current.movementKey !== subject.movementKey || current.domain !== subject.domain
      || current.allowedTypes.join() !== subject.allowedTypes.join()) throw stale();
  return current;
}

export function assertEquipmentResponseSubject(subject: EquipmentFlowSubject, response: { usage_movement_definition_id?: number | null }) {
  if (Number(response.usage_movement_definition_id) !== subject.movementDefinitionId) throw stale();
}

export function equipmentFlowVariants(subject: EquipmentFlowSubject) {
  return MACHINE_EQUIPMENT_TYPES.filter(row => subject.allowedTypes.includes(row.key)).map(row => ({
    ...row, label: subject.domain === 'cable' ? `${row.label} Cable Station` : row.label,
  }));
}

export function equipmentFlowWrite(subject: EquipmentFlowSubject, manufacturerKey: string, equipmentType: MachineEquipmentType) {
  if (!manufacturerKey || !subject.allowedTypes.includes(equipmentType)) throw new Error('Choose equipment compatible with this exact movement.');
  // Existing API contract configures physical equipment only. Never send a
  // movement_definition_id here: that legacy field accepts a different subject.
  return { manufacturer_key: manufacturerKey, equipment_type: equipmentType };
}

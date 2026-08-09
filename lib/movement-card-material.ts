import { SLMovementCardMaterial } from '@/constants/movement-card-material';

export type MovementCardMaterialState =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'skipped'
  | 'failed';

export type MovementCardMaterialStateInput = {
  state: MovementCardMaterialState;
  disabled?: boolean;
  expanded?: boolean;
  pressed?: boolean;
};

export function resolveMovementCardMaterial({
  state,
  disabled = false,
  expanded = false,
  pressed = false,
}: MovementCardMaterialStateInput) {
  const expandedMultiplier = expanded
    ? SLMovementCardMaterial.expandedTintMultiplier
    : 1;
  const pressedMultiplier = pressed
    ? SLMovementCardMaterial.pressedTintMultiplier
    : 1;
  return Object.freeze({
    accentColor: SLMovementCardMaterial.stateAccent[state],
    edgeStrength: SLMovementCardMaterial.edgeStrength[state],
    tintStrength:
      SLMovementCardMaterial.tintStrength[state]
      * expandedMultiplier
      * pressedMultiplier,
    opacity: disabled ? SLMovementCardMaterial.disabledOpacity : 1,
  });
}

export function movementCardStateAccent(state: MovementCardMaterialState) {
  return SLMovementCardMaterial.stateAccent[state];
}

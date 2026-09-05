import assert from 'node:assert/strict';

import { orderEquipmentChoices } from '../lib/equipment-selection.ts';

const ordered = orderEquipmentChoices([
  {
    id: 9301,
    key: 'matrix',
    display_name: 'Matrix',
    identity_specificity: 'exact',
    equipment_context: {
      remembered_status: 'never_used',
      last_used_at: '2026-08-12T12:00:00Z',
      option_kind: 'catalog',
    },
  },
  {
    id: 9302,
    key: 'cybex',
    display_name: 'Cybex',
    identity_specificity: 'exact',
    equipment_context: {
      remembered_status: 'used_before',
      last_used_at: '2026-08-01T12:00:00Z',
      option_kind: 'catalog',
    },
  },
], null);

assert.equal(
  ordered[0].key,
  'cybex',
  'Historical usage and recency must not override alphabetical display-name order.',
);
console.log('Equipment usage semantics regression passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const loggerModals = read('components/workout-logger/logger-modals.tsx');
const confirmation = read('components/ui/sl-confirmation-modal.tsx');

assert.match(loggerModals, /import \{ SLConfirmationModal \} from '@\/components\/ui\/sl-confirmation-modal'/);
assert.match(loggerModals, /<SLConfirmationModal/);
assert.match(confirmation, /export function SLConfirmationModal/);
assert.match(confirmation, /accessibilityViewIsModal/);
assert.match(confirmation, /variant=\{confirmTone\}/);
assert.match(confirmation, /disabled=\{loading\}/);

console.log('[session-logger-shared-confirmation] canonical Logger confirmation dependency passed');

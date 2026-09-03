import assert from 'node:assert/strict';
import fs from 'node:fs';

const sheet = fs.readFileSync('components/workout-logger/substitution-confirmation-sheet.tsx', 'utf8');
const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');

assert.match(sheet, /CanonicalMovementArtwork[\s\S]*substitution-programmed-artwork[\s\S]*CanonicalMovementArtwork[\s\S]*substitution-performing-artwork/, 'identity transition uses governed canonical movement artwork');
assert.match(sheet, /FROM[\s\S]*TO[\s\S]*CANONICAL/, 'identity transition hierarchy is explicit');
assert.match(sheet, /LoggerWheelPicker[\s\S]*density="sheet"[\s\S]*label: 'SETS'[\s\S]*label: 'RIR'/, 'Sets and RIR reuse the full-size canonical Logger wheel');
assert.match(sheet, /Single[\s\S]*Range[\s\S]*AMRAP/, 'all rep modes remain available');
assert.match(sheet, /separator="—"[\s\S]*label: 'MIN REPS'[\s\S]*label: 'MAX REPS'/, 'Range uses aligned canonical wheels and separator');
assert.match(sheet, /repTarget\.mode === 'FIXED'[\s\S]*repTarget\.mode === 'RANGE'[\s\S]*styles\.amrapCard/, 'Single, Range, and AMRAP render deliberate distinct editors');
assert.match(sheet, /ScrollView[\s\S]*maxHeight: '93%'/, 'realistic phone heights scroll instead of shrinking controls');
assert.match(sheet, /Confirm Swap/, 'not-started movement confirmation is the primary CTA');
assert.match(sheet, /Reset to Previous Prescription/, 'modified replacement prescription can be reset to its prior values');
assert.match(sheet, /Choose when ready[\s\S]*before the first set/, 'unresolved equipment is deferred explicitly until performed evidence');
assert.doesNotMatch(sheet, /Future Sets|future set|remaining work|Remaining sets only/, 'swap copy cannot imply post-evidence future-set replacement');
assert.match(sheet, /maxFontSizeMultiplier/, 'sheet defines controlled Dynamic Type behavior');
assert.match(logger, /SubstitutionConfirmationSheet[\s\S]*onConfirm=\{saveSwapAcc\}[\s\S]*performingIdentity=\{swapAccIdentity\}/, 'presentation remains wired to the authoritative selected identity and existing save command');
assert.match(logger, /itemHasPersistedSetLogs\(swapAccItem\)[\s\S]*acceptedSetEvidenceItemIds\.has/, 'save path retains the post-evidence identity lock');
assert.match(logger, /performed_canonical_movement_definition_id: swapAccIdentity\.id/, 'confirmation persists the stable governed movement ID');

console.log('Substitution confirmation sheet contracts PASS');

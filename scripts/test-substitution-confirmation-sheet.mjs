import assert from 'node:assert/strict';
import fs from 'node:fs';

const sheet = fs.readFileSync('components/workout-logger/substitution-confirmation-sheet.tsx', 'utf8');
const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');

assert.match(sheet, /CanonicalMovementArtwork[\s\S]*substitution-programmed-artwork[\s\S]*CanonicalMovementArtwork[\s\S]*substitution-performing-artwork/, 'identity transition uses governed canonical movement artwork');
assert.match(sheet, /PROGRAMMED[\s\S]*PERFORMING[\s\S]*CANONICAL/, 'identity transition hierarchy is explicit');
assert.match(sheet, /LoggerWheelPicker[\s\S]*density="sheet"[\s\S]*label: 'SETS'[\s\S]*label: 'RIR'/, 'Sets and RIR reuse the full-size canonical Logger wheel');
assert.match(sheet, /Single[\s\S]*Range[\s\S]*AMRAP/, 'all rep modes remain available');
assert.match(sheet, /separator="—"[\s\S]*label: 'MIN REPS'[\s\S]*label: 'MAX REPS'/, 'Range uses aligned canonical wheels and separator');
assert.match(sheet, /repTarget\.mode === 'FIXED'[\s\S]*repTarget\.mode === 'RANGE'[\s\S]*styles\.amrapCard/, 'Single, Range, and AMRAP render deliberate distinct editors');
assert.match(sheet, /ScrollView[\s\S]*maxHeight: '93%'/, 'realistic phone heights scroll instead of shrinking controls');
assert.match(sheet, /Use for Future Sets/, 'future-set confirmation is the primary CTA');
assert.match(sheet, /maxFontSizeMultiplier/, 'sheet defines controlled Dynamic Type behavior');
assert.match(logger, /SubstitutionConfirmationSheet[\s\S]*onConfirm=\{saveSwapAcc\}[\s\S]*performingIdentity=\{swapAccIdentity\}/, 'presentation remains wired to the authoritative selected identity and existing save command');
assert.match(logger, /itemHasPersistedSetLogs\(swapAccItem\)[\s\S]*acceptedSetEvidenceItemIds\.has/, 'save path retains the post-evidence identity lock');
assert.match(logger, /performed_canonical_movement_definition_id: swapAccIdentity\.id/, 'confirmation persists the stable governed movement ID');

console.log('Substitution confirmation sheet contracts PASS');


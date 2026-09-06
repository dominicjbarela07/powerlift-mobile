import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const achievements = fs.readFileSync(path.join(root, 'components/ledger/AchievementsExperience.tsx'), 'utf8');

assert.match(achievements, /PRIMARY_ACHIEVEMENT_SECTIONS = \['hub', 'milestones', 'clubs', 'trophies', 'medallions'\]/, 'the storyboard five-family tab row is canonical');
assert.match(achievements, /achievement-trophy-detail/, 'trophies open a full detail screen');
assert.match(achievements, /achievement-lift-tier-detail-/, 'each core lift opens a full tier detail screen');
assert.match(achievements, /FULL SEVEN-TIER PROGRESSION/, 'lift detail retains all seven governed tiers');
assert.match(achievements, /RELATED STRENGTH EVIDENCE/, 'trophy detail exposes the three contributing lift records');
assert.match(achievements, /Governed strength standard/, 'detail views disclose the evidence authority');
assert.match(achievements, /canonicalCompetitionLiftKey\(event\.core_movement_key\) === filter/, 'PR filters use governed core-lift identity');
assert.match(achievements, /\['all', 'squat', 'bench', 'deadlift'\]/, 'PR History has the storyboard lift filters');
assert.match(achievements, /ledger-milestones-index/, 'Milestones is a grouped family index');
assert.match(achievements, /achievement-overview-\$\{lift\.key\}/, 'Overview exposes all mapped core-lift standings');
assert.match(achievements, /artifactDetail[\s\S]*\(\) => setArtifactDetail\(null\)/, 'detail back-navigation returns inside Achievements');

for (const lift of ['squat', 'bench', 'deadlift']) {
  const hero = path.join(root, 'assets/images/achievements/lift-tier-heroes', `${lift}.png`);
  assert.ok(fs.existsSync(hero) && fs.statSync(hero).size > 100_000, `${lift} uses premium generated hero art`);
  const tierReferences = achievements.match(new RegExp(`milestone-renders/plate-club-material-v2/${lift}-`, 'g')) ?? [];
  assert.equal(tierReferences.length, 7, `${lift} has seven distinct lift-specific tier assets`);
}

assert.match(achievements, /club\.standardVersion/, 'detail views report the canonical runtime standard version');
assert.match(achievements, /tier\.threshold_kg/, 'expanded views preserve canonical KG thresholds');
assert.match(achievements, /tier\.display_lb/, 'expanded views preserve the exact rounded-LB projection');

console.log('[achievements storyboard] overview, grouped milestones, clubs, cabinet, details, medallions, filtered PR history, and assets passed');

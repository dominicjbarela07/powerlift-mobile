import assert from 'node:assert/strict';
import fs from 'node:fs';

import { resolveSessionNoteAuthor } from '../lib/session-note-author.ts';

const coachAuthored = resolveSessionNoteAuthor({
  isSelfCoached: false,
  coach: {
    name: 'Adrian Cole',
    avatar_url: '/media/adrian.png',
    avatar_uploaded_at: '2026-07-20T18:00:00Z',
  },
  athlete: { name: 'Maya Chen' },
  selfUser: {
    user_name: 'Maya Chen',
    profilePhotoUrl: '/media/maya.png',
    profilePhotoVersion: '2026-07-18T12:00:00Z',
  },
});
assert.deepEqual(coachAuthored, {
  kind: 'coach',
  name: 'Adrian Cole',
  profilePhotoUrl: '/media/adrian.png',
  profilePhotoVersion: '2026-07-20T18:00:00Z',
});

const selfAuthored = resolveSessionNoteAuthor({
  isSelfCoached: true,
  coach: {
    name: 'Adrian Cole',
    avatar_url: '/media/adrian.png',
    avatar_uploaded_at: '2026-07-20T18:00:00Z',
  },
  athlete: { name: 'Maya Chen' },
  selfUser: {
    user_name: 'Maya Chen',
    profilePhotoUrl: '/media/maya.png',
    profilePhotoVersion: '2026-07-18T12:00:00Z',
  },
});
assert.deepEqual(selfAuthored, {
  kind: 'self',
  name: 'Maya Chen',
  profilePhotoUrl: '/media/maya.png',
  profilePhotoVersion: '2026-07-18T12:00:00Z',
});

const selfFallback = resolveSessionNoteAuthor({
  isSelfCoached: true,
  athlete: {
    name: 'Maya Chen',
    profilePhotoUrl: '/media/athlete-fallback.png',
    profilePhotoVersion: '2026-07-01T09:00:00Z',
  },
  selfUser: null,
});
assert.deepEqual(selfFallback, {
  kind: 'self',
  name: 'Maya Chen',
  profilePhotoUrl: '/media/athlete-fallback.png',
  profilePhotoVersion: '2026-07-01T09:00:00Z',
});

const coachFallback = resolveSessionNoteAuthor({
  isSelfCoached: false,
  coach: null,
  athlete: { name: 'Maya Chen' },
  selfUser: null,
});
assert.deepEqual(coachFallback, {
  kind: 'coach',
  name: 'Coach',
  profilePhotoUrl: null,
  profilePhotoVersion: null,
});

const workoutSource = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
assert.match(
  workoutSource,
  /const sessionNoteAuthor = resolveSessionNoteAuthor\(\{[\s\S]*isSelfCoached:[\s\S]*coach: data\.coach,[\s\S]*selfUser: user,/,
  'The logger must resolve session-note authorship from coach versus self-coached identity.',
);
assert.match(
  workoutSource,
  /workout\.programming_notes[\s\S]*<SLProfileAvatar[\s\S]*sessionNoteAuthor\.name[\s\S]*profilePhotoUrl=\{sessionNoteAuthor\.profilePhotoUrl\}/,
  'Session-level programming notes must render the resolved author avatar.',
);
assert.doesNotMatch(
  workoutSource,
  /preSessionNotesIcon/,
  'Session notes must not fall back to the old document glyph.',
);

console.log('Session note author identity tests passed.');

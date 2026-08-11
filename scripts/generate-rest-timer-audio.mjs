import fs from 'node:fs';
import path from 'node:path';

const sampleRate = 44_100;
const outputDirectory = path.resolve('assets/audio');

function envelope(index, sampleCount, attackSeconds, releaseSeconds) {
  const attackSamples = Math.max(1, Math.round(attackSeconds * sampleRate));
  const releaseSamples = Math.max(1, Math.round(releaseSeconds * sampleRate));
  const attack = Math.min(1, index / attackSamples);
  const release = Math.min(1, (sampleCount - index - 1) / releaseSamples);
  return Math.max(0, Math.min(attack, release));
}

function createWav(data) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function createTone({
  durationSeconds,
  frequencies,
  amplitude,
  attackSeconds = 0.012,
  releaseSeconds = 0.05,
}) {
  const sampleCount = Math.round(sampleRate * durationSeconds);
  const data = Buffer.alloc(sampleCount * 2);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const harmonic = frequencies.reduce(
      (sum, [frequency, gain]) => sum + Math.sin(2 * Math.PI * frequency * time) * gain,
      0,
    );
    const shaped = harmonic * envelope(index, sampleCount, attackSeconds, releaseSeconds);
    const sample = Math.max(-1, Math.min(1, shaped * amplitude));
    data.writeInt16LE(Math.round(sample * 0x7fff), index * 2);
  }

  return createWav(data);
}

fs.mkdirSync(outputDirectory, { recursive: true });
const tick = createTone({
    durationSeconds: 0.13,
    frequencies: [[880, 1], [1760, 0.12]],
    amplitude: 0.34,
    releaseSeconds: 0.045,
  });
const finish = createTone({
    durationSeconds: 0.72,
    frequencies: [[660, 1], [990, 0.22], [1320, 0.08]],
    amplitude: 0.42,
    attackSeconds: 0.018,
    releaseSeconds: 0.22,
  });

const sequencePcm = Buffer.alloc(Math.round(sampleRate * 3.72) * 2);
const tickPcm = tick.subarray(44);
const finishPcm = finish.subarray(44);
for (const second of [0, 1, 2]) {
  tickPcm.copy(sequencePcm, second * sampleRate * 2);
}
finishPcm.copy(sequencePcm, 3 * sampleRate * 2);

fs.writeFileSync(path.join(outputDirectory, 'rest-countdown-tick.wav'), tick);
fs.writeFileSync(path.join(outputDirectory, 'rest-countdown-finish.wav'), finish);
fs.writeFileSync(
  path.join(outputDirectory, 'rest-countdown-sequence.wav'),
  createWav(sequencePcm),
);

console.log('Generated restrained rest-timer countdown audio, including the isolated sequence.');

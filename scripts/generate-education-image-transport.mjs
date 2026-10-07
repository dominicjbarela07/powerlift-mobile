import fs from 'node:fs';
import { carrierSource } from './education-image-transport.mjs';
const contract = JSON.parse(fs.readFileSync('config/education-image-transport.json'));
fs.writeFileSync('lib/mobile-education-image-data.js', carrierSource(process.cwd(), contract));
console.log('Regenerated 17 byte-identical PNG sources; original files retained.');

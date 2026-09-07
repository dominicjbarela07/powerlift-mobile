import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'components', 'anatomy', 'anatomy-mask-registry.tsx');
const registrySource = fs.readFileSync(registryPath, 'utf8');
const sourceFile = ts.createSourceFile(registryPath, registrySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  throw new Error(`Unsupported mask property at ${node.pos}`);
}

function literalValue(node) {
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property)) throw new Error(`Unsupported registry member at ${property.pos}`);
      return [propertyName(property.name), literalValue(property.initializer)];
    }));
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  if (ts.isStringLiteral(node)) return node.text;
  throw new Error(`Unsupported registry literal at ${node.pos}`);
}

let registry;
for (const statement of sourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.name.text === 'REGISTERED_ANATOMY_MASKS' && declaration.initializer) {
      registry = literalValue(declaration.initializer);
    }
  }
}
if (!registry) throw new Error('REGISTERED_ANATOMY_MASKS was not found');

const muscles = Object.keys(registry.masculine.front);
const outputDir = path.resolve(root, process.argv[2] || 'artifacts/anatomy-geometry-audit');
fs.mkdirSync(outputDir, { recursive: true });
const columns = 6;
const tileWidth = 214;
const tileHeight = 280;
const headerHeight = 72;
const sheetWidth = columns * tileWidth;
const sheetHeight = headerHeight + Math.ceil(muscles.length / columns) * tileHeight;

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

for (const presentation of ['masculine', 'feminine']) {
  for (const view of ['front', 'rear']) {
    const masterName = `${presentation}-${view}-v1.png`;
    const materialName = `${presentation}-${view}-primary-material-v2.png`;
    const master = fs.readFileSync(path.join(root, 'assets', 'images', 'anatomy-v2', 'masters', masterName)).toString('base64');
    const material = fs.readFileSync(path.join(root, 'assets', 'images', 'anatomy-v2', 'materials', materialName)).toString('base64');
    const cards = muscles.map((muscle, index) => {
      const paths = registry[presentation][view][muscle];
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * tileWidth;
      const y = headerHeight + row * tileHeight;
      const figureX = x + 55;
      const figureY = y + 30;
      const figureWidth = 104;
      const figureHeight = 234;
      const clipId = `${presentation}-${view}-${muscle}`;
      const pathNodes = paths.map((value) => `<path d="${escapeXml(value)}"/>`).join('');
      const figure = paths.length ? `
        <defs><clipPath id="${clipId}">${pathNodes}</clipPath></defs>
        <svg x="${figureX}" y="${figureY}" width="${figureWidth}" height="${figureHeight}" viewBox="0 0 418 941" preserveAspectRatio="xMidYMid meet">
          <image width="418" height="941" href="data:image/png;base64,${master}"/>
          <image width="418" height="941" href="data:image/png;base64,${material}" clip-path="url(#${clipId})" opacity="0.98"/>
          <image width="418" height="941" href="data:image/png;base64,${master}" opacity="0.12"/>
        </svg>` : `
        <svg x="${figureX}" y="${figureY}" width="${figureWidth}" height="${figureHeight}" viewBox="0 0 418 941" preserveAspectRatio="xMidYMid meet">
          <image width="418" height="941" href="data:image/png;base64,${master}" opacity="0.42"/>
        </svg>`;
      return `<g>
        <rect x="${x + 5}" y="${y + 5}" width="${tileWidth - 10}" height="${tileHeight - 10}" rx="14" fill="#080A0F" stroke="${paths.length ? '#563075' : '#262A32'}"/>
        <text x="${x + 13}" y="${y + 23}" fill="${paths.length ? '#E2C9FF' : '#686E79'}" font-family="sans-serif" font-size="12" font-weight="700">${escapeXml(muscle.replaceAll('_', ' '))}</text>
        ${figure}
      </g>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">
      <rect width="100%" height="100%" fill="#020306"/>
      <text x="18" y="30" fill="#F4F0F8" font-family="sans-serif" font-size="20" font-weight="800">${presentation} · ${view} · registered segment audit</text>
      <text x="18" y="52" fill="#969DA9" font-family="sans-serif" font-size="12">Each visible governed region is isolated against its exact 418 × 941 master. Dim cards are correctly unavailable from this view.</text>
      ${cards}
    </svg>`;
    fs.writeFileSync(path.join(outputDir, `${presentation}-${view}-geometry-audit.svg`), svg);
  }
}

console.log(`[anatomy-geometry-audit] wrote four registered-master sheets to ${outputDir}`);

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const runtime = typeof appConfig.runtimeVersion === 'string'
  ? appConfig.runtimeVersion
  : appConfig.version;
const baselines = JSON.parse(
  fs.readFileSync(path.join(root, 'config/native-runtime-baselines.json'), 'utf8'),
);
const baseline = baselines[runtime];

if (!baseline) {
  throw new Error(`No audited native baseline exists for runtime ${runtime}. Create a native build and record it before publishing an OTA.`);
}

const autolinking = path.join(root, 'node_modules', '.bin', 'expo-modules-autolinking');
const runJson = (args) => JSON.parse(execFileSync(autolinking, args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
}));

const rnConfig = runJson(['react-native-config', '--platform', 'ios', '--json']);
const reactNativeDependencies = Object.fromEntries(
  Object.entries(rnConfig.dependencies)
    .filter(([, value]) => value.platforms?.ios)
    .map(([name, value]) => [name, value.platforms.ios.version])
    .sort(([left], [right]) => left.localeCompare(right)),
);

const expoConfig = runJson(['resolve', '--platform', 'apple', '--json']);
const expoModules = Object.fromEntries(
  expoConfig.modules
    .map((module) => [module.packageName, module.packageVersion])
    .sort(([left], [right]) => left.localeCompare(right)),
);

const plugins = (appConfig.plugins ?? []).map((plugin) => (
  Array.isArray(plugin) ? plugin[0] : plugin
));

const checks = {
  newArchEnabled: appConfig.newArchEnabled,
  plugins,
  reactNativeDependencies,
  expoModules,
};

const failures = Object.entries(checks).filter(([key, value]) => (
  JSON.stringify(value) !== JSON.stringify(baseline[key])
));

if (failures.length) {
  const detail = failures.map(([key, value]) => (
    `${key}\n  build ${baseline.iosBuild}: ${JSON.stringify(baseline[key])}\n  current: ${JSON.stringify(value)}`
  )).join('\n');
  throw new Error(
    `OTA blocked: runtime ${runtime} no longer matches audited iOS build ${baseline.iosBuild} (${baseline.easBuildId}).\n${detail}`,
  );
}

console.log(`OTA native compatibility PASS — runtime ${runtime} matches iOS build ${baseline.iosBuild}.`);

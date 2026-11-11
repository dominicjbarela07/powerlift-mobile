import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function renderText(source) {
  let fontScale = 1;
  const react = {
    forwardRef: render => render,
    createElement: (type, props) => ({ type, props }),
  };
  const modules = {
    react,
    'react-native': {
      Text: 'NativeText', TextInput: 'NativeTextInput',
      StyleSheet: { flatten: styles => Object.assign({}, ...styles.filter(Boolean)) },
      useWindowDimensions: () => ({ width: 390, height: 844, fontScale }),
    },
    '@/constants/theme': { SLFontFamilies: { body: 'Exo2-Regular' }, SLTypographyRoles: {}, SLTypographyTextBehaviors: {} },
    '@/lib/mobile-text-layout-core': { guardedMobileLineHeight: () => undefined },
    '@/components/keyboard/KeyboardSurface': {},
    '@/lib/keyboard-layout': {},
  };
  const context = { exports: {}, require: name => {
    assert.ok(modules[name], name);
    return modules[name];
  } };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText, context);
  const initial = context.exports.Text({ children: 'Start your Individual trial' }, null);
  fontScale = 2.35;
  const enlarged = context.exports.Text({ children: 'Start your Individual trial' }, null);
  assert.notEqual(initial.props.key, enlarged.props.key, 'Dynamic Type must invalidate native glyph measurement');
  assert.notEqual(enlarged.props.allowFontScaling, false, 'readable scaling remains enabled');
}

const source = fs.readFileSync('components/ui/sl-text.tsx', 'utf8');
renderText(source);
assert.throws(() => renderText(source.replace('key={fontScale}', '')), /Dynamic Type must invalidate/);
console.log('PASS actual shared Text renderer invalidates stale native measurement on Dynamic Type changes. Scaling stays enabled. Deliberate removal is rejected.');

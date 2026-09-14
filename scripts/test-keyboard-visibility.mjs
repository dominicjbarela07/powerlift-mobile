import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as geometry from '../lib/keyboard-layout.ts';
const {keyboardOverlap,focusedFieldScrollDelta,multilineInputHeight}=geometry;
const read=p=>fs.readFileSync(p,'utf8');
const cases=[];
for(const [width,height] of [[375,667],[393,852],[402,874],[844,390]])for(const keyboardHeight of [216,291,346])for(const top of [0,44,112]){
 const keyboard={x:0,y:height-keyboardHeight,width,height:keyboardHeight};
 const window={x:0,y:top,width,height:height-top};
 const overlap=keyboardOverlap(window,keyboard);
 assert.equal(window.y+window.height-overlap,Math.max(top,keyboard.y),'complete bottom action row ends above keyboard');
 const resized={...window,height:Math.max(0,keyboard.y-top)};
 assert.equal(keyboardOverlap(resized,keyboard),0,'Android resize / already avoided child must not pay twice');
 assert.equal(keyboardOverlap(window,null),0,'closed keyboard reserves no blank space');
 cases.push(window);
}
assert.equal(keyboardOverlap({x:0,y:100,width:300,height:400},{x:320,y:200,width:200,height:300}),0,'floating keyboard beside a split pane does not inset it');
const viewport={x:0,y:100,width:375,height:300};
assert.equal(focusedFieldScrollDelta({x:0,y:120,width:300,height:44},viewport),0);
assert.equal(focusedFieldScrollDelta({x:0,y:500,width:300,height:44},viewport),156);
assert.equal(focusedFieldScrollDelta({x:0,y:90,width:300,height:44},viewport),-22);
for(const available of [220,350,600]){
 const small=multilineInputHeight(44,available),large=multilineInputHeight(2000,available);
 assert.equal(small.height,44);assert.ok(large.height<=160&&large.height<=available*.36);assert.equal(large.height,large.maxHeight);
}

// Execute the actual scroll component, preserving handlers/ref and moving focus A -> B without reopening keyboard.
const tasks=[];const context={visible:true,frame:{x:0,y:400,width:375,height:267}};
const react={createElement:(type,props,...children)=>({type,props:{...props,...(children.length ? {children} : {})}}),createContext:value=>({current:value,Provider:'Provider'}),
 forwardRef:fn=>fn,useContext:c=>c.current,useRef:value=>({current:value}),useState:value=>[value,()=>{}],useCallback:fn=>fn,useMemo:fn=>fn(),useEffect:()=>{}};
const style={create:x=>x,flatten:x=>Array.isArray(x)?Object.assign({},...x.filter(Boolean)):x};
const mocks={react,'react-native':{StyleSheet:style,ScrollView:'NativeScroll',View:'View',Modal:'NativeModal',Keyboard:{dismiss(){}},useWindowDimensions:()=>({width:375,height:667})},
 '@/lib/keyboard-layout':geometry,'./keyboard-state':{useKeyboardState:()=>context},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:20,bottom:0})}};
const exports={};vm.runInNewContext(ts.transpileModule(read('components/keyboard/KeyboardSurface.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},requestAnimationFrame:fn=>{tasks.push(fn);return tasks.length;},cancelAnimationFrame:()=>{}});
// Execute the measured native viewport ref callback as well as the geometry helper.
const boundary = exports.KeyboardViewport({independent:true,children:'composer'},null);
const measured = boundary.type(boundary.props);
measured.props.ref({measureInWindow:fn=>fn(0,0,375,667)});
measured.props.onLayout({});
assert.equal(measured.props.children[0].props.style[1].paddingBottom,267);
assert.equal(measured.props.children[0].props.children[0].props.value,400);
assert.equal(measured.props.children[0].props.children[0].props.children[0].props.value,null,'native presentations cannot scroll an underlying form through inherited focus context');

const scrolls=[];let callerScrolls=0,callerLayouts=0,callerSizes=0;const forwarded={current:null};
const tree=exports.KeyboardScrollView({keyboardShouldPersistTaps:'always',contentContainerStyle:{paddingBottom:24},onScroll:()=>callerScrolls++,onLayout:()=>callerLayouts++,onContentSizeChange:()=>callerSizes++,children:'field'},forwarded);
const native=tree.props.children[0]; const instance={getNativeScrollRef:()=>({measureInWindow:fn=>fn(0,100,375,300)}),scrollTo:args=>scrolls.push(args)};
native.props.ref(instance);assert.equal(forwarded.current,instance);assert.equal(native.props.automaticallyAdjustKeyboardInsets,false);assert.equal(native.props.keyboardShouldPersistTaps,'always');
native.props.onScroll({nativeEvent:{contentOffset:{y:50}}});assert.equal(callerScrolls,1);
const input=y=>({isFocused:()=>true,measureInWindow:fn=>fn(0,y,300,44)});
const A=input(130),B=input(500);tree.props.value.focus(A);while(tasks.length)tasks.shift()();assert.equal(scrolls.length,0,'visible A remains stationary');
tree.props.value.focus(B);while(tasks.length)tasks.shift()();assert.equal(scrolls.at(-1).y,206,'B is revealed with keyboard already open');
native.props.onLayout({});native.props.onContentSizeChange(375,800);while(tasks.length)tasks.shift()();assert.equal(callerLayouts,1);assert.equal(callerSizes,1);
tree.props.value.blur(B);const count=scrolls.length;tree.props.value.reveal();while(tasks.length)tasks.shift()();assert.equal(scrolls.length,count,'blurred/unmounted field never moves a new screen');
const horizontal=exports.KeyboardScrollView({horizontal:true},null);assert.equal(horizontal.props.value,null,'horizontal chips preserve vertical focus ownership');

// Architecture guard: every native text input and scroll/form/modal boundary goes through the canonical owner.
const paths=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())walk(p);else if(p.endsWith('.tsx'))paths.push(p);}}walk('app');walk('components');
for(const p of paths){if(p.startsWith('components/keyboard/'))continue;const source=read(p);const ast=ts.createSourceFile(p,source,99,true,4);for(const node of ast.statements){if(!ts.isImportDeclaration(node)||node.moduleSpecifier.text!=='react-native')continue;for(const spec of node.importClause?.namedBindings?.elements||[]){if(spec.isTypeOnly)continue;const name=spec.propertyName?.text||spec.name.text;if(name==='TextInput')assert.equal(p,'components/ui/sl-text.tsx',`${p}: input bypasses focus owner`);assert.ok(!['KeyboardAvoidingView','ScrollView','Modal'].includes(name),`${p}: ${name} bypasses keyboard owner`);}}
 assert.doesNotMatch(source,/keyboardVerticalOffset=|automaticallyAdjustKeyboardInsets/,'consumers cannot double-inset or guess header offsets');}
const root=read('app/_layout.tsx');assert.match(root,/screenLayout=\{[^\n]*<KeyboardViewport independent>/);assert.match(root,/keyboardPath\.current !== pathname\) Keyboard.dismiss\(\)/);
const text=read('components/ui/sl-text.tsx');for(const handler of ['onFocus','onBlur','onContentSizeChange','onSelectionChange'])assert.match(text,new RegExp(`props\\.${handler}\\?\\.`),'caller handlers preserved');assert.match(text,/scrollEnabled=\{props.multiline \? true/);
const sheet=read('components/sheets/StrengthLedgerBottomSheet.tsx');assert.match(sheet,/flexShrink: 1, minHeight: 0, maxHeight: '100%'/);
for(const p of ['components/ui/floating-control-coordinator.tsx','components/navigation/sl-tab-row-control.tsx'])assert.match(read(p),/if \(keyboard.visible\) return null/);
console.log(`Keyboard visibility: ${cases.length} device/frame geometries; actual focus transitions, refs/events, multiline caps, modal/sheet/navigation ownership and ${paths.length} consumer import contracts PASS`);

// Drive actual iOS/Android events and AppState reconciliation; no stale keyboard on resume.
for(const platform of ['ios','android']){
 const handlers=new Map();let metrics,visible=false,getSnapshot,unsubscribe;
 const app={currentState:'active',addEventListener:(name,fn)=>{handlers.set('app:'+name,fn);return{remove(){}};}};
 const native={Platform:{OS:platform},AppState:app,Dimensions:{get:()=>({height:667}),addEventListener:(name,fn)=>{handlers.set('dimensions',fn);return{remove(){}};}},
 Keyboard:{metrics:()=>metrics,isVisible:()=>visible,dismiss:()=>{visible=false;metrics=undefined;},addListener:(name,fn)=>{handlers.set(name,fn);return{remove(){}};}}};
 const module={};vm.runInNewContext(ts.transpileModule(read('components/keyboard/keyboard-state.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module,require:name=>name==='react'?{useSyncExternalStore:(subscribe,get)=>{getSnapshot=get;unsubscribe=subscribe(()=>{});return get();}}:native});
 assert.equal(module.useKeyboardState().visible,false);
 metrics={screenX:0,screenY:451,width:375,height:216};visible=true;handlers.get('keyboardDidShow')({endCoordinates:metrics});assert.equal(getSnapshot().frame.y,451);
 metrics={...metrics,screenY:376,height:291};(handlers.get('keyboardWillChangeFrame')||handlers.get('keyboardDidShow'))({endCoordinates:metrics});assert.equal(getSnapshot().frame.y,376,'predictive/language keyboard frame changes update overlap');
 app.currentState='background';handlers.get('app:change')('background');assert.equal(getSnapshot().visible,false);
 handlers.get('keyboardDidShow')({endCoordinates:metrics||{screenX:0,screenY:376,width:375,height:291}});assert.equal(getSnapshot().visible,false,'late background event cannot revive padding');
 app.currentState='active';handlers.get('app:change')('active');assert.equal(getSnapshot().frame,null);
 metrics={screenX:0,screenY:451,width:375,height:216};visible=true;handlers.get('dimensions')();assert.equal(getSnapshot().visible,true);
 handlers.get('keyboardDidHide')();assert.equal(getSnapshot().frame,null);unsubscribe();
}
console.log('Actual keyboard event store: iOS frame changes, Android did-show/hide, orientation reconciliation, background/foreground and late events PASS');

// Execute the composer in both states: reserve the real dock when closed, then reclaim it for typing.
const composerModule = {};
vm.runInNewContext(ts.transpileModule(read('components/keyboard/KeyboardComposer.tsx'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, { exports: composerModule, require: name => ({
 react,
 'react-native': { View: 'View' },
 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
 '@/components/navigation/sl-tab-row-control': { SL_TAB_ROW_CONTROL: { dockFrameHeight: 58 } },
 './keyboard-state': { useKeyboardState: () => context },
})[name] });
context.visible = false;
let composer = composerModule.KeyboardComposer({ children: 'input-and-send', style: { paddingHorizontal: 16 } });
assert.equal(composer.props.style[1].paddingBottom, 100);
context.visible = true;
composer = composerModule.KeyboardComposer({ children: 'input-and-send' });
assert.equal(composer.props.style[1].paddingBottom, 8);
assert.equal(composer.props.children, 'input-and-send');
assert.equal(composer.props.style[1].flexShrink, 0);
for (const p of ['app/(tabs)/messages/index.tsx', 'app/(tabs)/messages/[threadId].tsx']) {
 assert.match(read(p), /<KeyboardComposer style=\{styles\.composerWrap\}/);
}
assert.doesNotMatch(read('components/coach-mobile/athlete-workspace/CoachAthleteMessages.tsx'), /paddingBottom: 88/);
console.log('Messages composer: floating-dock clearance, keyboard-open compact spacing, complete action row and workspace consumption PASS');

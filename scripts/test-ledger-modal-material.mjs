import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
// Execute the canonical native owner, including its request-close handler.
const style={create:x=>x,flatten:x=>Object.assign({},...x.filter(Boolean))};
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),forwardRef:fn=>fn,createContext:value=>({current:value}),useContext:c=>c.current,useRef:value=>({current:value}),useEffect:()=>{}};
let dismissals=0,requests=0,shown=false;
const mocks={react,'react-native':{StyleSheet:style,View:'View',Modal:'NativeModal',Keyboard:{dismiss:()=>dismissals++}},'@/constants/theme':{SLColors:{canvas:'#020205'}},'./keyboard-state':{useKeyboardState:()=>({visible:shown})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:20,bottom:0})},'@/lib/keyboard-layout':{}};
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/keyboard/KeyboardSurface.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});
for(shown of [false,true,false])for(const transparent of [false,true])for(const material of [undefined,'#191D23']){
 const modal=exports.KeyboardModal({visible:true,transparent,backdropColor:material,children:'ledger evidence',onRequestClose:()=>requests++});
 assert.equal(modal.props.backdropColor,material??'#020205');
 assert.equal(style.flatten(modal.props.children[0].props.style).backgroundColor,transparent?undefined:material??'#020205');
 modal.props.onRequestClose({});
}
assert.equal(requests,12);assert.equal(dismissals,12);
console.log('PASS: actual native modal owner; default/explicit materials, transparent/opaque bounds, keyboard states and close callbacks preserved.');

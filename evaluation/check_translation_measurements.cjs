const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const path=require('path');

const storage=new Map();
const children=[];
const timingCards={replaceChildren(...values){children.splice(0,children.length,...values);}};
const makeNode=()=>({textContent:'',append(...values){this.children=values;}});
const context={
 localStorage:{
  getItem:key=>storage.get(key),
  setItem:(key,value)=>storage.set(key,value),
  removeItem:key=>storage.delete(key)
 },
 navigator:{userAgent:'test browser'},
 document:{getElementById:id=>id==='timingCards'?timingCards:null,createElement:makeNode},
 Event:class{constructor(type){this.type=type;}},
 dispatchEvent(){}
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/measurements.js'),'utf8'),context);
context.BICOLANGMeasurements.add({kind:'STT',outcome:'completed',ms:100});
assert.equal(context.BICOLANGMeasurements.list().length,0,'non-translation measurements must be ignored');
context.BICOLANGMeasurements.add({kind:'Translation',language:'Bicol',model:'minilm',query:'=MARAY',outcome:'exact',ms:125,start:10,id:1});
assert.equal(context.BICOLANGMeasurements.list().length,1);
assert.equal(context.BICOLANGMeasurements.list()[0].ms,125);
assert.ok(!('start' in context.BICOLANGMeasurements.list()[0]));
assert.ok(!('id' in context.BICOLANGMeasurements.list()[0]));
assert.match(context.BICOLANGMeasurements.csv(),/"'=MARAY"/,'CSV formula-like input must be escaped');
assert.equal(children.length,1,'only one live timing card should render');
context.BICOLANGMeasurements.clear();
assert.equal(context.BICOLANGMeasurements.list().length,0);
console.log('Passed: translation-only logging, timing card, CSV export safety, and clear behavior.');

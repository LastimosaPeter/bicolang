import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath}from 'node:url';
import * as transformers from '@huggingface/transformers';
import{createModelManager,MODELS}from '../dist/model-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'dist/dataset.json'),'utf8')).rows;
const tests=JSON.parse(fs.readFileSync(path.join(root,'evaluation/test_queries.json'),'utf8')).tests;
transformers.env.cacheDir=process.env.BICOLANG_MODEL_CACHE||path.join(root,'evaluation/.model-cache');
const manager=createModelManager({cacheLimit:50000,importer:async()=>({...transformers,pipeline:(task,model,options)=>transformers.pipeline(task,model,{...options,device:'cpu',session_options:{intraOpNumThreads:4,interOpNumThreads:1}})}),loadProjection:async()=>{const b=fs.readFileSync(path.join(root,'dist/distiluse-dense.bin'));return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}});
let result;
const context={injectedManager:manager,self:{postMessage:m=>{if(m.type==='result'||m.type==='error')result=m;}},console,Float32Array,Map,Set};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'dist/retrieval-worker.js'),'utf8'),context);vm.runInContext('modelManager=injectedManager;',context);context.self.onmessage({data:{type:'init',rows}});
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/ß/g,'ss').replace(/ς/g,'σ').replace(/\s+/g,' ').trim();
let id=0;const predictions=[];
for(const model of ['exact','dice','tfidf','minilm','distiluse','mpnet']){
 const start=Date.now();let done=0;
 for(const test of tests){
  result=undefined;context.self.onmessage({data:{id:++id,query:test.query,source:test.source,model}});await vm.runInContext('queue',context);
  if(!result||result.type==='error')throw Error(model+': '+JSON.stringify(result));
  const gold=new Set(test.references);const relevant=result.matches.map(m=>m.rows.some(i=>gold.has(normalize(rows[i][test.target_column]))));const rank=relevant.findIndex(Boolean);
  predictions.push({model,...test,status:result.status,answered:result.matches.length>0,hit1:Boolean(relevant[0]),hit5:rank>=0,mrr:rank>=0?1/(rank+1):0,matches:result.matches.map(m=>({key:m.key,score:m.score,translations:[...new Set(m.rows.map(i=>rows[i][test.target_column]).filter(Boolean))]}))});
  done++;if(done%25===0){fs.writeFileSync(path.join(root,'evaluation/predictions.json'),JSON.stringify(predictions));console.log(JSON.stringify({model,done,total:tests.length,seconds:Math.round((Date.now()-start)/1000)}));}
 }
 console.log('COMPLETE',model,Math.round((Date.now()-start)/1000)+'s');
}
await manager.dispose();fs.writeFileSync(path.join(root,'evaluation/predictions.json'),JSON.stringify(predictions));
console.log('Completed',predictions.length,'evaluations');

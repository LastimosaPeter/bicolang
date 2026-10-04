import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath}from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'dist/dataset.json'),'utf8')).rows,tests=JSON.parse(fs.readFileSync(path.join(root,'evaluation/test_queries.json'),'utf8')).tests;
let result;const context={self:{postMessage:m=>result=m},Float32Array,Map,Set,console};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'dist/retrieval-worker.js'),'utf8'),context);context.self.onmessage({data:{type:'init',rows}});
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/ß/g,'ss').replace(/ς/g,'σ').replace(/\s+/g,' ').trim();
let id=0;const records=[];
for(const model of ['tfidf','exact','dice','minilm','distiluse','mpnet']){
 let correct=0;
 for(const t of tests){context.self.onmessage({data:{id:++id,query:t.original,source:t.source,model}});await vm.runInContext('queue',context);if(result.status!=='exact')throw Error('Expected exact lookup');const gold=new Set(t.references);if(result.matches[0].rows.some(i=>gold.has(norm(rows[i][t.target_column]))))correct++;}
 records.push({model,n:tests.length,correct,accuracy:correct/tests.length});
}
fs.writeFileSync(path.join(root,'evaluation/known_entry_controls.json'),JSON.stringify(records,null,2));console.log(records);

let rows=[];
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/ß/g,'ss').replace(/ς/g,'σ').replace(/\s+/g,' ').trim();
const columns={Bicol:0,Tagalog:2,English:1};
const caches=new Map();
let latestId=0,queue=Promise.resolve(),modelManager;
const TRANSFORMER_KEYS=new Set(["minilm","distiluse","mpnet"]);
function grams(text){
 const counts=new Map();
 for(const word of normalize(text).split(/\s+/)){
  const padded=' '+word+' ';
  for(let n=2;n<=5;n++){
   const limit=Math.max(1,padded.length-n+1);
   for(let i=0;i<limit;i++){const gram=padded.slice(i,i+n);counts.set(gram,(counts.get(gram)||0)+1);if(i===0&&padded.length<=n)break;}
   if(n>=padded.length)break;
  }
 }
 return counts;
}
function getIndex(source){
 if(caches.has(source))return caches.get(source);
 const map=new Map();
 rows.forEach((row,i)=>{const key=normalize(row[columns[source]]);if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(i);});
 const docs=Array.from(map.keys()).sort().map(key=>({key,rows:map.get(key)}));
 const index={map,docs};caches.set(source,index);return index;
}
function fit(index){
 if(index.fitted)return;
 // One sparse representation per source entry, with the same char_wb(2,5)
 // feature counts, smoothed IDF, and L2 normalization as sklearn TF-IDF.
 const vocabulary=new Map();const dfs=[];
 for(const doc of index.docs){
  const entries=[];
  for(const [gram,count]of grams(doc.key)){
   let id=vocabulary.get(gram);
   if(id===undefined){id=dfs.length;vocabulary.set(gram,id);dfs.push(0);}
   dfs[id]++;entries.push(id,count);
  }
  doc.vector=new Float32Array(entries);
 }
 const idf=Float32Array.from(dfs,df=>Math.log((1+index.docs.length)/(1+df))+1);
 for(const doc of index.docs){let norm=0;for(let i=0;i<doc.vector.length;i+=2){const weight=doc.vector[i+1]*idf[doc.vector[i]];norm+=weight*weight;}doc.norm=Math.sqrt(norm);}
 index.vocabulary=vocabulary;index.idf=idf;index.fitted=true;
}
function trigrams(text){const p='  '+text+'  ';const set=new Set();for(let i=0;i<p.length-2;i++)set.add(p.slice(i,i+3));return set;}
async function search(query,source,model,id){
 const transformer=TRANSFORMER_KEYS.has(model);
 if(transformer)model="tfidf";
 const key=normalize(query),index=getIndex(source);
 if(index.map.has(key))return{status:'exact',matches:[{key,score:1,rows:index.map.get(key)}]};
 if(model==='exact')return{status:'none',matches:[]};
 const best=[];let queryVector,queryNorm=0,queryGrams;
 if(model==='tfidf'){
  fit(index);queryVector=new Map();
  for(const[gram,count]of grams(key)){const id=index.vocabulary.get(gram);if(id!==undefined){const weight=count*index.idf[id];queryVector.set(id,weight);queryNorm+=weight*weight;}}
  queryNorm=Math.sqrt(queryNorm);
 }else queryGrams=trigrams(key);
 for(const doc of index.docs){
  let score=0;
  if(model==='tfidf'){
   if(queryNorm){let dot=0;for(let i=0;i<doc.vector.length;i+=2){const id=doc.vector[i];dot+=(queryVector.get(id)||0)*doc.vector[i+1]*index.idf[id];}score=dot/(queryNorm*doc.norm||1);}
  }else{const other=trigrams(doc.key);let overlap=0;for(const gram of queryGrams)if(other.has(gram))overlap++;score=2*overlap/(queryGrams.size+other.size||1);}
  const threshold=model==='tfidf'?.35:.38;
  if(score<threshold)continue;
  if(best.length<(transformer?50:5)||score>best.at(-1).score){best.push({key:doc.key,score,rows:doc.rows});best.sort((a,b)=>b.score-a.score);if(best.length>(transformer?50:5))best.pop();}
 }
 if(transformer&&best.length){
  if(!modelManager){const module=await import('./model-runtime.mjs');modelManager=module.createModelManager({isCurrent:request=>request===latestId,notify:(request,message)=>self.postMessage({type:'progress',id:request,message})});}
  const transformerKey=currentModels.get(id);
  const texts=[query,...best.map(d=>rows[d.rows[0]][columns[source]])];
  const vectors=await modelManager.embed(transformerKey,texts,id);
  if(!vectors||id!==latestId)return null;
  const queryVector=vectors[0];
  best.forEach((candidate,i)=>{let semantic=0;for(let j=0;j<queryVector.length;j++)semantic+=queryVector[j]*vectors[i+1][j];candidate.characterScore=candidate.score;candidate.semanticScore=semantic;candidate.score=.75*candidate.score+.25*semantic;});
  best.sort((a,b)=>b.score-a.score);
 }
 return{status:best.length?'fuzzy':'none',matches:best.slice(0,5),transformer};
}
const currentModels=new Map();
self.onmessage=event=>{
 const msg=event.data;
 if(msg.type==='init'){rows=msg.rows;self.postMessage({type:'ready'});return;}
 if(msg.type==='cancel'){latestId=msg.id;return;}
 latestId=msg.id;currentModels.set(msg.id,msg.model);
 queue=queue.then(async()=>{
  if(msg.id!==latestId){currentModels.delete(msg.id);return;}
  try{const result=await search(msg.query,msg.source,msg.model,msg.id);if(result&&msg.id===latestId)self.postMessage({type:'result',id:msg.id,...result});}
  catch(e){if(msg.id===latestId)self.postMessage({type:'error',id:msg.id,message:e.message});}
  finally{currentModels.delete(msg.id);}
 });
};

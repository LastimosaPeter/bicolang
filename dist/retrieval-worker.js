/*
 * BICOLANG dictionary retrieval worker
 * ------------------------------------
 * The site is retrieval-based: it finds an entry in the supplied dictionary and
 * displays the translations already stored in that row. It does not generate a
 * new sentence or invent a translation.
 *
 * Operations used by every selectable AI model:
 * 1. Normalize the query so capitalization and repeated spaces do not matter.
 * 2. Return an exact dictionary entry immediately when one exists.
 * 3. Otherwise use character TF-IDF to create a small candidate pool.
 * 4. Embed the query and candidates with MiniLM, DistilUSE, or MPNet.
 * 5. Rerank candidates with 75% character similarity + 25% semantic similarity.
 * 6. Return the best five candidates as dictionary row IDs to app.js.
 */

// The dataset is sent by app.js after dataset.json has loaded.
let rows=[];

// Queries and source entries are normalized identically for case-insensitive
// matching. NFKC also regularizes compatible Unicode character forms.
const normalize=value=>String(value||'')
 .normalize('NFKC')
 .toLowerCase()
 .replace(/ß/g,'ss')
 .replace(/ς/g,'σ')
 .replace(/\s+/g,' ')
 .trim();

// Dataset row positions: [Bicol, English, Tagalog, POS, example, sheet, row].
const columns={Bicol:0,Tagalog:2,English:1};

// One index is built lazily for each possible source language.
const caches=new Map();
let latestId=0;
let queue=Promise.resolve();
let modelManager;

// These are the only models exposed in the translator interface.
const TRANSFORMER_KEYS=new Set(['minilm','distiluse','mpnet']);

// Splits each word into character n-grams of length 2–5. Word-boundary spaces
// make beginning/end spelling differences part of the comparison.
function grams(text){
 const counts=new Map();
 for(const word of normalize(text).split(/\s+/)){
  const padded=' '+word+' ';
  for(let n=2;n<=5;n++){
   const limit=Math.max(1,padded.length-n+1);
   for(let i=0;i<limit;i++){
    const gram=padded.slice(i,i+n);
    counts.set(gram,(counts.get(gram)||0)+1);
    if(i===0&&padded.length<=n)break;
   }
   if(n>=padded.length)break;
  }
 }
 return counts;
}

// Builds a lookup map from normalized source text to all matching dataset rows.
// Keeping all row IDs preserves entries that have more than one meaning.
function getIndex(source){
 if(caches.has(source))return caches.get(source);

 const map=new Map();
 rows.forEach((row,rowId)=>{
  const key=normalize(row[columns[source]]);
  if(!key)return;
  if(!map.has(key))map.set(key,[]);
  map.get(key).push(rowId);
 });

 const docs=Array.from(map.keys()).sort().map(key=>({key,rows:map.get(key)}));
 const index={map,docs};
 caches.set(source,index);
 return index;
}

// Fits a character TF-IDF index only on first use for a source language.
// The formula matches sklearn-style smoothed IDF and L2 normalization.
function fit(index){
 if(index.fitted)return;

 const vocabulary=new Map();
 const documentFrequencies=[];

 for(const doc of index.docs){
  const entries=[];
  for(const[gram,count]of grams(doc.key)){
   let featureId=vocabulary.get(gram);
   if(featureId===undefined){
    featureId=documentFrequencies.length;
    vocabulary.set(gram,featureId);
    documentFrequencies.push(0);
   }
   documentFrequencies[featureId]++;
   entries.push(featureId,count);
  }
  doc.vector=new Float32Array(entries);
 }

 const idf=Float32Array.from(
  documentFrequencies,
  frequency=>Math.log((1+index.docs.length)/(1+frequency))+1
 );

 for(const doc of index.docs){
  let squaredLength=0;
  for(let i=0;i<doc.vector.length;i+=2){
   const weight=doc.vector[i+1]*idf[doc.vector[i]];
   squaredLength+=weight*weight;
  }
  doc.norm=Math.sqrt(squaredLength);
 }

 index.vocabulary=vocabulary;
 index.idf=idf;
 index.fitted=true;
}

// Legacy trigram helper retained for compatibility with old benchmark scripts.
// The public interface now selects transformer models only.
function trigrams(text){
 const padded='  '+text+'  ';
 const set=new Set();
 for(let i=0;i<padded.length-2;i++)set.add(padded.slice(i,i+3));
 return set;
}

async function search(query,source,model,id){
 const transformer=TRANSFORMER_KEYS.has(model);

 // All three AI choices use TF-IDF to retrieve a practical candidate pool
 // before the chosen transformer performs the more expensive semantic rerank.
 if(transformer)model='tfidf';

 const key=normalize(query);
 const index=getIndex(source);

 // Operation 1: exact dictionary lookup. This is intentionally first because
 // a confirmed dictionary entry should not be displaced by an approximate one.
 if(index.map.has(key)){
  return{status:'exact',matches:[{key,score:1,rows:index.map.get(key)}]};
 }

 // This branch remains for internal/benchmark compatibility and is not exposed
 // as a model choice in the public page.
 if(model==='exact')return{status:'none',matches:[]};

 // Operation 2: calculate character similarity for every unique source entry.
 // Transformer searches retain the strongest 50 candidates for semantic work.
 const best=[];
 let queryVector;
 let queryNorm=0;
 let queryGrams;

 if(model==='tfidf'){
  fit(index);
  queryVector=new Map();
  for(const[gram,count]of grams(key)){
   const featureId=index.vocabulary.get(gram);
   if(featureId===undefined)continue;
   const weight=count*index.idf[featureId];
   queryVector.set(featureId,weight);
   queryNorm+=weight*weight;
  }
  queryNorm=Math.sqrt(queryNorm);
 }else{
  queryGrams=trigrams(key);
 }

 for(const doc of index.docs){
  let score=0;

  if(model==='tfidf'){
   // Cosine similarity between the query and dictionary TF-IDF vectors.
   if(queryNorm){
    let dot=0;
    for(let i=0;i<doc.vector.length;i+=2){
     const featureId=doc.vector[i];
     dot+=(queryVector.get(featureId)||0)*doc.vector[i+1]*index.idf[featureId];
    }
    score=dot/(queryNorm*doc.norm||1);
   }
  }else{
   // Legacy Dice similarity path used only by retained evaluation code.
   const other=trigrams(doc.key);
   let overlap=0;
   for(const gram of queryGrams)if(other.has(gram))overlap++;
   score=2*overlap/(queryGrams.size+other.size||1);
  }

  const threshold=model==='tfidf'?.35:.38;
  if(score<threshold)continue;

  const limit=transformer?50:5;
  if(best.length<limit||score>best.at(-1).score){
   best.push({key:doc.key,score,rows:doc.rows});
   best.sort((a,b)=>b.score-a.score);
   if(best.length>limit)best.pop();
  }
 }

 // Operation 3: use the selected multilingual transformer to create normalized
 // embeddings, measure semantic similarity, and rerank the candidate pool.
 if(transformer&&best.length){
  if(!modelManager){
   const module=await import('./model-runtime.mjs');
   modelManager=module.createModelManager({
    isCurrent:request=>request===latestId,
    notify:(request,message)=>self.postMessage({type:'progress',id:request,message})
   });
  }

  const transformerKey=currentModels.get(id);
  const texts=[query,...best.map(candidate=>rows[candidate.rows[0]][columns[source]])];
  const vectors=await modelManager.embed(transformerKey,texts,id);
  if(!vectors||id!==latestId)return null;

  const semanticQueryVector=vectors[0];
  best.forEach((candidate,index)=>{
   let semanticScore=0;
   for(let dimension=0;dimension<semanticQueryVector.length;dimension++){
    semanticScore+=semanticQueryVector[dimension]*vectors[index+1][dimension];
   }

   candidate.characterScore=candidate.score;
   candidate.semanticScore=semanticScore;
   candidate.score=.75*candidate.characterScore+.25*semanticScore;
  });
  best.sort((a,b)=>b.score-a.score);
 }

 // app.js receives row IDs rather than generated text. It reads the associated
 // Bicol, Tagalog, and English translations directly from the dataset.
 return{status:best.length?'fuzzy':'none',matches:best.slice(0,5),transformer};
}

// Remembers which transformer belongs to each queued request.
const currentModels=new Map();

// The queue serializes model work. latestId provides cooperative cancellation:
// old searches may finish internally, but their results are never displayed.
self.onmessage=event=>{
 const msg=event.data;

 if(msg.type==='init'){
  rows=msg.rows;
  self.postMessage({type:'ready'});
  return;
 }

 if(msg.type==='cancel'){
  latestId=msg.id;
  return;
 }

 latestId=msg.id;
 currentModels.set(msg.id,msg.model);
 queue=queue.then(async()=>{
  if(msg.id!==latestId){
   currentModels.delete(msg.id);
   return;
  }

  try{
   const result=await search(msg.query,msg.source,msg.model,msg.id);
   if(result&&msg.id===latestId)self.postMessage({type:'result',id:msg.id,...result});
  }catch(error){
   if(msg.id===latestId)self.postMessage({type:'error',id:msg.id,message:error.message});
  }finally{
   currentModels.delete(msg.id);
  }
 });
};

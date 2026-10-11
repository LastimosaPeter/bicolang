/*
 * Transformer model runtime
 * -------------------------
 * This module downloads and runs one multilingual sentence-embedding model in
 * the browser worker. Embeddings are numeric vectors used only to rerank likely
 * dictionary entries; the models do not generate translated sentences.
 */

// Pinned model revisions keep the demo reproducible across deployments.
export const MODELS={
 minilm:{
  name:'Multilingual MiniLM',
  repository:'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  revision:'2c4055b12046f11709e9df2c122e59ffbdc2f900',
  dimension:384
 },
 distiluse:{
  name:'Multilingual DistilUSE',
  repository:'Xenova/distiluse-base-multilingual-cased-v2',
  revision:'cad454171d918d9873a2701ba245054b6c1760dd',
  dimension:512
 },
 mpnet:{
  name:'Multilingual MPNet',
  repository:'Xenova/paraphrase-multilingual-mpnet-base-v2',
  revision:'e5d116277351513fd260955ece953ecddde7046e',
  dimension:768
 }
};

// DistilUSE includes a trained dense layer after its 768-value pooled output.
// Apply the stored 768→512 weights, tanh activation, and L2 normalization so
// its vectors match the original SentenceTransformer architecture.
export function projectDistilUSE(vector,parameters){
 if(vector.length!==768||parameters.length!==512*769){
  throw Error('Invalid DistilUSE projection dimensions');
 }

 const output=new Float32Array(512);
 let squaredNorm=0;
 for(let row=0;row<512;row++){
  // The last 512 values are biases; the preceding values are the weight matrix.
  let value=parameters[512*768+row];
  for(let column=0;column<768;column++){
   value+=parameters[row*768+column]*vector[column];
  }
  output[row]=Math.tanh(value);
  squaredNorm+=output[row]*output[row];
 }

 const norm=Math.sqrt(squaredNorm)||1;
 for(let i=0;i<output.length;i++)output[i]/=norm;
 return output;
}

/*
 * Creates a manager that owns model loading and embedding caches.
 * - importer: loads Transformers.js lazily only when a fuzzy search needs AI.
 * - loadProjection: loads DistilUSE's trained dense-layer parameters.
 * - notify: reports download/search progress to app.js through the worker.
 * - isCurrent: stops batch work when a newer user query has replaced it.
 */
export function createModelManager({
 importer=()=>import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js'),
 loadProjection=async()=>{
  const response=await fetch('distiluse-dense.bin');
  if(!response.ok)throw Error('DistilUSE projection could not be loaded');
  return new Float32Array(await response.arrayBuffer());
 },
 notify=()=>{},
 isCurrent=()=>true,
 cacheLimit=400
}={}){
 let transformerLibrary;
 let extractor;
 let activeKey;
 let projection;
 const cache=new Map();

 // Loads exactly one model at a time. Switching models disposes the previous
 // model to reduce browser memory use, especially on phones.
 async function load(key,id){
  const model=MODELS[key];
  if(!model)throw Error('Unknown transformer model');
  if(activeKey===key&&extractor)return extractor;

  if(extractor){
   await extractor.dispose();
   extractor=null;
   activeKey=null;
   cache.clear();
  }

  notify(id,`Loading ${model.name}… First use downloads the model.`);
  transformerLibrary??=await importer();
  transformerLibrary.env.allowLocalModels=false;
  transformerLibrary.env.backends.onnx.wasm.numThreads=1;

  // Inference remains in this worker; no secondary cross-origin worker proxy.
  transformerLibrary.env.backends.onnx.wasm.proxy=false;
  extractor=await transformerLibrary.pipeline('feature-extraction',model.repository,{
   revision:model.revision,
   dtype:'q8',
   device:'wasm',
   progress_callback:progress=>{
    if(progress.status==='progress'&&isCurrent(id)){
     notify(id,`Loading ${model.name}: ${progress.file} ${Math.round(progress.progress||0)}%`);
    }
   }
  });

  if(key==='distiluse')projection??=await loadProjection();
  activeKey=key;
  return extractor;
 }

 // Converts query/candidate text into normalized vectors. Repeated text is read
 // from the cache; missing text is processed in small batches of four.
 async function embed(key,texts,id){
  await load(key,id);
  const missing=[...new Set(texts.filter(text=>!cache.has(text)))];

  for(let start=0;start<missing.length;start+=4){
   if(!isCurrent(id))return null;
   const batch=missing.slice(start,start+4);
   notify(id,`Searching with ${MODELS[key].name}…`);

   const output=await extractor(batch,{
    pooling:'mean',
    normalize:key!=='distiluse',
    truncation:true,
    max_length:128
   });

   const width=output.dims.at(-1);
   for(let i=0;i<batch.length;i++){
    const vector=Float32Array.from(output.data.subarray(i*width,(i+1)*width));
    cache.set(batch[i],key==='distiluse'?projectDistilUSE(vector,projection):vector);
   }
  }

  const result=texts.map(text=>cache.get(text));
  if(result.some(vector=>vector.length!==MODELS[key].dimension)){
   throw Error('Unexpected model embedding dimensions');
  }

  // Bound memory usage while retaining vectors required by the current search.
  if(cache.size>cacheLimit){
   const keep=new Map(texts.map(text=>[text,cache.get(text)]));
   cache.clear();
   for(const[text,vector]of keep)cache.set(text,vector);
  }
  return result;
 }

 return{
  load,
  embed,
  async dispose(){
   if(extractor)await extractor.dispose();
   extractor=null;
   activeKey=null;
   cache.clear();
  }
 };
}

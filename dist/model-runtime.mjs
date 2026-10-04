export const MODELS={
 minilm:{name:'Multilingual MiniLM',repository:'Xenova/paraphrase-multilingual-MiniLM-L12-v2',revision:'2c4055b12046f11709e9df2c122e59ffbdc2f900',dimension:384},
 distiluse:{name:'Multilingual DistilUSE',repository:'Xenova/distiluse-base-multilingual-cased-v2',revision:'cad454171d918d9873a2701ba245054b6c1760dd',dimension:512},
 mpnet:{name:'Multilingual MPNet',repository:'Xenova/paraphrase-multilingual-mpnet-base-v2',revision:'e5d116277351513fd260955ece953ecddde7046e',dimension:768}
};
export function projectDistilUSE(vector,parameters){
 if(vector.length!==768||parameters.length!==512*769)throw Error('Invalid DistilUSE projection dimensions');
 const output=new Float32Array(512);let norm=0;
 for(let r=0;r<512;r++){let value=parameters[512*768+r];for(let c=0;c<768;c++)value+=parameters[r*768+c]*vector[c];output[r]=Math.tanh(value);norm+=output[r]*output[r];}
 norm=Math.sqrt(norm)||1;for(let i=0;i<output.length;i++)output[i]/=norm;return output;
}
export function createModelManager({importer=()=>import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js'),loadProjection=async()=>{const r=await fetch('distiluse-dense.bin');if(!r.ok)throw Error('DistilUSE projection could not be loaded');return new Float32Array(await r.arrayBuffer());},notify=()=>{},isCurrent=()=>true,cacheLimit=400}={}){
 let transformerLibrary,extractor,activeKey,projection;const cache=new Map();
 async function load(key,id){
  const model=MODELS[key];if(!model)throw Error('Unknown transformer model');
  if(activeKey===key&&extractor)return extractor;
  if(extractor){await extractor.dispose();extractor=null;activeKey=null;cache.clear();}
  notify(id,`Loading ${model.name}… First use downloads the model.`);
  transformerLibrary??=await importer();
  transformerLibrary.env.allowLocalModels=false;
  transformerLibrary.env.backends.onnx.wasm.numThreads=1;
  // Browser inference stays inside this worker; disable cross-origin worker proxies.
  transformerLibrary.env.backends.onnx.wasm.proxy=false;
  extractor=await transformerLibrary.pipeline('feature-extraction',model.repository,{
   revision:model.revision,dtype:'q8',device:'wasm',
   progress_callback:p=>{if(p.status==='progress'&&isCurrent(id))notify(id,`Loading ${model.name}: ${p.file} ${Math.round(p.progress||0)}%`);}
  });
  if(key==='distiluse')projection??=await loadProjection();
  activeKey=key;return extractor;
 }
 async function embed(key,texts,id){
  await load(key,id);const missing=[...new Set(texts.filter(t=>!cache.has(t)))];
  for(let start=0;start<missing.length;start+=4){
   if(!isCurrent(id))return null;
   const batch=missing.slice(start,start+4);
   notify(id,`Searching with ${MODELS[key].name}…`);
   const output=await extractor(batch,{pooling:'mean',normalize:key!=='distiluse',truncation:true,max_length:128});
   const width=output.dims.at(-1);
   for(let i=0;i<batch.length;i++){
    const vector=Float32Array.from(output.data.subarray(i*width,(i+1)*width));
    cache.set(batch[i],key==='distiluse'?projectDistilUSE(vector,projection):vector);
   }
  }
  const result=texts.map(t=>cache.get(t));
  if(result.some(v=>v.length!==MODELS[key].dimension))throw Error('Unexpected model embedding dimensions');
  if(cache.size>cacheLimit){const keep=new Map(texts.map(t=>[t,cache.get(t)]));cache.clear();for(const[t,v]of keep)cache.set(t,v);}
  return result;
 }
 return{load,embed,async dispose(){if(extractor)await extractor.dispose();extractor=null;activeKey=null;cache.clear();}};
}

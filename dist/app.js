const $=id=>document.getElementById(id);
const panels={Bicol:$('bicolResults'),Tagalog:$('tagalogResults'),English:$('englishResults')};
const column={Bicol:0,Tagalog:2,English:1};
const worker=new Worker('retrieval-worker.js');
let rows=[],ready=false,requestId=0;
let searchTimer=null,composing=false,measurement=null;
const AUTO_SEARCH_DELAY=350;
function updateSelection(){
 globalThis.renderDirectionalPerformance?.($('model').value);
 const source=$('source').value;
 for(const [lang,id]of Object.entries({Bicol:'bicol',Tagalog:'tagalog',English:'english'})){
  const selected=lang===source;
  $(id+'Panel').classList.toggle('is-source',selected);
  $(id+'Role').textContent=selected?'Source language':'Translation';
 }
 document.querySelectorAll('#performanceTable [data-model]').forEach(row=>{
  const selected=row.dataset.model===$('model').value;
  row.classList.toggle('is-selected',selected);
  row.querySelector('.selected-model').hidden=!selected;
 });
}
function reset(){globalThis.BICOLANGSpeech?.clear();for(const [lang,panel]of Object.entries(panels)){panel.replaceChildren();const p=document.createElement('p');p.className='placeholder';p.textContent=lang==='Bicol'?'Bicol entries':lang+' translations';panel.append(p);}$('suggestions').hidden=true;}
function idle(){reset();$('searchButton').disabled=!ready;$('status').textContent=ready?'Dictionary ready · '+rows.length.toLocaleString()+' source rows':'Loading dictionary…';}
function search(){clearTimeout(searchTimer);const query=$('query').value.trim();if(!query||!ready||composing)return;globalThis.BICOLANGSpeech?.stop();const id=++requestId;measurement={id,start:performance.now(),query,language:$('source').value,model:$('model').value};$('status').textContent='Searching…';$('searchButton').disabled=true;worker.postMessage({type:'search',id,query,source:$('source').value,model:$('model').value});}
function scheduleSearch(){
 clearTimeout(searchTimer);++requestId;worker.postMessage({type:"cancel",id:requestId});
 if(!$('query').value.trim()){idle();return;}
 reset();$('searchButton').disabled=!ready;
 if(!ready)return;
 $('status').textContent='Waiting for input…';
 if(!composing)searchTimer=setTimeout(search,AUTO_SEARCH_DELAY);
}
function fill(rowIds){
 for(const[lang,panel]of Object.entries(panels)){
  panel.replaceChildren();const seen=new Set(),speechTexts=[];
  for(const id of rowIds){const row=rows[id],text=row[column[lang]],key=text.normalize('NFKC').toLowerCase();if(!text||seen.has(key))continue;seen.add(key);speechTexts.push(text);
   const item=document.createElement('div');item.className='result-item';const p=document.createElement('p');p.textContent=text;item.append(p);
   if(row[3]){const small=document.createElement('small');small.textContent=row[3];item.append(small);}if(lang==='Bicol'&&row[4]){const small=document.createElement('small');small.textContent=row[4];item.append(small);}panel.append(item);
  }
  globalThis.BICOLANGSpeech?.setText(lang,speechTexts);
  if(!seen.size){const p=document.createElement('p');p.className='placeholder';p.textContent='No translation stored';panel.append(p);}
 }
}
worker.onmessage=({data})=>{
 if(data.type==='ready'){ready=true;idle();if($('query').value.trim())scheduleSearch();return;}
 if(data.id!==requestId)return;
 if(data.type==='progress'){$('status').textContent=data.message;return;}
 $('searchButton').disabled=false;
 if(data.type==='error'){globalThis.BICOLANGMeasurements?.add({kind:'Translation',outcome:'error',ms:performance.now()-measurement.start,...measurement});measurement=null;$('status').textContent='Model could not run: '+data.message+'. Try Character TF-IDF or reload.';return;}
 reset();
 if(!data.matches.length){globalThis.BICOLANGMeasurements?.add({kind:'Translation',outcome:'no match',ms:performance.now()-measurement.start,...measurement});measurement=null;$('status').textContent=$('model').value==='exact'?'No exact entry. Try Character TF-IDF for spelling suggestions.':'No reliable match. Check the spelling or source language.';return;}
 const first=data.matches[0];fill(first.rows);globalThis.BICOLANGMeasurements?.add({kind:'Translation',outcome:data.status,ms:performance.now()-measurement.start,...measurement});measurement=null;
 $('status').textContent=data.status==='exact'?'Exact dictionary match':`Closest entry: ${rows[first.rows[0]][column[$('source').value]]} · ${(first.score*100).toFixed(1)}% ${data.transformer?'hybrid score':'similarity'}`;
 if(data.status==='fuzzy'){
  const suggestions=$('suggestions');suggestions.hidden=false; suggestions.replaceChildren(document.createTextNode('Related entries: '));
  for(const candidate of data.matches){const b=document.createElement('button');b.type='button';b.textContent=rows[candidate.rows[0]][column[$('source').value]];b.onclick=()=>{$('query').value=b.textContent;search();};suggestions.append(b);}
 }
};
$('searchForm').onsubmit=e=>{e.preventDefault();search();};
$('query').addEventListener('input',scheduleSearch);
$('query').addEventListener('compositionstart',()=>{composing=true;clearTimeout(searchTimer);++requestId;worker.postMessage({type:"cancel",id:requestId});});
$('query').addEventListener('compositionend',()=>{composing=false;scheduleSearch();});
$('model').onchange=()=>{updateSelection();if($('query').value.trim())search();};
$('source').onchange=()=>{updateSelection();if($('query').value.trim())search();};
$('clear').onclick=()=>{clearTimeout(searchTimer);++requestId;worker.postMessage({type:"cancel",id:requestId});$('query').value='';idle();$('query').focus();};
fetch('dataset.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{rows=data.rows;worker.postMessage({type:'init',rows});}).catch(()=>{$('status').textContent='Dictionary could not be loaded. Reload the page.';});
updateSelection();

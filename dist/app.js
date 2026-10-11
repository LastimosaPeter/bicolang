/*
 * BICOLANG translator-page controller
 * -----------------------------------
 * This file manages the visible interface. It does not calculate similarity or
 * run the AI models itself; those heavier operations run in retrieval-worker.js.
 *
 * Translation flow:
 * 1. Load dataset.json and send its rows to the Web Worker.
 * 2. Read the query, source language, and selected AI model.
 * 3. Ask the worker to retrieve the best dictionary entry.
 * 4. Receive dictionary row IDs and display their Bicol/Tagalog/English values.
 * 5. Store the request-to-result duration as a translation-speed trial.
 */

// Short helper for retrieving an element by its id.
const $=id=>document.getElementById(id);

// Result containers and the matching column positions in every dataset row.
// Dataset row: [Bicol, English, Tagalog, part of speech, example, sheet, row].
const panels={Bicol:$('bicolResults'),Tagalog:$('tagalogResults'),English:$('englishResults')};
const column={Bicol:0,Tagalog:2,English:1};

// Search/index/model work is placed in a Web Worker so the page remains usable.
const worker=new Worker('retrieval-worker.js');

// Shared page state. requestId lets the page ignore results from older searches.
let rows=[],ready=false,requestId=0;
let searchTimer=null,composing=false,measurement=null;
const AUTO_SEARCH_DELAY=350;

// Visually identifies the selected source-language panel.
function updateSelection(){
 const source=$('source').value;
 for(const[lang,id]of Object.entries({Bicol:'bicol',Tagalog:'tagalog',English:'english'})){
  const selected=lang===source;
  $(id+'Panel').classList.toggle('is-source',selected);
  $(id+'Role').textContent=selected?'Source language':'Translation';
 }
}

// Restores empty result panels and clears any text-to-speech content.
function reset(){
 globalThis.BICOLANGSpeech?.clear();
 for(const[lang,panel]of Object.entries(panels)){
  panel.replaceChildren();
  const placeholder=document.createElement('p');
  placeholder.className='placeholder';
  placeholder.textContent=lang==='Bicol'?'Bicol entries':lang+' translations';
  panel.append(placeholder);
 }
 $('suggestions').hidden=true;
}

// Returns the page to its ready state after loading or clearing a query.
function idle(){
 reset();
 $('searchButton').disabled=!ready;
 $('status').textContent=ready
  ?'Dictionary ready · '+rows.length.toLocaleString()+' source rows'
  :'Loading dictionary…';
}

// Sends one search request to the worker and starts its speed measurement.
function search(){
 clearTimeout(searchTimer);
 const query=$('query').value.trim();
 if(!query||!ready||composing)return;

 globalThis.BICOLANGSpeech?.stop();
 const id=++requestId;
 measurement={id,start:performance.now(),query,language:$('source').value,model:$('model').value};

 $('status').textContent='Searching…';
 $('searchButton').disabled=true;
 worker.postMessage({type:'search',id,query,source:$('source').value,model:$('model').value});
}

// Auto-search waits briefly after typing. Cancelling the previous request keeps
// slower model results from replacing a newer query.
function scheduleSearch(){
 clearTimeout(searchTimer);
 ++requestId;
 worker.postMessage({type:'cancel',id:requestId});

 if(!$('query').value.trim()){
  idle();
  return;
 }

 reset();
 $('searchButton').disabled=!ready;
 if(!ready)return;

 $('status').textContent='Waiting for input…';
 if(!composing)searchTimer=setTimeout(search,AUTO_SEARCH_DELAY);
}

// A worker result contains dataset row IDs. This maps those IDs back to all
// three languages, removes duplicate meanings, and prepares the Listen text.
function fill(rowIds){
 for(const[lang,panel]of Object.entries(panels)){
  panel.replaceChildren();
  const seen=new Set();
  const speechTexts=[];

  for(const id of rowIds){
   const row=rows[id];
   const text=row[column[lang]];
   if(!text)continue;

   const key=text.normalize('NFKC').toLowerCase();
   if(seen.has(key))continue;
   seen.add(key);
   speechTexts.push(text);

   const item=document.createElement('div');
   item.className='result-item';
   const value=document.createElement('p');
   value.textContent=text;
   item.append(value);

   // Column 3 stores the part of speech. Column 4 stores a Bikol example.
   if(row[3]){
    const partOfSpeech=document.createElement('small');
    partOfSpeech.textContent=row[3];
    item.append(partOfSpeech);
   }
   if(lang==='Bicol'&&row[4]){
    const example=document.createElement('small');
    example.textContent=row[4];
    item.append(example);
   }
   panel.append(item);
  }

  globalThis.BICOLANGSpeech?.setText(lang,speechTexts);
  if(!seen.size){
   const placeholder=document.createElement('p');
   placeholder.className='placeholder';
   placeholder.textContent='No translation stored';
   panel.append(placeholder);
  }
 }
}

// Receives progress, errors, or completed retrieval results from the worker.
worker.onmessage=({data})=>{
 if(data.type==='ready'){
  ready=true;
  idle();
  if($('query').value.trim())scheduleSearch();
  return;
 }

 // Ignore a response if the user has already started a newer request.
 if(data.id!==requestId)return;

 if(data.type==='progress'){
  $('status').textContent=data.message;
  return;
 }

 $('searchButton').disabled=false;

 if(data.type==='error'){
  globalThis.BICOLANGMeasurements?.add({kind:'Translation',outcome:'error',ms:performance.now()-measurement.start,...measurement});
  measurement=null;
  $('status').textContent='Model could not run: '+data.message+'. Try another AI model or reload.';
  return;
 }

 reset();
 if(!data.matches.length){
  globalThis.BICOLANGMeasurements?.add({kind:'Translation',outcome:'no match',ms:performance.now()-measurement.start,...measurement});
  measurement=null;
  $('status').textContent='No reliable match. Check the spelling or source language.';
  return;
 }

 // The first candidate is the best-ranked dictionary entry. One source entry
 // may point to several rows because one spelling can have several senses.
 const first=data.matches[0];
 fill(first.rows);
 globalThis.BICOLANGMeasurements?.add({kind:'Translation',outcome:data.status,ms:performance.now()-measurement.start,...measurement});
 measurement=null;

 $('status').textContent=data.status==='exact'
  ?'Exact dictionary match'
  :`Closest entry: ${rows[first.rows[0]][column[$('source').value]]} · ${(first.score*100).toFixed(1)}% ${data.transformer?'hybrid score':'similarity'}`;

 // Other top candidates are shown as clickable related entries.
 if(data.status==='fuzzy'){
  const suggestions=$('suggestions');
  suggestions.hidden=false;
  suggestions.replaceChildren(document.createTextNode('Related entries: '));
  for(const candidate of data.matches){
   const button=document.createElement('button');
   button.type='button';
   button.textContent=rows[candidate.rows[0]][column[$('source').value]];
   button.onclick=()=>{$('query').value=button.textContent;search();};
   suggestions.append(button);
  }
 }
};

// Translator-page events.
$('searchForm').onsubmit=event=>{event.preventDefault();search();};
$('query').addEventListener('input',scheduleSearch);

// Composition events prevent partial searches while an input method editor is
// still composing a character or word.
$('query').addEventListener('compositionstart',()=>{
 composing=true;
 clearTimeout(searchTimer);
 ++requestId;
 worker.postMessage({type:'cancel',id:requestId});
});
$('query').addEventListener('compositionend',()=>{composing=false;scheduleSearch();});

$('model').onchange=()=>{updateSelection();if($('query').value.trim())search();};
$('source').onchange=()=>{updateSelection();if($('query').value.trim())search();};
$('clear').onclick=()=>{
 clearTimeout(searchTimer);
 ++requestId;
 worker.postMessage({type:'cancel',id:requestId});
 $('query').value='';
 idle();
 $('query').focus();
};

// Load the full dictionary once. The UI keeps the rows for display while the
// worker builds source-language indexes for retrieval.
fetch('dataset.json')
 .then(response=>{if(!response.ok)throw Error();return response.json();})
 .then(data=>{rows=data.rows;worker.postMessage({type:'init',rows});})
 .catch(()=>{$('status').textContent='Dictionary could not be loaded. Reload the page.';});

updateSelection();

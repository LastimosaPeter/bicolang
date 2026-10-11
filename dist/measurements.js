/*
 * Translation-speed measurement store
 * -----------------------------------
 * app.js measures from worker request to displayed result. This module saves
 * only those translation trials, renders the latest/mean time, and exports CSV.
 * It deliberately ignores text-to-speech because TTS is outside the study's
 * live speed measurement scope.
 */
(()=>{
 const key='bicolang-translation-trials-v1';
 let records=[];

 // Restore trials saved by this browser. A storage error leaves an empty list.
 try{
  records=JSON.parse(localStorage.getItem(key)||'[]');
  if(!Array.isArray(records))records=[];
 }catch{}

 // Store a sanitized measurement and retain no more than the latest 500 trials.
 function add(record){
  if(record.kind!=='Translation')return;
  const{start,id,...fields}=record;
  records.push({...fields,timestamp:new Date().toISOString(),userAgent:navigator.userAgent});
  records=records.slice(-500);
  try{localStorage.setItem(key,JSON.stringify(records));}catch{}
  globalThis.dispatchEvent(new Event('bicolang-trials'));
  render();
 }

 // Clear the in-memory list and its browser-local persisted copy.
 function clear(){
  records=[];
  try{localStorage.removeItem(key);}catch{}
  globalThis.dispatchEvent(new Event('bicolang-trials'));
  render();
 }

 // Exact and fuzzy outcomes are successful translations. Errors and no-match
 // trials remain exportable but are excluded from the displayed mean.
 function render(){
  const target=document.getElementById('timingCards');
  if(!target)return;
  const successful=records.filter(record=>
   ['exact','fuzzy'].includes(record.outcome)&&Number.isFinite(record.ms)
  );

  const card=document.createElement('div');
  const title=document.createElement('strong');
  const value=document.createElement('span');
  const detail=document.createElement('small');
  title.textContent='Translation';
  value.textContent=successful.length
   ?(successful.at(-1).ms/1000).toFixed(3)+' s'
   :'—';
  detail.textContent=successful.length
   ?`Mean ${(successful.reduce((sum,record)=>sum+record.ms,0)/successful.length/1000).toFixed(3)} s · ${successful.length} successful trials`
   :'Run a search to measure';
  card.append(title,value,detail);
  target.replaceChildren(card);
 }

 // Quote every CSV value and prefix formula-like input to make spreadsheet
 // imports safer when a user searches text beginning with =, +, -, or @.
 function csv(){
  const columns=['timestamp','language','model','query','outcome','ms','userAgent'];
  const cell=value=>'"'+String(value??'').replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
  return columns.join(',')+'\n'
   +records.map(record=>columns.map(column=>cell(record[column])).join(',')).join('\n');
 }

 // testing.mjs reads and exports trials through this public interface.
 globalThis.BICOLANGMeasurements={
  add,
  clear,
  list:()=>records.map(record=>({...record})),
  csv
 };
 render();
})();

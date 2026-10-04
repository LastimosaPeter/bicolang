(()=>{
 let report;
 const pct=value=>(value*100).toFixed(2)+'%';
 const names={bicol_to_english:'Bicol → English',english_to_bicol:'English → Bicol',bicol_to_tagalog:'Bicol → Tagalog',tagalog_to_bicol:'Tagalog → Bicol'};
 globalThis.renderDirectionalPerformance=modelKey=>{
  if(!report)return;
  const model=report.models[modelKey];if(!model)return;
  document.getElementById('directionHeading').textContent=model.name+' · results by direction';
  const body=document.getElementById('directionRows');body.replaceChildren();
  for(const[key,name]of Object.entries(names)){
   const data=model.directions[key],s=data.spelling,w=data.syntax_proxy;
   const row=document.createElement('tr');
   for(const value of[name,pct(s.rank1),pct(s.hit5),pct(w.rank1),pct(s.coverage)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);
  }
 };
 fetch('benchmark.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{report=data;globalThis.renderDirectionalPerformance(document.getElementById('model').value);}).catch(()=>{document.getElementById('directionHeading').textContent='Directional results unavailable. Download the CSV for all results.';});
})();

/*
 * Dataset browser
 * ---------------
 * Loads the same dictionary used by the translator, filters any displayed
 * field, filters by worksheet, and paginates the table without a backend.
 */
const $=id=>document.getElementById(id);
let rows=[];
let filtered=[];
let page=0;
const PAGE_SIZE=50;

// Render only the current 50-row page to keep the table responsive.
function render(){
 const start=page*PAGE_SIZE;
 $('datasetRows').replaceChildren();

 for(const row of filtered.slice(start,start+PAGE_SIZE)){
  const tableRow=document.createElement('tr');
  // Display order differs from storage order: Bicol, Tagalog, English, metadata.
  for(const column of[0,2,1,3,4,5,6]){
   const cell=document.createElement('td');
   cell.textContent=String(row[column]||'—');
   tableRow.append(cell);
  }
  $('datasetRows').append(tableRow);
 }

 $('datasetStatus').textContent=filtered.length.toLocaleString()+' matching rows';
 $('pageInfo').textContent=filtered.length
  ?`${start+1}–${Math.min(start+PAGE_SIZE,filtered.length)} of ${filtered.length.toLocaleString()}`
  :'No matches';
 $('previous').disabled=page===0;
 $('next').disabled=start+PAGE_SIZE>=filtered.length;
}

// Search is case-insensitive and checks the three languages plus entry metadata.
function filter(){
 const query=$('filter').value.normalize('NFKC').toLowerCase().trim();
 const sheet=$('sheet').value;
 filtered=rows.filter(row=>
  (!sheet||row[5]===sheet)
  &&(!query||row.slice(0,6).some(value=>value.normalize('NFKC').toLowerCase().includes(query)))
 );
 page=0;
 render();
}

// Debouncing avoids filtering all 41,504 rows after every rapid keystroke.
let timer;
$('filter').oninput=()=>{clearTimeout(timer);timer=setTimeout(filter,150);};
$('sheet').onchange=filter;
$('previous').onclick=()=>{page--;render();};
$('next').onclick=()=>{page++;render();};

// Populate both the worksheet selector and the first table page after loading.
fetch('dataset.json')
 .then(response=>{if(!response.ok)throw Error();return response.json();})
 .then(data=>{
  rows=data.rows;
  for(const name of new Set(rows.map(row=>row[5]))){
   const option=document.createElement('option');
   option.value=name;
   option.textContent=name;
   $('sheet').append(option);
  }
  filtered=rows;
  render();
 })
 .catch(()=>{$('datasetStatus').textContent='Dataset could not be loaded. Reload the page.';});

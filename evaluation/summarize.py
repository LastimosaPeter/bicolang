import json,csv,math,hashlib
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
predictions=json.loads((ROOT/'evaluation/predictions.json').read_text())
MODELS={'tfidf':'Character TF-IDF','exact':'Exact dictionary lookup','dice':'Character trigram similarity','minilm':'Multilingual MiniLM (hybrid)','distiluse':'Multilingual DistilUSE (hybrid)','mpnet':'Multilingual MPNet (hybrid)'}
expected={(model,direction,test) for model in MODELS for direction in ['bicol_to_english','english_to_bicol','bicol_to_tagalog','tagalog_to_bicol'] for test in ['spelling','syntax_proxy']}
assert len(predictions)==2400,len(predictions)
assert len({(p['model'],p['id']) for p in predictions})==2400
assert {(p['model'],p['direction'],p['test_type']) for p in predictions}==expected

def metrics(group):
 n=len(group);success=sum(p['hit1'] for p in group);accuracy=success/n;z=1.95996398454;den=1+z*z/n;center=(accuracy+z*z/(2*n))/den;delta=z*math.sqrt(accuracy*(1-accuracy)/n+z*z/(4*n*n))/den
 answered=sum(p['answered'] for p in group)
 return {'n':n,'rank1_correct':success,'rank1':accuracy,'hit5':sum(p['hit5'] for p in group)/n,'mrr':sum(p['mrr'] for p in group)/n,'coverage':answered/n,'selective_accuracy':sum(p['hit1'] for p in group if p['answered'])/answered if answered else None,'rank1_ci95_low':max(0,center-delta),'rank1_ci95_high':min(1,center+delta)}
records=[];models={}
for key,name in MODELS.items():
 models[key]={'name':name,'tests':{},'directions':{}}
 for test in ['spelling','syntax_proxy']:
  group=[p for p in predictions if p['model']==key and p['test_type']==test];m=metrics(group);models[key]['tests'][test]=m;records.append({'model':key,'model_name':name,'direction':'overall','test_type':test,**m})
  for direction in sorted({p['direction'] for p in group}):
   subset=[p for p in group if p['direction']==direction];assert len(subset)==50
   m=metrics(subset);models[key]['directions'].setdefault(direction,{})[test]=m;records.append({'model':key,'model_name':name,'direction':direction,'test_type':test,**m})
meta={'measured_at':datetime.now(timezone.utc).isoformat(),'seed':42,'test_queries':400,'per_direction_per_test':50,'evaluations':2400,'dataset_sha256':hashlib.sha256((ROOT/'dist/dataset.json').read_bytes()).hexdigest(),'queries_sha256':hashlib.sha256((ROOT/'evaluation/test_queries.json').read_bytes()).hexdigest(),'scope':'Synthetic spelling and adjacent-word-swap recovery from dictionary sources; not external translation accuracy. Exact matching and abstention are included.','inference':'Transformers.js 3.8.1; q8 ONNX weights; Node CPU inference; production retrieval worker. Hybrid weights: 0.75 character + 0.25 embedding. Browser WASM and CPU may have small numerical differences.','models':models,'external_translation_test':'Pending human verification'}
meta['known_entry_control']={r['model']:r for r in json.loads((ROOT/'evaluation/known_entry_controls.json').read_text())}
meta['known_entry_control_note']='Direct lookup of original indexed sources, not generalization accuracy.'
meta['confidence_interval_note']='Wilson intervals are descriptive pilot intervals; repeated dictionary senses and shared directions are not independent.'
(ROOT/'dist/benchmark.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
controls={r['model']:r for r in json.loads((ROOT/'evaluation/known_entry_controls.json').read_text())}
for r in records:r['known_entry_lookup']=controls[r['model']]['accuracy']
with (ROOT/'dist/performance.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
for key,m in models.items():
 s=m['tests']['spelling'];w=m['tests']['syntax_proxy'];print(key,round(s['rank1']*100,2),round(s['hit5']*100,2),round(w['rank1']*100,2),round(s['coverage']*100,2))

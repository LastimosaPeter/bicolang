import ast,json,re,hashlib,unicodedata,argparse
from pathlib import Path
import pandas as pd
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('notebook',type=Path);args=parser.parse_args()
notebook=json.loads(args.notebook.read_text())
wanted={'normalize_display','normalize_key','stable_number','make_spelling_perturbation','make_word_order_perturbation','make_evaluation_set'}
namespace={'re':re,'hashlib':hashlib,'unicodedata':unicodedata,'MIN_WORDS_FOR_SYNTAX_TEST':2}
for cell in notebook['cells']:
 if cell['cell_type']!='code':continue
 try:tree=ast.parse(''.join(cell['source']))
 except SyntaxError:continue
 for node in tree.body:
  if isinstance(node,ast.FunctionDef) and node.name in wanted:
   exec(compile(ast.Module(body=[node],type_ignores=[]),'<notebook>','exec'),namespace)
normalize=namespace['normalize_key']
rows=json.loads((ROOT/'dist/dataset.json').read_text())['rows']
directions={'bicol_to_english':('Bicol',0,1),'english_to_bicol':('English',1,0),'bicol_to_tagalog':('Bicol',0,2),'tagalog_to_bicol':('Tagalog',2,0)}
tests=[]
for direction,(lang,source,target)in directions.items():
 index={}
 for r in rows:
  key=normalize(r[source]);value=normalize(r[target])
  if not key or not value:continue
  if key not in index:index[key]={'source_text':r[source],'source_key':key,'target_keys':set()}
  index[key]['target_keys'].add(value)
 candidates=pd.DataFrame([index[k] for k in sorted(index)])
 for test_type in ['spelling','syntax_proxy']:
  evaluation=namespace['make_evaluation_set'](candidates,test_type,50,42)
  for i,r in evaluation.iterrows():tests.append({'id':f'{direction}_{test_type}_{i+1:03d}','direction':direction,'source':lang,'target_column':target,'test_type':test_type,'original':r['source_text'],'query':r['query_text'],'references':sorted(r['target_keys'])})
output={'sample_size_per_direction_and_test':50,'seed':42,'tests':tests}
(ROOT/'evaluation/test_queries.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
print('Prepared',len(tests),'queries; 50 per direction per test; seed 42')

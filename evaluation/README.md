# BICOLANG pilot benchmark

The same 400 deterministic queries are used for all six methods: 50 spelling
perturbations and 50 adjacent-word swaps in each of four translation directions.
Sources are sampled with seed 42 using the revised notebook's perturbation rules.
`test_queries.json` contains the complete fixed inputs and reference translations.

Run from this directory:

```
npm install
npm run benchmark
node check_known_entries.mjs
python3 summarize.py
python3 render_performance.py
```

If the environment needs a network proxy, configure it before running. Optionally
set BICOLANG_MODEL_CACHE to reuse downloaded model assets. Execution uses the
production retrieval worker and model manager; quantized ONNX model inference
runs with the Node CPU backend rather than browser WASM. All models use the same
exact-first retrieval rules, thresholds, candidate limit, and hybrid weights as
the website. The benchmark increases only the embedding cache size and sets CPU
thread counts to make repeated inference practical.

Rank-1 is correct when any translation associated with the first returned source
matches any accepted dictionary reference after normalization. Hit@5 applies the
same rule across five returned sources. Abstentions count as incorrect. MRR uses
the first relevant source rank. Coverage counts queries receiving a result.
Selective accuracy is accuracy among those queries only. Rank-1 confidence
intervals use Wilson's 95% formula; test items sharing dictionary senses are not
fully independent, so these are descriptive pilot intervals.

Word-order recovery measures retrieval after a swap, not grammatical correctness.
These generated tests do not establish unseen translation accuracy. The human-
verified external test remains pending. Historical and ambiguous dictionary
entries may limit translation-reference quality.

`predictions.json` retains every prediction and per-query correctness result.
The website's `benchmark.json` records aggregates and input hashes.

The unchanged-entry control evaluates 400 original indexed queries per method.
Its score checks dictionary consistency and does not establish generalization.

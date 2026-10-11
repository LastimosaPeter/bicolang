BICOLANG: An AI-Supported Bikol Naga Translator

Serve this folder through a static web host. For a local demonstration:
  python3 -m http.server 8000
Open http://localhost:8000 in your browser.

index.html: translator
dataset.html: all 41,504 source rows
about.html: six project members

User-selectable AI models: MiniLM, DistilUSE, and MPNet.
Each option uses exact-first dictionary lookup, character TF-IDF candidate
retrieval, and transformer reranking when an exact entry is unavailable.
Transformers run locally in a browser worker, using Transformers.js 3.8.1,
pinned Xenova ONNX revisions, q8 quantization, and mean-pooled embeddings.
DistilUSE applies its original trained 768-to-512 tanh projection after pooling.
The projection binary contains the weight matrix followed by the bias vector.
The corresponding original model revision is:
bfe45d0732ca50787611c0fe107ba278c7f3f889.

AI model searches use exact-first lookup, then TF-IDF(2,5) candidate retrieval
and 75% character similarity + 25% normalized embedding similarity reranking.
First model use requires Internet access and a download of approximately
120–280 MB of weights (plus tokenizer/runtime files), cached by the browser.
Only one transformer is held in memory at a time.
Model download failures are displayed; the UI does not substitute another model.

No API keys are required. Queries are embedded locally; downloads contact
Hugging Face and jsDelivr. Exact matches bypass transformer inference.

Full-sentence generation is unsupported. Model evaluation belongs in the paper
and is not presented as part of the website interface.

Brand assets: START (30) background and START (31) transparent logo.
Typography: locally installed Gotham, then bundled Montserrat variable font.
Montserrat is licensed under SIL OFL; fonts/OFL.txt includes the license.
Listen/Stop controls use browser SpeechSynthesis with device voices.
When no native Bikol voice exists, Filipino or another device voice is used
and approximate Bikol pronunciation is labeled. Speech quality and available
voices depend on the browser and operating system; no native Bikol TTS model
is bundled. New searches cancel playback.

The Testing page records translation speed only and can export its browser-local
trial log as CSV. The site does not include microphone input, speech-to-text,
intonation trials, or STT/TTS speed measurements.

# BICOLANG

An AI-Supported Bikol Naga Translator. Static HTML, CSS and JavaScript with Bicol, Tagalog and English panels, automatic search, six retrieval methods, model measurements, the full dataset, team page browser text-to-speech, speech input, live speed measurements and experimental intonation trials.

## Deploy from GitHub to Vercel

1. Extract the ZIP. Upload its contents to the root of a new GitHub repository. Keep `vercel.json`, `README.md`, `dist/` and `evaluation/` at that root. Upload the extracted files, not the ZIP itself.
2. In Vercel, select **Add New → Project**, connect GitHub and import the repository.
3. Leave **Root Directory** at the repository root. Use the **Other** framework preset. The included `vercel.json` sets the output directory to `dist` and skips install/build commands.
4. Select **Deploy**. The home page is `/`, with `/dataset.html`, `/about.html` and `/testing.html`.
5. Future commits to the connected production branch update the deployment.

No backend, API key, environment variables or production npm installation is required. The `evaluation/` package is optional benchmark tooling and is not deployed or installed by the static website configuration.

Official references: https://vercel.com/docs/project-configuration/vercel-json and https://vercel.com/docs/git/vercel-for-github

## Preview locally

From the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Use an HTTP server rather than opening HTML files directly, because dictionary loading and workers need HTTP.

## Runtime notes

The site is dictionary-based; word and dataset phrase searches are supported. Exact entries bypass transformer downloads. For related-entry AI reranking, the selected model downloads from Hugging Face on first use (roughly 120–280 MB, depending on the model), then runs in the browser. Internet access is needed for the initial model/runtime download. Downloads and inference can be slower on phones. Browser caches may be cleared by the device.

Listen buttons use installed browser/device voices. Native Bikol voices may be absent; the interface marks fallback pronunciation as approximate. Speech support varies by browser.

The supplied background is displayed at 90% opacity (a 10% white wash). Phone layouts stack the language panels and controls; data tables scroll inside their own containers.

See `dist/README.txt` for model details and `evaluation/README.md` for measurement scope and reproduction. Montserrat font licensing is included in `dist/fonts/OFL.txt`.

## Speech input and testing

Speech input uses Web Speech SpeechRecognition when available. Recognition languages are explicitly selectable: Filipino, English, and experimental Bikol Naga. The browser may reject unsupported languages or send audio to its online recognition service. A recognition language does not change the dictionary source language; choose both appropriately. Review recognized text before relying on a translation. No native Bikol speech model is bundled.

The Testing page measures an experimental pitch contour locally through Web Audio microphone samples. Normalized autocorrelation estimates 70–500 Hz pitch from 4096-sample frames every 60 ms; RMS below .01 or correlation below .75 is rejected. At least 12 voiced frames are required. Median pitch in the first/last thirds is compared in semitones, with ±2 semitones as the experimental rising/falling thresholds. The result is agreement with a user-selected pattern, not validated pronunciation accuracy or meaning discrimination. No microphone audio is stored by the pitch test. These thresholds require validation with labeled native-speaker recordings before use as research evidence.

Translation timing excludes the automatic-search debounce and includes model downloads/index construction when needed. STT timing includes recording/permission time; speech-end-to-result is separately recorded when available. TTS records request-to-first-audio latency and audio duration across all spoken segments. Cancelled and failed events remain in the CSV and are excluded from successful timing averages. Measurements use the monotonic browser performance clock, not Python's Time module. Trial logs (including tested text) are stored in localStorage, limited to the latest 500 records; export CSV on the Testing page. The log view shows the latest 100. If browser storage is unavailable, trials remain in memory until the page closes. Clear removes all saved trials after confirmation.

These additions do not add sentence generation, an OpenAI translation API, or validated language-level intonation evaluation.

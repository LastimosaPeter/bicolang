# BICOLANG

An AI-Supported Bikol Naga Translator. Static HTML, CSS and JavaScript with Bicol, Tagalog and English panels, automatic search, three multilingual AI models, browser text-to-speech, the full dataset, a team page, and translation-speed testing.

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

The site is dictionary-based; word and dataset phrase searches are supported. Users can select Multilingual MiniLM, Multilingual DistilUSE, or Multilingual MPNet. Every AI option performs exact-first dictionary lookup, then uses character retrieval and transformer reranking when an exact entry is unavailable. The selected model downloads from Hugging Face on first use (roughly 120–280 MB, depending on the model), then runs in the browser. Internet access is needed for the initial model/runtime download. Downloads and inference can be slower on phones. Browser caches may be cleared by the device.

Listen buttons use installed browser/device voices. Native Bikol voices may be absent; the interface marks fallback pronunciation as approximate. Speech support varies by browser.

The supplied background is displayed at 90% opacity (a 10% white wash). Phone layouts stack the language panels and controls; data tables scroll inside their own containers.

See `dist/README.txt` for model details and `evaluation/README.md` for measurement scope and reproduction. Montserrat font licensing is included in `dist/fonts/OFL.txt`.

## Code guide

See [`CODE_GUIDE.md`](CODE_GUIDE.md) for a file-by-file explanation and a walkthrough of the exact lookup, TF-IDF candidate retrieval, model reranking, result display, text-to-speech, and translation-speed operations. The JavaScript files also include inline comments beside the relevant code.

## Translation-speed testing

Translation timing excludes the automatic-search debounce and begins when a request is sent to the retrieval worker. It ends when a result is displayed. First-use trials may include model downloads and index construction. Failed and no-match searches remain in the CSV, while the displayed mean uses successful exact and fuzzy results only. Measurements use the browser's monotonic performance clock. Trial logs are stored in localStorage, limited to the latest 500 records; the Testing page displays the latest 100 and supports CSV export. If browser storage is unavailable, trials remain in memory until the page closes.

The site does not include speech-to-text, microphone input, intonation testing, or model-performance tables. Text-to-speech remains available as a user feature but is not included in the live speed measurements.

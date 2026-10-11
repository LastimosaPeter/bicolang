# BICOLANG Code Guide

This guide explains how the static website is organized and how a search becomes a displayed translation. The site runs entirely in the browser and does not require a backend or API key.

## Translation pipeline

1. `dist/app.js` loads `dist/dataset.json` and creates the retrieval worker.
2. The user enters a word or dataset phrase, chooses Bicol, Tagalog, or English as the source, and chooses an AI model.
3. `dist/retrieval-worker.js` normalizes the query using Unicode NFKC, lowercase conversion, whitespace cleanup, and punctuation cleanup.
4. The worker first checks an exact lookup table. Exact matches return immediately and do not run the selected embedding model.
5. If no exact entry exists, character TF-IDF retrieves a candidate pool from the source-language column. It uses character n-grams of length 2 through 5, a candidate threshold of `0.35`, and keeps at most 50 candidates.
6. `dist/model-runtime.mjs` loads the selected multilingual transformer and creates embeddings for the query and candidate text.
7. The worker reranks candidates with a hybrid score: 75% character similarity plus 25% semantic cosine similarity.
8. The worker returns up to five dictionary row IDs. It does not invent or generate new translations.
9. `dist/app.js` maps each row ID back to the Bicol, English, and Tagalog columns and renders all three panels.
10. `dist/measurements.js` records elapsed time from the worker request until the displayed result. `dist/speech.js` can then read the displayed text aloud, but text-to-speech is not part of translation retrieval or timing.

## Dictionary row format

Each entry in `dist/dataset.json` uses this array order:

```text
[Bicol, English, Tagalog, part of speech, example, worksheet, Excel row]
```

The display order is Bicol, Tagalog, English, so the page controller deliberately maps storage columns `0`, `2`, and `1`.

## Main files

| File | Responsibility |
| --- | --- |
| `dist/index.html` | Translator controls, three language panels, Listen buttons, and speed summary. |
| `dist/app.js` | Main page controller: loads data, starts searches, ignores stale results, maps dictionary rows, renders suggestions, and records speed. |
| `dist/retrieval-worker.js` | Exact dictionary lookup, character TF-IDF retrieval, transformer reranking, and top-result selection in a background worker. |
| `dist/model-runtime.mjs` | Downloads, caches, and runs MiniLM, DistilUSE, or MPNet embeddings in the browser. |
| `dist/speech.js` | Uses the browser Speech Synthesis API to read displayed results. It does not translate text. |
| `dist/measurements.js` | Stores the latest 500 translation trials in `localStorage`, calculates successful-trial summaries, and creates CSV data. |
| `dist/dataset.html` / `dist/dataset.js` | Displays, searches, filters, and paginates all dataset rows. |
| `dist/testing.html` / `dist/testing.mjs` | Displays saved translation-speed trials and supports CSV export or clearing. |
| `dist/about.html` | Project description and member list. |
| `dist/styles.css` | Shared branding, desktop layout, mobile layout, background, tables, panels, and testing styles. |

## Model behavior

The model selector chooses the embedding model used only when exact lookup fails:

- Multilingual MiniLM: compact and normally the fastest option.
- Multilingual DistilUSE: multilingual embeddings with a projection step in the local runtime.
- Multilingual MPNet: larger multilingual embeddings and normally the heaviest option.

Models are loaded lazily on first use. The first fuzzy search can therefore include model download and index-building time. Later searches can reuse browser and in-memory caches. Only one model stays active at a time to reduce memory use.

## Supporting features

- Automatic search uses a short debounce so rapid typing does not start a request for every keystroke.
- Each request receives an ID. A late response is ignored if a newer request has already started.
- Text-to-speech uses installed device voices; Bikol may fall back to an approximate voice.
- Translation timing excludes the typing debounce but can include first-use model loading.
- The static dataset page searches locally; it does not call a remote search service.

The JavaScript source contains inline comments beside the relevant operations for more detailed implementation notes.

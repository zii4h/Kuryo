# Curiosity

A single centered input for live, source-linked discovery. Enter any topic supported by English Wikipedia, or press the dice to discover a random article. Answers are short excerpts selected from article text, not AI-generated claims. No preset category list or published trivia collection limits topic search.

## Run and publish

Run `npm start`, then open http://127.0.0.1:3000. Node.js 20+ is required for the local preview. Run `npm run build` and upload the contents of `dist/` to a static host. Visitors need no Ollama installation, account, API key, or model download. The published site works when your computer is off.

Wikipedia receives the topic lookup and the visitor’s network request. Internet access is required. Its public API can rate-limit requests; this app does not promise unlimited service availability. It caches recent results in browser memory and renders external content as text. No analytics or prompt logging is added by the app.

Each excerpt links to its source revision and includes Wikipedia/CC BY-SA attribution. Wikipedia can contain errors and is not a substitute for primary-source research. The app preserves source wording; it does not independently verify claims. Paragraphs with scientific superscripts or subscripts are excluded to avoid flattening formulas into misleading numbers. Selection favors short sentences with distinctive details. Random articles can be obscure, and available excerpts can repeat.

`npm test` checks live-query construction, caching, source links, random lookup, missing results, and formula handling. Real lookups were verified for ancient Rome, black holes, coffee, and random articles. Browser rendering was not verified because no browser automation surface was available.

The old Ollama workbench remains on `archive/local-lab`; the fixed trivia version remains in Git history at `91e5472`. This change updates the local app; no remote push or public deployment is performed.

API documentation: https://www.mediawiki.org/wiki/API:Search, https://www.mediawiki.org/wiki/Extension:TextExtracts, https://www.mediawiki.org/wiki/API:Random.

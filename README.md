# Curiosity

One input, centered on the screen. Enter a topic or press the dice for a random interesting fact. A concise answer and its source appear below. There is no dashboard, model selector, signup, or visible content before the first request.

## Run

Node.js 20+ is required only for the local preview and optional authoring scripts.

```text
npm start
```

Open http://127.0.0.1:3000. No npm dependencies or Ollama installation are required to browse the site. If port 3000 is occupied, set `PORT` before starting; in PowerShell, use `$env:PORT = '3001'`.

## Publish

```text
npm run build
```

Upload the contents of `dist/` to any static website host, including GitHub Pages, Cloudflare Pages, or Netlify. The site works under a subdirectory because scripts and content use relative URLs. Your computer can be off after publication. Publishing is not automatic and this change does not create or configure a hosting account.

## The chosen tradeoff

This is a **published fact library**, not a live AI service. It has 32 concise, source-backed entries across space, animals, ocean, nature, food, technology, and history. Facts cite NASA, NOAA, Smithsonian, Kew, NIST, GPS.gov, the National Park Service, and the British Museum. Source support was checked during preparation on October 14, 2026; published statements can still need later correction.

Selection and topic matching run in the visitor’s browser. No API credits, generation quota, model download, always-on Ollama server, or runtime external requests are involved. There is no analytics or prompt logging. Static hosting can still have bandwidth/availability limits. The library is finite: facts repeat after the matching selection has been explored. Uncovered topics show suggestions instead of fabricated answers. Search matches keywords and aliases, not arbitrary conversational instructions.

## Optional offline Ollama authoring

Ollama is useful **before publication**, on the editor’s computer. Start Ollama with `llama3.2:latest` installed, then run:

```text
npm run draft -- venus-day
```

This passes the entry’s source-backed evidence to the local model and prints a proposed title and text. Use `OLLAMA_MODEL` to choose another installed model. This command was verified with a real local `llama3.2:latest` model. It never edits published content automatically: check every drafted claim against the source before copying it into `content/facts.json`. Model output is not a fact-check.

To add an entry, include a unique ID, topic, tags, short title/text, HTTPS source URL and publisher, a concise evidence summary, and review date. Keep uncertainty and measurement qualifiers. Avoid viral facts with missing evidence or misleading comparisons. Rebuild after editing the library.

## Checks and branches

`npm test` checks source metadata, category coverage, subject matching, no-repeat selection, indefinite cycling, safe source links, and the static server. Client flow checks cover the initially empty screen, random/topic requests, source display, unsupported topics, and loading failures. Browser rendering requires a manual check; no browser automation surface was available in this session.

The prior local AI workbench is preserved on `archive/local-lab`. This direction is developed on `feature/curiosity` and promoted to local `main` when checks pass. No remote push or public deployment is performed.

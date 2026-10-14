import { createFactPicker, TOPICS } from './library.js';
const $ = id => document.getElementById(id);
let picker, currentQuery = '', loading;
async function loadLibrary() {
  if (!loading) loading = fetch(new URL('../content/facts.json', import.meta.url))
    .then(response => { if (!response.ok) throw new Error('Library unavailable'); return response.json(); })
    .then(data => { picker = createFactPicker(data.facts); return picker; })
    .catch(error => { loading = null; throw error; });
  return loading;
}
function status(text) { $('status').textContent = text; $('status').hidden = !text; }
function renderFact(fact) {
  $('result-label').textContent = `Did you know? · ${fact.topic}`;
  $('fact-title').textContent = fact.title;
  $('fact-text').textContent = fact.text;
  $('source').textContent = `Source: ${fact.source.publisher} ↗`;
  $('source').href = fact.source.url;
  $('source').title = fact.source.title;
  $('result-footer').hidden = false;
  $('suggestions').hidden = true;
  $('result').hidden = false;
}
function renderMissing() {
  $('result-label').textContent = 'A little curiosity, a little patience';
  $('fact-title').textContent = 'That topic isn’t in the library yet.';
  $('fact-text').textContent = 'Try one of these topics, or roll the dice for a surprise.';
  $('result-footer').hidden = true;
  $('suggestions').replaceChildren();
  TOPICS.forEach(topic => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = topic;
    button.onclick = () => { $('topic').value = topic; discover(topic); };
    $('suggestions').append(button);
  });
  $('suggestions').hidden = false;
  $('result').hidden = false;
}
async function discover(query = $('topic').value.trim()) {
  if ($('discover').disabled) return;
  $('discover').disabled = true; $('surprise').disabled = true; $('another').disabled = true;
  try {
    const library = await loadLibrary();
    const result = library.pick(query);
    currentQuery = query;
    if (result.fact) {
      renderFact(result.fact);
      status(result.repeated ? 'You’ve explored this selection. Rediscovering a fact from the published library.' : 'From the published fact library. No live AI generation.');
    } else { renderMissing(); status(''); }
  } catch {
    status('The fact library couldn’t load. Check your connection and try again.');
  } finally { $('discover').disabled = false; $('surprise').disabled = false; $('another').disabled = false; }
}
$('curiosity-form').onsubmit = event => { event.preventDefault(); discover(); };
$('surprise').onclick = () => { $('topic').value = ''; discover(''); };
$('another').onclick = () => discover(currentQuery);
// Fetch only the small published library. No model download or runtime API.
loadLibrary().catch(() => {});

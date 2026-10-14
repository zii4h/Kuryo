import { createDiscovery } from './discovery.js';
const $ = id => document.getElementById(id);
const discovery = createDiscovery();
let currentQuery = '', controller;
function status(text) { $('status').textContent = text; $('status').hidden = !text; }
function renderFact(fact) {
  $('result-label').textContent = 'A detail worth knowing';
  $('fact-title').textContent = fact.title;
  $('fact-text').textContent = fact.text;
  $('source').textContent = 'From Wikipedia ↗';
  $('source').href = fact.source.url;
  $('source').title = fact.source.title;
  $('result-footer').hidden = false;
  $('suggestions').hidden = true;
  $('result').hidden = false;
}
function renderMissing(suggestion) {
  $('result-label').textContent = 'Keep exploring';
  $('fact-title').textContent = 'No matching article turned up.';
  $('fact-text').textContent = 'Try a different spelling or a more specific topic. You can also roll the dice.';
  $('result-footer').hidden = true;
  $('suggestions').replaceChildren();
  if (suggestion) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `Try “${suggestion}”`;
    button.onclick = () => { $('topic').value = suggestion; discover(suggestion); };
    $('suggestions').append(button);
  }
  $('suggestions').hidden = !suggestion;
  $('result').hidden = false;
}
async function discover(query = $('topic').value.trim()) {
  controller?.abort();
  const request = new AbortController(); controller = request;
  $('discover').disabled = true; $('surprise').disabled = true; $('another').disabled = true;
  $('curiosity-form').setAttribute('aria-busy','true');
  status(query ? 'Looking for an interesting detail…' : 'Following a random thread of curiosity…');
  try {
    const result = await discovery.discover(query,{signal:request.signal});
    if (controller !== request) return;
    currentQuery = query;
    if (result.fact) { renderFact(result.fact); status(result.repeated ? 'You’ve seen the selected details from this article. Try another topic to keep exploring.' : ''); }
    else { renderMissing(result.suggestion); status(''); }
  } catch(error) {
    if (request.signal.aborted || controller !== request) return;
    status(error.name === 'TimeoutError' ? 'The source is taking too long. Please try again.' : error.message || 'Couldn’t reach the source. Please try again.');
  } finally {
    if (controller === request) {
      controller = null;
      $('discover').disabled = false; $('surprise').disabled = false; $('another').disabled = false;
      $('curiosity-form').setAttribute('aria-busy','false');
    }
  }
}
$('curiosity-form').onsubmit = event => { event.preventDefault(); return discover(); };
$('surprise').onclick = () => { $('topic').value = ''; return discover(''); };
$('another').onclick = () => discover(currentQuery);

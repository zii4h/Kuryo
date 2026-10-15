import { createDiscovery } from './discovery.js';
const $ = id => document.getElementById(id);
const discovery = createDiscovery();
let controller;
function status(text) { $('status').textContent = text; $('status').hidden = !text; }
function animateTrivia(signal) {
  return new Promise(resolve => {
  const result = $('result');
  const glyphs = '01/\\[]{}<>_+=:.*#%';
  const characters = [];
  const hosts = [$('fact-title'), $('fact-text')];
  const scrambleDuration = 100;
  const revealDuration = 220;
  for (const [hostIndex, host] of hosts.entries()) {
    const text = host.firstChild;
    const bounds = host.getBoundingClientRect();
    const finalColor = getComputedStyle(host).color;
    const range = document.createRange();
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text.textContent[i])) continue;
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const rect = range.getBoundingClientRect();
      const character = document.createElement('span');
      character.className = 'ascii-character';
      character.setAttribute('aria-hidden', 'true');
      character.style.left = `${rect.left - bounds.left}px`;
      character.style.top = `${rect.top - bounds.top}px`;
      character.style.width = `${rect.width}px`;
      character.style.height = `${rect.height}px`;
      host.append(character);
      characters.push({
        element: character,
        original: text.textContent[i],
        revealAt: scrambleDuration + hostIndex * revealDuration
          + (rect.left - bounds.left) / Math.max(1, bounds.width) * revealDuration,
        finalColor,
        revealed: false
      });
    }
    host.classList.add('is-scrambling');
  }
  const started = performance.now();
  const draw = () => {
    // A stationary wipe: resolved letters stay put while noise clears rightward.
    const elapsed = performance.now() - started;
    for (const character of characters) {
      if (character.revealed) continue;
      if (elapsed >= character.revealAt) {
        character.element.textContent = character.original;
        character.element.style.color = character.finalColor;
        character.revealed = true;
      } else {
        character.element.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      }
    }
  };
  result.setAttribute('aria-busy', 'true');
  draw();
  const timer = setInterval(draw, 16);
  const finish = setTimeout(() => stop(), scrambleDuration + hosts.length * revealDuration + 16);
  const stop = () => {
    clearInterval(timer);
    clearTimeout(finish);
    characters.forEach(character => character.element.remove());
    hosts.forEach(host => host.classList.remove('is-scrambling'));
    result.removeAttribute('aria-busy');
    signal.removeEventListener('abort', stop);
    resolve();
  };
  signal.addEventListener('abort', stop, {once: true});
  if (signal.aborted) stop();
  });
}
function renderFact(fact) {
  $('fact-title').textContent = fact.title;
  $('fact-text').textContent = fact.text;
  $('source').href = fact.source.url;
  $('source').title = fact.source.title;
  $('result-footer').hidden = false;
  $('suggestions').hidden = true;
  $('result').hidden = false;
}
function renderMissing(suggestion) {
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
  $('discover').disabled = true; $('surprise').disabled = true;
  $('curiosity-form').setAttribute('aria-busy','true');
  status(query ? 'Looking for an interesting detail…' : 'Following a random thread of curiosity…');
  try {
    const result = await discovery.discover(query,{signal:request.signal});
    if (controller !== request) return;
    if (result.fact) {
      renderFact(result.fact);
      status('');
      await animateTrivia(request.signal);
      if (controller !== request) return;
      status(result.repeated ? 'You’ve seen the selected details from this article. Try another topic to keep exploring.' : '');
    }
    else { renderMissing(result.suggestion); status(''); }
  } catch(error) {
    if (request.signal.aborted || controller !== request) return;
    status(error.name === 'TimeoutError' ? 'The source is taking too long. Please try again.' : error.message || 'Couldn’t reach the source. Please try again.');
  } finally {
    if (controller === request) {
      controller = null;
      $('discover').disabled = false; $('surprise').disabled = false;
      $('curiosity-form').setAttribute('aria-busy','false');
    }
  }
}
$('curiosity-form').onsubmit = event => { event.preventDefault(); return discover(); };
function randomTrivia() {
  $('topic').value = '';
  return discover('');
}
$('surprise').onclick = randomTrivia;
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target instanceof Element &&
      (event.target.closest('input, textarea, select, button, a, [contenteditable]') || event.target.isContentEditable)) return;
  event.preventDefault();
  if (!event.repeat && !controller) randomTrivia();
});

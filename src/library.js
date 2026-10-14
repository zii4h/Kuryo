export const TOPICS = ['Space', 'Animals', 'Ocean', 'Nature', 'Food', 'Technology', 'History'];
const STOP = new Set('a an the is are was were i me my you your we us it its of in on to from for with about and or please tell give show generate find get want know did something anything interesting interest fascinating fun cool random surprise fact facts trivia new another one some stuff today'.split(' '));
const ALIASES = { astronomy:'space', astronomical:'space', cosmos:'space', universe:'space', planets:'space', planet:'space', wildlife:'animals', animal:'animals', creatures:'animals', creature:'animals', biology:'nature', plants:'nature', plant:'nature', trees:'nature', tree:'nature', oceans:'ocean', sea:'ocean', marine:'ocean', tech:'technology', computers:'technology', computer:'technology', computing:'technology', historical:'history', ancient:'history', foods:'food', cooking:'food', octopuses:'octopus', octopi:'octopus', squids:'squid', bananas:'banana', orchids:'orchid', redwoods:'redwood', volcanoes:'volcano', clocks:'clock', moons:'moon' };
export function tokenize(text) {
  return [...new Set((text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || []).filter(term => !STOP.has(term)).map(term => ALIASES[term] || term))];
}
export function validateFacts(facts) {
  if (!Array.isArray(facts) || !facts.length) throw new Error('The library needs at least one fact');
  const ids = new Set();
  for (const fact of facts) {
    if (!fact || typeof fact.id !== 'string' || !fact.id || ids.has(fact.id)) throw new Error('Fact IDs must be unique');
    ids.add(fact.id);
    for (const key of ['title','text','topic','evidence','reviewedAt']) if (typeof fact[key] !== 'string' || !fact[key].trim()) throw new Error(`Missing ${key} for ${fact.id}`);
    if (!TOPICS.includes(fact.topic) || !Array.isArray(fact.tags) || !fact.tags.length || fact.tags.some(tag => typeof tag !== 'string')) throw new Error(`Invalid topic or tags for ${fact.id}`);
    if (!fact.source || !fact.source.title || !fact.source.publisher) throw new Error(`Missing source for ${fact.id}`);
    const url = new URL(fact.source.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`Unsafe source URL for ${fact.id}`);
  }
}
export function createFactPicker(facts, { random = Math.random } = {}) {
  validateFacts(facts);
  const seen = new Set();
  const indexed = facts.map(fact => ({ fact, tags:new Set(tokenize(fact.tags.join(' '))), topic:new Set(tokenize(fact.topic)), body:new Set(tokenize(`${fact.title} ${fact.text}`)) }));
  function pick(query = '') {
    const terms = tokenize(query);
    const ranked = indexed.map(entry => ({...entry, score:terms.reduce((sum, term) => sum + (entry.tags.has(term) ? 8 : entry.topic.has(term) ? 5 : !/^\p{N}+$/u.test(term) && entry.body.has(term) ? 1 : 0),0)}));
    const best = Math.max(...ranked.map(entry => entry.score));
    if (terms.length && !best) return {fact:null,repeated:false};
    // Keep the best matching subject rather than unrelated low-score results.
    const broadTopic = terms.length === 1 && TOPICS.find(topic => tokenize(topic)[0] === terms[0]);
    const pool = broadTopic ? ranked.filter(entry => entry.fact.topic === broadTopic)
      : terms.length ? ranked.filter(entry => entry.score === best) : ranked;
    let available = pool.filter(entry => !seen.has(entry.fact.id));
    const repeated = !available.length;
    if (repeated) { pool.forEach(entry => seen.delete(entry.fact.id)); available = pool; }
    // Avoid an immediate repeat when cycling a selection with multiple entries.
    if (repeated && available.length > 1 && lastId) available = available.filter(entry => entry.fact.id !== lastId);
    const chosen = available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))].fact;
    seen.add(chosen.id); lastId = chosen.id;
    return {fact:chosen,repeated};
  }
  let lastId = null;
  return {pick};
}

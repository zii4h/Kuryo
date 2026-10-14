const ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const CACHE_TTL = 10 * 60 * 1000;

export function normalizeTopic(input = '') {
  let topic = input.trim().replace(/\s+/g, ' ');
  topic = topic.replace(/^(?:please\s+)?(?:tell|give|show)\s+me\s+(?:(?:a|an|some)\s+)?(?:(?:something|anything)\s+)?(?:(?:interesting|fun|random|fascinating|cool)\s+)*(?:(?:facts?|trivia|details?)\s*)?(?:about|on)\s+/i, '');
  if (/^(?:surprise me|random|anything|something interesting|random fact|random trivia|tell me something interesting)[.!?]*$/i.test(topic)) return '';
  return topic.replace(/[?!.]+$/, '').slice(0, 200);
}

export function extractDetails(extract) {
  if (typeof extract !== 'string') return [];
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', {granularity:'sentence'}) : null;
  const passages = [];
  // Bound processing on long articles. Keep complete sentences and source wording.
  const paragraphs = extract.slice(0, 40000).split(/\n+/);
  for (const paragraph of paragraphs) {
    if (/^\s*=|^\s*(?:References|External links|See also|Further reading)\s*$/i.test(paragraph)) continue;
    const text = paragraph.replace(/\s+/g, ' ').trim();
    const sentences = segmenter ? [...segmenter.segment(text)].map(s => s.segment.trim()) : text.match(/[^.!?]+[.!?](?:["”])?/g) || [];
    for (const sentence of sentences) {
      if (sentence.length < 65 || sentence.length > 480 || sentence.split(/\s+/).length > 85) continue;
      if (!/[.!?]["”']?$/.test(sentence) || /(?:\.\.\.|…)$/.test(sentence)) continue;
      if (/^(?:it|its|they|their|he|his|she|her|this|these|those|such|however|therefore)\b/i.test(sentence)) continue;
      if (/citation needed|needs citation|ISBN|https?:\/\//i.test(sentence)) continue;
      if ((sentence.match(/,/g) || []).length > 5 || /[☉∑√=]/u.test(sentence)) continue;
      const signals = sentence.match(/\b(?:only|first|last|oldest|largest|smallest|earliest|fastest|longest|rare|unusual|unlike|discovered|invented|surprisingly|despite|more than|less than|twice|never)\b/gi) || [];
      const score = signals.length * 3 + (/\d/.test(sentence) ? 1 : 0) + (sentence.length < 240 ? 2 : 0);
      if (!passages.some(p => p.text === sentence)) passages.push({text:sentence,score});
    }
  }
  return passages.sort((a,b) => b.score - a.score);
}

export function articleText(html) {
  // TextExtracts plaintext flattens superscripts (10^6 becomes 106). Skip
  // formula paragraphs rather than publishing a changed measurement.
  const decode = text => text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity,key) => {
    if (key.startsWith('#')) {
      const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[key.toLowerCase()];
  });
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(([,paragraph]) => /<(?:sup|sub|math|script|style)\b|mwe-math/i.test(paragraph) ? '' : decode(paragraph.replace(/<[^>]*>/g,'')))
    .filter(Boolean).join('\n');
}

export function createDiscovery({fetcher = globalThis.fetch, random = Math.random, now = Date.now} = {}) {
  const cache = new Map();
  const seen = new Set();
  let lastText;

  async function api(params, signal) {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',...params});
    const timeout = AbortSignal.timeout(12000);
    const response = await fetcher(url, {signal:signal ? AbortSignal.any([signal,timeout]) : timeout});
    if (!response.ok) throw new Error(response.status === 429 ? 'Wikipedia is receiving too many requests. Please try again shortly.' : 'The source couldn’t be reached. Please try again.');
    const data = await response.json();
    if (data.error) throw new Error('The source couldn’t complete this lookup. Please try again.');
    return data.query || {};
  }

  function remember(key, value) {
    cache.delete(key); cache.set(key, {time:now(),value});
    if (cache.size > 24) cache.delete(cache.keys().next().value);
  }

  async function article(pageid, signal) {
    const key = `article:${pageid}`, cached = cache.get(key);
    if (cached && now() - cached.time < CACHE_TTL) return cached.value;
    const data = await api({prop:'extracts|info|pageprops',pageids:String(pageid),exlimit:'1',inprop:'url'}, signal);
    const page = data.pages?.[0];
    if (!page || page.missing || page.ns !== 0 || !page.extract || Object.hasOwn(page.pageprops || {},'disambiguation') || /^List of\b/i.test(page.title)) return null;
    const passages = extractDetails(articleText(page.extract));
    if (!passages.length) return null;
    const result = {page,passages}; remember(key,result); return result;
  }

  function select({page,passages}) {
    // Prefer interesting details over definitions while keeping several choices.
    const pool = passages.filter(p => p.score >= Math.max(0,passages[0].score - 3));
    let available = pool.filter(p => !seen.has(`${page.pageid}:${p.text}`));
    const repeated = available.length === 0;
    if (repeated) {
      pool.forEach(p => seen.delete(`${page.pageid}:${p.text}`));
      available = pool.length > 1 ? pool.filter(p => p.text !== lastText) : pool;
    }
    const choice = available[Math.min(available.length - 1,Math.max(0,Math.floor(random() * available.length)))];
    seen.add(`${page.pageid}:${choice.text}`); lastText = choice.text;
    // Bound session memory on long browsing sessions.
    if (seen.size > 500) seen.delete(seen.values().next().value);
    const source = new URL('https://en.wikipedia.org/w/index.php');
    source.searchParams.set('curid',String(page.pageid));
    if (Number.isSafeInteger(page.lastrevid)) source.searchParams.set('oldid',String(page.lastrevid));
    return {fact:{title:page.title,text:choice.text,source:{title:page.title,publisher:'Wikipedia',url:source.href}},repeated};
  }

  async function discover(input = '', {signal} = {}) {
    const topic = normalizeTopic(input);
    if (!topic) {
      // A real random article lookup, not a random choice from preset categories.
      const data = await api({list:'random',rnnamespace:'0',rnlimit:'5',rnfilterredir:'nonredirects'}, signal);
      for (const candidate of data.random || []) {
        const found = await article(candidate.id,signal);
        if (found) return select(found);
      }
      throw new Error('No suitable detail turned up this time. Roll the dice again.');
    }
    const key = `search:${topic.toLowerCase()}`, cached = cache.get(key);
    let search;
    if (cached && now() - cached.time < CACHE_TTL) search = cached.value;
    else { search = await api({list:'search',srsearch:topic,srnamespace:'0',srlimit:'3',srprop:'',srenablerewrites:'1'},signal); remember(key,search); }
    for (const candidate of search.search || []) {
      const found = await article(candidate.pageid,signal);
      if (found) return select(found);
    }
    return {fact:null,repeated:false,suggestion:search.searchinfo?.suggestion || null};
  }
  return {discover};
}

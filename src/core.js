const stopwords = new Set('a an the is are was were to of and or in on for with what which who how each it its do does about me my please'.split(' '));
export function terms(text) { return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => !stopwords.has(t)); }
export function chunkSource(source) {
  const chunks = []; const text = source.text;
  for (let start = 0; start < text.length; start += 800) {
    const content = text.slice(start, start + 1000);
    chunks.push({ sourceId: source.id, name: source.name, text: content, offset: start, terms: terms(content) });
    if (start + 1000 >= text.length) break;
  }
  return chunks;
}
export function retrieve(query, sources, limit = 4) {
  const chunks = sources.flatMap(chunkSource); const words = [...new Set(terms(query))];
  if (!chunks.length || !words.length) return [];
  const average = chunks.reduce((n, c) => n + c.terms.length, 0) / (chunks.length || 1);
  // Compute document frequency once per query, rather than scanning the entire
  // library again for every passage being scored.
  const frequencies = new Map(words.map(word => [word, 0]));
  const termCounts = chunks.map(chunk => {
    const counts = new Map();
    for (const term of chunk.terms) {
      if (frequencies.has(term)) counts.set(term, (counts.get(term) || 0) + 1);
    }
    for (const term of counts.keys()) frequencies.set(term, frequencies.get(term) + 1);
    return counts;
  });
  return chunks.map((c, index) => {
    const score = words.reduce((sum, word) => {
      const tf = termCounts[index].get(word) || 0;
      const df = frequencies.get(word);
      const idf = Math.log(1 + (chunks.length - df + .5) / (df + .5));
      return sum + idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * c.terms.length / (average || 1)));
    }, 0);
    return { ...c, score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((c, i) => ({ ...c, citation: `S${i + 1}` }));
}
export async function consumeNDJSON(stream, onRecord) {
  const reader = stream.getReader(); const decoder = new TextDecoder(); let buffer = '';
  const parse = line => { if (line.trim()) onRecord(JSON.parse(line)); };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) { parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
    }
    buffer += decoder.decode(); parse(buffer);
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
export function metrics(record, firstToken) {
  return { speed: record.eval_duration > 0 ? record.eval_count / (record.eval_duration / 1e9) : null, tokens: record.eval_count ?? null, duration: record.total_duration != null ? record.total_duration / 1e9 : null, firstToken };
}

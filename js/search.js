// In-memory search over every question. The index is rebuilt whenever the
// question list changes; a search is a single pass over lowercased strings,
// which stays instant well past a few thousand questions.

import { store, skillName } from './data.js';
import { esc } from './utils.js';

let index = [];

function build() {
  index = store.questions.map((q) => ({
    q,
    title: q.question.toLowerCase(),
    meta: [skillName(q.skill), q.skill, q.topic, q.type, q.difficulty, ...q.tags].join(' ').toLowerCase(),
    body: [q.statement, q.shortAnswer, q.interviewAnswer, q.answer, q.example, q.approach, q.codes.map((c) => c.content).join(' ')]
      .join(' ')
      .toLowerCase(),
  }));
}
window.addEventListener('devprep:data', build);

export const terms = (query) => String(query || '').toLowerCase().split(/\s+/).filter(Boolean);

/** Every term must match somewhere (partial matches count). Best matches first. */
export function search(query, { limit = Infinity, within } = {}) {
  const ts = terms(query);
  if (!ts.length) return [];
  if (!index.length) build();
  const allow = within ? new Set(within.map((q) => q.id)) : null;
  const phrase = ts.join(' ');
  const hits = [];
  for (const entry of index) {
    if (allow && !allow.has(entry.q.id)) continue;
    let score = 0;
    let ok = true;
    for (const t of ts) {
      const inTitle = entry.title.indexOf(t);
      if (inTitle >= 0) {
        score += 10;
        if (inTitle === 0 || /\W/.test(entry.title[inTitle - 1])) score += 3;
      } else if (entry.meta.includes(t)) score += 6;
      else if (entry.body.includes(t)) score += 2;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (ts.length > 1 && entry.title.includes(phrase)) score += 8;
    if (entry.q.priority === 'critical') score += 1;
    hits.push({ q: entry.q, score });
  }
  hits.sort((a, b) => b.score - a.score || a.q._seq - b.q._seq);
  return hits.slice(0, limit).map((h) => h.q);
}

/** Escape `text` and wrap matches of the query's terms in <mark>. */
export function highlightTerms(text, query) {
  const ts = terms(query).filter((t) => t.length > 1);
  if (!ts.length) return esc(text);
  const re = new RegExp(`(${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return String(text)
    .split(re)
    .map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)))
    .join('');
}

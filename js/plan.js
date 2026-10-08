// Deterministic study logic: today's revision plan and the readiness score.
// No AI and no network — just the question data plus your saved status.

import { store, isCoding } from './data.js';
import * as db from './storage.js';
import { progressOf } from './ui.js';
import { todayISO } from './utils.js';

const DAY = 86400000;

// Stable pseudo-random number in [0, 1) so the plan stays the same all day.
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Pick `size` questions for today. Order of preference: marked for revision,
 * still learning, learned a while ago, important but not yet known, recently
 * added, and questions from your weakest skills. No skill takes more than half.
 */
export function todaysPlan(size = 10) {
  const day = todayISO();
  const now = Date.now();
  const skillPct = {};
  for (const s of store.skills) skillPct[s.id] = progressOf(store.questions.filter((q) => q.skill === s.id)).percent;

  // Skills with more questions get a small boost, so the plan leans towards
  // the core of the knowledge base (PHP and Laravel) without excluding the rest.
  const share = {};
  for (const q of store.questions) share[q.skill] = (share[q.skill] || 0) + 1 / store.questions.length;

  const scored = [];
  for (const q of store.questions) {
    const status = db.getStatus(q.id);
    let score = 0;
    let reason = '';
    if (status === 'revision') { score = 100; reason = 'Marked for revision'; }
    else if (status === 'learning') { score = 45; reason = 'Still learning'; }
    else if (status === 'learned') {
      if (now - db.statusTime(q.id) < 14 * DAY) continue;
      score = 35; reason = 'Learned over two weeks ago';
    } else if (status === 'mastered') continue;
    else {
      score = (1 - (skillPct[q.skill] || 0) / 100) * 15;
      reason = 'New in a skill you have covered least';
      if (q.commonInterviewQuestion) { score += 8; reason = 'Commonly asked'; }
      if (q.createdAt && now - q.createdAt < 14 * DAY) { score += 25; reason = 'Recently added'; }
      if (q.priority === 'high') { score += 10; reason = 'High priority'; }
      if (q.priority === 'critical') { score += 20; reason = 'Critical priority'; }
      if (db.isStarred(q)) { score += 20; reason = q.priority === 'critical' ? 'Critical priority' : 'Marked important'; }
      // Start people on approachable material.
      if (q.difficulty === 'Beginner') score += 4;
      if (q.difficulty === 'Advanced') score -= 4;
    }
    scored.push({ q, score: score + (share[q.skill] || 0) * 40 + seeded(q.id + day) * 3, reason });
  }
  scored.sort((a, b) => b.score - a.score);

  const cap = Math.max(1, Math.ceil(size / 2));
  const perSkill = {};
  const picked = [];
  for (const item of scored) {
    if (picked.length >= size) break;
    if ((perSkill[item.q.skill] || 0) >= cap) continue;
    perSkill[item.q.skill] = (perSkill[item.q.skill] || 0) + 1;
    picked.push(item);
  }
  // Keep at least one coding problem in the mix when any are left to do.
  if (picked.length === size && !picked.some((p) => isCoding(p.q))) {
    const coding = scored.find((s) => isCoding(s.q) && !picked.includes(s));
    if (coding) picked[picked.length - 1] = coding;
  }
  const mix = {};
  for (const p of picked) mix[p.q.skill] = (mix[p.q.skill] || 0) + 1;
  return {
    items: picked,
    mix: Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([skill, count]) => ({ skill, count })),
  };
}

/** A study-progress indicator (not a prediction). Returns { score, parts }. */
export function readiness() {
  const all = progressOf(store.questions);
  const total = all.total || 1;
  const touched = all.total - all.new;
  const coding = progressOf(store.questions.filter(isCoding));
  const skillShare = store.skills.length
    ? store.skills.reduce((sum, s) => {
        const p = progressOf(store.questions.filter((q) => q.skill === s.id));
        // A skill counts as covered once 60% of it is learned.
        return sum + Math.min(1, p.total ? p.known / p.total / 0.6 : 0);
      }, 0) / store.skills.length
    : 0;

  const parts = [
    { label: 'Questions learned', value: all.known / total, weight: 40 },
    { label: 'Questions mastered', value: all.mastered / total, weight: 15 },
    { label: 'Revision cleared', value: touched ? 1 - all.revision / touched : 0, weight: 10 },
    { label: 'Skill coverage', value: skillShare, weight: 20 },
    { label: 'Coding practice', value: coding.total ? coding.known / coding.total : 0, weight: 15 },
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.value * p.weight, 0));
  return { score, parts };
}

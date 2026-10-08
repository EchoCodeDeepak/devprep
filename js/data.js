// Loads question content from /data/*.json, validates it, and merges in
// questions that were added or edited in this browser.

import { getCustom } from './storage.js';
import { slug } from './utils.js';

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
export const TYPES = ['Concept', 'Coding', 'Scenario', 'Debugging', 'SQL', 'Architecture', 'Practical', 'Interview'];
export const PRIORITIES = ['critical', 'high', 'medium', 'normal'];
export const PRIORITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', normal: 'Normal' };
export const STATUS_LABEL = { new: 'New', learning: 'Learning', learned: 'Learned', revision: 'Needs revision', mastered: 'Mastered' };
export const CODE_LANGS = ['php', 'js', 'sql', 'html', 'css', 'bash', 'json', 'text'];

export const store = {
  skills: [],
  skillMap: new Map(),
  paths: [],
  questions: [],
  byId: new Map(),
  staticIds: new Set(),
  errors: [],
  loaded: false,
};
let staticQuestions = [];

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const pick = (value, allowed, fallback) => {
  const hit = allowed.find((a) => a.toLowerCase() === str(value).toLowerCase());
  return hit || fallback;
};

function normalizeCode(code) {
  const arr = Array.isArray(code) ? code : code ? [code] : [];
  return arr
    .filter((c) => c && typeof c === 'object' && str(c.content))
    .map((c) => ({ language: str(c.language) || 'text', content: String(c.content).replace(/\s+$/, ''), title: str(c.title) }));
}

/** Turn one raw JSON entry into the shape the app uses. Returns null if unusable. */
export function normalize(raw, fallbackSkill, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const id = str(raw.id);
  const question = str(raw.question);
  if (!id || !question) return null;

  const skill = str(raw.skill) || (raw.category ? slug(raw.category) : '') || fallbackSkill || 'general';
  let type = str(raw.type);
  if (/^conceptual$/i.test(type)) type = 'Concept';
  const priority = pick(raw.priority || raw.revisionPriority, PRIORITIES, raw.important ? 'high' : 'normal');

  return {
    id,
    order: Number.isFinite(Number(raw.order)) && raw.order !== '' && raw.order != null ? Number(raw.order) : index + 1,
    question,
    shortAnswer: str(raw.shortAnswer),
    interviewAnswer: str(raw.interviewAnswer),
    answer: str(raw.answer),
    example: str(raw.example),
    skill,
    topic: str(raw.topic) || str(raw.subcategory) || 'General',
    difficulty: pick(raw.difficulty, DIFFICULTIES, 'Intermediate'),
    type: pick(type, TYPES, 'Concept'),
    tags: [...new Set(list(raw.tags).map((t) => t.toLowerCase()))],
    priority,
    important: raw.important === undefined ? priority === 'critical' : Boolean(raw.important),
    commonInterviewQuestion: Boolean(raw.commonInterviewQuestion),
    askedBefore: Boolean(raw.askedBefore),
    codes: normalizeCode(raw.code),
    related: list(raw.related),
    notes: str(raw.notes),
    added: str(raw.added),
    // Coding-problem fields (all optional)
    statement: str(raw.statement),
    input: str(raw.input),
    output: str(raw.output),
    hint: str(raw.hint),
    approach: str(raw.approach),
    complexity: str(raw.complexity),
    mistakes: list(raw.mistakes),
    tips: list(raw.tips),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

/** Clean JSON for pasting into a /data file: canonical key order, no empty fields. */
export function toJSON(q) {
  const out = {
    id: q.id,
    order: q.order,
    question: q.question,
    shortAnswer: q.shortAnswer,
    interviewAnswer: q.interviewAnswer,
    answer: q.answer,
    example: q.example,
    topic: q.topic,
    difficulty: q.difficulty,
    type: q.type,
    tags: q.tags,
    priority: q.priority,
    important: q.important,
    commonInterviewQuestion: q.commonInterviewQuestion,
    askedBefore: q.askedBefore,
    statement: q.statement,
    input: q.input,
    output: q.output,
    hint: q.hint,
    approach: q.approach,
    complexity: q.complexity,
    mistakes: q.mistakes,
    tips: q.tips,
    code: q.codes && q.codes.length ? (q.codes.length === 1 ? stripEmpty(q.codes[0]) : q.codes.map(stripEmpty)) : undefined,
    related: q.related,
    notes: q.notes,
    added: q.added,
  };
  return stripEmpty(out);
}
function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}

/** Form validation. Returns { field: message } — empty when the question is valid. */
export function validate(q, { isNew = false } = {}) {
  const errors = {};
  if (!str(q.question)) errors.question = 'Write the question.';
  else if (str(q.question).length < 8) errors.question = 'The question is too short to be useful.';
  if (!str(q.skill) || !store.skillMap.has(q.skill)) errors.skill = 'Choose a skill.';
  if (!str(q.shortAnswer) && !str(q.interviewAnswer) && !str(q.answer)) {
    errors.shortAnswer = 'Add at least one answer: short, interview or detailed.';
  }
  if (!DIFFICULTIES.includes(q.difficulty)) errors.difficulty = 'Choose Beginner, Intermediate or Advanced.';
  if (!TYPES.includes(q.type)) errors.type = 'Choose a question type.';
  const badTag = (q.tags || []).find((t) => !/^[a-z0-9][a-z0-9+#. -]{0,29}$/.test(t));
  if (badTag) errors.tags = `"${badTag}" is not a valid tag. Use short lowercase words, separated by commas.`;
  if ((q.tags || []).length > 12) errors.tags = 'Keep it to 12 tags or fewer.';
  if (q.codes && q.codes.some((c) => !CODE_LANGS.includes(c.language))) errors.code = 'Choose a code language.';
  if (isNew && store.byId.has(q.id)) errors.id = 'A question with this ID already exists.';
  return errors;
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} could not be loaded (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${url} is not valid JSON: ${e.message}`);
  }
}

export async function loadAll() {
  store.errors = [];
  const manifest = await fetchJSON('data/skills.json');
  store.skills = (manifest.skills || []).filter((s) => s && s.id && s.name);
  store.skillMap = new Map(store.skills.map((s) => [s.id, s]));
  store.paths = Array.isArray(manifest.paths) ? manifest.paths : [];

  const results = await Promise.allSettled(store.skills.map((s) => fetchJSON(`data/${s.file || `${s.id}.json`}`)));
  staticQuestions = [];
  const seen = new Set();
  results.forEach((res, i) => {
    const skill = store.skills[i];
    if (res.status === 'rejected') {
      store.errors.push(res.reason.message);
      return;
    }
    const entries = Array.isArray(res.value) ? res.value : res.value && res.value.questions;
    if (!Array.isArray(entries)) {
      store.errors.push(`data/${skill.file} has no "questions" list.`);
      return;
    }
    entries.forEach((raw, index) => {
      const q = normalize(raw, skill.id, index);
      if (!q) {
        store.errors.push(`data/${skill.file}: entry ${index + 1} was skipped because it has no "id" or "question".`);
      } else if (seen.has(q.id)) {
        store.errors.push(`data/${skill.file}: duplicate id "${q.id}" was skipped.`);
      } else {
        seen.add(q.id);
        q._seq = staticQuestions.length;
        staticQuestions.push(q);
      }
    });
  });
  store.staticIds = seen;
  rebuild();
  store.loaded = true;
  return store;
}

/** Merge static content with this browser's additions. Call after any local edit. */
export function rebuild() {
  const merged = new Map(staticQuestions.map((q) => [q.id, q]));
  getCustom().forEach((raw, i) => {
    const q = normalize(raw, raw.skill, i);
    if (!q) return;
    q._local = true;
    q._override = store.staticIds.has(q.id);
    q._seq = merged.has(q.id) ? merged.get(q.id)._seq : staticQuestions.length + i;
    merged.set(q.id, q);
  });
  store.questions = [...merged.values()];
  store.byId = merged;
  for (const q of store.questions) {
    q._added = q.createdAt || Date.parse(q.added) || 0;
  }
  window.dispatchEvent(new CustomEvent('devprep:data'));
}

export const getQuestion = (id) => store.byId.get(id);
export const skillName = (id) => store.skillMap.get(id)?.name || id;
export const skillColor = (id) => store.skillMap.get(id)?.color || '#888';
export const bySkill = (id) => store.questions.filter((q) => q.skill === id).sort(byOrder);
export const byOrder = (a, b) => a.order - b.order || a._seq - b._seq;
export const isCoding = (q) => q.skill === 'coding-logic' || q.type === 'Coding' || Boolean(q.hint || q.approach);

/** Topics for a skill: the planned list from skills.json plus any used by questions. */
export function topicsOf(skillId) {
  const counts = new Map();
  for (const t of store.skillMap.get(skillId)?.topics || []) counts.set(t, 0);
  for (const q of store.questions) if (q.skill === skillId) counts.set(q.topic, (counts.get(q.topic) || 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

export function allTags() {
  const counts = new Map();
  for (const q of store.questions) for (const t of q.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

/** Does a question belong to a learning-path step? */
export function matchesStep(q, step) {
  return (step.match || []).some((rule) => {
    if (rule.skill && q.skill !== rule.skill) return false;
    if (rule.topics && !rule.topics.includes(q.topic)) return false;
    if (rule.exceptTopics && rule.exceptTopics.includes(q.topic)) return false;
    if (rule.tag && !q.tags.includes(rule.tag)) return false;
    if (rule.difficulty && q.difficulty !== rule.difficulty) return false;
    return true;
  });
}

export function nextId(skillId) {
  const prefix = store.skillMap.get(skillId)?.prefix || skillId;
  let max = 0;
  for (const q of store.questions) {
    const m = q.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

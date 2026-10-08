// Everything personal lives here, in one LocalStorage entry in this browser:
// study status, stars, notes, interview experience, questions you add, and
// settings. Question content itself lives in /data/*.json.
//
// If a backend is added later, this module is the only place that needs to
// learn how to talk to it.

const KEY = 'devprep:v1';
const VERSION = 1;

export const STATUSES = ['new', 'learning', 'learned', 'revision', 'mastered'];

const defaults = () => ({
  version: VERSION,
  progress: {},
  stars: {},
  notes: {},
  experience: {},
  recent: [],
  custom: [],
  interviews: [],
  sessions: [],
  filters: {},
  settings: { theme: 'system', view: 'cards', perPage: 20, reduceMotion: false },
});

let state = defaults();
let storageOk = true;
export let loadWarning = '';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Coerce anything (old backups, hand-edited JSON, corrupt data) into a valid state. */
function sanitize(raw) {
  const base = defaults();
  if (!isObj(raw)) return base;
  const out = base;
  if (isObj(raw.progress)) {
    for (const [id, p] of Object.entries(raw.progress)) {
      if (isObj(p) && STATUSES.includes(p.s)) out.progress[id] = { s: p.s, t: Number(p.t) || Date.now() };
    }
  }
  if (isObj(raw.stars)) for (const [id, v] of Object.entries(raw.stars)) out.stars[id] = Boolean(v);
  if (isObj(raw.notes)) for (const [id, v] of Object.entries(raw.notes)) if (typeof v === 'string' && v) out.notes[id] = v;
  if (isObj(raw.experience)) for (const [id, v] of Object.entries(raw.experience)) if (isObj(v)) out.experience[id] = v;
  if (Array.isArray(raw.recent)) out.recent = raw.recent.filter((r) => isObj(r) && typeof r.id === 'string').slice(0, 30);
  if (Array.isArray(raw.custom)) out.custom = raw.custom.filter((q) => isObj(q) && typeof q.id === 'string' && typeof q.question === 'string');
  if (Array.isArray(raw.interviews)) out.interviews = raw.interviews.filter((i) => isObj(i) && typeof i.id === 'string');
  if (Array.isArray(raw.sessions)) out.sessions = raw.sessions.filter(isObj).slice(-50);
  if (isObj(raw.filters)) out.filters = raw.filters;
  if (isObj(raw.settings)) {
    const s = raw.settings;
    if (['system', 'light', 'dark'].includes(s.theme)) out.settings.theme = s.theme;
    if (['cards', 'compact'].includes(s.view)) out.settings.view = s.view;
    if ([10, 20, 30, 50].includes(Number(s.perPage))) out.settings.perPage = Number(s.perPage);
    out.settings.reduceMotion = Boolean(s.reduceMotion);
  }
  return out;
}

export function load() {
  let text = null;
  try {
    text = localStorage.getItem(KEY);
  } catch (e) {
    storageOk = false;
    loadWarning = 'This browser is blocking LocalStorage, so progress will not be saved after you close the tab.';
    return state;
  }
  if (!text) return state;
  try {
    state = sanitize(JSON.parse(text));
  } catch (e) {
    // Keep the unreadable data so it can be rescued by hand, then start clean.
    try { localStorage.setItem(`${KEY}:corrupt`, text); } catch (err) { /* ignore */ }
    state = defaults();
    loadWarning = 'Saved data in this browser could not be read, so DevPrep started fresh. The old data was kept under "devprep:v1:corrupt".';
  }
  return state;
}

function save() {
  if (!storageOk) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    window.dispatchEvent(new CustomEvent('devprep:storage-error'));
  }
}

const changed = (what, id) => {
  save();
  window.dispatchEvent(new CustomEvent('devprep:change', { detail: { what, id } }));
};

/* ---------- Study status ---------- */

export const getStatus = (id) => state.progress[id]?.s || 'new';
export const statusTime = (id) => state.progress[id]?.t || 0;
export function setStatus(id, status) {
  if (!STATUSES.includes(status)) return;
  if (status === 'new') delete state.progress[id];
  else state.progress[id] = { s: status, t: Date.now() };
  changed('status', id);
}
export const isKnown = (id) => ['learned', 'mastered'].includes(getStatus(id));

/* ---------- Stars ---------- */

export const isStarred = (q) => (q.id in state.stars ? state.stars[q.id] : Boolean(q.important));
export function toggleStar(q) {
  const next = !isStarred(q);
  if (next === Boolean(q.important)) delete state.stars[q.id];
  else state.stars[q.id] = next;
  changed('star', q.id);
  return next;
}

/* ---------- Notes and interview experience ---------- */

export const getNote = (id) => state.notes[id] || '';
export function setNote(id, text) {
  if (text && text.trim()) state.notes[id] = text;
  else delete state.notes[id];
  changed('note', id);
}

export const getExperience = (id) => state.experience[id] || null;
export const allExperience = () => state.experience;
export function setExperience(id, exp) {
  const has = exp && (exp.asked || exp.company || exp.date || exp.round || exp.notes);
  if (has) state.experience[id] = exp;
  else delete state.experience[id];
  changed('experience', id);
}
export const wasAsked = (q) => Boolean(state.experience[q.id]?.asked) || Boolean(q.askedBefore);

/* ---------- Recently viewed ---------- */

export const getRecent = () => state.recent;
export function pushRecent(id) {
  state.recent = [{ id, t: Date.now() }, ...state.recent.filter((r) => r.id !== id)].slice(0, 30);
  save();
}
export const viewedAt = (id) => state.recent.find((r) => r.id === id)?.t || 0;

/* ---------- Questions added or edited in this browser ---------- */

export const getCustom = () => state.custom;
export function saveCustom(question) {
  const now = Date.now();
  const i = state.custom.findIndex((q) => q.id === question.id);
  if (i >= 0) state.custom[i] = { ...question, createdAt: state.custom[i].createdAt || now, updatedAt: now };
  else state.custom.push({ ...question, createdAt: now, updatedAt: now });
  changed('custom', question.id);
}
export function deleteCustom(id) {
  state.custom = state.custom.filter((q) => q.id !== id);
  changed('custom', id);
}

/* ---------- Interview history ---------- */

export const getInterviews = () => state.interviews;
export function saveInterview(entry) {
  const i = state.interviews.findIndex((x) => x.id === entry.id);
  if (i >= 0) state.interviews[i] = entry;
  else state.interviews.push(entry);
  changed('interviews');
}
export function deleteInterview(id) {
  state.interviews = state.interviews.filter((x) => x.id !== id);
  changed('interviews');
}

/* ---------- Practice sessions ---------- */

export const getSessions = () => state.sessions;
export function addSession(session) {
  state.sessions = [...state.sessions, { ...session, t: Date.now() }].slice(-50);
  save();
}

/* ---------- Settings and remembered filters ---------- */

export const getSettings = () => state.settings;
export function setSetting(key, value) {
  state.settings[key] = value;
  changed('settings');
}
export const getFilters = () => state.filters;
export function setFilters(filters) {
  state.filters = filters;
  save();
}

/* ---------- Backup ---------- */

export function exportBackup() {
  return { app: 'devprep', exportedAt: new Date().toISOString(), ...JSON.parse(JSON.stringify(state)) };
}

export function summarize(data = state) {
  return {
    statuses: Object.keys(data.progress || {}).length,
    stars: Object.keys(data.stars || {}).length,
    notes: Object.keys(data.notes || {}).length,
    experience: Object.keys(data.experience || {}).length,
    custom: (data.custom || []).length,
    interviews: (data.interviews || []).length,
  };
}

/** Returns a summary of what was restored, or throws with a readable message. */
export function importBackup(raw, mode = 'replace') {
  if (!isObj(raw) || (raw.app !== 'devprep' && !isObj(raw.progress) && !Array.isArray(raw.custom))) {
    throw new Error('This file is not a DevPrep backup.');
  }
  const incoming = sanitize(raw);
  if (mode === 'merge') {
    const cur = state;
    for (const [id, p] of Object.entries(incoming.progress)) {
      if (!cur.progress[id] || cur.progress[id].t < p.t) cur.progress[id] = p;
    }
    Object.assign(cur.stars, incoming.stars);
    for (const [id, n] of Object.entries(incoming.notes)) if (!cur.notes[id]) cur.notes[id] = n;
    for (const [id, x] of Object.entries(incoming.experience)) if (!cur.experience[id]) cur.experience[id] = x;
    for (const q of incoming.custom) {
      const i = cur.custom.findIndex((c) => c.id === q.id);
      if (i < 0) cur.custom.push(q);
      else if ((q.updatedAt || 0) > (cur.custom[i].updatedAt || 0)) cur.custom[i] = q;
    }
    for (const it of incoming.interviews) if (!cur.interviews.some((c) => c.id === it.id)) cur.interviews.push(it);
  } else {
    state = incoming;
  }
  changed('import');
  return summarize(incoming);
}

export function clearAll() {
  const keepTheme = state.settings.theme;
  state = defaults();
  state.settings.theme = keepTheme;
  changed('clear');
}

export function bytesUsed() {
  try {
    return new Blob([localStorage.getItem(KEY) || '']).size;
  } catch (e) {
    return 0;
  }
}

// Reusable interface pieces (badges, question cards, progress, empty states)
// and the click handlers for the actions that appear on every question.

import { $$, esc, icon, href, copyText, toast, absoluteLink, plain } from './utils.js';
import { getQuestion, skillName, skillColor, STATUS_LABEL, PRIORITY_LABEL } from './data.js';
import { highlightTerms } from './search.js';
import * as db from './storage.js';

/* ---------- Badges ---------- */

export const skillBadge = (skillId) =>
  `<a class="badge hover:text-ink" href="${href(`/skills/${skillId}`)}"><span class="dot" style="background:${esc(skillColor(skillId))}"></span>${esc(skillName(skillId))}</a>`;

/** Same look as skillBadge, but not a link (for use inside other links). */
export const skillChip = (skillId) =>
  `<span class="badge"><span class="dot" style="background:${esc(skillColor(skillId))}"></span>${esc(skillName(skillId))}</span>`;

export function difficultyBadge(level) {
  const n = { Beginner: 1, Intermediate: 2, Advanced: 3 }[level] || 2;
  const bars = [1, 2, 3]
    .map((i) => `<span class="w-[3px] rounded-sm ${i <= n ? 'bg-ink' : 'bg-line-strong'}" style="height:${3 + i * 2.5}px"></span>`)
    .join('');
  return `<span class="badge"><span class="flex items-end gap-[2px]" aria-hidden="true">${bars}</span>${esc(level)}</span>`;
}

export const typeBadge = (type) => `<span class="badge">${esc(type)}</span>`;

const STATUS_CLASS = { new: '', learning: 'badge-info', learned: 'badge-ok', revision: 'badge-warn', mastered: 'badge-plum' };
export const statusBadge = (status) =>
  status === 'new' ? '' : `<span class="badge ${STATUS_CLASS[status]}">${esc(STATUS_LABEL[status])}</span>`;

export const priorityBadge = (priority) =>
  priority === 'critical'
    ? `<span class="badge badge-bad">${icon('flag', 'h-3 w-3')}Critical</span>`
    : priority === 'high'
      ? `<span class="badge">${icon('flag', 'h-3 w-3')}High</span>`
      : '';

export const localBadge = (q) =>
  q._local ? `<span class="badge badge-accent" title="Stored in this browser only">${q._override ? 'Edited locally' : 'Local'}</span>` : '';

export const tagLinks = (tags, max = 4) =>
  tags
    .slice(0, max)
    .map((t) => `<a class="tag" href="${href('/questions', { tag: t })}">#${esc(t)}</a>`)
    .join('') + (tags.length > max ? `<span class="tag">+${tags.length - max}</span>` : '');

/* ---------- Question actions ---------- */

export function starButton(q, cls = 'btn btn-ghost btn-icon btn-sm') {
  const on = db.isStarred(q);
  return `<button type="button" class="${cls} ${on ? '!text-warn' : ''}" data-action="star" aria-pressed="${on}" aria-label="${on ? 'Remove from important' : 'Mark as important'}" title="Important (F)">${icon(on ? 'star-fill' : 'star')}</button>`;
}

export function statusControl(id) {
  const current = db.getStatus(id);
  return `<div class="flex flex-wrap gap-1.5" role="group" aria-label="Study status">
    ${db.STATUSES.map(
      (s) => `<button type="button" class="chip" data-action="set-status" data-status="${s}" aria-pressed="${s === current}">${esc(STATUS_LABEL[s])}</button>`,
    ).join('')}
  </div>`;
}

/** Card used in every question list. */
export function questionCard(q, { query = '' } = {}) {
  const status = db.getStatus(q.id);
  const known = status === 'learned' || status === 'mastered';
  const link = href(`/questions/${q.id}`);
  const summary = plain(q.statement || q.shortAnswer || q.interviewAnswer || q.answer.split('\n')[0]);
  return `<article class="card card-link flex min-w-0 flex-col p-4" data-qid="${esc(q.id)}">
    <div class="flex items-start gap-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        ${skillBadge(q.skill)}${difficultyBadge(q.difficulty)}${typeBadge(q.type)}${priorityBadge(q.priority)}${localBadge(q)}
        <span data-slot="status">${statusBadge(status)}</span>
      </div>
      <div class="-mr-1.5 -mt-1.5">${starButton(q)}</div>
    </div>
    <h2 class="mt-2.5 text-[1.0625rem] font-semibold leading-snug">
      <a class="hover:underline" href="${link}">${highlightTerms(q.question, query)}</a>
    </h2>
    ${summary ? `<p class="clamp-2 mt-1.5 text-sm text-muted">${highlightTerms(summary, query)}</p>` : ''}
    ${q.tags.length ? `<div class="mt-3 flex flex-wrap gap-1.5">${tagLinks(q.tags)}</div>` : ''}
    <div class="mt-auto flex items-center gap-1.5 pt-3.5">
      <a class="btn btn-sm btn-primary" href="${link}">View answer</a>
      <button type="button" class="btn btn-sm" data-action="learned" aria-pressed="${known}" aria-label="Learned" title="Mark learned (M)">${icon('check', 'h-3.5 w-3.5')}<span class="hidden xs:inline">Learned</span></button>
      <button type="button" class="btn btn-sm" data-action="revise" aria-pressed="${status === 'revision'}" aria-label="Revise" title="Mark for revision">${icon('refresh', 'h-3.5 w-3.5')}<span class="hidden xs:inline">Revise</span></button>
      <button type="button" class="btn btn-ghost btn-icon btn-sm ml-auto" data-action="copy-link" aria-label="Copy link to this question" title="Copy link">${icon('link')}</button>
    </div>
  </article>`;
}

/** One-line row for dense lists (dashboard, compact view, topic pages). */
export function questionRow(q, { query = '', meta = '' } = {}) {
  const status = db.getStatus(q.id);
  return `<li class="group flex items-center gap-2.5 px-3 py-2 sm:px-4" data-qid="${esc(q.id)}">
    <span class="dot" style="background:${esc(skillColor(q.skill))}" title="${esc(skillName(q.skill))}"></span>
    <a class="min-w-0 flex-1 py-1 text-sm font-medium leading-snug hover:underline" href="${href(`/questions/${q.id}`)}">
      <span class="clamp-2">${highlightTerms(q.question, query)}</span>
      ${meta ? `<span class="mt-0.5 block text-xs font-normal text-faint">${meta}</span>` : ''}
    </a>
    <span class="hidden shrink-0 sm:block" data-slot="status">${statusBadge(status)}</span>
    ${starButton(q)}
  </li>`;
}

export const rowList = (questions, opts) =>
  `<ul class="divide-y divide-line">${questions.map((q) => questionRow(q, typeof opts === 'function' ? opts(q) : opts)).join('')}</ul>`;

/** Reflect a question's current status and star on every copy of it on screen. */
export function syncQuestion(id) {
  const q = getQuestion(id);
  if (!q) return;
  const status = db.getStatus(id);
  const starred = db.isStarred(q);
  for (const root of $$(`[data-qid="${CSS.escape(id)}"]`)) {
    for (const b of $$('[data-action="learned"]', root)) b.setAttribute('aria-pressed', status === 'learned' || status === 'mastered');
    for (const b of $$('[data-action="revise"]', root)) b.setAttribute('aria-pressed', status === 'revision');
    for (const b of $$('[data-action="set-status"]', root)) b.setAttribute('aria-pressed', b.dataset.status === status);
    for (const slot of $$('[data-slot="status"]', root)) slot.innerHTML = statusBadge(status);
    for (const b of $$('[data-action="star"]', root)) {
      b.setAttribute('aria-pressed', starred);
      b.setAttribute('aria-label', starred ? 'Remove from important' : 'Mark as important');
      b.classList.toggle('!text-warn', starred);
      b.innerHTML = icon(starred ? 'star-fill' : 'star');
    }
  }
}

export function toggleStar(id, sourceEl) {
  const q = getQuestion(id);
  if (!q) return;
  const on = db.toggleStar(q);
  syncQuestion(id);
  if (sourceEl && on) {
    const svg = (document.contains(sourceEl) ? sourceEl : document).querySelector(`[data-qid="${CSS.escape(id)}"] [data-action="star"] svg`);
    if (svg) svg.classList.add('pop');
  }
  toast(on ? 'Added to important.' : 'Removed from important.');
}

export function toggleLearned(id) {
  const known = db.isKnown(id);
  db.setStatus(id, known ? 'new' : 'learned');
  syncQuestion(id);
  toast(known ? 'Status reset to new.' : 'Question marked as learned.');
}

export function toggleRevise(id) {
  const on = db.getStatus(id) === 'revision';
  db.setStatus(id, on ? 'learning' : 'revision');
  syncQuestion(id);
  toast(on ? 'Removed from revision.' : 'Added to revision.');
}

/** Practice results: "I know this" never downgrades a mastered question. */
export function markKnown(id) {
  if (db.getStatus(id) !== 'mastered') db.setStatus(id, 'learned');
}
export const markRevise = (id) => db.setStatus(id, 'revision');

/** Handles data-action clicks anywhere in the app. Returns true if handled. */
export function handleAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return false;
  const action = btn.dataset.action;
  const host = btn.closest('[data-qid]');
  const id = host && host.dataset.qid;
  switch (action) {
    case 'star':
      if (id) toggleStar(id, btn);
      return true;
    case 'learned':
      if (id) toggleLearned(id);
      return true;
    case 'revise':
      if (id) toggleRevise(id);
      return true;
    case 'set-status':
      if (id) {
        db.setStatus(id, btn.dataset.status);
        syncQuestion(id);
        toast(`Status set to ${STATUS_LABEL[btn.dataset.status].toLowerCase()}.`);
      }
      return true;
    case 'copy-link':
      if (id) copyText(absoluteLink(href(`/questions/${id}`))).then((ok) => toast(ok ? 'Link copied to clipboard.' : 'Copy failed. Copy the address from the browser bar instead.', ok ? 'ok' : 'error'));
      return true;
    case 'copy-code': {
      const pre = btn.closest('.codeblock')?.querySelector('pre');
      if (!pre) return true;
      copyText(pre.textContent).then((ok) => {
        const label = btn.querySelector('span');
        if (ok && label) {
          label.textContent = 'Copied!';
          setTimeout(() => (label.textContent = 'Copy'), 1600);
        }
        toast(ok ? 'Copied to clipboard.' : 'Copy failed. Select the code and copy it manually.', ok ? 'ok' : 'error');
      });
      return true;
    }
    case 'to-playground': {
      const pre = btn.closest('.codeblock')?.querySelector('pre');
      if (!pre) return true;
      try {
        sessionStorage.setItem('devprep:playground', JSON.stringify({ lang: btn.dataset.lang, code: pre.textContent }));
      } catch (err) { /* the playground simply opens with its last content */ }
      location.hash = href('/playground');
      return true;
    }
    default:
      return false;
  }
}

/* ---------- Layout pieces ---------- */

export function pageHeader({ title, subtitle = '', actions = '', crumbs = [] }) {
  const trail = crumbs.length
    ? `<nav aria-label="Breadcrumb" class="mb-2 flex flex-wrap items-center gap-1 text-[0.8125rem] text-faint">
        ${crumbs.map((c) => (c.href ? `<a class="hover:text-ink" href="${c.href}">${esc(c.label)}</a>` : `<span class="text-muted">${esc(c.label)}</span>`)).join(icon('chevron-right', 'h-3.5 w-3.5'))}
      </nav>`
    : '';
  return `<header class="mb-5 sm:mb-6">
    ${trail}
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div class="min-w-0">
        <h1 class="text-2xl sm:text-[1.75rem] sm:leading-9">${esc(title)}</h1>
        ${subtitle ? `<p class="mt-1 max-w-2xl text-muted">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>` : ''}
    </div>
  </header>`;
}

export const sectionTitle = (title, action = '', id = '') =>
  `<div class="mb-2.5 flex items-center justify-between gap-3"><h2 class="text-base"${id ? ` id="${id}"` : ''}>${esc(title)}</h2>${action}</div>`;

export const progressBar = (value, label) =>
  `<div class="progress" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label || 'Progress')}"><span style="width:${value}%"></span></div>`;

export function ring(value, size = 96, stroke = 8) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${value}%">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgb(var(--raised))" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgb(var(--ink))" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - value / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="rgb(var(--ink))" font-size="${size * 0.24}" font-weight="600">${value}%</text>
  </svg>`;
}

export function emptyState({ icon: name = 'search', title, text = '', action = '' }) {
  return `<div class="card flex flex-col items-center px-6 py-10 text-center">
    <span class="flex h-11 w-11 items-center justify-center rounded-full bg-raised text-muted">${icon(name, 'h-5 w-5')}</span>
    <h2 class="mt-3 text-base">${esc(title)}</h2>
    ${text ? `<p class="mt-1 max-w-sm text-sm text-muted">${text}</p>` : ''}
    ${action ? `<div class="mt-4 flex flex-wrap justify-center gap-2">${action}</div>` : ''}
  </div>`;
}

export const notice = (html, kind = 'info') =>
  `<div class="flex gap-2.5 rounded-card border ${kind === 'warn' ? 'border-warn/30 bg-warn/10' : 'border-line bg-raised'} px-3.5 py-3 text-sm text-muted">
    <span class="mt-0.5 ${kind === 'warn' ? 'text-warn' : ''}">${icon(kind === 'warn' ? 'alert' : 'info')}</span><div class="min-w-0">${html}</div>
  </div>`;

/* ---------- Next / previous context ---------- */

// The list the reader last browsed, so N and P on a question page follow it.
export function setListContext(ids) {
  try {
    sessionStorage.setItem('devprep:list', JSON.stringify(ids.slice(0, 500)));
  } catch (e) { /* ignore */ }
}
export function getListContext() {
  try {
    const ids = JSON.parse(sessionStorage.getItem('devprep:list') || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch (e) {
    return [];
  }
}

/** Skill progress numbers used across dashboard, skills and paths. */
export function progressOf(questions) {
  const out = { total: questions.length, new: 0, learning: 0, learned: 0, revision: 0, mastered: 0, starred: 0 };
  for (const q of questions) {
    out[db.getStatus(q.id)]++;
    if (db.isStarred(q)) out.starred++;
  }
  out.known = out.learned + out.mastered;
  out.percent = out.total ? Math.round((out.known / out.total) * 100) : 0;
  return out;
}

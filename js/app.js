// App shell: boot, hash router, sidebar, mobile navigation, command palette
// and keyboard shortcuts. Hash routes (#/questions/php-001) need no server
// rewrites, so the site works unchanged on GitHub Pages, Vercel or any
// static host.

import { $, $$, esc, icon, href, parseHash, modal, closeTopModal, modalOpen, toast, debounce } from './utils.js';
import * as db from './storage.js';
import { store, loadAll, skillName } from './data.js';
import { search, highlightTerms } from './search.js';
import { handleAction, skillChip, difficultyBadge, emptyState } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderExplorer } from './views/questions.js';
import { renderQuestion } from './views/question.js';
import { renderSkills, renderSkill, renderTopic, renderPath } from './views/skills.js';
import { renderPractice, renderInterview, renderFlashcards, renderCoding } from './views/practice.js';
import { renderPlayground } from './views/playground.js';
import { renderManager, renderForm } from './views/manager.js';
import { renderHistory } from './views/history.js';
import { renderSettings, renderBackup } from './views/settings.js';

const SITE = 'DevPrep';
const main = $('#main');
let current = null; // context of the view on screen

/* ---------- Routes ---------- */

const routes = [
  { test: (s) => s.length === 0, view: renderDashboard, nav: '/' },
  { test: (s) => s[0] === 'questions' && s.length === 1, view: (c) => renderExplorer(c, 'all'), nav: '/questions' },
  { test: (s) => s[0] === 'questions' && s.length === 2, view: renderQuestion, nav: '/questions' },
  { test: (s) => s[0] === 'important', view: (c) => renderExplorer(c, 'important'), nav: '/important' },
  { test: (s) => s[0] === 'revision', view: (c) => renderExplorer(c, 'revision'), nav: '/revision' },
  { test: (s) => s[0] === 'skills' && s.length === 1, view: renderSkills, nav: '/skills' },
  { test: (s) => s[0] === 'skills' && s.length === 2, view: renderSkill, nav: (s) => `/skills/${s[1]}` },
  { test: (s) => s[0] === 'skills' && s.length === 3, view: renderTopic, nav: (s) => `/skills/${s[1]}` },
  { test: (s) => s[0] === 'path', view: renderPath, nav: '/path' },
  { test: (s) => s[0] === 'practice', view: renderPractice, nav: '/practice' },
  { test: (s) => s[0] === 'interview', view: renderInterview, nav: '/interview' },
  { test: (s) => s[0] === 'flashcards', view: renderFlashcards, nav: '/flashcards' },
  { test: (s) => s[0] === 'coding', view: renderCoding, nav: '/skills/coding-logic' },
  { test: (s) => s[0] === 'playground', view: renderPlayground, nav: '/playground' },
  { test: (s) => s[0] === 'manager' && s.length === 1, view: renderManager, nav: '/manager' },
  { test: (s) => s[0] === 'manager' && (s[1] === 'new' || s[1] === 'edit'), view: renderForm, nav: '/manager' },
  { test: (s) => s[0] === 'history', view: renderHistory, nav: '/history' },
  { test: (s) => s[0] === 'backup', view: renderBackup, nav: '/backup' },
  { test: (s) => s[0] === 'settings', view: renderSettings, nav: '/settings' },
];

export function navigate(path, query) {
  location.hash = href(path, query);
}

function route() {
  const { path, segments, query } = parseHash();
  if (current && current.onLeave) {
    try { current.onLeave(); } catch (e) { console.error(e); }
  }
  closeDrawer();
  const match = routes.find((r) => r.test(segments));
  const ctx = {
    main, path, segments, query, keys: {}, onLeave: null, navigate,
    setTitle(t) { document.title = t ? `${t} — ${SITE}` : `${SITE} — PHP & Laravel Interview Preparation`; },
  };
  current = ctx;
  try {
    if (match) match.view(ctx);
    else notFound(ctx);
  } catch (e) {
    console.error(e);
    main.innerHTML = emptyState({
      icon: 'alert',
      title: 'This page hit an error',
      text: `${esc(e.message)} Reloading usually fixes it. Your saved progress is not affected.`,
      action: `<a class="btn btn-primary" href="#/">Go to dashboard</a>`,
    });
  }
  const navPath = match ? (typeof match.nav === 'function' ? match.nav(segments) : match.nav) : '';
  markActive(navPath);
  window.scrollTo(0, 0);
}

function notFound(ctx) {
  ctx.setTitle('Page not found');
  main.innerHTML = emptyState({
    icon: 'search',
    title: 'Page not found',
    text: 'That address does not match anything in DevPrep.',
    action: `<a class="btn btn-primary" href="#/">Go to dashboard</a><a class="btn" href="#/questions">Browse questions</a>`,
  });
}

function markActive(navPath) {
  for (const a of $$('[data-nav]')) {
    if (a.dataset.nav === navPath) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const tab = navPath === '/' ? '/' : ['/questions', '/important', '/revision'].includes(navPath) ? '/questions'
    : ['/practice', '/interview', '/flashcards', '/playground'].includes(navPath) ? '/practice'
    : navPath.startsWith('/skills') || navPath === '/path' ? '/skills' : '';
  for (const a of $$('[data-tab]')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/* ---------- Shell ---------- */

const navItem = (path, label, ic, countKey = '') =>
  `<a class="nav-link" href="${href(path)}" data-nav="${path}">${icon(ic)}<span class="truncate">${esc(label)}</span>${countKey ? `<span class="nav-count" data-count="${countKey}"></span>` : ''}</a>`;
const navGroup = (label, items) =>
  `<div class="mt-5"><h2 class="mb-1 px-2.5 text-xs font-medium text-faint">${label}</h2><div class="space-y-px">${items}</div></div>`;

function buildShell() {
  const skillLinks = store.skills
    .map(
      (s) => `<a class="nav-link" href="${href(`/skills/${s.id}`)}" data-nav="/skills/${s.id}">
        <span class="flex h-4 w-4 items-center justify-center"><span class="dot" style="background:${esc(s.color || '#888')}"></span></span>
        <span class="truncate">${esc(s.name)}</span><span class="nav-count" data-count="skill:${s.id}"></span></a>`,
    )
    .join('');

  const sidebar = $('#sidebar');
  sidebar.className =
    'fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[86vw] -translate-x-full flex-col border-r border-line bg-surface transition-transform duration-200 data-[open=true]:translate-x-0 lg:w-64 lg:translate-x-0';
  sidebar.innerHTML = `
    <div class="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
      <a href="#/" class="flex items-center gap-2.5 rounded-ctl">
        <img src="assets/icon.svg" alt="" width="30" height="30" class="rounded-lg">
        <span><span class="block text-[0.9375rem] font-semibold leading-tight">DevPrep</span>
        <span class="block text-xs leading-tight text-faint">Interview Knowledge Base</span></span>
      </a>
      <button type="button" class="btn btn-ghost btn-icon btn-sm lg:hidden" data-drawer-close aria-label="Close menu">${icon('x')}</button>
    </div>
    <div class="px-3">
      <button type="button" class="input flex items-center gap-2 text-left !text-faint" data-open-search>
        ${icon('search')}<span class="flex-1">Search questions</span><span class="kbd">Ctrl K</span>
      </button>
    </div>
    <nav class="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Sections">
      ${navGroup('Overview', navItem('/', 'Dashboard', 'home'))}
      ${navGroup('Learn',
        navItem('/questions', 'All Questions', 'list', 'all') +
        navItem('/important', 'Important', 'star', 'important') +
        navItem('/revision', 'Revision', 'refresh', 'revision') +
        navItem('/interview', 'Random Interview', 'shuffle') +
        navItem('/flashcards', 'Flashcards', 'layers') +
        navItem('/path', 'Learning Path', 'route'))}
      ${navGroup(`<a href="#/skills" class="hover:text-ink">Skills</a>`, skillLinks)}
      ${navGroup('Tools',
        navItem('/playground', 'Code Playground', 'terminal') +
        `<button type="button" class="nav-link w-full" data-open-search>${icon('search')}<span>Search</span></button>` +
        navItem('/manager', 'Content Manager', 'database') +
        navItem('/history', 'Interview History', 'briefcase') +
        navItem('/backup', 'Import / Export', 'download'))}
    </nav>
    <div class="flex items-center gap-1 border-t border-line px-3 py-2.5">
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-theme-toggle aria-label="Switch theme" title="Switch theme"></button>
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-open-shortcuts aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">${icon('keyboard')}</button>
      <a class="btn btn-ghost btn-sm ml-auto" href="#/settings" data-nav="/settings">${icon('settings')}Settings</a>
    </div>`;

  const topbar = $('#topbar');
  topbar.className = 'sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-surface/95 px-2 backdrop-blur lg:hidden';
  topbar.innerHTML = `
    <button type="button" class="btn btn-ghost btn-icon" data-drawer-open aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${icon('menu', 'h-5 w-5')}</button>
    <a href="#/" class="flex items-center gap-2 px-1 text-[0.9375rem] font-semibold"><img src="assets/icon.svg" alt="" width="24" height="24" class="rounded-md">DevPrep</a>
    <span class="flex-1"></span>
    <button type="button" class="btn btn-ghost btn-icon" data-open-search aria-label="Search questions">${icon('search', 'h-5 w-5')}</button>
    <button type="button" class="btn btn-ghost btn-icon" data-theme-toggle aria-label="Switch theme"></button>`;

  const tab = (path, label, ic) => `<a class="tabbar-link" href="${href(path)}" data-tab="${path}">${icon(ic, 'h-5 w-5')}<span>${label}</span></a>`;
  const tabbar = $('#tabbar');
  tabbar.className = 'fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-safe backdrop-blur lg:hidden';
  tabbar.innerHTML =
    tab('/', 'Home', 'home') + tab('/questions', 'Questions', 'list') + tab('/practice', 'Practice', 'bolt') + tab('/skills', 'Skills', 'grid') +
    `<button type="button" class="tabbar-link" data-drawer-open aria-label="More: open menu">${icon('more', 'h-5 w-5')}<span>More</span></button>`;

  if (!$('#backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'backdrop';
    backdrop.className = 'fixed inset-0 z-[35] bg-black/45 lg:hidden';
    backdrop.hidden = true;
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);
  }
  paintTheme();
  updateCounts();
}

function updateCounts() {
  const counts = { all: store.questions.length, important: 0, revision: 0 };
  const perSkill = {};
  for (const q of store.questions) {
    perSkill[q.skill] = (perSkill[q.skill] || 0) + 1;
    if (db.isStarred(q)) counts.important++;
    if (db.getStatus(q.id) === 'revision') counts.revision++;
  }
  for (const el of $$('[data-count]')) {
    const key = el.dataset.count;
    const n = key.startsWith('skill:') ? perSkill[key.slice(6)] || 0 : counts[key];
    el.textContent = n || '';
  }
}

/* ---------- Mobile drawer ---------- */

let drawerReturn = null;
function openDrawer() {
  const sidebar = $('#sidebar');
  drawerReturn = document.activeElement;
  sidebar.dataset.open = 'true';
  $('#backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  for (const b of $$('[data-drawer-open]')) b.setAttribute('aria-expanded', 'true');
  sidebar.querySelector('[data-drawer-close]').focus();
}
function closeDrawer() {
  const sidebar = $('#sidebar');
  if (!sidebar || sidebar.dataset.open !== 'true') return false;
  sidebar.dataset.open = 'false';
  $('#backdrop').hidden = true;
  if (!modalOpen()) document.body.style.overflow = '';
  for (const b of $$('[data-drawer-open]')) b.setAttribute('aria-expanded', 'false');
  if (drawerReturn && document.contains(drawerReturn)) drawerReturn.focus({ preventScroll: true });
  return true;
}

/* ---------- Theme ---------- */

const activeTheme = () => document.documentElement.dataset.theme;
function paintTheme() {
  const dark = activeTheme() === 'dark';
  for (const b of $$('[data-theme-toggle]')) {
    b.innerHTML = icon(dark ? 'sun' : 'moon', b.closest('#topbar') ? 'h-5 w-5' : 'h-4 w-4');
    b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  const meta = $('#theme-color');
  if (meta) meta.content = dark ? '#0f1116' : '#f6f7f9';
}
export function applySettings() {
  const s = db.getSettings();
  const theme = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme;
  document.documentElement.dataset.theme = theme;
  if (s.reduceMotion) document.documentElement.dataset.motion = 'reduced';
  else delete document.documentElement.dataset.motion;
  paintTheme();
}
function toggleTheme() {
  db.setSetting('theme', activeTheme() === 'dark' ? 'light' : 'dark');
  applySettings();
}

/* ---------- Command palette (Ctrl + K) ---------- */

const PAGES = [
  ['Dashboard', '/', 'home'], ['All questions', '/questions', 'list'], ['Important questions', '/important', 'star'],
  ['Revision queue', '/revision', 'refresh'], ['Random interview', '/interview', 'shuffle'], ['Flashcards', '/flashcards', 'layers'],
  ['Coding problems', '/coding', 'code'], ['Code playground', '/playground', 'terminal'], ['Learning path', '/path', 'route'],
  ['Add a question', '/manager/new', 'plus'], ['Content manager', '/manager', 'database'], ['Interview history', '/history', 'briefcase'],
  ['Import / export', '/backup', 'download'], ['Settings', '/settings', 'settings'],
];
let palette = null;

export function openSearch(initial = '') {
  if (palette) return;
  palette = modal({
    top: true,
    bare: true,
    size: 'md',
    label: 'Search questions',
    body: `<div class="flex items-center gap-2.5 border-b border-line px-4">
        <span class="text-faint">${icon('search', 'h-5 w-5')}</span>
        <input type="search" autofocus autocomplete="off" spellcheck="false" class="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint"
          placeholder="Search questions, answers, tags…" aria-label="Search questions" role="combobox" aria-expanded="true" aria-controls="palette-results" value="${esc(initial)}">
        <button type="button" class="kbd" data-close aria-label="Close search">Esc</button>
      </div>
      <div id="palette-results" role="listbox" aria-label="Results" class="max-h-[60dvh] overflow-y-auto p-1.5"></div>
      <div class="hidden items-center gap-3 border-t border-line px-4 py-2 text-xs text-faint sm:flex">
        <span><span class="kbd">↑</span> <span class="kbd">↓</span> move</span><span><span class="kbd">Enter</span> open</span>
        <span class="ml-auto" data-palette-count></span>
      </div>`,
    onClose: () => { palette = null; },
  });
  const input = palette.el.querySelector('input');
  const results = palette.el.querySelector('#palette-results');
  const countEl = palette.el.querySelector('[data-palette-count]');
  let active = 0;

  const option = (link, inner) => `<a role="option" href="${link}" class="flex items-center gap-3 rounded-ctl px-2.5 py-2 aria-selected:bg-raised" aria-selected="false">${inner}</a>`;
  const heading = (t) => `<div class="px-2.5 pb-1 pt-2 text-xs font-medium text-faint">${t}</div>`;

  function paint() {
    const query = input.value.trim();
    let html = '';
    if (!query) {
      const recent = db.getRecent().map((r) => store.byId.get(r.id)).filter(Boolean).slice(0, 5);
      if (recent.length) {
        html += heading('Recently viewed') + recent.map((q) => option(href(`/questions/${q.id}`), `${icon('clock', 'h-4 w-4 text-faint')}<span class="min-w-0 flex-1 truncate text-sm">${esc(q.question)}</span><span class="text-xs text-faint">${esc(skillName(q.skill))}</span>`)).join('');
      }
      html += heading('Go to') + PAGES.slice(0, 8).map(([label, path, ic]) => option(href(path), `${icon(ic, 'h-4 w-4 text-faint')}<span class="text-sm">${label}</span>`)).join('');
      countEl.textContent = '';
    } else {
      const ql = query.toLowerCase();
      const pages = PAGES.filter(([label]) => label.toLowerCase().includes(ql)).slice(0, 3);
      const skills = store.skills.filter((s) => s.name.toLowerCase().includes(ql)).slice(0, 3);
      const found = search(query);
      const shown = found.slice(0, 12);
      html += pages.map(([label, path, ic]) => option(href(path), `${icon(ic, 'h-4 w-4 text-faint')}<span class="text-sm">${label}</span><span class="ml-auto text-xs text-faint">Page</span>`)).join('');
      html += skills.map((s) => option(href(`/skills/${s.id}`), `<span class="flex h-4 w-4 items-center justify-center"><span class="dot" style="background:${esc(s.color)}"></span></span><span class="text-sm">${esc(s.name)}</span><span class="ml-auto text-xs text-faint">Skill</span>`)).join('');
      html += shown
        .map((q) => option(href(`/questions/${q.id}`), `<span class="min-w-0 flex-1">
            <span class="block text-sm font-medium leading-snug">${highlightTerms(q.question, query)}</span>
            <span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-faint">${skillChip(q.skill)}<span>${esc(q.topic)}</span>${difficultyBadge(q.difficulty)}${q.tags.slice(0, 3).map((t) => `<span>#${highlightTerms(t, query)}</span>`).join('')}</span>
          </span>`))
        .join('');
      if (found.length > shown.length) {
        html += option(href('/questions', { q: query }), `${icon('list', 'h-4 w-4 text-faint')}<span class="text-sm">See all ${found.length} results for “${esc(query)}”</span>`);
      }
      if (!found.length && !pages.length && !skills.length) {
        html = `<div class="px-4 py-8 text-center"><p class="font-medium">No questions matched “${esc(query)}”.</p>
          <p class="mt-1 text-sm text-muted">Try a shorter word such as “join” or “middleware”, or <a class="link" href="${href('/manager/new', { question: query })}">add it as a new question</a>.</p></div>`;
      }
      countEl.textContent = found.length ? `${found.length} question${found.length === 1 ? '' : 's'}` : '';
    }
    results.innerHTML = html;
    active = 0;
    select();
  }
  function select() {
    const opts = $$('[role="option"]', results);
    opts.forEach((o, i) => o.setAttribute('aria-selected', i === active));
    if (opts[active]) opts[active].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', debounce(paint, 200));
  input.addEventListener('keydown', (e) => {
    const opts = $$('[role="option"]', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!opts.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      select();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (opts[active]) opts[active].click();
    }
  });
  results.addEventListener('click', (e) => {
    if (e.target.closest('a')) setTimeout(() => palette && palette.close(), 0);
  });
  results.addEventListener('mousemove', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (!opt) return;
    const i = $$('[role="option"]', results).indexOf(opt);
    if (i !== active) { active = i; select(); }
  });
  paint();
  input.select();
}

/* ---------- Shortcuts ---------- */

const SHORTCUTS = [
  ['Ctrl + K', 'Search everything'], ['/', 'Search everything'], ['N', 'Next question'], ['P', 'Previous question'],
  ['R', 'Open a random question'], ['F', 'Mark as important'], ['M', 'Mark as learned'],
  ['Space', 'Reveal the answer (flashcards and interview)'], ['1 / 2', 'I know this / Need revision (practice modes)'],
  ['?', 'Show this list'], ['Esc', 'Close a dialog or menu'],
];
function openShortcuts() {
  modal({
    title: 'Keyboard shortcuts',
    size: 'sm',
    body: `<dl class="divide-y divide-line">${SHORTCUTS.map(([k, d]) => `<div class="flex items-center justify-between gap-4 py-2"><dt class="text-sm text-muted">${d}</dt><dd>${k.split(' + ').map((p) => `<span class="kbd">${p}</span>`).join(' ')}</dd></div>`).join('')}</dl>
      <p class="mt-3 text-xs text-faint">Single-key shortcuts are off while you are typing in a field.</p>`,
  });
}

function randomQuestion() {
  if (!store.questions.length) return;
  const pool = store.questions.filter((q) => q.id !== (current && current.segments[1]));
  const q = pool[Math.floor(Math.random() * pool.length)] || store.questions[0];
  navigate(`/questions/${q.id}`);
}

function onKeydown(e) {
  const key = e.key;
  if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'k') {
    e.preventDefault();
    if (palette) palette.close();
    else openSearch();
    return;
  }
  if (key === 'Escape') {
    if (closeTopModal() || closeDrawer()) e.preventDefault();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if (typing || modalOpen()) return;

  const k = key === ' ' ? 'space' : key.toLowerCase();
  const handler = current && current.keys[k];
  if (handler) {
    // Let Space and Enter keep their normal job on a focused button or link.
    if (k === 'space' && /^(BUTTON|A|SUMMARY)$/.test(t.tagName)) return;
    e.preventDefault();
    handler(e);
    return;
  }
  if (k === '/') { e.preventDefault(); openSearch(); }
  else if (k === '?') { e.preventDefault(); openShortcuts(); }
  else if (k === 'r') { e.preventDefault(); randomQuestion(); }
}

/* ---------- Boot ---------- */

function bindGlobal() {
  document.addEventListener('click', (e) => {
    if (handleAction(e)) return;
    if (e.target.closest('[data-open-search]')) { closeDrawer(); openSearch(); }
    else if (e.target.closest('[data-theme-toggle]')) toggleTheme();
    else if (e.target.closest('[data-open-shortcuts]')) { closeDrawer(); openShortcuts(); }
    else if (e.target.closest('[data-drawer-open]')) openDrawer();
    else if (e.target.closest('[data-drawer-close]')) closeDrawer();
    else if (e.target.closest('[data-random]')) randomQuestion();
  });
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('hashchange', route);
  window.addEventListener('devprep:change', (e) => {
    updateCounts();
    if (e.detail && ['import', 'clear', 'settings'].includes(e.detail.what)) applySettings();
  });
  window.addEventListener('devprep:data', updateCounts);
  window.addEventListener('devprep:storage-error', () => toast('Could not save: browser storage is full or blocked. Export a backup from Import / Export.', 'error'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
}

async function boot() {
  db.load();
  applySettings();
  bindGlobal();
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    const local = location.protocol === 'file:';
    main.innerHTML = emptyState({
      icon: 'alert',
      title: 'The question data could not be loaded',
      text: local
        ? 'DevPrep was opened straight from a file. Browsers block data loading that way — serve the folder instead, for example with <code class="font-mono">python3 -m http.server</code>, then open the address it prints.'
        : `${esc(e.message)} Check that the <code class="font-mono">data/</code> folder was deployed, then reload.`,
      action: `<button type="button" class="btn btn-primary" onclick="location.reload()">Reload</button>`,
    });
    return;
  }
  buildShell();
  route();
  if (db.loadWarning) toast(db.loadWarning, 'error');

  const host = location.hostname;
  if ('serviceWorker' in navigator && location.protocol === 'https:' && host !== 'localhost') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();

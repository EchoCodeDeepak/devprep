// Question explorer: search, combinable filters, sorting. Also powers the
// Important and Revision pages, which are the same list with a fixed filter.

import { $, $$, esc, icon, href, debounce, modal, plural } from '../utils.js';
import { store, DIFFICULTIES, TYPES, PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, skillName, byOrder } from '../data.js';
import * as db from '../storage.js';
import { search } from '../search.js';
import { pageHeader, questionCard, rowList, emptyState, setListContext } from '../ui.js';

const PRESETS = {
  all: { title: 'All questions', subtitle: 'Search and filter the whole knowledge base.', path: '/questions' },
  important: { title: 'Important questions', subtitle: 'Starred and high-priority questions to know before an interview.', path: '/important' },
  revision: { title: 'Revision', subtitle: 'Questions you marked to see again.', path: '/revision' },
};

const SORTS = [
  ['order', 'Learning order'], ['relevance', 'Best match'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['alpha', 'Alphabetical'],
  ['difficulty', 'Difficulty'], ['important', 'Important first'], ['priority', 'Revision priority'], ['viewed', 'Recently viewed'],
];

const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const PRI = { critical: 0, high: 1, medium: 2, normal: 3 };

export function renderExplorer(ctx, presetKey) {
  const preset = PRESETS[presetKey];
  ctx.setTitle(preset.title);
  const settings = db.getSettings();
  const mem = db.getFilters();

  const f = {
    q: ctx.query.q || '',
    skill: csv(ctx.query.skill).filter((s) => store.skillMap.has(s)),
    difficulty: csv(ctx.query.difficulty).filter((d) => DIFFICULTIES.includes(d)),
    type: csv(ctx.query.type).filter((t) => TYPES.includes(t)),
    priority: csv(ctx.query.priority).filter((p) => PRIORITIES.includes(p)),
    status: csv(ctx.query.status).filter((s) => db.STATUSES.includes(s)),
    topic: ctx.query.topic || '',
    tag: ctx.query.tag || '',
    sort: ctx.query.sort || (presetKey === 'important' ? 'priority' : mem.sort) || 'order',
  };
  if (!SORTS.some(([k]) => k === f.sort)) f.sort = 'order';
  let view = settings.view;
  let shown = settings.perPage;
  let panelOpen = false;

  const GROUPS = [
    { key: 'skill', label: 'Skill', options: store.skills.map((s) => [s.id, s.name]) },
    { key: 'difficulty', label: 'Difficulty', options: DIFFICULTIES.map((d) => [d, d]) },
    { key: 'type', label: 'Question type', options: TYPES.map((t) => [t, t]) },
    { key: 'priority', label: 'Priority', options: PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]]) },
    ...(presetKey === 'revision' ? [] : [{ key: 'status', label: 'Status', options: db.STATUSES.map((s) => [s, STATUS_LABEL[s]]) }]),
  ];
  const labelOf = (key, value) => GROUPS.find((g) => g.key === key)?.options.find((o) => o[0] === value)?.[1] || value;

  const groupsHtml = () =>
    GROUPS.map(
      (g) => `<fieldset class="min-w-0">
        <legend class="mb-1.5 text-[0.8125rem] font-medium text-ink">${g.label}</legend>
        <div class="flex flex-wrap gap-1.5">
          ${g.options.map(([value, label]) => `<button type="button" class="chip" data-filter="${g.key}" data-value="${esc(value)}" aria-pressed="${f[g.key].includes(value)}">${esc(label)}</button>`).join('')}
        </div>
      </fieldset>`,
    ).join('');

  // With a search term, "Learning order" gives way to best match; without one, best match means nothing.
  const effectiveSort = (query) => (query ? (f.sort === 'order' ? 'relevance' : f.sort) : f.sort === 'relevance' ? 'order' : f.sort);

  function compute() {
    let items = store.questions;
    if (presetKey === 'important') items = items.filter((q) => db.isStarred(q) || q.priority === 'critical');
    if (presetKey === 'revision') items = items.filter((q) => db.getStatus(q.id) === 'revision');
    if (f.skill.length) items = items.filter((q) => f.skill.includes(q.skill));
    if (f.difficulty.length) items = items.filter((q) => f.difficulty.includes(q.difficulty));
    if (f.type.length) items = items.filter((q) => f.type.includes(q.type));
    if (f.priority.length) items = items.filter((q) => f.priority.includes(q.priority));
    if (f.status.length) items = items.filter((q) => f.status.includes(db.getStatus(q.id)));
    if (f.topic) items = items.filter((q) => q.topic === f.topic);
    if (f.tag) items = items.filter((q) => q.tags.includes(f.tag));
    const query = f.q.trim();
    if (query) items = search(query, { within: items });

    const sort = effectiveSort(query);
    const skillPos = new Map(store.skills.map((s, i) => [s.id, i]));
    const sorters = {
      order: (a, b) => skillPos.get(a.skill) - skillPos.get(b.skill) || byOrder(a, b),
      newest: (a, b) => b._added - a._added || b._seq - a._seq,
      oldest: (a, b) => a._added - b._added || a._seq - b._seq,
      alpha: (a, b) => a.question.localeCompare(b.question),
      difficulty: (a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty) || a._seq - b._seq,
      important: (a, b) => Number(db.isStarred(b)) - Number(db.isStarred(a)) || PRI[a.priority] - PRI[b.priority] || a._seq - b._seq,
      priority: (a, b) => PRI[a.priority] - PRI[b.priority] || a._seq - b._seq,
      viewed: (a, b) => db.viewedAt(b.id) - db.viewedAt(a.id) || a._seq - b._seq,
    };
    if (sort !== 'relevance') items = items.slice().sort(sorters[sort]);
    return items;
  }

  const activeCount = () => f.skill.length + f.difficulty.length + f.type.length + f.priority.length + f.status.length + (f.topic ? 1 : 0) + (f.tag ? 1 : 0);

  function syncUrl() {
    const query = { q: f.q.trim(), skill: f.skill, difficulty: f.difficulty, type: f.type, priority: f.priority, status: f.status, topic: f.topic, tag: f.tag };
    const defaultSort = presetKey === 'important' ? 'priority' : 'order';
    if (f.sort !== defaultSort && f.sort !== 'relevance') query.sort = f.sort;
    history.replaceState(null, '', href(preset.path, query));
    db.setFilters({ sort: f.sort === 'relevance' ? 'order' : f.sort });
  }

  function emptyFor(query) {
    if (query || activeCount()) {
      return emptyState({
        icon: 'search',
        title: 'No questions matched your search.',
        text: `${query ? 'Try a shorter or more general word.' : 'No question fits this combination of filters.'} ${activeCount() ? 'Removing a filter will widen the results.' : ''}`,
        action: `<button type="button" class="btn btn-primary" data-clear>Clear search and filters</button>${query ? `<a class="btn" href="${href('/manager/new', { question: query })}">Add “${esc(query.slice(0, 30))}” as a question</a>` : ''}`,
      });
    }
    if (presetKey === 'revision') return emptyState({ icon: 'check', title: 'You are all caught up! 🎉', text: 'Nothing is marked for revision. Press “Revise” on any question you want to come back to.', action: `<a class="btn" href="#/questions">Browse questions</a>` });
    if (presetKey === 'important') return emptyState({ icon: 'star', title: 'No important questions yet', text: 'Star important questions to access them here.', action: `<a class="btn" href="#/questions">Browse questions</a>` });
    return emptyState({ icon: 'database', title: 'No questions found.', text: 'The data files are empty or failed to load. Check the Content Manager for details.', action: `<a class="btn" href="#/manager">Open Content Manager</a>` });
  }

  function paint() {
    const items = compute();
    const query = f.q.trim();
    setListContext(items.map((q) => q.id));
    const visible = items.slice(0, shown);
    const n = activeCount();

    $('[data-result-count]', ctx.main).textContent = `${plural(items.length, 'question')}${query ? ` for “${query}”` : ''}`;
    const fb = $('[data-filter-count]', ctx.main);
    fb.textContent = n || '';
    fb.hidden = !n;

    const chips = [];
    for (const g of GROUPS) for (const v of f[g.key]) chips.push([g.key, v, labelOf(g.key, v)]);
    if (f.topic) chips.push(['topic', f.topic, `Topic: ${f.topic}`]);
    if (f.tag) chips.push(['tag', f.tag, `#${f.tag}`]);
    $('[data-active]', ctx.main).innerHTML = chips.length
      ? chips.map(([k, v, label]) => `<button type="button" class="badge gap-1.5 py-1 hover:text-ink" data-remove="${k}" data-value="${esc(v)}" aria-label="Remove filter ${esc(label)}">${esc(label)}${icon('x', 'h-3 w-3')}</button>`).join('') +
        `<button type="button" class="link text-[0.8125rem]" data-clear>Clear all</button>`
      : '';

    const sortSel = $('[data-sort]', ctx.main);
    sortSel.value = effectiveSort(query);
    sortSel.querySelector('option[value="relevance"]').hidden = !query;

    const host = $('[data-results]', ctx.main);
    if (!items.length) host.innerHTML = emptyFor(query);
    else {
      host.innerHTML =
        (view === 'compact'
          ? `<div class="card overflow-hidden">${rowList(visible, (q) => ({ query, meta: `${esc(skillName(q.skill))}, ${esc(q.topic)}, ${esc(q.difficulty)}` }))}</div>`
          : `<div class="grid grid-cols-1 gap-3 md:grid-cols-2">${visible.map((q) => questionCard(q, { query })).join('')}</div>`) +
        (items.length > shown
          ? `<div class="mt-5 text-center"><button type="button" class="btn" data-more>Show ${Math.min(settings.perPage, items.length - shown)} more</button>
             <p class="mt-2 text-xs text-faint">Showing ${visible.length} of ${items.length}</p></div>`
          : '');
    }
    for (const b of $$('[data-view]', ctx.main)) b.setAttribute('aria-pressed', b.dataset.view === view);
    for (const b of $$('[data-filter]')) b.setAttribute('aria-pressed', f[b.dataset.filter].includes(b.dataset.value));
    return items.length;
  }

  function changed({ keepShown = false } = {}) {
    if (!keepShown) shown = settings.perPage;
    syncUrl();
    return paint();
  }

  function toggle(key, value) {
    const i = f[key].indexOf(value);
    if (i >= 0) f[key].splice(i, 1);
    else f[key].push(value);
    // A topic only makes sense inside its skill.
    if (key === 'skill' && f.topic && f.skill.length !== 1) f.topic = '';
  }

  function clearAll() {
    f.q = '';
    for (const g of GROUPS) f[g.key] = [];
    f.topic = '';
    f.tag = '';
    $('[data-q]', ctx.main).value = '';
    changed();
  }

  ctx.main.innerHTML = `
    ${pageHeader({
      title: preset.title,
      subtitle: preset.subtitle,
      actions: `<a class="btn" href="${href('/flashcards', presetKey === 'all' ? {} : { deck: presetKey })}">${icon('layers')}Flashcards</a><a class="btn btn-primary" href="#/manager/new">${icon('plus')}Add question</a>`,
    })}
    <div class="sticky top-14 z-20 -mx-4 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <div class="flex gap-2">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Search in ${esc(preset.title.toLowerCase())}</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">${icon('search')}</span>
          <input type="search" class="input pl-9" data-q placeholder="Search question, answer, tag, topic…" value="${esc(f.q)}" autocomplete="off" spellcheck="false">
        </label>
        <button type="button" class="btn shrink-0" data-open-filters aria-label="Filters" aria-expanded="false" aria-controls="filter-panel">${icon('filter')}<span class="hidden xs:inline">Filters</span><span class="rounded-full bg-ink px-1.5 text-xs text-canvas" data-filter-count hidden></span></button>
      </div>
    </div>
    <div id="filter-panel" class="card card-pad mt-3 hidden gap-4" data-panel></div>
    <div class="mt-3 flex flex-wrap items-center gap-1.5 empty:hidden" data-active></div>
    <div class="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted" data-result-count aria-live="polite"></p>
      <div class="flex items-center gap-2">
        <label class="sr-only" for="sort">Sort by</label>
        <select id="sort" class="input !min-h-[2rem] w-auto py-1 text-[0.8125rem]" data-sort>${SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <div class="hidden rounded-ctl border border-line bg-surface p-0.5 sm:flex" role="group" aria-label="View">
          <button type="button" class="btn btn-ghost btn-icon btn-sm !min-h-[1.625rem]" data-view="cards" aria-label="Card view" title="Cards">${icon('grid')}</button>
          <button type="button" class="btn btn-ghost btn-icon btn-sm !min-h-[1.625rem]" data-view="compact" aria-label="Compact list view" title="Compact list">${icon('list')}</button>
        </div>
      </div>
    </div>
    <div data-results></div>`;

  const panel = $('[data-panel]', ctx.main);
  const filterBtn = $('[data-open-filters]', ctx.main);
  const paintPanel = () => {
    panel.innerHTML = groupsHtml();
    panel.classList.toggle('hidden', !panelOpen);
    panel.classList.toggle('grid', panelOpen);
    filterBtn.setAttribute('aria-expanded', panelOpen);
  };

  // Phones get the filters as a bottom sheet; larger screens expand them in place.
  function openFilters() {
    if (matchMedia('(min-width: 1024px)').matches) {
      panelOpen = !panelOpen;
      paintPanel();
      return;
    }
    const m = modal({
      title: 'Filters',
      body: `<div class="grid gap-5">${groupsHtml()}</div>`,
      footer: `<button type="button" class="btn" data-sheet-clear>Clear all</button><button type="button" class="btn btn-primary flex-1 sm:flex-none" data-close data-sheet-done></button>`,
    });
    const done = m.el.querySelector('[data-sheet-done]');
    const label = (count) => (done.textContent = `Show ${plural(count, 'question')}`);
    label(compute().length);
    m.el.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (chip) {
        toggle(chip.dataset.filter, chip.dataset.value);
        label(changed());
      } else if (e.target.closest('[data-sheet-clear]')) {
        for (const g of GROUPS) f[g.key] = [];
        f.topic = '';
        f.tag = '';
        label(changed());
      }
    });
  }

  ctx.main.addEventListener('click', onClick);
  function onClick(e) {
    const chip = e.target.closest('[data-filter]');
    if (chip) { toggle(chip.dataset.filter, chip.dataset.value); changed(); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const key = rm.dataset.remove;
      if (Array.isArray(f[key])) toggle(key, rm.dataset.value);
      else f[key] = '';
      changed();
      return;
    }
    if (e.target.closest('[data-clear]')) return clearAll();
    if (e.target.closest('[data-open-filters]')) return openFilters();
    if (e.target.closest('[data-more]')) { shown += settings.perPage; paint(); return; }
    const v = e.target.closest('[data-view]');
    if (v) { view = v.dataset.view; db.setSetting('view', view); paint(); }
  }
  const onInput = debounce(() => { f.q = $('[data-q]', ctx.main).value; changed(); }, 220);
  $('[data-q]', ctx.main).addEventListener('input', onInput);
  $('[data-sort]', ctx.main).addEventListener('change', (e) => { f.sort = e.target.value; changed(); });

  ctx.onLeave = () => ctx.main.removeEventListener('click', onClick);
  panelOpen = matchMedia('(min-width: 1024px)').matches && f.skill.length + f.difficulty.length + f.type.length + f.priority.length + f.status.length > 0;
  paintPanel();
  paint();
}

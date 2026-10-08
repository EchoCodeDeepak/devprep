// Content Manager and the add/edit form.
//
// Two kinds of content exist and the screens here keep them apart:
//   Static content  — /data/*.json, deployed with the site.
//   Browser data    — questions added or edited here, kept in LocalStorage
//                     until you export them and commit them to a data file.

import { $, $$, esc, icon, href, modal, confirmDialog, toast, codeBlock, copyText, download, debounce, timeAgo, plural, todayISO } from '../utils.js';
import { store, rebuild, normalize, validate, toJSON, nextId, getQuestion, skillName, DIFFICULTIES, TYPES, PRIORITIES, PRIORITY_LABEL, CODE_LANGS, topicsOf, isCoding } from '../data.js';
import * as db from '../storage.js';
import { search } from '../search.js';
import { pageHeader, emptyState, notice, skillChip } from '../ui.js';
import { LANG_LABEL } from '../utils.js';

const fileOf = (q) => `data/${store.skillMap.get(q.skill)?.file || `${q.skill}.json`}`;
// A coding problem is complete with a solution; other questions need both a spoken and a detailed answer.
const missing = (q) => {
  if (isCoding(q) && (q.statement || q.approach)) return q.codes.length || q.answer ? '' : 'No solution';
  if (!q.interviewAnswer) return 'No interview answer';
  if (!q.answer) return 'No detailed answer';
  return '';
};
const incomplete = (q) => Boolean(missing(q));
const sourceBadge = (q) =>
  q._override ? `<span class="badge badge-accent">Edited locally</span>` : q._local ? `<span class="badge badge-accent">Local</span>` : `<span class="badge">Static</span>`;

/* ---------- Export dialogs ---------- */

export function exportQuestionDialog(q) {
  const json = JSON.stringify(toJSON(q), null, 2);
  const m = modal({
    title: 'Export question JSON',
    size: 'lg',
    body: `<p class="mb-3 text-sm text-muted">Paste this object into the <code class="font-mono text-ink">"questions"</code> list in <code class="font-mono text-ink">${esc(fileOf(q))}</code>${q._override ? ', replacing the existing entry with the same id' : ''}. Add a comma after the entry before it. Then commit and deploy.</p>
      ${codeBlock(json, 'json', { title: fileOf(q) })}`,
    footer: `<button type="button" class="btn" data-dl>${icon('download')}Download .json</button><button type="button" class="btn btn-primary" data-cp autofocus>${icon('copy')}Copy JSON</button>`,
  });
  m.el.querySelector('[data-cp]').addEventListener('click', () => copyText(json).then((ok) => toast(ok ? 'Copied to clipboard.' : 'Copy failed. Select the JSON and copy it manually.', ok ? 'ok' : 'error')));
  m.el.querySelector('[data-dl]').addEventListener('click', () => { download(`${q.id}.json`, json); toast('Question exported successfully.'); });
}

function exportAllLocal() {
  const local = store.questions.filter((q) => q._local);
  if (!local.length) return toast('There are no local questions to export.', 'info');
  const byFile = {};
  for (const q of local) (byFile[fileOf(q)] = byFile[fileOf(q)] || []).push(toJSON(q));
  const text = JSON.stringify(byFile, null, 2);
  const m = modal({
    title: `Export ${plural(local.length, 'local question')}`,
    size: 'lg',
    body: `<p class="mb-3 text-sm text-muted">Grouped by the data file each question belongs in. Copy each group's entries into that file's <code class="font-mono text-ink">"questions"</code> list, commit, and deploy. After the deploy you can delete the local copies here.</p>
      ${codeBlock(text, 'json', { title: 'Local questions by file' })}`,
    footer: `<button type="button" class="btn btn-primary" data-dl autofocus>${icon('download')}Download devprep-questions.json</button>`,
  });
  m.el.querySelector('[data-dl]').addEventListener('click', () => { download('devprep-questions.json', text); toast('Questions exported successfully.'); });
}

/* ---------- Content Manager ---------- */

export function renderManager(ctx) {
  ctx.setTitle('Content Manager');
  let scope = ctx.query.scope || 'all';
  let query = '';
  let shown = 40;

  function rows() {
    let items = store.questions;
    if (scope === 'local') items = items.filter((q) => q._local);
    if (scope === 'review') items = items.filter(incomplete);
    if (scope === 'important') items = items.filter((q) => db.isStarred(q));
    if (query.trim()) items = search(query, { within: items });
    else items = items.slice().sort((a, b) => (b.updatedAt || b._added) - (a.updatedAt || a._added) || b._seq - a._seq);
    return items;
  }

  function paintList() {
    const items = rows();
    const host = $('[data-list]', ctx.main);
    $('[data-list-count]', ctx.main).textContent = plural(items.length, 'question');
    if (!items.length) {
      host.innerHTML = emptyState(
        scope === 'local' && !query
          ? { icon: 'plus', title: 'No local questions yet', text: 'Questions you add or edit in this browser are listed here until you export them into a data file.', action: `<a class="btn btn-primary" href="#/manager/new">Add a question</a>` }
          : scope === 'review' && !query
            ? { icon: 'check', title: 'Nothing needs review', text: 'Every question has an interview answer and a detailed explanation, and every coding problem has a solution.' }
            : { icon: 'search', title: 'No questions found.', text: 'Try a different search or switch to “All”.' },
      );
      return;
    }
    host.innerHTML = `<ul class="card divide-y divide-line">
      ${items.slice(0, shown).map((q) => `<li class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4" data-id="${esc(q.id)}">
        <div class="min-w-0 flex-1 basis-64">
          <a class="block text-sm font-medium leading-snug hover:underline" href="${href(`/questions/${q.id}`)}">${esc(q.question)}</a>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-faint">
            ${skillChip(q.skill)}${sourceBadge(q)}<span class="font-mono">${esc(q.id)}</span>
            ${incomplete(q) ? `<span class="badge badge-warn">${missing(q)}</span>` : ''}
            ${q.updatedAt ? `<span>Updated ${timeAgo(q.updatedAt)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1">
          <a class="btn btn-ghost btn-icon btn-sm" href="${href(`/manager/edit/${q.id}`)}" aria-label="Edit" title="Edit">${icon('edit')}</a>
          <a class="btn btn-ghost btn-icon btn-sm" href="${href('/manager/new', { from: q.id })}" aria-label="Duplicate" title="Duplicate">${icon('copy')}</a>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-export aria-label="Export JSON" title="Export JSON">${icon('download')}</button>
          ${q._local ? `<button type="button" class="btn btn-ghost btn-icon btn-sm hover:!text-bad" data-delete aria-label="${q._override ? 'Discard local edit' : 'Delete from this browser'}" title="${q._override ? 'Discard local edit' : 'Delete from this browser'}">${icon('trash')}</button>` : `<span class="w-8 sm:w-[1.875rem]"></span>`}
        </div>
      </li>`).join('')}
    </ul>
    ${items.length > shown ? `<div class="mt-4 text-center"><button type="button" class="btn" data-more>Show 40 more</button></div>` : ''}`;
  }

  function paint() {
    const local = store.questions.filter((q) => q._local);
    const added = local.filter((q) => !q._override).length;
    const edited = local.length - added;
    const review = store.questions.filter(incomplete).length;
    const important = store.questions.filter((q) => db.isStarred(q)).length;
    const stat = (label, value, key) => `<button type="button" class="card card-link px-4 py-3 text-left aria-pressed:border-ink" data-scope="${key}" aria-pressed="${scope === key}">
        <span class="block text-[0.8125rem] text-muted">${label}</span><span class="block text-xl font-semibold tabular-nums">${value}</span></button>`;

    ctx.main.innerHTML = `
      ${pageHeader({
        title: 'Content Manager',
        subtitle: 'Add, edit and export questions. Nothing here talks to a server.',
        actions: `<button type="button" class="btn" data-export-all>${icon('download')}Export local questions</button><a class="btn btn-primary" href="#/manager/new">${icon('plus')}Add question</a>`,
      })}

      <div class="grid gap-3 md:grid-cols-2">
        <section class="card card-pad">
          <h2 class="flex items-center gap-2 text-base">${icon('database')}Static content</h2>
          <p class="mt-1.5 text-sm text-muted"><strong class="text-ink">${store.staticIds.size} questions</strong> in the <code class="font-mono">/data</code> JSON files. They are part of the deployed site, load on every device, and change only when you edit a file and commit it.</p>
        </section>
        <section class="card card-pad">
          <h2 class="flex items-center gap-2 text-base">${icon('note')}Browser personal data</h2>
          <p class="mt-1.5 text-sm text-muted"><strong class="text-ink">${added} added, ${edited} edited</strong> in this browser, kept in LocalStorage with your statuses and notes. Editing here never changes the JSON files on GitHub. Clearing site data removes it, so <a class="link" href="#/backup">keep a backup</a>.</p>
        </section>
      </div>

      <details class="card mt-3" ${local.length ? 'open' : ''}>
        <summary class="flex cursor-pointer items-center justify-between px-4 py-3 font-medium sm:px-5">Make a question permanent ${icon('chevron-down')}</summary>
        <ol class="grid gap-3 border-t border-line p-4 text-sm sm:grid-cols-5 sm:p-5">
          ${[
            ['Add the question', 'Use “Add question”. It is saved in this browser straight away.'],
            ['Export its JSON', 'Press the download icon on its row, or “Export local questions”.'],
            ['Paste into the data file', 'Add the object to the "questions" list of the file named in the export.'],
            ['Commit to GitHub', 'git add data, commit, and push.'],
            ['Deploy', 'GitHub Pages or Vercel redeploys. Then delete the local copy here.'],
          ].map(([t, d], i) => `<li><span class="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-canvas">${i + 1}</span><span class="mt-2 block font-medium">${t}</span><span class="mt-0.5 block text-muted">${d}</span></li>`).join('')}
        </ol>
      </details>

      ${store.errors.length ? `<div class="mt-3">${notice(`<strong class="text-ink">${plural(store.errors.length, 'problem')} found while loading the data files</strong><ul class="mt-1.5 list-disc space-y-1 pl-4">${store.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`, 'warn')}</div>` : ''}

      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${stat('Total questions', store.questions.length, 'all')}${stat('Local (added or edited)', local.length, 'local')}${stat('Needs review', review, 'review')}${stat('Important', important, 'important')}
      </div>

      <div class="mb-3 mt-5 flex flex-wrap items-center gap-2">
        <label class="relative min-w-0 flex-1 basis-56"><span class="sr-only">Search content</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">${icon('search')}</span>
          <input type="search" class="input pl-9" placeholder="Search content…" data-q value="${esc(query)}" autocomplete="off"></label>
        <p class="text-sm text-muted" data-list-count aria-live="polite"></p>
      </div>
      <div data-list></div>`;
    paintList();
  }

  async function onClick(e) {
    const sc = e.target.closest('[data-scope]');
    if (sc) { scope = sc.dataset.scope; shown = 40; history.replaceState(null, '', href('/manager', scope === 'all' ? {} : { scope })); paint(); $(`[data-scope="${scope}"]`, ctx.main).focus(); return; }
    if (e.target.closest('[data-export-all]')) return exportAllLocal();
    if (e.target.closest('[data-more]')) { shown += 40; paintList(); return; }
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const q = getQuestion(row.dataset.id);
    if (!q) return;
    if (e.target.closest('[data-export]')) exportQuestionDialog(q);
    else if (e.target.closest('[data-delete]')) {
      const ok = await confirmDialog({
        title: q._override ? 'Discard local edit?' : 'Delete this question?',
        message: q._override
          ? 'Your edited copy is removed from this browser and the original from the data file shows again.'
          : 'The question is removed from this browser. If you have not exported it, it is gone for good.',
        confirmLabel: q._override ? 'Discard edit' : 'Delete question',
        danger: true,
      });
      if (!ok) return;
      db.deleteCustom(q.id);
      rebuild();
      paint();
      toast(q._override ? 'Local edit discarded.' : 'Question deleted from this browser.');
    }
  }
  const onInput = debounce((e) => { if (e.target.matches('[data-q]')) { query = e.target.value; shown = 40; paintList(); } }, 220);
  ctx.main.addEventListener('click', onClick);
  ctx.main.addEventListener('input', onInput);
  ctx.onLeave = () => { ctx.main.removeEventListener('click', onClick); ctx.main.removeEventListener('input', onInput); };
  paint();
}

/* ---------- Add / edit form ---------- */

const lines = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);

export function renderForm(ctx) {
  const editing = ctx.segments[1] === 'edit';
  const existing = editing ? getQuestion(ctx.segments[2]) : null;
  if (editing && !existing) {
    ctx.setTitle('Question not found');
    ctx.main.innerHTML = emptyState({ icon: 'search', title: 'Question not found', text: 'There is nothing to edit at this address.', action: `<a class="btn btn-primary" href="#/manager">Back to Content Manager</a>` });
    return;
  }
  const source = existing || (ctx.query.from ? getQuestion(ctx.query.from) : null);
  ctx.setTitle(editing ? 'Edit question' : 'Add question');

  const v = source
    ? { ...source, code: source.codes[0] || { language: 'php', content: '' } }
    : {
        question: ctx.query.question || '', skill: store.skillMap.has(ctx.query.skill) ? ctx.query.skill : '', topic: ctx.query.topic || '',
        difficulty: 'Intermediate', type: TYPES.includes(ctx.query.type) ? ctx.query.type : 'Concept', priority: 'normal', tags: [], related: [], mistakes: [], tips: [],
        code: { language: 'php', content: '' }, important: false, commonInterviewQuestion: false, askedBefore: Boolean(ctx.query.asked),
      };
  if (!editing && source) v.question = `${source.question} (copy)`;
  let related = (v.related || []).filter((id) => store.byId.has(id));
  // The form edits one code block; any further blocks on the question are kept as they are.
  const extraCodes = source ? source.codes.slice(1) : [];
  let idTouched = false;

  const val = (k) => esc(v[k] ?? '');
  const options = (list, current, labels) => list.map((o) => `<option value="${esc(o)}" ${o === current ? 'selected' : ''}>${esc(labels ? labels[o] : o)}</option>`).join('');
  const field = (name, label, control, { hint = '', required = false, cls = '' } = {}) =>
    `<div class="${cls}" data-field="${name}">
      <label class="label" for="f-${name}">${label}${required ? ' <span class="text-bad" aria-hidden="true">*</span>' : ''}</label>
      ${control}
      ${hint ? `<p class="hint" id="h-${name}">${hint}</p>` : ''}
      <p class="field-error" id="e-${name}" hidden></p>
    </div>`;
  const text = (name, { placeholder = '', required = false, list = '', mono = false } = {}) =>
    `<input id="f-${name}" name="${name}" class="input ${mono ? 'font-mono text-[0.8125rem]' : ''}" value="${val(name)}" placeholder="${esc(placeholder)}" ${required ? 'required aria-required="true"' : ''} ${list ? `list="${list}"` : ''} autocomplete="off">`;
  const area = (name, { placeholder = '', rows = 3, mono = false, value } = {}) =>
    `<textarea id="f-${name}" name="${name}" rows="${rows}" class="input ${mono ? 'font-mono text-[0.8125rem]' : ''}" placeholder="${esc(placeholder)}" ${mono ? 'spellcheck="false"' : ''}>${esc(value ?? v[name] ?? '')}</textarea>`;
  const group = (title, body, note = '') => `<section class="card p-4 sm:p-5"><h2 class="text-base">${title}</h2>${note ? `<p class="mt-0.5 text-sm text-muted">${note}</p>` : ''}<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">${body}</div></section>`;
  const check = (name, label) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" name="${name}" ${v[name] ? 'checked' : ''}> ${label}</label>`;
  const hasCoding = Boolean(v.statement || v.input || v.output || v.hint || v.approach || v.complexity || (v.mistakes || []).length || (v.tips || []).length) || v.type === 'Coding';

  ctx.main.innerHTML = `
    ${pageHeader({
      title: editing ? 'Edit question' : 'Add question',
      crumbs: [{ label: 'Content Manager', href: '#/manager' }, { label: editing ? existing.id : 'New question' }],
    })}
    <form class="max-w-3xl space-y-4" novalidate data-form>
      ${editing && !existing._local
        ? notice(`This question comes from <code class="font-mono text-ink">${esc(fileOf(existing))}</code>. Saving stores your version <strong class="text-ink">in this browser only</strong> as a local edit. The file itself changes when you paste the exported JSON into it and commit.`)
        : notice(`Saved to <strong class="text-ink">this browser</strong> (LocalStorage). To keep a question permanently and on every device, export its JSON from the Content Manager and commit it to the matching file in <code class="font-mono text-ink">/data</code>.`)}
      <div class="rounded-card border border-bad/40 bg-bad/10 px-4 py-3 text-sm" role="alert" data-summary hidden></div>

      ${group('The question',
        field('question', 'Question', area('question', { rows: 2, placeholder: 'What is the difference between == and === in PHP?' }), { required: true, cls: 'sm:col-span-2' }) +
        field('skill', 'Skill', `<select id="f-skill" name="skill" class="input" required aria-required="true"><option value="">Choose a skill</option>${store.skills.map((s) => `<option value="${esc(s.id)}" ${s.id === v.skill ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`, { required: true }) +
        field('topic', 'Topic', text('topic', { placeholder: 'Operators', list: 'topics' }) + `<datalist id="topics"></datalist>`, { hint: 'Pick an existing topic or type a new one.' }) +
        field('difficulty', 'Difficulty', `<select id="f-difficulty" name="difficulty" class="input">${options(DIFFICULTIES, v.difficulty)}</select>`) +
        field('type', 'Question type', `<select id="f-type" name="type" class="input">${options(TYPES, v.type)}</select>`))}

      ${group('Answers',
        field('shortAnswer', 'Short answer', area('shortAnswer', { rows: 2, placeholder: 'One or two sentences. Shown on cards and in search.' }), { cls: 'sm:col-span-2' }) +
        field('interviewAnswer', 'Interview answer', area('interviewAnswer', { rows: 4, placeholder: 'What you would actually say out loud, in 20 to 40 seconds.' }), { cls: 'sm:col-span-2', hint: 'Write it the way you speak. This is what flashcards and interview mode show.' }) +
        field('answer', 'Detailed answer', area('answer', { rows: 8, placeholder: 'The fuller explanation. Supports **bold**, `code`, - lists and ```php fenced code.' }), { cls: 'sm:col-span-2', hint: 'Light Markdown is supported.' }) +
        field('example', 'Real-world example', area('example', { rows: 3, placeholder: 'Where this shows up in a real project. Optional.' }), { cls: 'sm:col-span-2' }),
        'At least one answer is required.')}

      ${group('Code example',
        field('codeLanguage', 'Code language', `<select id="f-codeLanguage" name="codeLanguage" class="input">${options(CODE_LANGS, CODE_LANGS.includes(v.code.language) ? v.code.language : 'text', LANG_LABEL)}</select>`) +
        `<div></div>` +
        field('code', 'Code', area('code', { rows: 8, mono: true, value: v.code.content, placeholder: '<?php\n\nvar_dump(0 == "a");' }), { cls: 'sm:col-span-2' }))}

      <details class="card" ${hasCoding ? 'open' : ''}>
        <summary class="flex cursor-pointer items-center justify-between px-4 py-3.5 font-semibold sm:px-5">Coding problem details <span class="flex items-center gap-2 text-sm font-normal text-faint">Optional ${icon('chevron-down')}</span></summary>
        <div class="grid grid-cols-1 gap-4 border-t border-line p-4 sm:grid-cols-2 sm:p-5">
          ${field('statement', 'Problem statement', area('statement', { rows: 3, placeholder: 'Given a string, count how many times each character appears.' }), { cls: 'sm:col-span-2' })}
          ${field('input', 'Example input', area('input', { rows: 2, mono: true, placeholder: 'INTERVIEW' }))}
          ${field('output', 'Expected output', area('output', { rows: 2, mono: true, placeholder: 'I → 2' }))}
          ${field('hint', 'Hint', area('hint', { rows: 2, placeholder: 'A nudge that does not give the answer away.' }), { cls: 'sm:col-span-2' })}
          ${field('approach', 'Approach', area('approach', { rows: 4, placeholder: 'The logic in plain steps, before any code.' }), { cls: 'sm:col-span-2' })}
          ${field('complexity', 'Complexity', text('complexity', { placeholder: 'Time O(n), space O(k)' }), { cls: 'sm:col-span-2' })}
          ${field('mistakes', 'Common mistakes', area('mistakes', { rows: 3, value: (v.mistakes || []).join('\n'), placeholder: 'One per line' }))}
          ${field('tips', 'Interview tips', area('tips', { rows: 3, value: (v.tips || []).join('\n'), placeholder: 'One per line' }))}
        </div>
      </details>

      ${group('Organise',
        field('tags', 'Tags', `<input id="f-tags" name="tags" class="input" value="${esc((v.tags || []).join(', '))}" placeholder="php, operators, comparison" autocomplete="off">`, { hint: 'Comma-separated, lowercase.', cls: 'sm:col-span-2' }) +
        field('priority', 'Revision priority', `<select id="f-priority" name="priority" class="input">${options(PRIORITIES, v.priority, PRIORITY_LABEL)}</select>`) +
        `<div class="flex flex-col justify-end gap-2.5 pb-1">${check('important', 'Important (starred by default)')}${check('commonInterviewQuestion', 'Common interview question')}${check('askedBefore', 'I was asked this in an interview')}</div>` +
        `<div class="min-w-0 sm:col-span-2" data-field="related">
          <label class="label" for="f-related">Related questions</label>
          <div class="mb-2 flex flex-wrap gap-1.5 empty:hidden" data-related></div>
          <div class="relative"><input id="f-related" class="input" placeholder="Search for a question to link…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="related-list">
            <ul id="related-list" role="listbox" class="card absolute inset-x-0 top-full z-10 mt-1 hidden max-h-56 overflow-y-auto p-1 shadow-lg"></ul></div>
        </div>` +
        field('notes', 'Notes', area('notes', { rows: 2, placeholder: 'Asked by XYZ company. Remember to mention eager loading.' }), { cls: 'sm:col-span-2', hint: 'Saved with the question. Private per-browser notes live on the question page.' }) +
        field('id', 'ID', `<input id="f-id" name="id" class="input font-mono text-[0.8125rem]" value="${esc(editing ? existing.id : '')}" ${editing ? 'readonly' : ''} autocomplete="off">`, { hint: editing ? 'IDs cannot change, because links and progress depend on them.' : 'Generated from the skill. Change it only if you need to.' }) +
        field('order', 'Order in skill', `<input id="f-order" name="order" type="number" min="1" class="input" value="${esc(editing ? existing.order : '')}" placeholder="Auto">`, { hint: 'Position in the learning order.' }))}

      <div class="sticky bottom-[4.25rem] z-10 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-2.5 lg:bottom-4">
        <button type="submit" class="btn btn-primary">${icon('check')}Save question</button>
        ${editing ? '' : `<button type="submit" class="btn" data-another>Save and add another</button>`}
        <a class="btn btn-ghost ml-auto" href="${editing ? href(`/questions/${existing.id}`) : '#/manager'}">Cancel</a>
      </div>
    </form>`;

  const form = $('[data-form]', ctx.main);
  const el = (name) => form.elements[name];

  function fillTopics() {
    $('#topics', ctx.main).innerHTML = el('skill').value ? topicsOf(el('skill').value).map((t) => `<option value="${esc(t.name)}">`).join('') : '';
  }
  function suggestId() {
    if (editing || idTouched) return;
    el('id').value = el('skill').value ? nextId(el('skill').value) : '';
  }
  fillTopics();
  suggestId();
  el('skill').addEventListener('change', () => { fillTopics(); suggestId(); });
  el('id').addEventListener('input', () => { idTouched = true; });

  /* Related questions picker */
  const relInput = $('#f-related', ctx.main);
  const relList = $('#related-list', ctx.main);
  const paintRelated = () => {
    $('[data-related]', ctx.main).innerHTML = related.map((id) => {
      const q = getQuestion(id);
      return `<span class="badge max-w-full gap-1.5 py-1"><span class="truncate">${esc(q ? q.question : id)}</span><button type="button" data-unlink="${esc(id)}" aria-label="Remove link">${icon('x', 'h-3 w-3')}</button></span>`;
    }).join('');
  };
  const closeRel = () => { relList.classList.add('hidden'); relInput.setAttribute('aria-expanded', 'false'); };
  relInput.addEventListener('input', debounce(() => {
    const found = search(relInput.value, { limit: 8 }).filter((q) => !related.includes(q.id) && q.id !== el('id').value);
    if (!relInput.value.trim() || !found.length) return closeRel();
    relList.innerHTML = found.map((q) => `<li role="option"><button type="button" class="block w-full rounded-ctl px-2.5 py-2 text-left text-sm hover:bg-raised" data-link="${esc(q.id)}">${esc(q.question)}<span class="block text-xs text-faint">${esc(skillName(q.skill))}, ${esc(q.topic)}</span></button></li>`).join('');
    relList.classList.remove('hidden');
    relInput.setAttribute('aria-expanded', 'true');
  }, 200));
  relInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const first = relList.querySelector('[data-link]'); if (first && !relList.classList.contains('hidden')) first.click(); }
    if (e.key === 'Escape' && !relList.classList.contains('hidden')) { e.stopPropagation(); closeRel(); }
  });
  form.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) { related.push(link.dataset.link); relInput.value = ''; closeRel(); paintRelated(); relInput.focus(); return; }
    const un = e.target.closest('[data-unlink]');
    if (un) { related = related.filter((id) => id !== un.dataset.unlink); paintRelated(); }
  });
  paintRelated();

  function collect() {
    const d = new FormData(form);
    const g = (k) => String(d.get(k) || '').trim();
    const code = String(d.get('code') || '').replace(/\s+$/, '');
    const raw = {
      id: g('id'), order: g('order'), question: g('question'), shortAnswer: g('shortAnswer'), interviewAnswer: g('interviewAnswer'), answer: g('answer'), example: g('example'),
      skill: g('skill'), topic: g('topic'), difficulty: g('difficulty'), type: g('type'),
      tags: g('tags').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      priority: g('priority'), important: d.get('important') === 'on', commonInterviewQuestion: d.get('commonInterviewQuestion') === 'on', askedBefore: d.get('askedBefore') === 'on',
      statement: g('statement'), input: String(d.get('input') || '').replace(/\s+$/, ''), output: String(d.get('output') || '').replace(/\s+$/, ''), hint: g('hint'), approach: g('approach'), complexity: g('complexity'),
      mistakes: lines(d.get('mistakes')), tips: lines(d.get('tips')),
      code: code ? [{ language: g('codeLanguage'), content: code, title: v.code.title || '' }, ...extraCodes] : extraCodes.length ? extraCodes : undefined,
      related, notes: g('notes'),
    };
    if (!raw.id && raw.skill) raw.id = nextId(raw.skill);
    if (!raw.order) raw.order = raw.skill ? store.questions.filter((q) => q.skill === raw.skill).reduce((m, q) => Math.max(m, q.order), 0) + 1 : 1;
    return raw;
  }

  function showErrors(errors) {
    for (const wrap of $$('[data-field]', form)) {
      const name = wrap.dataset.field;
      const msg = errors[name];
      const errEl = wrap.querySelector('.field-error');
      const input = wrap.querySelector('.input');
      if (errEl) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
      if (input) {
        if (msg) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', `e-${name}`); }
        else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
      }
    }
    const summary = $('[data-summary]', form);
    const keys = Object.keys(errors);
    summary.hidden = !keys.length;
    if (keys.length) {
      summary.innerHTML = `<strong>${plural(keys.length, 'field needs', 'fields need')} attention before this can be saved.</strong>`;
      const first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const another = Boolean(e.submitter && e.submitter.hasAttribute('data-another'));
    const raw = collect();
    const q = normalize(raw, raw.skill) || { ...raw, tags: raw.tags, codes: [] };
    const errors = validate({ ...q, question: raw.question, skill: raw.skill }, { isNew: !editing });
    if (!/^[a-z0-9][a-z0-9-]*$/.test(raw.id || '') && !errors.skill) errors.id = 'Use lowercase letters, numbers and hyphens, for example php-021.';
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const saved = { ...toJSON(q), skill: q.skill };
    if (!saved.added) saved.added = editing ? existing.added || undefined : todayISO();
    if (editing && existing._local) saved.createdAt = existing.createdAt;
    db.saveCustom(saved);
    rebuild();
    toast(editing ? 'Question updated in this browser.' : 'Question saved in this browser.');
    if (another) ctx.navigate('/manager/new', { skill: q.skill, topic: q.topic, t: Date.now() % 100000 });
    else ctx.navigate(`/questions/${q.id}`);
  });

  if (!editing) el('question').focus({ preventScroll: true });
}

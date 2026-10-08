// A single question: the answer you would say out loud, the fuller
// explanation, code, your notes and where you were asked it.

import { $, esc, icon, href, md, mdInline, codeBlock, normLang, debounce, speakingTime, fmtDate, copyText, toast } from '../utils.js';
import { store, getQuestion, skillName, isCoding, bySkill, PRIORITY_LABEL } from '../data.js';
import * as db from '../storage.js';
import {
  skillBadge, difficultyBadge, typeBadge, priorityBadge, localBadge, starButton, statusControl, rowList,
  emptyState, getListContext, toggleStar, toggleLearned,
} from '../ui.js';

const RUNNABLE = ['js', 'html', 'css'];

export function codeFigures(q) {
  return q.codes
    .map((c) => {
      const lang = normLang(c.language);
      const actions = RUNNABLE.includes(lang)
        ? `<button type="button" class="btn btn-ghost btn-sm" data-action="to-playground" data-lang="${lang}">${icon('play', 'h-3 w-3')}<span>Run</span></button>`
        : '';
      return codeBlock(c.content, lang, { title: c.title, actions });
    })
    .join('<div class="h-3"></div>');
}

/** The highlighted, say-it-out-loud answer. */
export function interviewBlock(q) {
  const text = q.interviewAnswer || q.shortAnswer;
  if (!text) return '';
  return `<section aria-labelledby="say-h">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h2 id="say-h" class="flex items-center gap-2 text-base">${icon('mic')}Interview answer</h2>
      <span class="flex items-center gap-2 text-xs text-faint">About ${speakingTime(text)} to say
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy-answer aria-label="Copy interview answer" title="Copy">${icon('copy')}</button></span>
    </div>
    <div class="answer">${text.split(/\n{2,}/).map((p) => `<p>${mdInline(p)}</p>`).join('')}</div>
  </section>`;
}

const section = (title, body, id) =>
  body ? `<section aria-labelledby="${id}"><h2 id="${id}" class="mb-2 text-base">${title}</h2>${body}</section>` : '';

const bullets = (items) => `<ul class="prose-dp list-disc space-y-1.5 pl-5 marker:text-faint">${items.map((i) => `<li>${mdInline(i)}</li>`).join('')}</ul>`;

/** Everything below the question for a normal (non-coding) question. */
export function answerSections(q) {
  return [
    q.shortAnswer && q.interviewAnswer ? section('Short answer', `<p class="max-w-read text-[1.0625rem] leading-relaxed">${mdInline(q.shortAnswer)}</p>`, 'short-h') : '',
    interviewBlock(q),
    section('Detailed explanation', q.answer ? `<div class="prose-dp">${md(q.answer)}</div>` : '', 'detail-h'),
    section('Example', q.example ? `<div class="prose-dp">${md(q.example)}</div>` : '', 'example-h'),
    section('Code', codeFigures(q), 'code-h'),
  ].filter(Boolean).join('');
}

function ioBlock(label, text) {
  return text ? `<div class="min-w-0"><div class="mb-1 text-xs font-medium text-faint">${label}</div><pre class="overflow-x-auto rounded-ctl border border-line bg-code px-3 py-2 text-[0.8125rem] leading-relaxed">${esc(text)}</pre></div>` : '';
}

/** Coding problems reveal themselves in stages so you try before you read. */
function codingSections(q, stage) {
  const steps = [];
  if (q.hint) steps.push(['hint', 'Show hint']);
  if (q.approach) steps.push(['approach', 'Show approach']);
  steps.push(['solution', 'Show solution']);
  const reached = steps.slice(0, stage).map((s) => s[0]);
  const next = steps[stage];

  const problem = `<section aria-labelledby="prob-h">
      <h2 id="prob-h" class="mb-2 text-base">Problem</h2>
      ${q.statement ? `<div class="prose-dp">${md(q.statement)}</div>` : ''}
      ${q.input || q.output ? `<div class="mt-3 grid gap-3 sm:grid-cols-2">${ioBlock('Example input', q.input)}${ioBlock('Expected output', q.output)}</div>` : ''}
    </section>`;

  const think = next
    ? `<div class="rounded-card border border-dashed border-line-strong px-4 py-4">
        <p class="font-medium">${stage === 0 ? 'Think first' : 'Still stuck?'}</p>
        <p class="mt-0.5 text-sm text-muted">${stage === 0 ? 'Work out the logic on paper or in an editor before you look. Reveal one step at a time.' : 'Take the next step only when you need it.'}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary" data-reveal>${icon(next[0] === 'hint' ? 'bulb' : 'eye')}${next[1]}</button>
          ${next[0] !== 'solution' ? `<button type="button" class="btn btn-ghost" data-reveal-all>Skip to solution</button>` : ''}
          <a class="btn btn-ghost" href="#/playground">${icon('terminal')}Open playground</a>
        </div>
      </div>`
    : '';

  const parts = [problem];
  if (reached.includes('hint')) parts.push(section('Hint', `<div class="prose-dp">${md(q.hint)}</div>`, 'hint-h'));
  if (reached.includes('approach')) parts.push(section('Approach', `<div class="prose-dp">${md(q.approach)}</div>`, 'approach-h'));
  if (reached.includes('solution')) {
    parts.push(
      section('Solution', codeFigures(q), 'code-h'),
      section('Explanation', q.answer ? `<div class="prose-dp">${md(q.answer)}</div>` : '', 'detail-h'),
      section('Complexity', q.complexity ? `<p class="prose-dp">${mdInline(q.complexity)}</p>` : '', 'cx-h'),
      section('Common mistakes', q.mistakes.length ? bullets(q.mistakes) : '', 'mis-h'),
      section('Interview tips', q.tips.length ? bullets(q.tips) : '', 'tips-h'),
      interviewBlock(q),
    );
  }
  parts.push(think);
  return { html: parts.filter(Boolean).join(''), done: !next, steps: steps.length };
}

export function renderQuestion(ctx) {
  const id = ctx.segments[1];
  const q = getQuestion(id);
  if (!q) {
    ctx.setTitle('Question not found');
    ctx.main.innerHTML = emptyState({
      icon: 'search',
      title: 'Question not found',
      text: `There is no question with the ID “${esc(id)}”. It may have been renamed, or it was added in another browser.`,
      action: `<a class="btn btn-primary" href="#/questions">Browse questions</a>`,
    });
    return;
  }
  ctx.setTitle(q.question);
  db.pushRecent(q.id);

  const coding = isCoding(q) && (q.hint || q.approach || q.statement || q.skill === 'coding-logic');
  let stage = 0;

  // Next / previous follow the list you came from, falling back to the skill's order.
  let ids = getListContext();
  if (!ids.includes(q.id)) ids = bySkill(q.skill).map((x) => x.id);
  const pos = ids.indexOf(q.id);
  const prev = getQuestion(ids[pos - 1]);
  const next = getQuestion(ids[pos + 1]);

  const explicit = q.related.map(getQuestion).filter(Boolean);
  const sameTopic = store.questions.filter((x) => x.id !== q.id && x.skill === q.skill && x.topic === q.topic && !explicit.includes(x));
  const sharedTags = store.questions
    .filter((x) => x.id !== q.id && !explicit.includes(x) && !sameTopic.includes(x) && x.tags.filter((t) => q.tags.includes(t) && t !== q.skill).length >= 2)
    .slice(0, 4);
  const related = [...explicit, ...sameTopic, ...sharedTags].slice(0, 8);

  const exp = db.getExperience(q.id) || {};
  const pager = (cls) => `<div class="${cls} items-center gap-2">
      ${prev ? `<a class="btn btn-sm" href="${href(`/questions/${prev.id}`)}" title="Previous (P)">${icon('arrow-left')}<span>Previous</span></a>` : ''}
      ${next ? `<a class="btn btn-sm" href="${href(`/questions/${next.id}`)}" title="Next (N)"><span>Next</span>${icon('arrow-right')}</a>` : ''}
    </div>`;

  ctx.main.innerHTML = `<article data-qid="${esc(q.id)}">
    <nav aria-label="Breadcrumb" class="mb-3 flex flex-wrap items-center gap-1 text-[0.8125rem] text-faint">
      <a class="hover:text-ink" href="${href(`/skills/${q.skill}`)}">${esc(skillName(q.skill))}</a>${icon('chevron-right', 'h-3.5 w-3.5')}
      <a class="hover:text-ink" href="${href(`/skills/${q.skill}/${encodeURIComponent(q.topic)}`)}">${esc(q.topic)}</a>
      <span class="ml-auto">${pos >= 0 ? `${pos + 1} of ${ids.length}` : ''}</span>
    </nav>

    <header class="max-w-3xl">
      <div class="flex flex-wrap items-center gap-1.5">
        ${skillBadge(q.skill)}${difficultyBadge(q.difficulty)}${typeBadge(q.type)}${priorityBadge(q.priority)}${localBadge(q)}
        ${q.commonInterviewQuestion ? `<span class="badge">Commonly asked</span>` : ''}
        ${db.wasAsked(q) ? `<span class="badge badge-accent" data-asked-badge>Asked in an interview</span>` : ''}
      </div>
      <h1 class="mt-3 text-[1.625rem] leading-tight sm:text-[2rem] sm:leading-[1.15]">${esc(q.question)}</h1>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        ${starButton(q, 'btn btn-icon')}
        <button type="button" class="btn" data-action="copy-link">${icon('link')}Copy link</button>
        <a class="btn" href="${href(`/manager/edit/${q.id}`)}">${icon('edit')}Edit</a>
        ${pager('ml-auto hidden sm:flex')}
      </div>
    </header>

    <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="min-w-0 space-y-7" data-body></div>

      <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Your progress and notes">
        <section class="card p-4">
          <h2 class="mb-2.5 text-sm">Study status</h2>
          ${statusControl(q.id)}
        </section>

        <section class="card p-4">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm"><label for="note">My notes</label></h2>
            <span class="text-xs text-faint" data-note-state></span>
          </div>
          <textarea id="note" class="input min-h-[7rem] text-sm" placeholder="Remember to mention eager loading…" data-note>${esc(db.getNote(q.id))}</textarea>
          ${q.notes ? `<p class="mt-2 text-xs text-muted"><span class="font-medium">Note in the question file:</span> ${mdInline(q.notes)}</p>` : ''}
        </section>

        <details class="card p-4" ${exp.asked || exp.company ? 'open' : ''}>
          <summary class="flex cursor-pointer items-center justify-between text-sm font-semibold">Interview experience ${icon('chevron-down')}</summary>
          <form class="mt-3 space-y-3" data-exp>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" name="asked" ${exp.asked ? 'checked' : ''}> I was asked this in an interview</label>
            <div><label class="label" for="exp-company">Company</label><input id="exp-company" class="input" name="company" value="${esc(exp.company || '')}" placeholder="ABC Technologies" autocomplete="off"></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="label" for="exp-date">Date</label><input id="exp-date" type="date" class="input" name="date" value="${esc(exp.date || '')}"></div>
              <div><label class="label" for="exp-round">Round</label><input id="exp-round" class="input" name="round" value="${esc(exp.round || '')}" placeholder="Technical" list="rounds" autocomplete="off"></div>
            </div>
            <datalist id="rounds"><option value="Screening"><option value="Technical round"><option value="Machine test"><option value="Manager round"><option value="HR round"></datalist>
            <div><label class="label" for="exp-notes">What happened</label><textarea id="exp-notes" class="input text-sm" name="notes" placeholder="Follow-up was about N+1…">${esc(exp.notes || '')}</textarea></div>
          </form>
        </details>

        <section class="card p-4 text-[0.8125rem]">
          <dl class="space-y-1.5">
            <div class="flex justify-between gap-3"><dt class="text-muted">ID</dt><dd class="font-mono text-xs">${esc(q.id)}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted">Priority</dt><dd>${PRIORITY_LABEL[q.priority]}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted">Stored in</dt><dd>${q._local ? 'This browser' : `data/${esc(store.skillMap.get(q.skill)?.file || '')}`}</dd></div>
            ${q._added ? `<div class="flex justify-between gap-3"><dt class="text-muted">Added</dt><dd>${fmtDate(q._added)}</dd></div>` : ''}
          </dl>
          ${q.tags.length ? `<div class="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">${q.tags.map((t) => `<a class="tag" href="${href('/questions', { tag: t })}">#${esc(t)}</a>`).join('')}</div>` : ''}
          <p class="mt-3 border-t border-line pt-3 text-xs text-faint">Status, notes and interview experience are saved in this browser only.</p>
        </section>
      </aside>
    </div>

    ${related.length ? `<section class="mt-9 max-w-3xl" aria-labelledby="rel-h">
      <h2 id="rel-h" class="mb-2.5 text-base">Related questions</h2>
      <div class="card overflow-hidden">${rowList(related, (x) => ({ meta: `${esc(skillName(x.skill))}, ${esc(x.topic)}` }))}</div>
    </section>` : ''}
    <div class="mt-6 flex justify-between gap-2">${pager('flex w-full justify-between sm:w-auto')}</div>
  </article>`;

  const body = $('[data-body]', ctx.main);
  function paintBody(focusNew = false) {
    if (!coding) {
      body.innerHTML = answerSections(q) || emptyState({ icon: 'note', title: 'No answer written yet', text: 'Add a short, interview or detailed answer so this question is useful later.', action: `<a class="btn btn-primary" href="${href(`/manager/edit/${q.id}`)}">Write the answer</a>` });
      return;
    }
    const before = body.querySelectorAll('section').length;
    const out = codingSections(q, stage);
    body.innerHTML = out.html;
    if (focusNew) {
      const fresh = body.querySelectorAll('section')[before];
      if (fresh) fresh.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  const totalSteps = () => (q.hint ? 1 : 0) + (q.approach ? 1 : 0) + 1;
  const reveal = (all = false) => {
    if (!coding || stage >= totalSteps()) return;
    stage = all ? totalSteps() : stage + 1;
    paintBody(true);
  };
  paintBody();

  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-reveal]')) reveal();
    else if (e.target.closest('[data-reveal-all]')) reveal(true);
    else if (e.target.closest('[data-copy-answer]')) {
      copyText(q.interviewAnswer || q.shortAnswer).then((ok) => toast(ok ? 'Copied to clipboard.' : 'Copy failed. Select the text and copy it manually.', ok ? 'ok' : 'error'));
    }
  });

  const noteState = $('[data-note-state]', ctx.main);
  const saveNote = debounce((value) => {
    db.setNote(q.id, value);
    noteState.textContent = 'Saved';
  }, 400);
  $('[data-note]', ctx.main).addEventListener('input', (e) => {
    noteState.textContent = 'Saving…';
    saveNote(e.target.value);
  });

  const expForm = $('[data-exp]', ctx.main);
  const saveExp = debounce(() => {
    const d = new FormData(expForm);
    db.setExperience(q.id, {
      asked: d.get('asked') === 'on' || Boolean(String(d.get('company')).trim()),
      company: String(d.get('company')).trim(),
      date: String(d.get('date')),
      round: String(d.get('round')).trim(),
      notes: String(d.get('notes')).trim(),
    });
  }, 400);
  expForm.addEventListener('input', saveExp);
  expForm.addEventListener('submit', (e) => e.preventDefault());

  ctx.keys = {
    n: () => next && ctx.navigate(`/questions/${next.id}`),
    p: () => prev && ctx.navigate(`/questions/${prev.id}`),
    f: () => toggleStar(q.id),
    m: () => toggleLearned(q.id),
    space: () => reveal(),
  };
  if (!coding) delete ctx.keys.space;
}

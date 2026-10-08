// Practice modes: the hub, random interview, flashcards and the coding list.

import { $, $$, esc, icon, href, md, mdInline, shuffle, plural, pct } from '../utils.js';
import { store, DIFFICULTIES, skillName, isCoding, bySkill, matchesStep, byOrder } from '../data.js';
import * as db from '../storage.js';
import { pageHeader, skillChip, difficultyBadge, statusBadge, progressBar, emptyState, markKnown, markRevise, setListContext, progressOf, ring } from '../ui.js';
import { interviewBlock, codeFigures } from './question.js';
import { todaysPlan } from '../plan.js';

/* ---------- Hub ---------- */

export function renderPractice(ctx) {
  ctx.setTitle('Practice');
  const revision = store.questions.filter((q) => db.getStatus(q.id) === 'revision').length;
  const coding = store.questions.filter(isCoding);
  const sessions = db.getSessions();
  const last = sessions[sessions.length - 1];
  const card = (link, ic, title, text, foot) => `<a class="card card-link flex gap-3.5 p-4 sm:p-5" href="${link}">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-raised">${icon(ic, 'h-5 w-5')}</span>
      <span class="min-w-0"><span class="block text-base font-semibold">${title}</span><span class="mt-0.5 block text-sm text-muted">${text}</span>
      ${foot ? `<span class="mt-2 block text-xs text-faint">${foot}</span>` : ''}</span></a>`;
  ctx.main.innerHTML = `
    ${pageHeader({ title: 'Practice', subtitle: 'Test recall instead of re-reading. Every answer you give updates your study status.' })}
    <div class="grid gap-3 md:grid-cols-2">
      ${card('#/interview', 'shuffle', 'Random interview', 'Pick skills, difficulty and length. Answer out loud, then check yourself.', last ? `Last session: ${last.known} of ${last.total} known` : 'No sessions yet')}
      ${card('#/flashcards', 'layers', 'Flashcards', 'Question on the front, interview answer on the back. Built for a phone.', revision ? `${plural(revision, 'card')} waiting in revision` : '')}
      ${card('#/coding', 'code', 'Coding problems', 'Logic problems with a hint, an approach and a solution you reveal in steps.', `${progressOf(coding).known} of ${coding.length} solved`)}
      ${card('#/playground', 'terminal', 'Code playground', 'Run HTML, CSS and JavaScript in the browser. Draft PHP with highlighting.', '')}
    </div>`;
}

/* ---------- Decks (shared by flashcards) ---------- */

function deckOptions() {
  return [
    ['all', 'All questions'], ['today', "Today's plan"], ['revision', 'Revision queue'], ['important', 'Important'], ['new', 'Not learned yet'],
    ...store.skills.map((s) => [`skill:${s.id}`, s.name]),
  ];
}

function resolveDeck(key) {
  if (key === 'today') return todaysPlan(10).items.map((p) => p.q);
  if (key === 'revision') return store.questions.filter((q) => db.getStatus(q.id) === 'revision');
  if (key === 'important') return store.questions.filter((q) => db.isStarred(q) || q.priority === 'critical');
  if (key === 'new') return store.questions.filter((q) => !db.isKnown(q.id));
  if (key.startsWith('skill:')) return bySkill(key.slice(6));
  if (key.startsWith('path:')) {
    const [, pi, si] = key.split(':');
    const step = store.paths[Number(pi)]?.steps[Number(si)];
    return step ? store.questions.filter((q) => matchesStep(q, step)).sort(byOrder) : [];
  }
  return store.questions.slice();
}

const backText = (q) => q.interviewAnswer || q.shortAnswer || q.approach || q.answer.split(/\n{2,}/)[0] || '';

/* ---------- Flashcards ---------- */

export function renderFlashcards(ctx) {
  ctx.setTitle('Flashcards');
  let deckKey = ctx.query.deck || 'all';
  let shuffled = ctx.query.deck !== 'today';
  let cards = [];
  let i = 0;
  let flipped = false;
  let known = [];
  let revise = [];

  const pathLabel = () => {
    if (!deckKey.startsWith('path:')) return null;
    const [, pi, si] = deckKey.split(':');
    const step = store.paths[Number(pi)]?.steps[Number(si)];
    return step ? `Path step: ${step.title}` : null;
  };

  function start(list) {
    const base = list || resolveDeck(deckKey);
    cards = shuffled && !list ? shuffle(base) : base;
    i = 0;
    flipped = false;
    known = [];
    revise = [];
    setListContext(cards.map((q) => q.id));
    paint();
  }

  function header() {
    const opts = deckOptions();
    const extra = pathLabel();
    return pageHeader({
      title: 'Flashcards',
      actions: `<label class="sr-only" for="deck">Deck</label>
        <select id="deck" class="input w-auto" data-deck>
          ${extra ? `<option value="${esc(deckKey)}" selected>${esc(extra)}</option>` : ''}
          ${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === deckKey ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        <button type="button" class="btn" data-shuffle aria-pressed="${shuffled}">${icon('shuffle')}Shuffle</button>`,
    });
  }

  function paint() {
    if (!cards.length) {
      ctx.main.innerHTML = header() + emptyState(
        deckKey === 'revision'
          ? { icon: 'check', title: 'You are all caught up! 🎉', text: 'There is nothing in the revision queue. Choose another deck above.' }
          : deckKey === 'important'
            ? { icon: 'star', title: 'No important questions yet', text: 'Star important questions to practise them here.' }
            : { icon: 'layers', title: 'This deck is empty', text: 'Choose another deck above.' },
      );
      return;
    }
    if (i >= cards.length) return paintDone();
    const q = cards[i];
    const back = backText(q);
    ctx.main.innerHTML = `${header()}
      <div class="mx-auto max-w-2xl" data-qid="${esc(q.id)}">
        <div class="mb-3 flex items-center gap-3 text-sm text-muted">
          <span class="tabular-nums">${i + 1} / ${cards.length}</span>
          <div class="flex-1">${progressBar(pct(i, cards.length), 'Deck progress')}</div>
          <span class="flex gap-2 tabular-nums"><span class="text-ok" title="Known">${known.length}</span><span class="text-warn" title="Need revision">${revise.length}</span></span>
        </div>

        <div class="flip h-[min(56dvh,27rem)]" data-flipped="${flipped}">
          <div class="flip-inner">
            <div class="flip-face card flex cursor-pointer flex-col p-5 sm:p-7" data-flip role="button" tabindex="0" aria-label="Question. Activate to reveal the answer." ${flipped ? 'inert' : ''}>
              <div class="flex flex-wrap items-center gap-1.5">${skillChip(q.skill)}${difficultyBadge(q.difficulty)}<span data-slot="status">${statusBadge(db.getStatus(q.id))}</span></div>
              <div class="flex flex-1 flex-col justify-center py-4">
                <p class="text-[1.375rem] font-semibold leading-snug tracking-tight sm:text-2xl">${esc(q.question)}</p>
                ${q.statement ? `<p class="mt-3 text-sm text-muted">${mdInline(q.statement.split('\n')[0])}</p>` : ''}
              </div>
              <p class="text-center text-xs text-faint">Say your answer out loud, then tap the card <span class="hidden sm:inline">or press <span class="kbd">Space</span></span></p>
            </div>
            <div class="flip-face flip-back card flex flex-col p-5 sm:p-7" ${flipped ? '' : 'inert'}>
              <p class="text-[0.8125rem] font-medium text-muted">${esc(q.question)}</p>
              <div class="answer mt-3">${back ? md(back) : '<p>No answer written for this question yet.</p>'}</div>
              <div class="mt-auto pt-4 text-center"><a class="link text-sm" href="${href(`/questions/${q.id}`)}">Open the full answer</a></div>
            </div>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2.5">
          ${flipped
            ? `<button type="button" class="btn h-12 border-ok/40 text-base hover:border-ok hover:bg-ok/10" data-know>👍 Know <span class="kbd ml-1 hidden sm:inline-flex">1</span></button>
               <button type="button" class="btn h-12 border-warn/40 text-base hover:border-warn hover:bg-warn/10" data-revise>🤔 Need revision <span class="kbd ml-1 hidden sm:inline-flex">2</span></button>`
            : `<button type="button" class="btn btn-primary col-span-2 h-12 text-base" data-flip>Reveal answer</button>`}
        </div>
        <div class="mt-3 flex justify-between">
          <button type="button" class="btn btn-ghost btn-sm" data-back ${i === 0 ? 'disabled' : ''}>${icon('arrow-left')}Back</button>
          <button type="button" class="btn btn-ghost btn-sm" data-skip>Skip${icon('arrow-right')}</button>
        </div>
      </div>`;
  }

  function paintDone() {
    const total = known.length + revise.length;
    db.addSession({ mode: 'flashcards', total, known: known.length, revise: revise.length });
    ctx.main.innerHTML = `${header()}
      <div class="card mx-auto max-w-xl p-6 text-center sm:p-8">
        <h2 class="text-xl">Deck finished</h2>
        <p class="mt-1 text-muted">${total ? `You knew ${known.length} of ${total}.` : 'You skipped every card.'}</p>
        <div class="mt-5 grid grid-cols-2 gap-3 text-left">
          <div class="rounded-ctl bg-ok/10 px-4 py-3"><div class="text-2xl font-semibold tabular-nums text-ok">${known.length}</div><div class="text-sm text-muted">Known</div></div>
          <div class="rounded-ctl bg-warn/10 px-4 py-3"><div class="text-2xl font-semibold tabular-nums text-warn">${revise.length}</div><div class="text-sm text-muted">Need revision</div></div>
        </div>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          ${revise.length ? `<button type="button" class="btn btn-primary" data-again-missed>Repeat the ${plural(revise.length, 'card')} to revise</button>` : ''}
          <button type="button" class="btn" data-again>Restart deck</button>
          <a class="btn" href="#/">Dashboard</a>
        </div>
      </div>`;
  }

  const flip = () => { if (i < cards.length) { flipped = !flipped; paint(); } };
  const answer = (isKnown) => {
    if (i >= cards.length || !flipped) return;
    const q = cards[i];
    if (isKnown) { markKnown(q.id); known.push(q); } else { markRevise(q.id); revise.push(q); }
    i++; flipped = false; paint();
  };
  const skip = () => { if (i < cards.length) { i++; flipped = false; paint(); } };
  const back = () => {
    if (i === 0) return;
    i--; flipped = false;
    const q = cards[i];
    known = known.filter((x) => x !== q);
    revise = revise.filter((x) => x !== q);
    paint();
  };

  function onClick(e) {
    if (e.target.closest('a')) return;
    if (e.target.closest('[data-know]')) answer(true);
    else if (e.target.closest('[data-revise]')) answer(false);
    else if (e.target.closest('[data-flip]')) flip();
    else if (e.target.closest('[data-skip]')) skip();
    else if (e.target.closest('[data-back]')) back();
    else if (e.target.closest('[data-again]')) start();
    else if (e.target.closest('[data-again-missed]')) start(revise.slice());
    else if (e.target.closest('[data-shuffle]')) { shuffled = !shuffled; start(); }
  }
  function onChange(e) {
    if (e.target.matches('[data-deck]')) {
      deckKey = e.target.value;
      history.replaceState(null, '', href('/flashcards', deckKey === 'all' ? {} : { deck: deckKey }));
      start();
    }
  }
  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-flip][role="button"]')) { e.preventDefault(); flip(); }
  }
  ctx.main.addEventListener('click', onClick);
  ctx.main.addEventListener('change', onChange);
  ctx.main.addEventListener('keydown', onKey);
  ctx.onLeave = () => {
    ctx.main.removeEventListener('click', onClick);
    ctx.main.removeEventListener('change', onChange);
    ctx.main.removeEventListener('keydown', onKey);
  };
  ctx.keys = { space: flip, 1: () => answer(true), 2: () => answer(false), n: skip, p: back };
  start();
}

/* ---------- Random interview ---------- */

export function renderInterview(ctx) {
  ctx.setTitle('Random interview');
  const cfg = {
    skills: ctx.query.skill && store.skillMap.has(ctx.query.skill) ? [ctx.query.skill] : [],
    difficulty: 'Mixed',
    count: 10,
    unlearned: false,
  };
  let qs = [];
  let i = 0;
  let revealed = false;
  let results = []; // { q, known }

  const pool = () => store.questions.filter((q) =>
    (!cfg.skills.length || cfg.skills.includes(q.skill)) &&
    (cfg.difficulty === 'Mixed' || q.difficulty === cfg.difficulty) &&
    (!cfg.unlearned || !db.isKnown(q.id)));

  function paintSetup() {
    const available = pool().length;
    const chip = (group, value, label, on) => `<button type="button" class="chip" data-set="${group}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
    ctx.main.innerHTML = `
      ${pageHeader({ title: 'Random interview', subtitle: 'A mock round from your own knowledge base. Answer each question out loud before you reveal it.' })}
      <div class="card max-w-2xl space-y-5 p-4 sm:p-6">
        <fieldset><legend class="label">Skills</legend>
          <div class="flex flex-wrap gap-1.5">${chip('skill', '', 'All skills', !cfg.skills.length)}${store.skills.map((s) => chip('skill', s.id, s.name, cfg.skills.includes(s.id))).join('')}</div>
        </fieldset>
        <fieldset><legend class="label">Difficulty</legend>
          <div class="flex flex-wrap gap-1.5">${['Mixed', ...DIFFICULTIES].map((d) => chip('difficulty', d, d, cfg.difficulty === d)).join('')}</div>
        </fieldset>
        <fieldset><legend class="label">Number of questions</legend>
          <div class="flex flex-wrap gap-1.5">${[5, 10, 20, 30].map((n) => chip('count', n, n, cfg.count === n)).join('')}</div>
        </fieldset>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" data-unlearned ${cfg.unlearned ? 'checked' : ''}> Only questions I have not learned yet</label>
        <div class="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button type="button" class="btn btn-primary h-11 px-5" data-start ${available ? '' : 'disabled'}>${icon('play', 'h-3.5 w-3.5')}Start interview</button>
          <p class="text-sm text-muted" aria-live="polite">${available ? `${plural(Math.min(cfg.count, available), 'question')} from a pool of ${available}` : 'No questions match these choices. Widen the skills or difficulty.'}</p>
        </div>
      </div>`;
  }

  function paintQuestion() {
    const q = qs[i];
    ctx.main.innerHTML = `
      <div class="mx-auto max-w-3xl" data-qid="${esc(q.id)}">
        <div class="mb-5 flex items-center gap-3 text-sm text-muted">
          <span class="tabular-nums">Question ${i + 1} of ${qs.length}</span>
          <div class="flex-1">${progressBar(pct(i, qs.length), 'Interview progress')}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-end>End</button>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">${skillChip(q.skill)}${difficultyBadge(q.difficulty)}<span class="badge">${esc(q.topic)}</span></div>
        <h1 class="mt-3 text-[1.625rem] leading-tight sm:text-[2rem] sm:leading-[1.15]">${esc(q.question)}</h1>
        ${q.statement ? `<div class="prose-dp mt-3">${md(q.statement)}</div>` : ''}

        ${revealed
          ? `<div class="mt-6 space-y-5">
              ${interviewBlock(q) || (q.approach
                ? `<section><h2 class="mb-2 text-base">Approach</h2><div class="answer">${md(q.approach)}</div></section>`
                : q.answer || q.codes.length ? '' : '<p class="text-muted">No answer written for this question yet.</p>')}
              ${q.answer || q.codes.length ? `<details class="card" ${interviewBlock(q) ? '' : 'open'}>
                <summary class="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">${q.approach && !interviewBlock(q) ? 'Solution and explanation' : 'Detailed explanation and code'} ${icon('chevron-down')}</summary>
                <div class="space-y-4 border-t border-line p-4">
                  ${q.approach && interviewBlock(q) ? `<div class="prose-dp">${md(q.approach)}</div>` : ''}
                  ${q.answer ? `<div class="prose-dp">${md(q.answer)}</div>` : ''}
                  ${codeFigures(q)}
                </div></details>` : ''}
            </div>`
          : `<div class="mt-6 rounded-card border border-dashed border-line-strong px-4 py-8 text-center">
              <p class="text-muted">Answer out loud as if the interviewer were listening.</p>
              <button type="button" class="btn btn-primary mt-4 h-11 px-5" data-reveal>${icon('eye')}Reveal answer <span class="kbd ml-1 hidden !border-white/20 !bg-white/10 !text-current sm:inline-flex">Space</span></button>
            </div>`}

        <div class="sticky bottom-[4.25rem] mt-6 grid grid-cols-2 gap-2.5 rounded-card border border-line bg-surface p-2.5 sm:grid-cols-3 lg:bottom-4">
          <button type="button" class="btn h-11 border-ok/40 hover:border-ok hover:bg-ok/10" data-know>${icon('check', 'h-4 w-4 text-ok')}I know this</button>
          <button type="button" class="btn h-11 border-warn/40 hover:border-warn hover:bg-warn/10" data-revise>${icon('refresh', 'h-4 w-4 text-warn')}Need revision</button>
          <button type="button" class="btn btn-ghost col-span-2 h-11 sm:col-span-1" data-next>Next question${icon('arrow-right')}</button>
        </div>
      </div>`;
    window.scrollTo(0, 0);
  }

  function paintResults() {
    const answered = results.length;
    const known = results.filter((r) => r.known).length;
    const missed = results.filter((r) => !r.known);
    const score = pct(known, answered);
    const bySkillMap = {};
    for (const r of results) {
      const s = (bySkillMap[r.q.skill] = bySkillMap[r.q.skill] || { known: 0, total: 0 });
      s.total++;
      if (r.known) s.known++;
    }
    const weak = Object.entries(bySkillMap).filter(([, s]) => s.known < s.total).sort((a, b) => a[1].known / a[1].total - b[1].known / b[1].total);
    if (answered) db.addSession({ mode: 'interview', total: answered, known, revise: missed.length, skills: bySkillMap });

    ctx.main.innerHTML = `
      ${pageHeader({ title: 'Interview finished', subtitle: answered ? `You answered ${answered} of ${plural(qs.length, 'question')}.` : 'You did not answer any questions this time.' })}
      <div class="grid max-w-4xl gap-4 md:grid-cols-[auto_1fr]">
        <div class="card flex items-center gap-5 p-5">
          ${ring(score, 104)}
          <dl class="space-y-1 text-sm">
            <div class="flex gap-6"><dt class="w-28 text-muted">Score</dt><dd class="font-semibold tabular-nums">${score}%</dd></div>
            <div class="flex gap-6"><dt class="w-28 text-muted">Known</dt><dd class="font-semibold tabular-nums text-ok">${known}</dd></div>
            <div class="flex gap-6"><dt class="w-28 text-muted">Needs revision</dt><dd class="font-semibold tabular-nums text-warn">${missed.length}</dd></div>
            <div class="flex gap-6"><dt class="w-28 text-muted">Skipped</dt><dd class="font-semibold tabular-nums">${qs.length - answered}</dd></div>
          </dl>
        </div>
        <div class="card p-5">
          <h2 class="text-base">Weak skills</h2>
          ${weak.length
            ? `<ul class="mt-3 space-y-2.5">${weak.map(([id, s]) => `<li class="flex items-center gap-3 text-sm"><a class="w-28 truncate font-medium hover:underline" href="${href(`/skills/${id}`)}">${esc(skillName(id))}</a><div class="flex-1">${progressBar(pct(s.known, s.total), `${skillName(id)} score`)}</div><span class="tabular-nums text-muted">${s.known}/${s.total}</span></li>`).join('')}</ul>`
            : `<p class="mt-2 text-sm text-muted">${answered ? 'None this round. You knew every question you answered.' : 'Answer some questions to see where you are weakest.'}</p>`}
        </div>
      </div>
      ${missed.length ? `<section class="mt-6 max-w-4xl" aria-labelledby="missed-h"><h2 id="missed-h" class="mb-2.5 text-base">Added to revision</h2>
        <ul class="card divide-y divide-line">${missed.map((r) => `<li><a class="block px-4 py-2.5 text-sm font-medium hover:underline" href="${href(`/questions/${r.q.id}`)}">${esc(r.q.question)}<span class="block text-xs font-normal text-faint">${esc(skillName(r.q.skill))}, ${esc(r.q.topic)}</span></a></li>`).join('')}</ul></section>` : ''}
      <div class="mt-6 flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary" data-restart>New interview</button>
        ${missed.length ? `<a class="btn" href="${href('/flashcards', { deck: 'revision' })}">${icon('layers')}Revise as flashcards</a>` : ''}
        <a class="btn" href="#/">Dashboard</a>
      </div>`;
    setListContext(missed.map((r) => r.q.id));
    mode = 'done';
  }

  let mode = 'setup';
  const reveal = () => { if (mode === 'run' && !revealed) { revealed = true; paintQuestion(); } };
  const advance = () => { i++; revealed = false; if (i >= qs.length) paintResults(); else paintQuestion(); };
  const answer = (isKnown) => {
    if (mode !== 'run') return;
    const q = qs[i];
    if (isKnown) markKnown(q.id); else markRevise(q.id);
    results.push({ q, known: isKnown });
    advance();
  };

  function onClick(e) {
    const set = e.target.closest('[data-set]');
    if (set) {
      const { set: group, value } = set.dataset;
      if (group === 'skill') {
        if (!value) cfg.skills = [];
        else if (cfg.skills.includes(value)) cfg.skills = cfg.skills.filter((s) => s !== value);
        else cfg.skills.push(value);
      } else if (group === 'difficulty') cfg.difficulty = value;
      else cfg.count = Number(value);
      paintSetup();
      const again = $(`[data-set="${group}"][data-value="${CSS.escape(value)}"]`, ctx.main);
      if (again) again.focus();
      return;
    }
    if (e.target.closest('[data-start]')) {
      qs = shuffle(pool()).slice(0, cfg.count);
      i = 0; revealed = false; results = []; mode = 'run';
      paintQuestion();
    } else if (e.target.closest('[data-reveal]')) reveal();
    else if (e.target.closest('[data-know]')) answer(true);
    else if (e.target.closest('[data-revise]')) answer(false);
    else if (e.target.closest('[data-next]')) { if (mode === 'run') advance(); }
    else if (e.target.closest('[data-end]')) paintResults();
    else if (e.target.closest('[data-restart]')) { mode = 'setup'; paintSetup(); }
  }
  function onChange(e) {
    if (e.target.matches('[data-unlearned]')) { cfg.unlearned = e.target.checked; paintSetup(); $('[data-unlearned]', ctx.main).focus(); }
  }
  ctx.main.addEventListener('click', onClick);
  ctx.main.addEventListener('change', onChange);
  ctx.onLeave = () => { ctx.main.removeEventListener('click', onClick); ctx.main.removeEventListener('change', onChange); };
  ctx.keys = { space: reveal, 1: () => answer(true), 2: () => answer(false), n: () => mode === 'run' && advance() };
  paintSetup();
}

/* ---------- Coding problems ---------- */

export function renderCoding(ctx) {
  ctx.setTitle('Coding problems');
  const all = store.questions.filter(isCoding).sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty) || byOrder(a, b));
  const topics = [...new Set(all.map((q) => q.topic))];
  let topic = ctx.query.topic && topics.includes(ctx.query.topic) ? ctx.query.topic : '';
  const p = progressOf(all);

  function paint() {
    const list = topic ? all.filter((q) => q.topic === topic) : all;
    setListContext(list.map((q) => q.id));
    ctx.main.innerHTML = `
      ${pageHeader({
        title: 'Coding problems',
        subtitle: 'Logic and problem-solving questions. Each one hides its hint, approach and solution until you ask.',
        actions: `<a class="btn" href="#/playground">${icon('terminal')}Playground</a><a class="btn btn-primary" href="${href('/manager/new', { skill: 'coding-logic', type: 'Coding' })}">${icon('plus')}Add problem</a>`,
      })}
      <div class="card card-pad mb-4 flex items-center gap-4">
        <div class="min-w-0 flex-1"><div class="mb-2 flex justify-between text-sm"><span class="text-muted">Solved</span><span class="font-semibold tabular-nums">${p.known} of ${p.total}</span></div>${progressBar(p.percent, 'Coding problems solved')}</div>
      </div>
      <div class="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Topic">
        <button type="button" class="chip" data-topic="" aria-pressed="${!topic}">All</button>
        ${topics.map((t) => `<button type="button" class="chip" data-topic="${esc(t)}" aria-pressed="${t === topic}">${esc(t)}</button>`).join('')}
      </div>
      ${list.length
        ? `<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">${list.map((q) => `
            <a class="card card-link flex min-w-0 flex-col p-4" href="${href(`/questions/${q.id}`)}" data-qid="${esc(q.id)}">
              <div class="flex flex-wrap items-center gap-1.5">${difficultyBadge(q.difficulty)}<span class="badge">${esc(q.skill === 'coding-logic' ? q.topic : skillName(q.skill))}</span><span data-slot="status">${statusBadge(db.getStatus(q.id))}</span></div>
              <h2 class="mt-2.5 text-base leading-snug">${esc(q.question)}</h2>
              ${q.statement ? `<p class="clamp-2 mt-1 text-sm text-muted">${mdInline(q.statement.split('\n')[0])}</p>` : ''}
              ${q.input ? `<p class="mt-auto truncate pt-3 font-mono text-xs text-faint">${esc(q.input.split('\n')[0])}</p>` : ''}
            </a>`).join('')}</div>`
        : emptyState({ icon: 'code', title: 'No coding problems found.', text: 'Add your first problem, or check that data/coding-logic.json loaded.', action: `<a class="btn btn-primary" href="${href('/manager/new', { skill: 'coding-logic', type: 'Coding' })}">Add a problem</a>` })}`;
  }
  function onClick(e) {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    topic = b.dataset.topic;
    history.replaceState(null, '', href('/coding', { topic }));
    paint();
  }
  ctx.main.addEventListener('click', onClick);
  ctx.onLeave = () => ctx.main.removeEventListener('click', onClick);
  paint();
}

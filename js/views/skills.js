import { esc, icon, href, plural } from '../utils.js';
import { store, bySkill, topicsOf, skillColor, matchesStep, DIFFICULTIES, byOrder } from '../data.js';
import * as db from '../storage.js';
import { pageHeader, sectionTitle, rowList, progressBar, emptyState, progressOf, setListContext } from '../ui.js';

const stat = (label, value) =>
  `<div class="card px-4 py-3"><div class="text-[0.8125rem] text-muted">${label}</div><div class="text-xl font-semibold tabular-nums">${value}</div></div>`;

export function renderSkills(ctx) {
  ctx.setTitle('Skills');
  ctx.main.innerHTML = `
    ${pageHeader({ title: 'Skills', subtitle: 'Each skill has its own topics, questions and progress.', actions: `<a class="btn" href="#/path">${icon('route')}Learning path</a>` })}
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      ${store.skills.map((s) => {
        const p = progressOf(bySkill(s.id));
        return `<a class="card card-link flex flex-col p-4 sm:p-5" href="${href(`/skills/${s.id}`)}">
          <div class="flex items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-lg"><span class="dot" style="background:${esc(skillColor(s.id))}"></span>${esc(s.name)}</h2>
            <span class="text-sm font-semibold tabular-nums">${p.percent}%</span>
          </div>
          <p class="clamp-2 mt-1.5 text-sm text-muted">${esc(s.description || '')}</p>
          <div class="mt-auto pt-4">${progressBar(p.percent, `${s.name} progress`)}
            <p class="mt-2 text-xs text-faint">${plural(p.total, 'question')}, ${p.known} learned${p.revision ? `, ${p.revision} to revise` : ''}</p>
          </div>
        </a>`;
      }).join('')}
    </div>`;
}

export function renderSkill(ctx) {
  const skill = store.skillMap.get(ctx.segments[1]);
  if (!skill) return missing(ctx, 'Skill not found', 'That skill is not listed in data/skills.json.');
  ctx.setTitle(skill.name);
  const questions = bySkill(skill.id);
  const p = progressOf(questions);
  const topics = topicsOf(skill.id);
  setListContext(questions.map((q) => q.id));

  ctx.main.innerHTML = `
    ${pageHeader({
      title: skill.name,
      subtitle: esc(skill.description || ''),
      crumbs: [{ label: 'Skills', href: '#/skills' }, { label: skill.name }],
      actions: `<a class="btn" href="${href('/flashcards', { deck: `skill:${skill.id}` })}">${icon('layers')}Flashcards</a>
                <a class="btn" href="${href('/interview', { skill: skill.id })}">${icon('shuffle')}Interview</a>
                <a class="btn btn-primary" href="${href('/manager/new', { skill: skill.id })}">${icon('plus')}Add question</a>`,
    })}
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      ${stat('Total questions', p.total)}${stat('Learned', `${p.known} <span class="text-sm font-normal text-faint">${p.percent}%</span>`)}${stat('To revise', p.revision)}${stat('Important', p.starred)}
    </div>
    <div class="mt-3">${progressBar(p.percent, `${skill.name} progress`)}</div>

    <section class="mt-7" aria-labelledby="topics-h">
      ${sectionTitle('Topics', '', 'topics-h')}
      <div class="flex flex-wrap gap-1.5">
        ${topics.map((t) => t.count
          ? `<a class="chip" href="${href(`/skills/${skill.id}/${encodeURIComponent(t.name)}`)}">${esc(t.name)}<span class="text-xs opacity-70">${t.count}</span></a>`
          : `<a class="chip border-dashed !text-faint" href="${href('/manager/new', { skill: skill.id, topic: t.name })}" title="No questions yet. Add the first one.">${esc(t.name)}${icon('plus', 'h-3 w-3')}</a>`).join('')}
      </div>
      <p class="mt-2 text-xs text-faint">Dashed topics have no questions yet. Tap one to add the first.</p>
    </section>

    <section class="mt-7" aria-labelledby="qs-h">
      ${sectionTitle('Questions in learning order', `<a class="link text-sm" href="${href('/questions', { skill: skill.id })}">Filter in explorer</a>`, 'qs-h')}
      ${questions.length
        ? `<div class="card overflow-hidden">${rowList(questions, (q) => ({ meta: `${esc(q.topic)}, ${esc(q.difficulty)}, ${esc(q.type)}` }))}</div>`
        : emptyState({ icon: 'database', title: 'No questions in this skill yet', text: 'Add the first one, or check that the data file loaded.', action: `<a class="btn btn-primary" href="${href('/manager/new', { skill: skill.id })}">Add a question</a>` })}
    </section>`;
}

export function renderTopic(ctx) {
  const skill = store.skillMap.get(ctx.segments[1]);
  const topic = ctx.segments[2];
  if (!skill) return missing(ctx, 'Skill not found', 'That skill is not listed in data/skills.json.');
  const questions = bySkill(skill.id).filter((q) => q.topic === topic);
  ctx.setTitle(`${topic} — ${skill.name}`);
  setListContext(questions.map((q) => q.id));
  const p = progressOf(questions);
  const important = questions.filter((q) => db.isStarred(q));
  const revision = questions.filter((q) => db.getStatus(q.id) === 'revision');
  const rest = questions.filter((q) => !important.includes(q) && !revision.includes(q));
  const meta = (q) => ({ meta: `${esc(q.difficulty)}, ${esc(q.type)}` });
  const levels = DIFFICULTIES.map((d) => [d, questions.filter((q) => q.difficulty === d).length]);

  ctx.main.innerHTML = `
    ${pageHeader({
      title: topic,
      subtitle: questions.length ? `${plural(questions.length, 'question')} on ${esc(topic)} in ${esc(skill.name)}. ${p.known} learned, ${p.revision} to revise.` : '',
      crumbs: [{ label: 'Skills', href: '#/skills' }, { label: skill.name, href: href(`/skills/${skill.id}`) }, { label: topic }],
      actions: `<a class="btn btn-primary" href="${href('/manager/new', { skill: skill.id, topic })}">${icon('plus')}Add question</a>`,
    })}
    ${!questions.length
      ? emptyState({ icon: 'note', title: 'No questions on this topic yet', text: 'When an interviewer asks you about it, add the question here.', action: `<a class="btn btn-primary" href="${href('/manager/new', { skill: skill.id, topic })}">Add the first question</a>` })
      : `<section class="card card-pad" aria-labelledby="dist-h">
          <h2 id="dist-h" class="mb-3 text-sm">Difficulty spread</h2>
          <div class="space-y-2">
            ${levels.map(([d, n]) => `<div class="flex items-center gap-3 text-[0.8125rem]"><span class="w-24 text-muted">${d}</span><div class="flex-1">${progressBar(Math.round((n / questions.length) * 100), `${d} share`)}</div><span class="w-6 text-right tabular-nums">${n}</span></div>`).join('')}
          </div>
        </section>
        ${revision.length ? `<section class="mt-6" aria-labelledby="t-rev">${sectionTitle('To revise', '', 't-rev')}<div class="card overflow-hidden">${rowList(revision, meta)}</div></section>` : ''}
        ${important.filter((q) => !revision.includes(q)).length ? `<section class="mt-6" aria-labelledby="t-imp">${sectionTitle('Important', '', 't-imp')}<div class="card overflow-hidden">${rowList(important.filter((q) => !revision.includes(q)), meta)}</div></section>` : ''}
        ${rest.length ? `<section class="mt-6" aria-labelledby="t-all">${sectionTitle(important.length || revision.length ? 'Everything else' : 'Questions', '', 't-all')}<div class="card overflow-hidden">${rowList(rest, meta)}</div></section>` : ''}`}`;
}

export function renderPath(ctx) {
  ctx.setTitle('Learning path');
  if (!store.paths.length) {
    ctx.main.innerHTML = pageHeader({ title: 'Learning path' }) + emptyState({ icon: 'route', title: 'No learning path defined', text: 'Add a "paths" list to data/skills.json to see one here.' });
    return;
  }
  ctx.main.innerHTML = store.paths
    .map((path, pi) => {
      const steps = path.steps.map((step) => {
        const qs = store.questions.filter((q) => matchesStep(q, step)).sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty) || byOrder(a, b));
        return { step, qs, p: progressOf(qs) };
      });
      const total = steps.reduce((n, s) => n + s.p.total, 0);
      const known = steps.reduce((n, s) => n + s.p.known, 0);
      const currentIndex = steps.findIndex((s) => s.p.total && s.p.percent < 100);
      return `
        ${pi === 0 ? pageHeader({ title: path.name, subtitle: esc(path.description || 'A suggested order to work through the knowledge base. Progress updates as you mark questions learned.') }) : `<h2 class="mb-3 mt-10 text-xl">${esc(path.name)}</h2>`}
        <div class="card card-pad mb-5">
          <div class="mb-2 flex justify-between text-sm"><span class="text-muted">Overall</span><span class="font-semibold tabular-nums">${known} of ${total} learned</span></div>
          ${progressBar(total ? Math.round((known / total) * 100) : 0, 'Path progress')}
        </div>
        <ol class="space-y-3">
          ${steps.map(({ step, qs, p }, i) => {
            const upNext = qs.filter((q) => !db.isKnown(q.id)).slice(0, 3);
            const done = p.total > 0 && p.percent === 100;
            return `<li class="card overflow-hidden">
              <details ${i === currentIndex ? 'open' : ''}>
                <summary class="flex cursor-pointer items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold ${done ? 'bg-ok/15 text-ok' : i === currentIndex ? 'bg-ink text-canvas' : 'bg-raised text-muted'}">${done ? icon('check', 'h-3.5 w-3.5') : i + 1}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-medium">${esc(step.title)}</span>
                    <span class="mt-1.5 block max-w-xs">${progressBar(p.percent, step.title)}</span>
                  </span>
                  <span class="text-sm tabular-nums text-muted">${p.known}/${p.total}</span>
                  ${icon('chevron-down', 'h-4 w-4 text-faint')}
                </summary>
                <div class="border-t border-line">
                  ${step.description ? `<p class="px-4 pt-3 text-sm text-muted sm:px-5">${esc(step.description)}</p>` : ''}
                  ${upNext.length ? `<p class="px-4 pt-3 text-xs font-medium text-faint sm:px-5">Up next</p>${rowList(upNext, (q) => ({ meta: `${esc(q.topic)}, ${esc(q.difficulty)}` }))}` : `<p class="px-4 py-3 text-sm text-muted sm:px-5">${p.total ? 'Every question in this step is learned.' : 'No questions match this step yet.'}</p>`}
                  ${p.total ? `<div class="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5">
                    <a class="btn btn-sm" href="${href('/flashcards', { deck: `path:${pi}:${i}` })}">${icon('layers', 'h-3.5 w-3.5')}Practise this step</a>
                  </div>` : ''}
                </div>
              </details>
            </li>`;
          }).join('')}
        </ol>`;
    })
    .join('');
}

function missing(ctx, title, text) {
  ctx.setTitle(title);
  ctx.main.innerHTML = emptyState({ icon: 'search', title, text, action: `<a class="btn btn-primary" href="#/skills">All skills</a>` });
}

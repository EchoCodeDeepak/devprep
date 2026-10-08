import { esc, icon, href, plural, timeAgo } from '../utils.js';
import { store, isCoding, skillName, skillColor, matchesStep } from '../data.js';
import * as db from '../storage.js';
import { pageHeader, sectionTitle, rowList, progressBar, ring, emptyState, notice, progressOf, setListContext } from '../ui.js';
import { todaysPlan, readiness } from '../plan.js';

const tile = (label, value, link, sub = '') =>
  `<a class="card card-link block px-4 py-3.5" href="${link}">
    <span class="block text-[0.8125rem] text-muted">${label}</span>
    <span class="mt-0.5 block text-2xl font-semibold tabular-nums tracking-tight">${value}</span>
    ${sub ? `<span class="block text-xs text-faint">${sub}</span>` : ''}
  </a>`;

export function renderDashboard(ctx) {
  ctx.setTitle('');
  const all = progressOf(store.questions);
  const coding = store.questions.filter(isCoding);
  const plan = todaysPlan(10);
  const ready = readiness();
  const recent = db.getRecent().map((r) => ({ q: store.byId.get(r.id), t: r.t })).filter((r) => r.q).slice(0, 5);
  const revision = store.questions.filter((q) => db.getStatus(q.id) === 'revision').sort((a, b) => db.statusTime(a.id) - db.statusTime(b.id));
  const order = { critical: 0, high: 1, medium: 2, normal: 3 };
  const important = store.questions
    .filter((q) => db.isStarred(q) && !db.isKnown(q.id))
    .sort((a, b) => order[a.priority] - order[b.priority] || a._seq - b._seq);

  const planCard = plan.items.length
    ? `<section class="card overflow-hidden lg:col-span-2" aria-labelledby="today-h">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div>
            <h2 id="today-h" class="text-lg">Today's preparation</h2>
            <p class="mt-0.5 text-sm text-muted">${plan.mix.map((m) => `${m.count} ${esc(skillName(m.skill))}`).join(', ')}</p>
          </div>
          <a class="btn btn-primary" href="${href('/flashcards', { deck: 'today' })}">${icon('play', 'h-3.5 w-3.5')}Start ${plural(plan.items.length, 'card')}</a>
        </div>
        <div class="border-t border-line">${rowList(plan.items.map((p) => p.q), (q) => ({ meta: esc(plan.items.find((p) => p.q === q).reason) }))}</div>
      </section>`
    : `<div class="lg:col-span-2">${emptyState({ icon: 'check', title: 'Nothing left to plan', text: 'Every question is mastered. Add new questions to keep the plan going.', action: `<a class="btn btn-primary" href="#/manager/new">Add a question</a>` })}</div>`;

  const readyCard = `<section class="card card-pad" aria-labelledby="ready-h">
      <h2 id="ready-h" class="text-base">Interview readiness</h2>
      <div class="mt-3 flex items-center gap-4">
        ${ring(ready.score)}
        <dl class="min-w-0 flex-1 space-y-1.5 text-[0.8125rem]">
          ${ready.parts.map((p) => `<div class="flex justify-between gap-2"><dt class="truncate text-muted">${p.label}</dt><dd class="tabular-nums">${Math.round(p.value * 100)}%</dd></div>`).join('')}
        </dl>
      </div>
      <p class="mt-3 text-xs text-faint">A study-progress indicator built from your own marks. It shows how much of this knowledge base you have covered, not how an interview will go.</p>
    </section>`;

  const skillCards = store.skills
    .map((s) => {
      const p = progressOf(store.questions.filter((q) => q.skill === s.id));
      return `<a class="card card-link block p-4" href="${href(`/skills/${s.id}`)}">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 font-medium"><span class="dot" style="background:${esc(skillColor(s.id))}"></span>${esc(s.name)}</span>
          <span class="text-sm font-semibold tabular-nums">${p.percent}%</span>
        </div>
        <div class="mt-3">${progressBar(p.percent, `${s.name} progress`)}</div>
        <p class="mt-2 text-xs text-faint">${p.known} of ${p.total} learned${p.revision ? `, ${p.revision} to revise` : ''}</p>
      </a>`;
    })
    .join('');

  const path = store.paths[0];
  const pathCard = path
    ? `<section aria-labelledby="path-h">
        ${sectionTitle(path.name, `<a class="link text-sm" href="#/path">Open path</a>`, 'path-h')}
        <ol class="card grid gap-px overflow-hidden bg-line sm:grid-cols-2 lg:grid-cols-5">
          ${path.steps.map((step, i) => {
            const p = progressOf(store.questions.filter((q) => matchesStep(q, step)));
            return `<li class="bg-surface px-3.5 py-3">
              <span class="flex items-center justify-between gap-2 text-sm"><span class="truncate font-medium">${i + 1}. ${esc(step.title)}</span><span class="text-xs tabular-nums text-faint">${p.percent}%</span></span>
              <div class="mt-2">${progressBar(p.percent, step.title)}</div></li>`;
          }).join('')}
        </ol>
      </section>`
    : '';

  ctx.main.innerHTML = `
    ${pageHeader({
      title: 'Dashboard',
      subtitle: `${plural(all.total, 'question')} across ${plural(store.skills.length, 'skill')}. ${all.known ? `${all.known} learned so far.` : 'Start with today\'s plan below.'}`,
      actions: `<a class="btn" href="#/interview">${icon('shuffle')}Random interview</a><a class="btn" href="#/manager/new">${icon('plus')}Add question</a>`,
    })}
    ${store.errors.length ? `<div class="mb-4">${notice(`<strong class="text-ink">Some content could not be loaded.</strong> ${esc(store.errors[0])} ${store.errors.length > 1 ? `(+${store.errors.length - 1} more)` : ''} <a class="link" href="#/manager">See details</a>`, 'warn')}</div>` : ''}

    <div class="grid gap-4 lg:grid-cols-3">
      ${planCard}
      <div class="flex min-w-0 flex-col gap-4">
        ${readyCard}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          ${tile('Total questions', all.total, '#/questions')}
          ${tile('Learned', all.known, href('/questions', { status: 'learned,mastered' }), all.mastered ? `${all.mastered} mastered` : '')}
          ${tile('To revise', all.revision, '#/revision')}
          ${tile('Important', all.starred, '#/important')}
          ${tile('Coding problems', coding.length, '#/coding')}
          ${tile('Skills covered', store.skills.length, '#/skills')}
        </div>
      </div>
    </div>

    <div class="mt-7 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="cont-h">
        ${sectionTitle('Continue learning', '', 'cont-h')}
        ${recent.length
          ? `<div class="card overflow-hidden">${rowList(recent.map((r) => r.q), (q) => ({ meta: `Viewed ${timeAgo(recent.find((r) => r.q === q).t)}` }))}</div>`
          : emptyState({ icon: 'book', title: 'Nothing viewed yet', text: 'Questions you open show up here so you can pick up where you stopped.', action: `<a class="btn" href="#/questions">Browse questions</a>` })}
      </section>
      <section aria-labelledby="rev-h">
        ${sectionTitle('Revision queue', revision.length ? `<a class="link text-sm" href="#/revision">All ${revision.length}</a>` : '', 'rev-h')}
        ${revision.length
          ? `<div class="card overflow-hidden">${rowList(revision.slice(0, 5), (q) => ({ meta: `Added ${timeAgo(db.statusTime(q.id))}` }))}</div>`
          : emptyState({ icon: 'check', title: 'You are all caught up! 🎉', text: 'Press “Revise” on any question you want to see again and it will wait for you here.' })}
      </section>
    </div>

    <section class="mt-7" aria-labelledby="imp-h">
      ${sectionTitle('Important questions to learn', important.length ? `<a class="link text-sm" href="#/important">All important</a>` : '', 'imp-h')}
      ${important.length
        ? `<div class="card overflow-hidden">${rowList(important.slice(0, 6), (q) => ({ meta: `${esc(skillName(q.skill))}, ${esc(q.topic)}` }))}</div>`
        : emptyState({ icon: 'star', title: 'No important questions waiting', text: 'Star important questions to access them here.' })}
    </section>

    <section class="mt-7" aria-labelledby="skill-h">
      ${sectionTitle('Skill progress', `<a class="link text-sm" href="#/skills">All skills</a>`, 'skill-h')}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${skillCards}</div>
    </section>

    <div class="mt-7">${pathCard}</div>`;

  setListContext(plan.items.map((p) => p.q.id));
}

// Interview history: a personal record of which company asked what.
// Stored in this browser only.

import { $, esc, icon, href, modal, confirmDialog, toast, fmtDate, plural, todayISO } from '../utils.js';
import { store, getQuestion, skillName } from '../data.js';
import * as db from '../storage.js';
import { pageHeader, emptyState, skillChip, sectionTitle, notice } from '../ui.js';

const ROUNDS = ['Screening', 'Technical round', 'Machine test', 'Manager round', 'HR round'];

function matchQuestion(text) {
  const t = text.toLowerCase().replace(/[?.!\s]+$/g, '');
  return store.questions.find((q) => q.question.toLowerCase().replace(/[?.!\s]+$/g, '') === t);
}

function openEditor(entry, onSaved) {
  const e = entry || { id: `iv-${Date.now().toString(36)}`, company: '', role: '', date: todayISO(), round: '', skills: [], notes: '', questions: [] };
  let skills = [...(e.skills || [])];
  const m = modal({
    title: entry ? 'Edit interview' : 'Add interview',
    body: `<form class="space-y-4" data-iv novalidate>
        <div><label class="label" for="iv-company">Company <span class="text-bad" aria-hidden="true">*</span></label>
          <input id="iv-company" name="company" class="input" value="${esc(e.company)}" placeholder="ABC Technologies" required aria-required="true" autocomplete="off" autofocus>
          <p class="field-error" id="iv-company-err" hidden>Enter the company name.</p></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="iv-date">Date</label><input id="iv-date" name="date" type="date" class="input" value="${esc(e.date || '')}"></div>
          <div><label class="label" for="iv-round">Round</label><input id="iv-round" name="round" class="input" value="${esc(e.round || '')}" list="iv-rounds" placeholder="Technical round" autocomplete="off">
            <datalist id="iv-rounds">${ROUNDS.map((r) => `<option value="${r}">`).join('')}</datalist></div>
        </div>
        <div><label class="label" for="iv-role">Role</label><input id="iv-role" name="role" class="input" value="${esc(e.role || '')}" placeholder="Laravel Developer" autocomplete="off"></div>
        <fieldset><legend class="label">Skills covered</legend>
          <div class="flex flex-wrap gap-1.5">${store.skills.map((s) => `<button type="button" class="chip" data-skill="${esc(s.id)}" aria-pressed="${skills.includes(s.id)}">${esc(s.name)}</button>`).join('')}</div></fieldset>
        <div><label class="label" for="iv-questions">Questions asked</label>
          <textarea id="iv-questions" name="questions" rows="6" class="input" placeholder="Explain dependency injection.&#10;What is Eloquent eager loading?&#10;Difference between interface and abstract class.">${esc((e.questions || []).map((q) => q.text).join('\n'))}</textarea>
          <p class="hint">One question per line. Lines that match a question in the knowledge base are linked to it.</p></div>
        <div><label class="label" for="iv-notes">Notes</label><textarea id="iv-notes" name="notes" rows="3" class="input" placeholder="How it went, what to prepare next time.">${esc(e.notes || '')}</textarea></div>
      </form>`,
    footer: `<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save interview</button>`,
  });
  m.el.addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-skill]');
    if (chip) {
      const id = chip.dataset.skill;
      skills = skills.includes(id) ? skills.filter((s) => s !== id) : [...skills, id];
      chip.setAttribute('aria-pressed', skills.includes(id));
      return;
    }
    if (!ev.target.closest('[data-save]')) return;
    const d = new FormData(m.el.querySelector('[data-iv]'));
    const company = String(d.get('company')).trim();
    const input = m.el.querySelector('#iv-company');
    const err = m.el.querySelector('#iv-company-err');
    if (!company) {
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'iv-company-err');
      input.focus();
      return;
    }
    const previous = new Map((e.questions || []).map((q) => [q.text, q.qid]));
    const questions = String(d.get('questions')).split('\n').map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
      .map((text) => ({ text, qid: previous.get(text) || matchQuestion(text)?.id || '' }));
    db.saveInterview({ id: e.id, company, role: String(d.get('role')).trim(), date: String(d.get('date')), round: String(d.get('round')).trim(), skills, notes: String(d.get('notes')).trim(), questions });
    m.close();
    toast('Interview saved.');
    onSaved();
  });
}

export function renderHistory(ctx) {
  ctx.setTitle('Interview history');

  function paint() {
    const interviews = db.getInterviews().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const asked = Object.entries(db.allExperience()).map(([id, x]) => ({ q: getQuestion(id), x })).filter((r) => r.q && (r.x.asked || r.x.company));
    const totalQs = interviews.reduce((n, i) => n + (i.questions || []).length, 0);

    ctx.main.innerHTML = `
      ${pageHeader({
        title: 'Interview history',
        subtitle: 'Your interview memory: which company asked what, so the next round is easier.',
        actions: `<button type="button" class="btn btn-primary" data-add>${icon('plus')}Add interview</button>`,
      })}
      ${interviews.length
        ? `<p class="mb-3 text-sm text-muted">${plural(interviews.length, 'interview')}, ${plural(totalQs, 'question')} recorded.</p>
          <div class="space-y-3">${interviews.map((iv) => `
            <article class="card" data-iv-id="${esc(iv.id)}">
              <div class="flex flex-wrap items-start justify-between gap-3 p-4 sm:px-5">
                <div class="min-w-0">
                  <h2 class="text-lg">${esc(iv.company)}</h2>
                  <p class="text-sm text-muted">${[iv.role, iv.round, fmtDate(iv.date)].filter(Boolean).map(esc).join(', ')}</p>
                  ${(iv.skills || []).length ? `<div class="mt-2 flex flex-wrap gap-1.5">${iv.skills.filter((s) => store.skillMap.has(s)).map(skillChip).join('')}</div>` : ''}
                </div>
                <div class="flex gap-1">
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" data-edit aria-label="Edit interview" title="Edit">${icon('edit')}</button>
                  <button type="button" class="btn btn-ghost btn-icon btn-sm hover:!text-bad" data-del aria-label="Delete interview" title="Delete">${icon('trash')}</button>
                </div>
              </div>
              ${(iv.questions || []).length ? `<ol class="divide-y divide-line border-t border-line">
                ${iv.questions.map((item, n) => {
                  const q = item.qid && getQuestion(item.qid);
                  return `<li class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-5">
                    <span class="w-5 shrink-0 text-sm tabular-nums text-faint">${n + 1}.</span>
                    ${q
                      ? `<a class="min-w-0 flex-1 basis-56 text-sm font-medium hover:underline" href="${href(`/questions/${q.id}`)}">${esc(item.text)}</a><span class="badge badge-ok">In knowledge base</span>`
                      : `<span class="min-w-0 flex-1 basis-56 text-sm">${esc(item.text)}</span>
                         <a class="btn btn-ghost btn-sm" href="${href('/questions', { q: item.text.replace(/[?.]/g, '').split(/\s+/).slice(0, 4).join(' ') })}">${icon('search', 'h-3.5 w-3.5')}Find</a>
                         <a class="btn btn-sm" href="${href('/manager/new', { question: item.text, asked: 1, skill: (iv.skills || [])[0] || '' })}">${icon('plus', 'h-3.5 w-3.5')}Add answer</a>`}
                  </li>`;
                }).join('')}</ol>` : ''}
              ${iv.notes ? `<p class="whitespace-pre-line border-t border-line px-4 py-3 text-sm text-muted sm:px-5">${esc(iv.notes)}</p>` : ''}
            </article>`).join('')}</div>`
        : emptyState({ icon: 'briefcase', title: 'No interviews recorded yet', text: 'After each interview, write down what they asked while you still remember. It becomes your best revision list.', action: `<button type="button" class="btn btn-primary" data-add>${icon('plus')}Add your first interview</button>` })}

      ${asked.length ? `<section class="mt-8" aria-labelledby="asked-h">
        ${sectionTitle('Questions marked as asked', '', 'asked-h')}
        <ul class="card divide-y divide-line">${asked.map(({ q, x }) => `<li><a class="block px-4 py-2.5 hover:bg-raised sm:px-5" href="${href(`/questions/${q.id}`)}">
          <span class="block text-sm font-medium">${esc(q.question)}</span>
          <span class="block text-xs text-faint">${[skillName(q.skill), x.company, x.round, fmtDate(x.date)].filter(Boolean).map(esc).join(', ')}</span></a></li>`).join('')}</ul>
      </section>` : ''}
      <div class="mt-6">${notice('Interview history is saved in this browser only. It is included in the backup file from <a class="link" href="#/backup">Import / Export</a>. Keep it to interview questions and notes; do not store passwords or private documents here.')}</div>`;
  }

  async function onClick(e) {
    if (e.target.closest('[data-add]')) return openEditor(null, paint);
    const card = e.target.closest('[data-iv-id]');
    if (!card) return;
    const entry = db.getInterviews().find((i) => i.id === card.dataset.ivId);
    if (!entry) return;
    if (e.target.closest('[data-edit]')) openEditor(entry, paint);
    else if (e.target.closest('[data-del]')) {
      const ok = await confirmDialog({ title: 'Delete this interview?', message: `The record for ${entry.company} and its ${plural((entry.questions || []).length, 'question')} will be removed from this browser.`, confirmLabel: 'Delete interview', danger: true });
      if (ok) { db.deleteInterview(entry.id); paint(); toast('Interview deleted.'); }
    }
  }
  ctx.main.addEventListener('click', onClick);
  ctx.onLeave = () => ctx.main.removeEventListener('click', onClick);
  paint();
}

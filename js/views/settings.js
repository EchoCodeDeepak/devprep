// Settings and Import / Export.

import { $, esc, icon, modal, confirmDialog, toast, download, plural, todayISO } from '../utils.js';
import { rebuild } from '../data.js';
import * as db from '../storage.js';
import { pageHeader, notice } from '../ui.js';

const describe = (s) =>
  [
    plural(s.statuses, 'study status', 'study statuses'), plural(s.stars, 'star change'), plural(s.notes, 'note'),
    plural(s.experience, 'interview experience'), plural(s.custom, 'local question'), plural(s.interviews, 'interview'),
  ].join(', ');

function exportBackup() {
  download('interview-prep-backup.json', JSON.stringify(db.exportBackup(), null, 2));
  toast('Backup exported successfully.');
}

function importFile(file, onDone) {
  const reader = new FileReader();
  reader.onerror = () => toast('That file could not be read.', 'error');
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(String(reader.result));
    } catch (e) {
      toast('That file is not valid JSON, so nothing was imported.', 'error');
      return;
    }
    if (!data || typeof data !== 'object' || (data.app !== 'devprep' && !data.progress && !data.custom)) {
      toast('That file is not a DevPrep backup, so nothing was imported.', 'error');
      return;
    }
    const m = modal({
      title: 'Import backup',
      size: 'sm',
      body: `<p class="text-sm text-muted">This backup${data.exportedAt ? ` from <strong class="text-ink">${esc(new Date(data.exportedAt).toLocaleString())}</strong>` : ''} contains ${esc(describe(db.summarize(data)))}.</p>
        <fieldset class="mt-4 space-y-2.5">
          <legend class="label">How should it be applied?</legend>
          <label class="flex gap-2.5 rounded-ctl border border-line p-3 text-sm"><input type="radio" name="mode" value="merge" class="check mt-0.5 rounded-full" checked>
            <span><span class="font-medium">Merge with this browser</span><span class="block text-muted">Keeps what is here and adds what is missing. The newer status wins.</span></span></label>
          <label class="flex gap-2.5 rounded-ctl border border-line p-3 text-sm"><input type="radio" name="mode" value="replace" class="check mt-0.5 rounded-full">
            <span><span class="font-medium">Replace everything</span><span class="block text-muted">This browser's data is discarded and the backup takes its place.</span></span></label>
        </fieldset>`,
      footer: `<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" data-go>Import backup</button>`,
    });
    m.el.querySelector('[data-go]').addEventListener('click', () => {
      const mode = m.el.querySelector('input[name="mode"]:checked').value;
      try {
        db.importBackup(data, mode);
        rebuild();
        m.close();
        toast('Backup imported successfully.');
        onDone();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  };
  reader.readAsText(file);
}

const browserNote = () =>
  notice(`<strong class="text-ink">Your progress lives in this browser.</strong> Statuses, stars, notes, interview history and locally added questions are stored in LocalStorage on this device, for this browser profile only. They do not sync, and clearing site data or using a private window loses them. Export a backup now and then, and keep it out of public repos if your notes are private.`);

export function renderBackup(ctx) {
  ctx.setTitle('Import / Export');
  function paint() {
    const sum = db.summarize();
    ctx.main.innerHTML = `
      ${pageHeader({ title: 'Import / Export', subtitle: 'Back up your personal data, or move it to another browser.' })}
      <div class="max-w-3xl space-y-4">
        ${browserNote()}
        <section class="card card-pad">
          <h2 class="text-base">Export my data</h2>
          <p class="mt-1 text-sm text-muted">Downloads <code class="font-mono text-ink">interview-prep-backup.json</code> with ${esc(describe(sum))}, plus your settings.</p>
          <button type="button" class="btn btn-primary mt-4" data-export>${icon('download')}Export my data</button>
        </section>
        <section class="card card-pad">
          <h2 class="text-base">Import backup</h2>
          <p class="mt-1 text-sm text-muted">Restores learned status, favourites, notes, revision status, interview history and local questions from a backup file. You choose whether to merge or replace before anything changes.</p>
          <label class="btn mt-4 cursor-pointer">${icon('upload')}Choose backup file<input type="file" accept="application/json,.json" class="sr-only" data-import></label>
        </section>
        <section class="card card-pad">
          <h2 class="text-base">Export questions for the data files</h2>
          <p class="mt-1 text-sm text-muted">A backup restores your browser. To make a question part of the site itself, export its JSON and commit it to <code class="font-mono text-ink">/data</code>.</p>
          <a class="btn mt-4" href="#/manager?scope=local">${icon('database')}Open Content Manager</a>
        </section>
      </div>`;
  }
  function onClick(e) {
    if (e.target.closest('[data-export]')) exportBackup();
  }
  function onChange(e) {
    if (!e.target.matches('[data-import]')) return;
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) importFile(file, paint);
  }
  ctx.main.addEventListener('click', onClick);
  ctx.main.addEventListener('change', onChange);
  ctx.onLeave = () => { ctx.main.removeEventListener('click', onClick); ctx.main.removeEventListener('change', onChange); };
  paint();
}

export function renderSettings(ctx) {
  ctx.setTitle('Settings');
  const seg = (name, options, current) =>
    `<div class="inline-flex flex-wrap rounded-ctl bg-raised p-1" role="radiogroup" aria-label="${esc(name)}">
      ${options.map(([value, label]) => `<button type="button" role="radio" class="rounded-chip px-3 py-1.5 text-[0.8125rem] font-medium text-muted aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm" data-set="${name}" data-value="${esc(value)}" aria-checked="${String(value) === String(current)}">${esc(label)}</button>`).join('')}
    </div>`;
  const row = (title, text, control) =>
    `<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-4 py-3.5 sm:px-5"><div class="min-w-0 basis-56"><div class="text-sm font-medium">${title}</div>${text ? `<div class="text-[0.8125rem] text-muted">${text}</div>` : ''}</div>${control}</div>`;

  function paint() {
    const s = db.getSettings();
    const kb = (db.bytesUsed() / 1024).toFixed(1);
    ctx.main.innerHTML = `
      ${pageHeader({ title: 'Settings' })}
      <div class="max-w-3xl space-y-5">
        <section aria-labelledby="set-look"><h2 id="set-look" class="mb-2 text-base">Appearance</h2>
          <div class="card divide-y divide-line">
            ${row('Theme', 'System follows your device setting.', seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], s.theme))}
            ${row('Reduce animations', 'Turns off card flips and transitions. Your device\'s reduced-motion setting is always respected.', `<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" data-toggle="reduceMotion" ${s.reduceMotion ? 'checked' : ''}><span class="sr-only">Reduce animations</span></label>`)}
          </div>
        </section>
        <section aria-labelledby="set-q"><h2 id="set-q" class="mb-2 text-base">Questions</h2>
          <div class="card divide-y divide-line">
            ${row('Default question view', 'How question lists open.', seg('view', [['cards', 'Cards'], ['compact', 'Compact list']], s.view))}
            ${row('Questions per page', 'How many load before “Show more”.', seg('perPage', [[10, '10'], [20, '20'], [30, '30'], [50, '50']], s.perPage))}
            ${row('Keyboard shortcuts', 'Search, next, previous, favourite and more.', `<button type="button" class="btn" data-open-shortcuts>${icon('keyboard')}View shortcuts</button>`)}
          </div>
        </section>
        <section aria-labelledby="set-data"><h2 id="set-data" class="mb-2 text-base">Your data</h2>
          <div class="card divide-y divide-line">
            ${row('Export backup', `${esc(describe(db.summarize()))}. About ${kb} KB.`, `<button type="button" class="btn" data-export>${icon('download')}Export backup</button>`)}
            ${row('Import backup', 'Restore from a backup file.', `<label class="btn cursor-pointer">${icon('upload')}Import backup<input type="file" accept="application/json,.json" class="sr-only" data-import></label>`)}
            ${row('Clear browser data', 'Removes statuses, stars, notes, interview history and local questions from this browser. Questions in the data files stay.', `<button type="button" class="btn btn-danger" data-clear>${icon('trash')}Clear browser data</button>`)}
          </div>
        </section>
        ${browserNote()}
        ${notice('LocalStorage is not encrypted, and anything with access to this browser profile can read it. Use DevPrep for interview knowledge and study notes. Do not store passwords, API keys, private credentials or sensitive personal information here.', 'warn')}
      </div>`;
  }

  async function onClick(e) {
    const set = e.target.closest('[data-set]');
    if (set) {
      const key = set.dataset.set;
      db.setSetting(key, key === 'perPage' ? Number(set.dataset.value) : set.dataset.value);
      paint();
      $(`[data-set="${key}"][aria-checked="true"]`, ctx.main)?.focus();
      toast('Settings saved.');
      return;
    }
    if (e.target.closest('[data-export]')) return exportBackup();
    if (e.target.closest('[data-clear]')) {
      const ok = await confirmDialog({
        title: 'Clear all browser data?',
        message: 'This removes every status, star, note, interview record and locally added question from this browser. It cannot be undone. Export a backup first if you might want it back.',
        confirmLabel: 'Clear everything',
        danger: true,
      });
      if (!ok) return;
      db.clearAll();
      rebuild();
      paint();
      toast('Browser data cleared.');
    }
  }
  function onChange(e) {
    if (e.target.matches('[data-toggle]')) {
      db.setSetting(e.target.dataset.toggle, e.target.checked);
      toast('Settings saved.');
    } else if (e.target.matches('[data-import]')) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) importFile(file, paint);
    }
  }
  ctx.main.addEventListener('click', onClick);
  ctx.main.addEventListener('change', onChange);
  ctx.onLeave = () => { ctx.main.removeEventListener('click', onClick); ctx.main.removeEventListener('change', onChange); };
  paint();
}

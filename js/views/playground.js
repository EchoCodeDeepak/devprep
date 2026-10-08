// Code playground. HTML, CSS and JavaScript run in a sandboxed iframe that
// cannot touch this page or its storage. PHP is server-side, so the PHP tab
// is an editor only — it never pretends to execute.

import { $, $$, esc, icon, highlight, copyText, toast, debounce, md, mdInline } from '../utils.js';
import { store, skillName } from '../data.js';
import { pageHeader, notice } from '../ui.js';

const KEY = 'devprep:playground:v1';
const STARTER = {
  html: `<h1>Character counter</h1>\n<input id="word" value="INTERVIEW">\n<pre id="out"></pre>`,
  css: `body { font-family: system-ui, sans-serif; }\ninput { padding: 6px 8px; font-size: 16px; }\npre { background: #f4f5f7; padding: 10px; border-radius: 8px; }`,
  js: `const input = document.getElementById('word');\nconst out = document.getElementById('out');\n\nfunction countChars(text) {\n  const counts = {};\n  for (const ch of text) {\n    counts[ch] = (counts[ch] || 0) + 1;\n  }\n  return counts;\n}\n\nfunction render() {\n  const counts = countChars(input.value);\n  out.textContent = Object.entries(counts)\n    .map(([ch, n]) => ch + ' → ' + n)\n    .join('\\n');\n  console.log(counts);\n}\n\ninput.addEventListener('input', render);\nrender();`,
  php: `<?php\n\nfunction countChars(string $text): array\n{\n    $counts = [];\n    foreach (str_split($text) as $ch) {\n        $counts[$ch] = ($counts[$ch] ?? 0) + 1;\n    }\n    return $counts;\n}\n\nprint_r(countChars('INTERVIEW'));`,
  expected: `Array\n(\n    [I] => 2\n    [N] => 1\n    [T] => 1\n    [E] => 2\n    [R] => 1\n    [V] => 1\n    [W] => 1\n)`,
};

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d === 'object') return { ...STARTER, ...d };
  } catch (e) { /* use the starter */ }
  return { ...STARTER };
}

/** A textarea laid over highlighted code, so typing stays native and accessible. */
function mountEditor(host, lang, value, onInput) {
  host.innerHTML = `<div class="editor"><pre aria-hidden="true"><code></code></pre>
    <textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="${esc(lang.toUpperCase())} code. Press Escape, then Tab, to leave the editor."></textarea></div>`;
  const ta = host.querySelector('textarea');
  const pre = host.querySelector('pre');
  const code = host.querySelector('code');
  let escaped = false;
  const paint = () => { code.innerHTML = highlight(ta.value, lang) + '\n'; };
  ta.value = value;
  paint();
  ta.addEventListener('input', () => { paint(); onInput(ta.value); });
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { escaped = true; return; }
    if (e.key === 'Tab' && !escaped && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = ta;
      ta.setRangeText('  ', s, en, 'end');
      paint();
      onInput(ta.value);
    }
    escaped = false;
  });
  return { set(v) { ta.value = v; paint(); }, get: () => ta.value, focus: () => ta.focus() };
}

function buildDocument({ html, css, js }) {
  const bridge = `(function(){var fmt=function(v){if(typeof v==='string')return v;if(v instanceof Error)return v.name+': '+v.message;if(typeof v==='function')return v.toString();try{var s=JSON.stringify(v,null,2);return s===undefined?String(v):s}catch(e){return String(v)}};
var send=function(type,args){parent.postMessage({source:'devprep-playground',type:type,text:[].map.call(args,fmt).join(' ')},'*')};
['log','info','warn','error','debug'].forEach(function(m){var o=console[m];console[m]=function(){send(m,arguments);o&&o.apply(console,arguments)}});
window.onerror=function(msg){send('error',[String(msg)]);return true};
window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise rejection: '+(e.reason&&e.reason.message||e.reason)])});})();`;
  const safe = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;font-family:system-ui,sans-serif;color:#14171f;background:#fff}</style><style>${String(css).replace(/<\/(style)/gi, '<\\/$1')}</style></head><body>${html}<script>${bridge}<\/script><script>${safe(js)}<\/script></body></html>`;
}

export function renderPlayground(ctx) {
  ctx.setTitle('Code playground');
  const draft = loadDraft();
  let mode = 'web';
  let tab = 'js';

  // Code sent here from a question's "Run" button.
  try {
    const sent = JSON.parse(sessionStorage.getItem('devprep:playground') || 'null');
    sessionStorage.removeItem('devprep:playground');
    if (sent && ['js', 'html', 'css'].includes(sent.lang)) {
      draft[sent.lang] = sent.code;
      if (sent.lang === 'js') draft.html = '';
      tab = sent.lang;
    }
  } catch (e) { /* ignore */ }

  const persist = debounce(() => {
    try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch (e) { /* drafts are optional */ }
  }, 400);
  const phpExamples = store.questions.filter((q) => q.codes.some((c) => c.language === 'php')).slice(0, 80);
  let editor = null;
  let logs = [];

  const tabBtn = (id, label, group, current) =>
    `<button type="button" role="tab" class="rounded-chip px-3 py-1.5 text-[0.8125rem] font-medium text-muted aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-sm" data-${group}="${id}" aria-selected="${id === current}">${label}</button>`;

  function paint() {
    ctx.main.innerHTML = `
      ${pageHeader({ title: 'Code playground', subtitle: 'Try an idea without leaving your notes. Drafts are saved in this browser.' })}
      <div class="mb-4 inline-flex rounded-ctl bg-raised p-1" role="tablist" aria-label="Language">
        ${tabBtn('web', 'HTML / CSS / JavaScript', 'mode', mode)}${tabBtn('php', 'PHP', 'mode', mode)}
      </div>
      ${mode === 'web' ? webHtml() : phpHtml()}`;
    if (mode === 'web') mountWeb();
    else mountPhp();
  }

  /* ----- Web ----- */

  function webHtml() {
    return `<div class="grid gap-4 lg:grid-cols-2">
      <section class="card flex min-w-0 flex-col overflow-hidden" aria-label="Editor">
        <div class="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
          <div class="inline-flex rounded-ctl bg-raised p-0.5" role="tablist" aria-label="File">
            ${tabBtn('html', 'HTML', 'tab', tab)}${tabBtn('css', 'CSS', 'tab', tab)}${tabBtn('js', 'JavaScript', 'tab', tab)}
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-ghost btn-sm" data-reset>Reset</button>
            <button type="button" class="btn btn-primary btn-sm" data-run>${icon('play', 'h-3 w-3')}Run</button>
          </div>
        </div>
        <div class="h-[19rem] lg:h-[30rem]" data-editor></div>
      </section>
      <div class="flex min-w-0 flex-col gap-4">
        <section class="card flex flex-col overflow-hidden" aria-label="Preview">
          <div class="border-b border-line px-3.5 py-2 text-xs text-faint">Preview</div>
          <iframe title="Preview of your code" sandbox="allow-scripts" class="h-56 w-full bg-white lg:h-[17rem]" data-frame></iframe>
        </section>
        <section class="card flex min-h-0 flex-col overflow-hidden" aria-label="Console">
          <div class="flex items-center justify-between border-b border-line py-1 pl-3.5 pr-1.5 text-xs text-faint">Console<button type="button" class="btn btn-ghost btn-sm" data-clear-console>Clear</button></div>
          <div class="h-36 overflow-auto bg-code p-3 font-mono text-[0.8125rem] leading-relaxed lg:h-[9.25rem]" data-console role="log" aria-live="polite" aria-label="Console output" tabindex="0"></div>
        </section>
      </div>
    </div>
    <p class="mt-3 text-xs text-faint">The preview runs in a sandboxed frame: it cannot read this page, your saved progress or your cookies. Press <span class="kbd">Ctrl</span> <span class="kbd">Enter</span> in the editor to run.</p>`;
  }

  function paintConsole() {
    const el = $('[data-console]', ctx.main);
    if (!el) return;
    const color = { error: 'text-bad', warn: 'text-warn', info: 'text-info' };
    el.innerHTML = logs.length
      ? logs.map((l) => `<div class="whitespace-pre-wrap break-words border-b border-line/60 py-0.5 ${color[l.type] || ''}">${esc(l.text)}</div>`).join('')
      : `<span class="text-faint">console.log output appears here.</span>`;
    el.scrollTop = el.scrollHeight;
  }

  function run() {
    const frame = $('[data-frame]', ctx.main);
    if (!frame) return;
    logs = [];
    paintConsole();
    frame.srcdoc = buildDocument(draft);
  }

  function mountWeb() {
    editor = mountEditor($('[data-editor]', ctx.main), tab, draft[tab], (v) => { draft[tab] = v; persist(); });
    $('[data-editor] textarea', ctx.main).addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    run();
  }

  /* ----- PHP ----- */

  function phpHtml() {
    return `${notice(`<strong class="text-ink">PHP does not run in a browser.</strong> It needs a PHP interpreter on a server or your machine, so this tab is for drafting and reading only. To execute the code, save it and run <code class="font-mono text-ink">php file.php</code>, or paste it into an online runner such as <a class="link" href="https://3v4l.org/" target="_blank" rel="noopener noreferrer">3v4l.org</a> or <a class="link" href="https://onlinephp.io/" target="_blank" rel="noopener noreferrer">onlinephp.io</a>.`)}
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section class="card flex min-w-0 flex-col overflow-hidden" aria-label="PHP editor">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1.5">
          <label class="sr-only" for="php-example">Load an example</label>
          <select id="php-example" class="input !min-h-[2rem] w-auto max-w-[14rem] py-1 text-[0.8125rem]" data-example>
            <option value="">Load code from a question…</option>
            ${phpExamples.map((q) => `<option value="${esc(q.id)}">${esc(skillName(q.skill))}: ${esc(q.question.slice(0, 60))}</option>`).join('')}
          </select>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-ghost btn-sm" data-reset-php>Reset</button>
            <button type="button" class="btn btn-sm" data-copy-php>${icon('copy', 'h-3.5 w-3.5')}Copy</button>
          </div>
        </div>
        <div class="h-[20rem] lg:h-[30rem]" data-editor></div>
      </section>
      <div class="flex min-w-0 flex-col gap-4">
        <section class="card p-4">
          <label class="label" for="expected">Expected output</label>
          <textarea id="expected" class="input min-h-[9rem] font-mono text-[0.8125rem]" spellcheck="false" data-expected placeholder="Write what you expect this code to print, then check it against a real run.">${esc(draft.expected || '')}</textarea>
          <p class="hint">Predicting the output before you run code is one of the fastest ways to find gaps.</p>
        </section>
        <section class="card p-4" data-explain>
          <h2 class="text-sm">Explanation</h2>
          <p class="mt-1.5 text-sm text-muted">Load code from a question to see its explanation here.</p>
        </section>
      </div>
    </div>`;
  }

  function mountPhp() {
    editor = mountEditor($('[data-editor]', ctx.main), 'php', draft.php, (v) => { draft.php = v; persist(); });
  }

  function loadExample(id) {
    const q = store.byId.get(id);
    if (!q) return;
    const code = q.codes.find((c) => c.language === 'php');
    draft.php = /^\s*<\?php/.test(code.content) ? code.content : `<?php\n\n${code.content}`;
    draft.expected = q.output || '';
    editor.set(draft.php);
    $('[data-expected]', ctx.main).value = draft.expected;
    $('[data-explain]', ctx.main).innerHTML = `<h2 class="text-sm">Explanation</h2>
      <p class="mt-1.5 font-medium">${esc(q.question)}</p>
      <div class="prose-dp mt-2 text-sm">${q.interviewAnswer || q.shortAnswer ? `<p>${mdInline(q.interviewAnswer || q.shortAnswer)}</p>` : md(q.answer)}</div>
      <a class="link mt-3 inline-block text-sm" href="#/questions/${esc(q.id)}">Open the question</a>`;
    persist();
  }

  /* ----- Events ----- */

  function onClick(e) {
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.dataset.mode; paint(); $(`[data-mode="${mode}"]`, ctx.main).focus(); return; }
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; paint(); $(`[data-tab="${tab}"]`, ctx.main).focus(); return; }
    if (e.target.closest('[data-run]')) run();
    else if (e.target.closest('[data-clear-console]')) { logs = []; paintConsole(); }
    else if (e.target.closest('[data-reset]')) { Object.assign(draft, { html: STARTER.html, css: STARTER.css, js: STARTER.js }); persist(); paint(); toast('Playground reset to the starter example.'); }
    else if (e.target.closest('[data-reset-php]')) { draft.php = STARTER.php; draft.expected = STARTER.expected; persist(); paint(); toast('PHP editor reset to the starter example.'); }
    else if (e.target.closest('[data-copy-php]')) copyText(draft.php).then((ok) => toast(ok ? 'Copied to clipboard.' : 'Copy failed. Select the code and copy it manually.', ok ? 'ok' : 'error'));
  }
  function onChange(e) {
    if (e.target.matches('[data-example]')) loadExample(e.target.value);
  }
  function onInput(e) {
    if (e.target.matches('[data-expected]')) { draft.expected = e.target.value; persist(); }
  }
  function onMessage(e) {
    const frame = $('[data-frame]', ctx.main);
    if (!frame || e.source !== frame.contentWindow || !e.data || e.data.source !== 'devprep-playground') return;
    logs.push({ type: String(e.data.type), text: String(e.data.text).slice(0, 4000) });
    if (logs.length > 200) logs.shift();
    paintConsole();
  }
  ctx.main.addEventListener('click', onClick);
  ctx.main.addEventListener('change', onChange);
  ctx.main.addEventListener('input', onInput);
  window.addEventListener('message', onMessage);
  ctx.onLeave = () => {
    ctx.main.removeEventListener('click', onClick);
    ctx.main.removeEventListener('change', onChange);
    ctx.main.removeEventListener('input', onInput);
    window.removeEventListener('message', onMessage);
  };
  paint();
}

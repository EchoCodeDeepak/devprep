// Small shared helpers: DOM, formatting, markdown, syntax highlighting,
// clipboard, toasts and modals. No dependencies.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function debounce(fn, ms = 220) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Strip the light Markdown used in answers, for one-line summaries. */
export const plain = (s) => String(s ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

export const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(ts);
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- Icons ---------- */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 21h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><path d="M7.5 7.5h.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
};

export function icon(name, cls = 'h-4 w-4') {
  const filled = name === 'star-fill' || name === 'play';
  const body = ICONS[name === 'star-fill' ? 'star' : name] || '';
  return `<svg class="${cls} shrink-0" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ---------- Syntax highlighting ---------- */

const KW = {
  php: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enum extends final finally fn for foreach function global if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while yield null true false self parent int float string bool void mixed never iterable object',
  js: 'async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield null undefined true false',
  sql: 'select from where and or not in is null as join inner left right outer full cross on group by having order asc desc limit offset insert into values update set delete create table alter drop index unique primary key foreign references constraint default auto_increment distinct union all exists between like case when then else end begin commit rollback start transaction explain view with over partition count sum avg min max int bigint varchar text decimal date datetime timestamp unsigned if cascade add column engine check',
  bash: 'if then else fi for do done while case esac function echo cd export sudo return in',
  json: 'true false null',
};
const KWSET = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new Set(v.split(' '))]));

const LANG_ALIAS = {
  javascript: 'js', node: 'js', ts: 'js', mysql: 'sql', shell: 'bash', sh: 'bash', git: 'bash',
  blade: 'html', xml: 'html', scss: 'css', http: 'text', plaintext: 'text', txt: 'text', '': 'text',
};
export const LANG_LABEL = {
  php: 'PHP', js: 'JavaScript', sql: 'SQL', html: 'HTML', css: 'CSS', bash: 'Shell', json: 'JSON', text: 'Text',
};
export const normLang = (lang) => {
  const l = String(lang || '').toLowerCase().trim();
  const n = LANG_ALIAS[l] ?? l;
  return LANG_LABEL[n] ? n : 'text';
};

const STR = `"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\``;
const COMMENT = {
  php: '\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|#(?!\\[)[^\\n]*',
  js: '\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*',
  sql: '\\/\\*[\\s\\S]*?\\*\\/|--[^\\n]*',
  bash: '#[^\\n]*',
  json: '(?!)',
};
const span = (cls, text) => `<span class="tok-${cls}">${esc(text)}</span>`;

function highlightGeneric(code, lang) {
  const re = new RegExp(
    `(${COMMENT[lang]})|(${STR})|(\\$[A-Za-z_]\\w*)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]\\w*)`,
    'g',
  );
  const kws = KWSET[lang];
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out += span('com', m[1]);
    else if (m[2]) out += span('str', m[2]);
    else if (m[3]) out += lang === 'js' ? esc(m[3]) : span('var', m[3]);
    else if (m[4]) out += span('num', m[4]);
    else {
      const word = m[5];
      const key = lang === 'sql' ? word.toLowerCase() : word;
      if (kws.has(key)) out += span('kw', word);
      else if (code[last] === '(') out += span('fn', word);
      else out += esc(word);
    }
  }
  return out + esc(code.slice(last));
}

function highlightHtml(code) {
  const re = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][^>]*>)|(\{\{[\s\S]*?\}\}|\{!![\s\S]*?!!\}|@[a-z]+\b)/g;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out += span('com', m[1]);
    else if (m[3]) out += span('kw', m[3]);
    else {
      out += m[2].replace(
        /^(<\/?)([\w-]+)|([\w:@.-]+)(=)|("[^"]*"|'[^']*')|([^\s\w"'=<]+|\s+|\w+)/g,
        (all, open, name, attr, eq, str) => {
          if (name) return esc(open) + span('tag', name);
          if (attr) return span('attr', attr) + eq;
          if (str) return span('str', str);
          return esc(all);
        },
      );
    }
  }
  return out + esc(code.slice(last));
}

function highlightCss(code) {
  const re = new RegExp(
    `(\\/\\*[\\s\\S]*?\\*\\/)|(${STR})|(@[\\w-]+)|(#[0-9a-fA-F]{3,8}\\b|-?\\d*\\.?\\d+(?:px|rem|em|%|vh|vw|fr|ms|s|deg)?\\b)|([A-Za-z-]+)(?=\\s*:[^:])`,
    'g',
  );
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out += span('com', m[1]);
    else if (m[2]) out += span('str', m[2]);
    else if (m[3]) out += span('kw', m[3]);
    else if (m[4]) out += span('num', m[4]);
    else out += span('attr', m[5]);
  }
  return out + esc(code.slice(last));
}

export function highlight(code, lang) {
  const l = normLang(lang);
  const src = String(code ?? '');
  try {
    if (l === 'html') return highlightHtml(src);
    if (l === 'css') return highlightCss(src);
    if (KWSET[l]) return highlightGeneric(src, l);
  } catch (e) {
    /* fall through to plain text */
  }
  return esc(src);
}

export function codeBlock(code, lang, opts = {}) {
  const l = normLang(lang);
  const extra = opts.actions || '';
  return `<figure class="codeblock">
    <figcaption class="codeblock-bar">
      <span>${esc(opts.title || LANG_LABEL[l])}</span>
      <span class="flex items-center gap-1">${extra}
        <button type="button" class="btn btn-ghost btn-sm" data-action="copy-code">${icon('copy', 'h-3.5 w-3.5')}<span>Copy</span></button>
      </span>
    </figcaption>
    <pre tabindex="0"><code>${highlight(code, l)}</code></pre>
  </figure>`;
}

/* ---------- Markdown (the small subset used in answers and notes) ---------- */

function inline(text) {
  return String(text)
    .split('`')
    .map((part, i) => {
      if (i % 2) return `<code>${esc(part)}</code>`;
      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    })
    .join('');
}
export const mdInline = inline;

function mdBlocks(text) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return blocks
    .map((raw) => {
      const block = raw.replace(/^\n+|\s+$/g, '');
      if (!block) return '';
      const lines = block.split('\n');
      if (/^#{1,4}\s/.test(block) && lines.length === 1) {
        return `<h3>${inline(block.replace(/^#{1,4}\s+/, ''))}</h3>`;
      }
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      }
      if (lines.length > 1 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l)) && /^[\s|:-]+$/.test(lines[1])) {
        const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(lines[0]).map((c) => `<th scope="col">${inline(c)}</th>`).join('');
        const rows = lines.slice(2).map((l) => `<tr>${cells(l).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
        return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

export function md(text) {
  if (!text) return '';
  const parts = String(text).split(/```([\w-]*)\n([\s\S]*?)```/g);
  let out = '';
  for (let i = 0; i < parts.length; i += 3) {
    out += mdBlocks(parts[i] || '');
    if (parts[i + 2] !== undefined) out += codeBlock(parts[i + 2].replace(/\n$/, ''), parts[i + 1]);
  }
  return out;
}

/* ---------- Clipboard, download ---------- */

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* try the fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Toasts ---------- */

export function toast(message, kind = 'ok') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const ic = kind === 'error' ? icon('alert', 'h-4 w-4 text-bad') : kind === 'info' ? icon('info') : icon('check', 'h-4 w-4 text-ok');
  el.innerHTML = `${ic}<span>${esc(message)}</span>`;
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2600);
}

/* ---------- Modals ---------- */

const openModals = [];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function closeTopModal() {
  const top = openModals[openModals.length - 1];
  if (top) top.close();
  return Boolean(top);
}
export const modalOpen = () => openModals.length > 0;

/**
 * modal({ title, body, footer, size, sheet, top, bare, label, onClose })
 * `sheet` docks to the bottom on phones; `top` pins near the top (command palette).
 */
export function modal(opts) {
  const returnTo = document.activeElement;
  const overlay = document.createElement('div');
  const align = opts.top ? 'items-start justify-center px-3 pt-[8vh] sm:pt-[12vh]' : 'items-end justify-center sm:items-center sm:p-4';
  overlay.className = `overlay ${align}`;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[opts.size || 'md'];
  const shape = opts.top ? 'rounded-card' : 'rounded-t-2xl sm:rounded-card';
  const id = `dlg-${Date.now()}`;
  overlay.innerHTML = `<div class="dialog ${shape} ${width}" role="dialog" aria-modal="true" ${
    opts.title ? `aria-labelledby="${id}"` : `aria-label="${esc(opts.label || 'Dialog')}"`
  }>
    ${
      opts.bare
        ? ''
        : `<div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 id="${id}" class="text-base">${esc(opts.title || '')}</h2>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icon('x')}</button>
          </div>`
    }
    <div class="dialog-body min-h-0 flex-1 overflow-y-auto ${opts.bare ? '' : 'px-4 py-4 sm:px-5'}">${opts.body || ''}</div>
    ${opts.footer ? `<div class="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 pb-safe sm:px-5">${opts.footer}</div>` : ''}
  </div>`;

  const api = {
    el: overlay,
    body: overlay.querySelector('.dialog-body'),
    close(result) {
      const i = openModals.indexOf(api);
      if (i < 0) return;
      openModals.splice(i, 1);
      overlay.remove();
      if (!openModals.length) document.body.style.overflow = '';
      if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
      if (opts.onClose) opts.onClose(result);
    },
  };

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) api.close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, overlay).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  $('#overlays').appendChild(overlay);
  document.body.style.overflow = 'hidden';
  openModals.push(api);
  const target = overlay.querySelector('[autofocus]') || overlay.querySelector('.dialog-body ' + FOCUSABLE.split(',').join(',.dialog-body ')) || overlay.querySelector(FOCUSABLE);
  if (target) target.focus({ preventScroll: true });
  return api;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal({
      title,
      size: 'sm',
      body: `<p class="text-sm text-muted">${esc(message)}</p>`,
      footer: `<button type="button" class="btn" data-close>Cancel</button>
               <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm autofocus>${esc(confirmLabel)}</button>`,
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    m.el.querySelector('[data-confirm]').addEventListener('click', () => {
      answered = true;
      resolve(true);
      m.close();
    });
  });
}

/* ---------- Hash routing helpers ---------- */

export function href(path, query) {
  let h = `#${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`)
      .join('&');
    if (qs) h += `?${qs}`;
  }
  return h;
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const query = {};
  for (const pair of queryPart.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    try {
      query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch (e) {
      query[k] = v;
    }
  }
  let path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  });
  return { path, segments, query };
}

export const absoluteLink = (hash) => `${location.origin}${location.pathname}${hash}`;

/** Rough time needed to say a passage out loud (about 150 words a minute). */
export function speakingTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const secs = Math.max(5, Math.round((words / 150) * 60 / 5) * 5);
  return secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60 ? `${secs % 60} s` : ''}`.trim() : `${secs} s`;
}

# DevPrep — Interview Knowledge Base

A personal interview-preparation app for PHP and Laravel developers. Search a question, read the answer you would say out loud, check the detailed explanation and code, practise with flashcards or a mock interview, and mark what needs revision.

It is a **static site**: HTML, CSS, JavaScript and JSON. There is no backend, database, API or login, so it deploys to GitHub Pages, Vercel, Netlify or Cloudflare Pages as plain files.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Folder structure](#folder-structure)
- [Where data lives](#where-data-lives)
- [Add a question](#add-a-question)
- [Question format](#question-format)
- [Change skills, topics and the learning path](#change-skills-topics-and-the-learning-path)
- [Backup and restore](#backup-and-restore)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Deploy to Vercel](#deploy-to-vercel)
- [Other static hosts](#other-static-hosts)
- [Change the design](#change-the-design)
- [Offline use (PWA)](#offline-use-pwa)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Adding a backend later](#adding-a-backend-later)

## Features

**Knowledge base**

- 200 starter questions across PHP, Laravel, MySQL, JavaScript, HTML/CSS, REST API, Git, OOP and Coding Logic, weighted towards PHP and Laravel
- Each question has a short answer, an interview answer written to be spoken (with an estimated speaking time), a detailed explanation, and code with syntax highlighting and a copy button
- Search across question, answers, tags, topic and skill, with highlighted matches; a `Ctrl + K` command palette
- Filters you can combine: skill, difficulty, question type, priority, status; sort eight ways; card or compact view
- Skill pages, topic pages, tag pages, related questions and a learning path

**Learning**

- Study status per question: New, Learning, Learned, Needs revision, Mastered
- Important (star) list and revision queue
- Dashboard with today's preparation plan, a readiness indicator, progress per skill, recently viewed questions
- Personal notes and interview experience (company, date, round) on every question
- Interview history: record what each company asked and link it to your answers

**Practice**

- Random interview: pick skills, difficulty and length; get a score and your weak skills at the end
- Flashcards: question on the front, interview answer on the back
- Coding problems that reveal a hint, then the approach, then the solution
- Code playground: HTML, CSS and JavaScript run in a sandboxed frame with a console. PHP is edit-only, because PHP cannot run in a browser

**Content management**

- Add, edit and duplicate questions in the browser, with validation
- Export a question as JSON ready to paste into a data file
- Export and import a full backup of your personal data

**Quality**

- Mobile-first layout from 320 px up: drawer navigation, bottom tab bar, filters in a bottom sheet
- Light and dark themes driven by CSS variables
- Keyboard accessible, visible focus, labelled controls, reduced-motion support
- Friendly empty and error states: missing or malformed data files and unreadable saved data do not break the app

## Tech stack

| Part | Choice |
|---|---|
| Markup | HTML5, one `index.html` |
| Styles | Tailwind CSS 3, compiled ahead of time into `css/styles.css` (committed) |
| Behaviour | Vanilla JavaScript ES modules, no framework and no bundler |
| Content | JSON files in `/data` |
| Personal state | LocalStorage |
| Fonts | Geist and JetBrains Mono, self-hosted in `assets/fonts` |

Nothing is loaded from a CDN, so the app works offline and has no third-party requests.

**Routing** uses the URL hash (`#/questions/php-001`). Hash routes never reach the server, so every link works on GitHub Pages without rewrite rules.

## Run it locally

Browsers block `fetch()` and ES modules on `file://` pages, so serve the folder instead of double-clicking `index.html`:

```bash
cd devprep
python3 -m http.server 8080
# open http://localhost:8080
```

Any static server works (`npx serve`, `php -S localhost:8080`, the VS Code Live Server extension).

Node is **not** needed to run or deploy the app. You only need it for two optional things:

```bash
npm install        # once
npm run build      # recompile css/styles.css after changing Tailwind classes or tokens
npm run watch      # same, on every save
npm run check      # validate the JSON in /data before committing
```

## Folder structure

```text
devprep/
├── index.html              App shell: meta tags, theme bootstrap, mount points
├── 404.html                Static-host fallback that links back to the app
├── manifest.webmanifest    PWA manifest
├── sw.js                   Service worker (offline cache)
├── robots.txt
├── .nojekyll               Tells GitHub Pages to serve the files as they are
│
├── css/
│   └── styles.css          Compiled CSS (generated; do not edit by hand)
├── src/
│   └── input.css           Design tokens and component classes (edit this)
├── tailwind.config.js
│
├── js/
│   ├── app.js              Boot, hash router, sidebar, mobile nav, command palette, shortcuts
│   ├── data.js             Loads and validates /data, merges local questions
│   ├── storage.js          Everything saved in LocalStorage, plus backup import/export
│   ├── search.js           In-memory search index and match highlighting
│   ├── plan.js             Today's plan and the readiness score
│   ├── ui.js               Shared pieces: badges, question cards, progress, empty states
│   ├── utils.js            Helpers: escaping, Markdown, syntax highlighting, modal, toast
│   └── views/
│       ├── dashboard.js    Dashboard
│       ├── questions.js    Explorer, Important, Revision
│       ├── question.js     Question detail and coding-problem reveal
│       ├── skills.js       Skills, skill, topic, learning path
│       ├── practice.js     Practice hub, random interview, flashcards, coding list
│       ├── playground.js   Code playground
│       ├── manager.js      Content Manager and the add/edit form
│       ├── history.js      Interview history
│       └── settings.js     Settings and Import / Export
│
├── data/
│   ├── skills.json         Skills, their topics, colours, and the learning path
│   ├── php.json            One file per skill
│   ├── laravel.json
│   ├── mysql.json
│   ├── javascript.json
│   ├── html-css.json
│   ├── rest-api.json
│   ├── git.json
│   ├── oop.json
│   └── coding-logic.json
│
├── assets/                 Icons and fonts
└── tools/
    └── validate-data.mjs   `npm run check`
```

## Where data lives

There are two kinds of data, and the app keeps them apart on purpose.

| | Static content | Browser personal data |
|---|---|---|
| What | The questions in `/data/*.json` | Status, stars, notes, interview experience and history, questions you add or edit in the app, settings |
| Stored | In the repository, deployed with the site | LocalStorage in one browser on one device |
| Shared across devices | Yes | No |
| Changes when | You edit a JSON file and commit | You use the app |
| Lost when | Never (it is in Git) | Site data is cleared, or you switch browser or device |

Editing a question in the app **never** changes a JSON file. It saves a local copy in your browser. To make it permanent, export it and commit it (next section).

LocalStorage is not encrypted. Keep it to interview knowledge and study notes; do not store passwords, API keys or other private information in notes.

## Add a question

### Option 1: in the app, then commit (recommended)

1. Open **Add question** (sidebar → Content Manager → Add question, or the button on most pages).
2. Fill in the form and save. The question is usable straight away in this browser and is labelled **Local**.
3. In **Content Manager**, press the download icon on its row (or **Export local questions** for all of them). You get JSON and the name of the file it belongs in.
4. Paste the object into the `"questions"` list of that file, for example `data/laravel.json`. Remember the comma after the previous entry.
5. Commit and push:

   ```bash
   npm run check          # optional but recommended
   git add data
   git commit -m "Add question: find vs findOrFail"
   git push
   ```

6. After the site redeploys, delete the local copy in Content Manager (the static one takes over).

### Option 2: edit the JSON directly

Open the skill's file in `/data`, copy an existing entry, change the `id` and the content, and commit. The only required fields are `id` and `question`.

## Question format

```json
{
  "id": "php-027",
  "order": 27,
  "question": "What is the difference between == and === in PHP?",
  "shortAnswer": "One or two sentences. Shown on cards and in search results.",
  "interviewAnswer": "What you would say out loud in 20 to 40 seconds.",
  "answer": "The detailed explanation. Light Markdown is supported.",
  "example": "Optional real-world example.",
  "topic": "Operators",
  "difficulty": "Beginner",
  "type": "Concept",
  "tags": ["php", "operators", "comparison"],
  "priority": "high",
  "important": true,
  "commonInterviewQuestion": true,
  "askedBefore": false,
  "code": { "language": "php", "content": "var_dump(5 == \"5\");" },
  "related": ["php-003", "php-004"],
  "notes": "Optional note stored with the question.",
  "added": "2026-10-08"
}
```

| Field | Notes |
|---|---|
| `id` | Required, unique across all files. Convention: `<prefix>-<number>`. Do not change an id once used: links, progress and notes point to it. |
| `question` | Required. |
| `order` | Position in the skill's learning order. Defaults to the position in the file. |
| `shortAnswer`, `interviewAnswer`, `answer`, `example` | All optional, but include at least one answer. |
| `topic` | Free text. Topics listed for the skill in `skills.json` appear even when empty. (`subcategory` is accepted as an alias.) |
| `difficulty` | `Beginner`, `Intermediate` or `Advanced`. |
| `type` | `Concept`, `Coding`, `Scenario`, `Debugging`, `SQL`, `Architecture`, `Practical` or `Interview`. |
| `priority` | `critical`, `high`, `medium` or `normal`. (`revisionPriority` is accepted as an alias.) |
| `important` | Starred by default. If omitted, critical questions are starred. A star you toggle in the app overrides it in your browser. |
| `code` | One `{ "language", "content", "title"? }` object or a list of them. Languages: `php`, `js`, `sql`, `html`, `css`, `bash`, `json`, `text`. |
| `related` | Ids of related questions. Questions on the same topic are suggested automatically as well. |
| `added` | ISO date, used by the Newest and Oldest sorts. |

The skill comes from the file a question is in, so entries do not need a `skill` field.

**Coding problems** can add these optional fields, which the question page reveals in steps:

| Field | Shown as |
|---|---|
| `statement` | Problem |
| `input`, `output` | Example input and expected output |
| `hint` | Step 1: Hint |
| `approach` | Step 2: Approach |
| `code`, `answer`, `complexity` | Step 3: Solution, explanation and complexity |
| `mistakes`, `tips` | Lists of common mistakes and interview tips |

**Markdown supported in answers**: paragraphs, `**bold**`, `` `inline code` ``, `-` and `1.` lists, `###` headings, tables, links, and fenced code blocks with a language (```` ```php ````).

Invalid entries do not break the app. An entry without an `id` or `question`, a duplicate id, or a file that is missing or not valid JSON is skipped and reported on the dashboard and in Content Manager.

## Change skills, topics and the learning path

Everything about skills is in `data/skills.json`:

```json
{
  "id": "php",
  "name": "PHP",
  "prefix": "php",
  "file": "php.json",
  "color": "#7377AD",
  "description": "Shown on the skill page.",
  "topics": ["PHP Basics", "Variables", "..."]
}
```

- **Add a skill**: add an entry here, create its JSON file with `{ "skill": "<id>", "questions": [] }`, and add the file to the `SHELL` list in `sw.js` if you want it cached on install (it is cached on first load either way).
- **Add a topic**: add it to `topics`, or just use it on a question.
- **Learning path**: the `paths` list. Each step has a `title` and `match` rules. A question belongs to a step when it matches any rule; a rule can combine `skill`, `topics`, `exceptTopics`, `tag` and `difficulty`.

## Backup and restore

**Import / Export** in the sidebar:

- **Export my data** downloads `interview-prep-backup.json` with your statuses, stars, notes, interview experience and history, local questions and settings.
- **Import backup** reads that file and lets you choose:
  - **Merge**: keeps what is in the browser and adds what is missing (the newer status wins).
  - **Replace**: discards the browser's data and uses the backup.

Use this to move to another browser or device, and before clearing site data. Settings → **Clear browser data** removes everything personal after a confirmation; the questions in `/data` are not affected.

## Deploy to GitHub Pages

1. Create a repository on GitHub, for example `devprep`.
2. From this folder:

   ```bash
   git init
   git add .
   git commit -m "DevPrep"
   git branch -M main
   git remote add origin https://github.com/<your-username>/devprep.git
   git push -u origin main
   ```

3. On GitHub open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/ (root)**, and save.
5. Wait about a minute. The site is at `https://<your-username>.github.io/devprep/`.

Every later `git push` to `main` redeploys. All paths in the app are relative, so it works under the `/devprep/` sub-path without configuration. The `.nojekyll` file stops GitHub from running Jekyll over the files.

If the repository is public, so are the questions in `/data`. Your statuses and notes stay in your browser and are never uploaded.

## Deploy to Vercel

**From the dashboard**

1. Push the project to GitHub (steps above).
2. On vercel.com choose **Add New → Project** and import the repository.
3. Framework Preset: **Other**. Leave **Build Command** empty and **Output Directory** empty (or `.`).
4. Deploy.

**From the terminal**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

No build step and no serverless functions are involved; Vercel serves the folder as it is.

## Other static hosts

- **Netlify**: New site from Git, build command empty, publish directory `.`. Or drag the folder onto the deploy page.
- **Cloudflare Pages**: Connect the repository, framework preset "None", build command empty, output directory `/`.
- **Any web server**: copy the folder to the document root.

## Change the design

Colours are CSS variables at the top of `src/input.css`, defined once for light and once for dark:

```css
:root {
  --canvas: 246 247 249;   /* page background */
  --surface: 255 255 255;  /* cards */
  --ink: 20 23 31;         /* text and primary buttons */
  --accent: 43 89 224;     /* links and focus */
  --mark: 255 225 77;      /* search highlight */
  --answer-bg: 255 246 196;/* the interview-answer block */
  /* ... */
}
```

Values are space-separated RGB so Tailwind can apply opacity (`bg-accent/10`). Change a value, run `npm run build`, and the whole interface follows. Reusable component classes (`.btn`, `.card`, `.badge`, `.chip`, `.input`, `.answer`, `.codeblock`) are in the same file.

Tailwind only generates classes it finds in `index.html` and `js/`. If you add a new utility class in a template, run `npm run build` and commit `css/styles.css`.

## Offline use (PWA)

On an HTTPS host the app registers `sw.js`, which caches the app and data so it opens offline and can be installed to a phone's home screen. It serves from the cache first and refreshes in the background, so **a new deploy appears on the second visit**. To force every visitor onto a new version immediately, change `VERSION` at the top of `sw.js`.

The service worker is not registered on `localhost`, so local development always shows your latest files. To remove offline support, delete `sw.js` and the registration lines at the end of `js/app.js`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl + K` or `/` | Search |
| `N` / `P` | Next / previous question (follows the list you came from) |
| `R` | Random question |
| `F` | Mark as important |
| `M` | Mark as learned |
| `Space` | Reveal the answer (flashcards, interview, coding problems) |
| `1` / `2` | I know this / Need revision (flashcards and interview) |
| `?` | Show shortcuts |
| `Esc` | Close a dialog or menu |

Single-key shortcuts are off while you are typing in a field.

## Adding a backend later

The first version is deliberately static. Two modules are the seams if that changes:

- `js/data.js` is the only place that knows questions come from JSON files. Pointing `loadAll()` at an API is a local change.
- `js/storage.js` is the only place that reads and writes personal state. Replacing LocalStorage with an authenticated API (accounts, cloud sync) means changing this file, not the views.

## Licences

The app code and question content are yours to use and change. The bundled fonts, Geist and JetBrains Mono, are under the SIL Open Font License 1.1 (see `assets/fonts/OFL.txt`).

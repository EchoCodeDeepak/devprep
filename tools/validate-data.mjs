// Checks every file in /data before you commit: valid JSON, unique ids,
// required fields, allowed values, and "related" ids that really exist.
// Run with: npm run check   (or: node tools/validate-data.mjs)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const TYPES = ['Concept', 'Coding', 'Scenario', 'Debugging', 'SQL', 'Architecture', 'Practical', 'Interview'];
const PRIORITIES = ['critical', 'high', 'medium', 'normal'];

const problems = [];
const read = (file) => {
  try {
    return JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  } catch (e) {
    problems.push(`${file}: ${e.message}`);
    return null;
  }
};

const manifest = read('skills.json');
const ids = new Map();
const related = [];
let total = 0;

for (const skill of manifest?.skills ?? []) {
  const file = skill.file ?? `${skill.id}.json`;
  const data = read(file);
  if (!data) continue;
  const questions = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(questions)) {
    problems.push(`${file}: expected a "questions" list`);
    continue;
  }
  questions.forEach((q, i) => {
    const where = `${file} #${i + 1}${q?.id ? ` (${q.id})` : ''}`;
    if (!q?.id) problems.push(`${where}: missing "id"`);
    if (!q?.question) problems.push(`${where}: missing "question"`);
    if (q?.id && ids.has(q.id)) problems.push(`${where}: duplicate id, also in ${ids.get(q.id)}`);
    if (q?.id) ids.set(q.id, file);
    if (!q?.shortAnswer && !q?.interviewAnswer && !q?.answer && !q?.statement) problems.push(`${where}: no answer text`);
    if (q?.difficulty && !DIFFICULTIES.includes(q.difficulty)) problems.push(`${where}: difficulty "${q.difficulty}" is not one of ${DIFFICULTIES.join(', ')}`);
    if (q?.type && !TYPES.includes(q.type)) problems.push(`${where}: type "${q.type}" is not one of ${TYPES.join(', ')}`);
    if (q?.priority && !PRIORITIES.includes(q.priority)) problems.push(`${where}: priority "${q.priority}" is not one of ${PRIORITIES.join(', ')}`);
    if (q?.tags && !Array.isArray(q.tags)) problems.push(`${where}: "tags" must be a list`);
    for (const r of q?.related ?? []) related.push([where, r]);
    total++;
  });
  console.log(`${file.padEnd(22)} ${questions.length} questions`);
}

for (const [where, id] of related) {
  if (!ids.has(id)) problems.push(`${where}: related id "${id}" does not exist`);
}

console.log(`\n${total} questions in ${manifest?.skills?.length ?? 0} skills.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('No problems found.');

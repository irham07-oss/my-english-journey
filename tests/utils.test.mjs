import assert from 'node:assert/strict';
import { dateKey, weekStartKey, getStreak, toDbKey, fromDbKey, mapLegacyState, escapeHtml } from '../utils.js';

// --- dateKey: waktu lokal, bukan UTC ---
assert.equal(dateKey(new Date(2026, 9, 23, 1, 0)), '2026-10-23');
const lokalMalam = new Date(2026, 9, 23, 0, 30);
assert.equal(dateKey(lokalMalam), '2026-10-23');
// zona timur UTC: toISOString sudah mundur sehari, bukti dateKey tidak pakai UTC
if (lokalMalam.getTimezoneOffset() < 0) {
  assert.notEqual(lokalMalam.toISOString().slice(0, 10), '2026-10-23');
}

// --- weekStartKey: 2026-10-23 itu Kamis, Senin minggunya 2026-10-19 ---
assert.equal(weekStartKey(new Date(2026, 9, 23, 10, 0)), '2026-10-19');
assert.equal(weekStartKey(new Date(2026, 9, 20, 0, 1)), '2026-10-19'); // Selasa
assert.equal(weekStartKey(new Date(2026, 9, 25, 2, 0)), '2026-10-19'); // Minggu -> Senin sebelumnya

// --- getStreak ---
assert.equal(getStreak(['2026-10-23', '2026-10-22', '2026-10-21'], '2026-10-23'), 3); // streak 3 hari
assert.equal(getStreak(['2026-10-22'], '2026-10-23'), 0);      // kemarin tanpa hari ini
assert.equal(getStreak(['2026-10-23', '2026-10-21'], '2026-10-23'), 1); // ada lubang
assert.equal(getStreak([], '2026-10-23'), 0);
assert.equal(getStreak(['2026-10-15'], '2026-10-23'), 0);      // kedaluwarsa

// --- toDbKey: persis sesuai kontrak ---
assert.equal(toDbKey('stage', '0-1'), 'stage:0:1');
assert.equal(toDbKey('lesson', '3'), 'lesson:3');
assert.equal(toDbKey('week', '2026-10-20-1'), 'week:2026-10-20:1');
assert.equal(toDbKey('daily', '2026-10-23-0'), 'daily:2026-10-23:0');

// key invalid -> throw
assert.throws(() => toDbKey('stage', '1'));
assert.throws(() => toDbKey('stage', 'x-1'));
assert.throws(() => toDbKey('lesson', 'tiga'));
assert.throws(() => toDbKey('daily', '2026-10'));
assert.throws(() => toDbKey('week', 'abc-1'));
assert.throws(() => toDbKey('mobil', '2026-10-23-0'));

// --- fromDbKey: round-trip 4 kind ---
for (const [kind, key] of [
  ['stage', '0-1'],
  ['lesson', '3'],
  ['week', '2026-10-20-1'],
  ['daily', '2026-10-23-0'],
]) {
  assert.deepEqual(fromDbKey(toDbKey(kind, key)), { kind, key });
}
assert.deepEqual(fromDbKey('stage:4:5'), { kind: 'stage', key: '4-5' });
assert.throws(() => fromDbKey('garbage'));
assert.throws(() => fromDbKey('stage:0'));
assert.throws(() => fromDbKey('unknown:3'));

// --- mapLegacyState: payload persis ---
const legacy = {
  checks: { '0-1': true, 'lesson-3': true, '1-2': false },
  studyDates: ['2026-10-23', '2026-10-22'],
  weekChecks: { '2026-10-20-1': true },
  dailyChecks: { '2026-10-23-0': true },
  words: [{ en: ' diligent ', id: ' rajin ' }, { en: '', id: '' }],
  notes: 'Catatan belajar.',
  history: [{ date: '2026-10-23T08:00:00.000Z', text: 'Menyelesaikan materi: Pola dasar kalimat' }],
};
assert.deepEqual(mapLegacyState(legacy), {
  checks: { 'stage:0:1': true, 'lesson:3': true, 'week:2026-10-20:1': true, 'daily:2026-10-23:0': true },
  study_days: ['2026-10-23', '2026-10-22'],
  words: [{ english: ' diligent ', meaning: ' rajin ' }, { english: '', meaning: '' }],
  notes: 'Catatan belajar.',
  history: [{ happened_at: '2026-10-23T08:00:00.000Z', text: 'Menyelesaikan materi: Pola dasar kalimat' }],
});

// input kosong -> payload mati
assert.deepEqual(mapLegacyState(undefined), {
  checks: {}, study_days: [], words: [], notes: '', history: [],
});
// notes kosong -> ""
assert.equal(mapLegacyState({ notes: '' }).notes, '');

// --- escapeHtml sama seperti aslinya ---
assert.equal(escapeHtml('<b class="x">&\'</b>'), '&lt;b class=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;');
assert.equal(escapeHtml(42), '42');

console.log('OK — semua tes utils.js lulus.');

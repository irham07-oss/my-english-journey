// Pure utilities — tanpa DOM/Supabase, aman di-import Node maupun browser.
// honey: key harian selalu waktu LOKAL; jangan pernah toISOString untuk key harian.

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Senin minggu berisi d.
export function weekStartKey(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(monday);
}

// Streak = jumlah hari berurutan yang berakhir "hari ini" (dihitung mundur).
export function getStreak(studyDays, today = dateKey()) {
  const set = new Set(studyDays || []);
  const [ty, tm, td] = String(today).split('-').map(Number);
  let cur = new Date(ty, tm - 1, td);
  let n = 0;
  while (set.has(dateKey(cur))) {
    n++;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

// Legacy key -> key DB. kind: 'stage' | 'lesson' | 'week' | 'daily'.
export function toDbKey(kind, key) {
  const s = String(key);
  if (kind === 'stage') {
    const m = s.match(/^(\d+)-(\d+)$/);
    if (!m) throw new Error(`toDbKey: key stage tidak valid: ${key}`);
    return `stage:${m[1]}:${m[2]}`;
  }
  if (kind === 'lesson') {
    if (!/^\d+$/.test(s)) throw new Error(`toDbKey: key lesson tidak valid: ${key}`);
    return `lesson:${s}`;
  }
  if (kind === 'week' || kind === 'daily') {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})-(\d+)$/);
    if (!m) throw new Error(`toDbKey: key ${kind} tidak valid: ${key}`);
    return `${kind}:${m[1]}:${m[2]}`;
  }
  throw new Error(`toDbKey: kind tidak dikenal: ${kind}`);
}

// Key DB -> { kind, key legacy }. Inverse dari toDbKey.
export function fromDbKey(dbKey) {
  const m = String(dbKey).match(/^(stage|lesson|week|daily):(.+)$/);
  if (!m) throw new Error(`fromDbKey: key tidak valid: ${dbKey}`);
  const [, kind, rest] = m;
  if (kind === 'lesson') {
    if (!/^\d+$/.test(rest)) throw new Error(`fromDbKey: key lesson tidak valid: ${dbKey}`);
    return { kind, key: rest };
  }
  const p = kind === 'stage'
    ? rest.match(/^(\d+):(\d+)$/)
    : rest.match(/^(\d{4}-\d{2}-\d{2}):(\d+)$/);
  if (!p) throw new Error(`fromDbKey: key ${kind} tidak valid: ${dbKey}`);
  return { kind, key: `${p[1]}-${p[2]}` };
}

// State localStorage lama -> payload RPC import_legacy_state.
// Hanya nilai check yang true dikirim; key dengan format asing dilewati.
export function mapLegacyState(legacy) {
  const o = legacy || {};
  const checks = {};
  const put = (kind, key) => { checks[toDbKey(kind, key)] = true; };
  for (const [k, v] of Object.entries(o.checks || {})) {
    if (v !== true) continue;
    const lm = k.match(/^lesson-(\d+)$/);
    if (lm) put('lesson', lm[1]);
    else if (/^\d+-\d+$/.test(k)) put('stage', k);
    // key lain (format asing) sengaja dilewati agar migrasi tak pernah galat
  }
  for (const [k, v] of Object.entries(o.weekChecks || {})) {
    if (v === true) put('week', k);
  }
  for (const [k, v] of Object.entries(o.dailyChecks || {})) {
    if (v === true) put('daily', k);
  }
  const study_days = (o.studyDates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const words = (o.words || []).map((w) => ({ english: w.en ?? w.english ?? '', meaning: w.id ?? w.meaning ?? '' }));
  const history = (o.history || []).map((h) => ({ happened_at: h.date ?? h.happened_at ?? '', text: h.text ?? '' }));
  return { checks, study_days, words, notes: o.notes || '', history };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

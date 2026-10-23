// Logika UI — My English Journey (Supabase backend, tanpa build step).
// honey: perilaku referensi = backup/my_english_journey.original.html; id DOM sesuai index.html.
import { stages, lessons, days } from './content.js';
import * as db from './data.js';
import {
  dateKey, weekStartKey, getStreak, toDbKey, fromDbKey, mapLegacyState, escapeHtml,
} from './utils.js';

const $ = (id) => document.getElementById(id);
const MON_LABEL = (i) => days[(i + 1) % 7]; // i minggu Senin-awal -> label hari
const LEGACY_KEY = 'englishJourneyState';
const BACKUP_KEY = 'englishJourneyState_backup';

function freshState() {
  return { checks: {}, studyDates: [], weekChecks: {}, dailyChecks: {}, words: [], notes: '', history: [], lastQuiz: null };
}
let state = freshState();
let selectedStage = 0;
let notesDirty = false;
let dataReady = false;
let lastLoadedAt = 0;
let migrationTried = false;
let authLoadedFor = null;

// ---------- Hitung progress ----------
function stageCount(s) {
  return stages[s].items.filter((_, i) => state.checks[s + '-' + i]).length;
}
function stagePct(s) {
  return Math.round((stageCount(s) / stages[s].items.length) * 100);
}
function overall() {
  const all = stages.reduce((n, s) => n + s.items.length, 0);
  const done = stages.reduce((n, _, si) => n + stageCount(si), 0);
  return Math.round((done / all) * 100);
}
function canAccess(s) {
  return s === 0 || stages.slice(0, s).every((_, i) => stagePct(i) === 100);
}

// ---------- Toast ----------
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
}

// ---------- Render ----------
function renderStages() {
  $('stage-cards').innerHTML = stages.map((s, i) => `
    <div class="stage ${selectedStage === i ? 'selected' : ''}" data-stage="${i}">
      <div class="stage-num">${i + 1}</div><strong>${s.short}</strong>
      <small>${stagePct(i)}% selesai</small>
      <div class="bar"><span style="width:${stagePct(i)}%;background:${s.color}"></span></div>
    </div>`).join('');
  document.querySelectorAll('[data-stage]').forEach((el) => {
    el.onclick = () => { selectedStage = +el.dataset.stage; renderFocus(); renderStages(); };
  });
}

function renderFocus() {
  const s = stages[selectedStage];
  $('stage-badge').textContent = 'Tahap ' + (selectedStage + 1);
  $('focus-title').textContent = s.title;
  $('focus-desc').textContent = s.desc;
  $('focus-pct').textContent = stagePct(selectedStage) + '%';
  $('focus-bar').style.width = stagePct(selectedStage) + '%';
  $('focus-bar').style.background = s.color;
  $('next-stage-title').textContent = stages[selectedStage + 1]?.title || 'Semua tahap utama selesai 🎉';
  const btn = $('focus-btn');
  btn.textContent = canAccess(selectedStage) ? 'Mulai / Lanjut Belajar →' : 'Tahap terkunci 🔒';
  btn.disabled = !canAccess(selectedStage);
  btn.style.opacity = canAccess(selectedStage) ? '1' : '.55';
  $('focus-checklist').innerHTML = s.items.map((item, i) => `
    <label class="check-row">
      <input type="checkbox" data-check="${selectedStage}-${i}" ${state.checks[selectedStage + '-' + i] ? 'checked' : ''}>
      <span>${item}</span>
    </label>`).join('');
  document.querySelectorAll('[data-check]').forEach((el) => {
    el.onchange = () => toggleStageCheck(+el.dataset.check.split('-')[0], +el.dataset.check.split('-')[1], el.checked);
  });
}

function lessonCard(l, i) {
  return `<div class="lesson"><div class="lesson-icon">${l.icon}</div><div class="tag">${l.tag}</div><h4>${l.title}</h4><p>${l.desc}</p><div class="lesson-foot"><button class="button secondary" data-lesson="${i}">Mulai</button><small>◷ ${l.mins} mnt</small></div></div>`;
}

function renderLessons() {
  $('home-lessons').innerHTML = lessons.slice(0, 4).map(lessonCard).join('');
  $('all-lessons').innerHTML = lessons.map((l, i) => {
    const done = !!state.checks['lesson-' + i];
    return `<div class="module-row"><div class="micon">${l.icon}</div><div><h4>${l.title} ${done ? '✓' : ''}</h4><p>${l.desc} · ${l.tag} · ${l.mins} menit</p></div><button class="button ${done ? 'secondary' : ''}" data-lesson="${i}">${done ? 'Selesai ✓' : 'Pelajari'}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-lesson]').forEach((b) => { b.onclick = () => openLesson(+b.dataset.lesson); });
}

function renderStats() {
  const pct = overall();
  $('overall-pct').textContent = pct + '%';
  $('overall-ring').style.setProperty('--progress', pct + '%');
  $('skill-bars').innerHTML = [['Grammar', 0], ['Vocabulary', 2], ['Listening', 3], ['Speaking', 4], ['Writing', 4]].map(([name, s]) => `
    <div class="skill-row"><span>${name}</span><strong>${stagePct(s)}%</strong><div class="bar"><span style="width:${stagePct(s)}%;background:${stages[s].color}"></span></div></div>`).join('');
  $('next-focus').textContent = stages.find((_, i) => stagePct(i) < 100)?.title || 'Terus gunakan bahasa Inggris dalam kehidupan nyata';
  $('progress-stats').innerHTML = `
    <div class="stat"><div class="stat-label">Progress keseluruhan</div><div class="stat-num">${pct}%</div><small>Materi checklist selesai</small></div>
    <div class="stat"><div class="stat-label">Materi ditandai selesai</div><div class="stat-num">${stages.reduce((n, _, si) => n + stageCount(si), 0)}</div><small>Terus tambah secara konsisten</small></div>
    <div class="stat"><div class="stat-label">Hari belajar tercatat</div><div class="stat-num">${state.studyDates.length}</div><small>Hari unik yang ditandai belajar</small></div>
    <div class="stat"><div class="stat-label">Tahap tuntas</div><div class="stat-num">${stages.filter((_, i) => stagePct(i) === 100).length}/6</div><small>Checklist tiap tahap</small></div>`;
  $('progress-stages').innerHTML = stages.map((s, i) => `
    <div class="progress-stage">
      <div class="progress-stage-head"><strong>${i + 1}. ${s.title}</strong><span>${stageCount(i)}/${s.items.length} · ${stagePct(i)}%</span></div>
      <div class="bar"><span style="width:${stagePct(i)}%;background:${s.color}"></span></div>
    </div>`).join('');
  $('history').innerHTML = state.history.length
    ? state.history.slice(0, 12).map((h) => `
      <div class="module-row"><div class="micon">✓</div><div><h4>${escapeHtml(h.text)}</h4><p>${new Date(h.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>`).join('')
    : '<div class="empty">Belum ada aktivitas. Checklist pertama yang kamu selesaikan akan muncul di sini.</div>';
}

function renderWeek() {
  const start = weekStartKey();
  const [sy, sm, sd] = start.split('-').map(Number);
  const today = dateKey();
  const tasks = ['Grammar', 'Vocabulary', 'Speaking', 'Listening', 'Review', 'Mini Test', 'Free Practice'];
  $('week-grid').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sy, sm - 1, sd + i);
    const id = dateKey(d);
    return `<div class="day ${id === today ? 'today' : ''}"><strong>${MON_LABEL(i)}</strong><small>${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</small>
      <label><input type="checkbox" data-week="${id}-1" ${state.weekChecks[id + '-1'] ? 'checked' : ''}> ${tasks[i]}</label>
      <label><input type="checkbox" data-week="${id}-2" ${state.weekChecks[id + '-2'] ? 'checked' : ''}> ${i % 2 ? 'Listening' : 'Speaking'}</label></div>`;
  }).join('');
  document.querySelectorAll('[data-week]').forEach((el) => {
    el.onchange = () => toggleWeekCheck(el.dataset.week, el.checked);
  });
}

function renderStreak() {
  const today = dateKey();
  $('streak-count').textContent = getStreak(state.studyDates, today);
  $('streak-caption').textContent = state.studyDates.includes(today)
    ? 'Belajar hari ini tercatat. Pertahankan!'
    : 'Tandai belajar hari ini untuk mulai membangun streak.';
  const start = weekStartKey();
  const [sy, sm, sd] = start.split('-').map(Number);
  $('streak-days').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const id = dateKey(new Date(sy, sm - 1, sd + i));
    const done = state.studyDates.includes(id);
    return `<div class="dotday"><span class="${done ? 'done' : ''}">${done ? '✓' : '·'}</span>${MON_LABEL(i)}</div>`;
  }).join('');
}

function renderDaily() {
  const today = dateKey();
  $('today-date').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const items = ['Materi inti', 'Latihan soal', 'Listening / Shadowing', 'Speaking / Writing'];
  $('daily-checks').innerHTML = items.map((x, i) => `
    <label class="check-row"><input type="checkbox" data-daily="${i}" ${state.dailyChecks[today + '-' + i] ? 'checked' : ''}><span>${x}</span></label>`).join('');
  document.querySelectorAll('[data-daily]').forEach((el) => {
    el.onchange = () => toggleDailyCheck(+el.dataset.daily, el.checked);
  });
}

function renderWords() {
  $('word-list').innerHTML = state.words.length
    ? state.words.map((w, i) => `
      <div class="module-row"><div class="micon">Aa</div><div><h4>${escapeHtml(w.en)}</h4><p>${escapeHtml(w.id)}</p></div><button class="button ghost" data-delword="${i}">Hapus</button></div>`).join('')
    : '<div class="empty">Belum ada kata. Tambahkan kata baru yang ingin kamu gunakan saat berbicara.</div>';
  document.querySelectorAll('[data-delword]').forEach((b) => {
    b.onclick = () => removeWord(+b.dataset.delword);
  });
}

function renderQuizResult() {
  const q = state.lastQuiz;
  const el = $('quiz-result');
  if (!q) { if (el) el.innerHTML = ''; return; }
  const score = q.score ?? 0;
  const total = q.total ?? 4;
  const msg = score >= 3
    ? 'Fondasi awal cukup menjanjikan. Tetap cek bagian yang salah.'
    : 'Tidak masalah — tes ini membantu kita melihat bagian yang perlu dilatih.';
  el.innerHTML = `
    <div class="stat"><div class="stat-label">Hasil tes pilihan ganda</div><div class="stat-num">${score}/${total}</div><p>${msg}</p><p><strong>Kalimatmu:</strong> ${escapeHtml(q.writing)}</p><small>Jawaban benar: 1) studies, 2) went, 3) I agree with you, 4) reading.</small></div>`;
}

function renderAll() {
  renderStages();
  renderFocus();
  renderLessons();
  renderStats();
  renderWeek();
  renderStreak();
  renderDaily();
  renderWords();
  renderQuizResult();
  if (!notesDirty) $('notes').value = state.notes || '';
}

// Setelah checklist tahap berubah: render terarah saja (tanpa renderAll).
function renderCheckViews() {
  renderStages();
  renderFocus();
  renderLessons();
  renderStats();
}

// ---------- Navigasi ----------
function gotoPage(name) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  $('page-' + name).classList.add('active');
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Tulis ke DB (optimistic + revert) ----------
async function toggleStageCheck(si, ii, done) {
  const k = si + '-' + ii;
  const prev = state.checks[k];
  const itemText = stages[si]?.items[ii] ?? '';
  if (done) state.checks[k] = true; else delete state.checks[k];
  const h = { date: new Date().toISOString(), text: 'Menyelesaikan: ' + itemText };
  if (done) { state.history.unshift(h); state.history = state.history.slice(0, 40); }
  renderCheckViews();
  try {
    await db.setCheck(toDbKey('stage', k), done);
  } catch (e) {
    if (prev === undefined) delete state.checks[k]; else state.checks[k] = prev;
    if (done) {
      const idx = state.history.indexOf(h);
      if (idx !== -1) state.history.splice(idx, 1);
    }
    renderCheckViews();
    toast('Gagal menyimpan: ' + e.message);
    return;
  }
  if (done) {
    try {
      await db.addHistory(h.text);
    } catch (e) {
      const idx = state.history.indexOf(h);
      if (idx !== -1) state.history.splice(idx, 1);
      renderStats();
      toast('Checklist tersimpan, tetapi riwayat gagal dicatat.');
    }
  }
}

async function toggleWeekCheck(k, done) {
  const prev = state.weekChecks[k];
  if (done) state.weekChecks[k] = true; else delete state.weekChecks[k];
  renderWeek();
  try {
    await db.setCheck(toDbKey('week', k), done);
  } catch (e) {
    if (prev === undefined) delete state.weekChecks[k]; else state.weekChecks[k] = prev;
    renderWeek();
    toast('Gagal menyimpan: ' + e.message);
  }
}

async function toggleDailyCheck(i, done) {
  const day = dateKey();
  const k = day + '-' + i;
  const prev = state.dailyChecks[k];
  if (done) state.dailyChecks[k] = true; else delete state.dailyChecks[k];
  const hadDay = state.studyDates.includes(day);
  if (done && !hadDay) state.studyDates.push(day);
  renderDaily();
  if (done) { renderStreak(); renderStats(); }
  try {
    await db.setCheck(toDbKey('daily', k), done);
  } catch (e) {
    if (prev === undefined) delete state.dailyChecks[k]; else state.dailyChecks[k] = prev;
    if (done && !hadDay) {
      const di = state.studyDates.indexOf(day);
      if (di !== -1) state.studyDates.splice(di, 1);
    }
    renderDaily();
    if (done) { renderStreak(); renderStats(); }
    toast('Gagal menyimpan: ' + e.message);
    return;
  }
  if (done && !hadDay) {
    try {
      await db.setStudyDay(day);
    } catch (e) {
      const di = state.studyDates.indexOf(day);
      if (di !== -1) state.studyDates.splice(di, 1);
      renderStreak();
      renderStats();
      toast('Checklist tersimpan, tetapi hari belajar gagal dicatat.');
    }
  }
}

async function openLesson(i) {
  const l = lessons[i];
  if (!l) return;
  if (!canAccess(l.stage)) { toast('Selesaikan tahap sebelumnya terlebih dahulu.'); return; }
  const intro = `${l.title}\n\n${l.desc}\n\nCara belajar:\n1. Pelajari penjelasan singkat dari tutor atau sumber belajar.\n2. Buat 3–5 contoh kalimat sendiri.\n3. Ucapkan contoh tersebut dengan suara keras.\n4. Coba gunakan dalam jawaban spontan.\n\nSetelah selesai, tandai materi ini selesai.\n\nTandai materi ini selesai?`;
  if (!confirm(intro)) return;
  const k = 'lesson-' + i;
  const day = dateKey();
  const hadCheck = !!state.checks[k];
  const hadDay = state.studyDates.includes(day);
  const h = { date: new Date().toISOString(), text: 'Menyelesaikan materi: ' + l.title };
  if (!hadCheck) state.checks[k] = true;
  if (!hadDay) state.studyDates.push(day);
  state.history.unshift(h);
  state.history = state.history.slice(0, 40);
  renderCheckViews();
  renderStreak();
  try {
    await db.setCheck(toDbKey('lesson', String(i)), true);
  } catch (e) {
    if (!hadCheck) delete state.checks[k];
    if (!hadDay) {
      const di = state.studyDates.indexOf(day);
      if (di !== -1) state.studyDates.splice(di, 1);
    }
    const hi = state.history.indexOf(h);
    if (hi !== -1) state.history.splice(hi, 1);
    renderCheckViews();
    renderStreak();
    renderStats();
    toast('Gagal menyimpan: ' + e.message);
    return;
  }
  try {
    await db.setStudyDay(day);
  } catch (e) {
    if (!hadDay) {
      const di = state.studyDates.indexOf(day);
      if (di !== -1) state.studyDates.splice(di, 1);
    }
    renderStreak();
    renderStats();
    toast('Materi tersimpan, tetapi hari belajar gagal dicatat.');
  }
  try {
    await db.addHistory(h.text);
  } catch (e) {
    const hi = state.history.indexOf(h);
    if (hi !== -1) state.history.splice(hi, 1);
    renderStats();
    toast('Materi tersimpan, tetapi riwayat gagal dicatat.');
  }
  toast('Materi ditandai selesai. Bagus!');
}

async function markToday() {
  const day = dateKey();
  const hadDay = state.studyDates.includes(day);
  const h = { date: new Date().toISOString(), text: 'Menandai sesi belajar hari ini' };
  if (!hadDay) state.studyDates.push(day);
  state.history.unshift(h);
  state.history = state.history.slice(0, 40);
  renderStreak();
  renderStats();
  try {
    await db.setStudyDay(day);
  } catch (e) {
    if (!hadDay) {
      const di = state.studyDates.indexOf(day);
      if (di !== -1) state.studyDates.splice(di, 1);
    }
    const hi = state.history.indexOf(h);
    if (hi !== -1) state.history.splice(hi, 1);
    renderStreak();
    renderStats();
    toast('Gagal menyimpan: ' + e.message);
    return;
  }
  try {
    await db.addHistory(h.text);
  } catch (e) {
    const hi = state.history.indexOf(h);
    if (hi !== -1) state.history.splice(hi, 1);
    renderStats();
    toast('Hari belajar tersimpan, tetapi riwayat gagal dicatat.');
    return;
  }
  toast('Sesi belajar hari ini tercatat!');
}

async function saveNotes() {
  const btn = $('save-notes');
  btn.disabled = true;
  try {
    const content = $('notes').value;
    await db.saveNotes(content);
    state.notes = content;
    notesDirty = false;
    $('notes-status').textContent = 'Tersimpan ke database pada ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    toast('Catatan tersimpan.');
  } catch (e) {
    toast('Gagal menyimpan catatan: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function addWord(e) {
  e.preventDefault();
  const en = $('word-en').value.trim();
  const id = $('word-id').value.trim();
  const w = { dbId: null, en, id };
  state.words.push(w);
  e.target.reset();
  renderWords();
  try {
    const row = await db.addWord(en, id);
    w.dbId = row.id;
    toast('Kata baru ditambahkan!');
  } catch (err) {
    const idx = state.words.indexOf(w);
    if (idx !== -1) state.words.splice(idx, 1);
    renderWords();
    toast('Gagal menambah kata: ' + err.message);
  }
}

async function removeWord(idx) {
  const w = state.words[idx];
  if (!w) return;
  state.words.splice(idx, 1);
  renderWords();
  try {
    if (w.dbId != null) await db.deleteWord(w.dbId);
    toast('Kata dihapus.');
  } catch (e) {
    state.words.splice(idx, 0, w);
    renderWords();
    toast('Gagal menghapus kata: ' + e.message);
  }
}

async function submitQuiz(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const correct = { q1: 'b', q2: 'b', q3: 'b', q4: 'c' };
  const score = Object.keys(correct).filter((k) => f.get(k) === correct[k]).length;
  const writing = $('quiz-writing').value;
  const prevQuiz = state.lastQuiz;
  const h = { date: new Date().toISOString(), text: 'Mengerjakan tes fondasi: ' + score + '/4' };
  state.history.unshift(h);
  state.history = state.history.slice(0, 40);
  state.lastQuiz = { score, total: 4, writing };
  renderQuizResult();
  renderStats();
  try {
    await db.saveQuizResult(score, 4, writing);
  } catch (err) {
    state.lastQuiz = prevQuiz;
    const hi = state.history.indexOf(h);
    if (hi !== -1) state.history.splice(hi, 1);
    renderQuizResult();
    renderStats();
    toast('Gagal menyimpan hasil tes: ' + err.message);
  }
}

async function exportProgress() {
  try {
    const data = await db.exportState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-english-journey-progress.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Progress diekspor.');
  } catch (e) {
    toast('Gagal mengekspor: ' + e.message);
  }
}

// ---------- Muat data / migrasi / hydrate ----------
function hydrate(s) {
  state = freshState();
  for (const r of s.checks) {
    if (!r.check_key || !r.done) continue;
    try {
      const { kind, key } = fromDbKey(r.check_key);
      if (kind === 'stage' || kind === 'lesson') state.checks[kind === 'lesson' ? 'lesson-' + key : key] = true;
      else if (kind === 'week') state.weekChecks[key] = true;
      else if (kind === 'daily') state.dailyChecks[key] = true;
    } catch { /* key asing dibiarkan */ }
  }
  state.studyDates = [...new Set((s.study_days || []).filter(Boolean))];
  state.words = (s.words || []).map((w) => ({ dbId: w.id, en: w.english, id: w.meaning }));
  state.notes = s.notes || '';
  state.history = (s.history || []).map((h) => ({ date: h.happened_at, text: h.text }));
  if (s.quiz_result) state.lastQuiz = s.quiz_result;
}

async function maybeMigrate(s) {
  if (migrationTried) return false;
  migrationTried = true;
  let raw = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { return false; }
  if (!raw) return false;
  const dbEmpty = (s.checks || []).length === 0
    && (s.words || []).length === 0
    && (s.study_days || []).length === 0
    && (s.history || []).length === 0
    && !s.quiz_result
    && !(s.notes && String(s.notes).trim() !== '');
  if (!dbEmpty) return false;
  let legacy;
  try { legacy = JSON.parse(raw); } catch { return false; } // data lokal rusak: biarkan apa adanya
  try {
    const ok = await db.importLegacyState(mapLegacyState(legacy));
    if (ok === true) {
      try {
        localStorage.setItem(BACKUP_KEY, raw);
        localStorage.removeItem(LEGACY_KEY);
      } catch { /* abaikan */ }
      toast('Data lama berhasil dipindahkan ke Supabase.');
      hydrate(await db.loadState());
      return true;
    }
    toast('Migrasi data lama dilewati — Supabase sudah berisi data.');
  } catch (e) {
    toast('Migrasi data lama gagal — data lokal tetap aman. (' + e.message + ')');
  }
  return false;
}

async function loadData() {
  try {
    const s = await db.loadState();
    hydrate(s);
    await maybeMigrate(s);
    lastLoadedAt = Date.now();
    dataReady = true;
    hideDataError();
    renderAll();
  } catch (e) {
    showDataError(e.message);
  }
}

function showDataError(msg) {
  const m = $('error-message');
  if (m) m.textContent = msg;
  setShown($('data-error'), true);
}
function hideDataError() {
  setShown($('data-error'), false);
}

// ---------- Boot / auth ----------
// Gunakan atribut hidden, bukan style.display: CSS memakai [hidden]{display:none!important}.
function setShown(el, shown) {
  if (!el) return;
  el.hidden = !shown;
  el.style.display = '';
}

function showAuth() {
  setShown($('boot-screen'), false);
  setShown($('auth-view'), true);
  setShown($('app-view'), false);
  const err = $('login-error');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

function showApp() {
  setShown($('boot-screen'), false);
  setShown($('auth-view'), false);
  setShown($('app-view'), true);
}

function onAuthEvent(_event, session) {
  const user = session?.user || null;
  if (!user) {
    authLoadedFor = null;
    dataReady = false;
    notesDirty = false;
    migrationTried = false;
    state = freshState();
    showAuth();
    return;
  }
  if (authLoadedFor === user.id) return; // anti load ganda (INITIAL_SESSION/TOKEN_REFRESHED)
  authLoadedFor = user.id;
  notesDirty = false;
  showApp();
  loadData();
}

function boot() {
  if (!db.isConfigured()) {
    $('boot-text').innerHTML =
      'Supabase belum dikonfigurasi. Ikuti langkah berikut:<br>' +
      '1. Buka file <code>supabase-config.js</code><br>' +
      '2. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dari Supabase Dashboard (Settings → API)<br>' +
      '3. Jalankan isi file <code>schema.sql</code> di SQL Editor Supabase<br>' +
      '4. Muat ulang halaman ini.';
    return;
  }
  $('boot-text').textContent = 'Memeriksa sesi...';
  db.getSession()
    .then((session) => onAuthEvent(session ? 'INITIAL_SESSION' : 'SIGNED_OUT', session))
    .catch((e) => {
      $('boot-text').textContent = 'Gagal menghubungi Supabase: ' + e.message;
    });
  try {
    db.onAuthStateChange(onAuthEvent);
  } catch (e) {
    $('boot-text').textContent = 'Gagal menghubungi Supabase: ' + e.message;
  }
}

// ---------- Binding awal (elemen statis) ----------
document.querySelectorAll('.nav button').forEach((b) => { b.onclick = () => gotoPage(b.dataset.page); });
document.querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => gotoPage(b.dataset.goto); });

$('focus-btn').onclick = () => {
  if (!canAccess(selectedStage)) return;
  gotoPage('materials');
  toast('Pilih materi yang ingin kamu pelajari.');
};
$('mark-today').onclick = markToday;
$('save-notes').onclick = saveNotes;
$('word-form').onsubmit = addWord;
$('quiz').onsubmit = submitQuiz;
$('export-progress').onclick = exportProgress;
$('notes').addEventListener('input', () => { notesDirty = true; });
$('retry-btn').onclick = () => { hideDataError(); loadData(); };

$('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('login-submit');
  const errEl = $('login-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  try {
    await db.signIn($('login-email').value.trim(), $('login-password').value);
    const session = await db.getSession();
    if (session) onAuthEvent('SIGNED_IN', session);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
};

$('logout-btn').onclick = async () => {
  const btn = $('logout-btn');
  btn.disabled = true;
  try {
    await db.signOut();
    onAuthEvent('SIGNED_OUT', null);
  } catch (e) {
    toast('Gagal keluar: ' + e.message);
  } finally {
    btn.disabled = false;
  }
};

// Refresh saat tab kembali aktif (jeda >30 detik, textarea notes tidak sedang diedit).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!dataReady || notesDirty) return;
  if (Date.now() - lastLoadedAt < 30000) return;
  loadData();
});

boot();

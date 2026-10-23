// Lapisan data Supabase — semua error dilempar sebagai Error dengan pesan Bahasa Indonesia.
// honey: state aplikasi TIDAK disimpan di localStorage; sesi login ditangani library Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

let client = null;
const configured =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes('GANTI_') &&
  !SUPABASE_ANON_KEY.includes('GANTI_');

export function isConfigured() {
  return configured;
}

function getSupabase() {
  if (!configured) {
    throw new Error('Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di supabase-config.js.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } });
  }
  return client;
}

function failMsg(err, fallback) {
  const raw = err?.message || err?.error_description || (typeof err === 'string' ? err : '');
  const code = err?.code || '';
  if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(raw)) {
    return 'Tabel database belum dibuat. Jalankan isi schema.sql di SQL Editor Supabase.';
  }
  if (code === 'PGRST301' || code === '401' || /JWT|invalid|expired/i.test(raw) && /token|session/i.test(raw)) {
    return 'Sesi berakhir. Keluar lalu login kembali.';
  }
  if (/Failed to fetch|fetch failed|NetworkError|Load failed|getaddrinfo|ENOTFOUND|network/i.test(raw)) {
    return 'Tidak dapat terhubung ke Supabase. Periksa koneksi internetmu.';
  }
  if (/invalid login credentials/i.test(raw)) return 'Email atau password salah.';
  if (/email not confirmed/i.test(raw)) return 'Email belum dikonfirmasi. Cek kotak masukmu.';
  if (/too many requests|rate limit/i.test(raw)) return 'Terlalu banyak percobaan. Coba lagi beberapa saat.';
  return raw || fallback;
}

function fail(err, fallback) {
  return new Error(failMsg(err, fallback));
}

async function requireUser() {
  const { data: { session } } = await getSupabase().auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  return user;
}

export async function getSession() {
  try {
    const { data: { session } } = await getSupabase().auth.getSession();
    return session || null;
  } catch (e) {
    throw fail(e, 'Gagal memeriksa sesi.');
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  } catch (e) {
    throw fail(e, 'Gagal masuk. Coba lagi.');
  }
}

export async function signOut() {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    return true;
  } catch (e) {
    throw fail(e, 'Gagal keluar. Coba lagi.');
  }
}

export function onAuthStateChange(cb) {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}

export async function loadState() {
  try {
    const c = getSupabase();
    const [checks, days, words, notes, history, quiz] = await Promise.all([
      c.from('checks').select('check_key,done'),
      c.from('study_days').select('day'),
      c.from('words').select('id,english,meaning').order('created_at', { ascending: true }),
      c.from('notes').select('content').maybeSingle(),
      c.from('history').select('happened_at,text').order('happened_at', { ascending: false }).limit(40),
      c.from('quiz_results').select('score,total,writing,created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    // PGRST116 = baris tidak ada pada single()/maybeSingle() — perlakukan sebagai null.
    if (checks.error && checks.error.code !== 'PGRST116') throw checks.error;
    if (days.error && days.error.code !== 'PGRST116') throw days.error;
    if (words.error && words.error.code !== 'PGRST116') throw words.error;
    if (notes.error && notes.error.code !== 'PGRST116') throw notes.error;
    if (history.error && history.error.code !== 'PGRST116') throw history.error;
    if (quiz.error && quiz.error.code !== 'PGRST116') throw quiz.error;
    return {
      checks: checks.data ?? [],
      study_days: (days.data ?? []).map((r) => r.day),
      words: words.data ?? [],
      notes: notes.data?.content ?? null,
      history: history.data ?? [],
      quiz_result: quiz.data ?? null,
    };
  } catch (e) {
    throw fail(e, 'Gagal memuat data dari Supabase.');
  }
}

export async function setCheck(dbKey, done) {
  try {
    const user = await requireUser();
    const { error } = await getSupabase().from('checks').upsert(
      { user_id: user.id, check_key: dbKey, done, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,check_key' },
    );
    if (error) throw error;
    return true;
  } catch (e) {
    throw fail(e, 'Gagal menyimpan checklist.');
  }
}

export async function setStudyDay(day) {
  try {
    const user = await requireUser();
    const { error } = await getSupabase().from('study_days').upsert(
      { user_id: user.id, day },
      { onConflict: 'user_id,day' },
    );
    if (error) throw error;
    return true;
  } catch (e) {
    throw fail(e, 'Gagal menyimpan hari belajar.');
  }
}

export async function saveNotes(content) {
  try {
    const user = await requireUser();
    const { error } = await getSupabase().from('notes').upsert(
      { user_id: user.id, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
    return true;
  } catch (e) {
    throw fail(e, 'Gagal menyimpan catatan.');
  }
}

export async function addWord(english, meaning) {
  try {
    const user = await requireUser();
    const { data, error } = await getSupabase()
      .from('words')
      .insert({ user_id: user.id, english, meaning })
      .select('id,english,meaning,created_at')
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    throw fail(e, 'Gagal menambah kata.');
  }
}

export async function deleteWord(id) {
  try {
    await requireUser();
    const { error } = await getSupabase().from('words').delete().eq('id', id);
    if (error) throw error; // RLS membatasi ke baris milik user ini
    return true;
  } catch (e) {
    throw fail(e, 'Gagal menghapus kata.');
  }
}

export async function addHistory(text) {
  try {
    const user = await requireUser();
    const { error } = await getSupabase().from('history')
      .insert({ user_id: user.id, happened_at: new Date().toISOString(), text });
    if (error) throw error;
    return true;
  } catch (e) {
    throw fail(e, 'Gagal menyimpan riwayat.');
  }
}

export async function saveQuizResult(score, total, writing) {
  try {
    const user = await requireUser();
    const c = getSupabase();
    const { error } = await c.from('quiz_results')
      .insert({ user_id: user.id, score, total, writing });
    if (error) throw error;
    // Riwayat bersifat pelengkap: jangan gagalkan hasil tes hanya karena ini.
    const { error: hErr } = await c.from('history')
      .insert({ user_id: user.id, happened_at: new Date().toISOString(), text: `Mengerjakan tes fondasi: ${score}/${total}` });
    if (hErr) console.warn('Gagal mencatat riwayat tes:', hErr.message);
    return true;
  } catch (e) {
    throw fail(e, 'Gagal menyimpan hasil tes.');
  }
}

export async function importLegacyState(payload) {
  try {
    const { data, error } = await getSupabase().rpc('import_legacy_state', { payload });
    if (error) throw error;
    return data;
  } catch (e) {
    throw fail(e, 'Gagal mengimpor data lama.');
  }
}

export async function exportState() {
  try {
    const c = getSupabase();
    const [checks, days, words, notes, history, quiz] = await Promise.all([
      c.from('checks').select('check_key,done').order('check_key', { ascending: true }),
      c.from('study_days').select('day').order('day', { ascending: true }),
      c.from('words').select('id,english,meaning,created_at').order('created_at', { ascending: true }),
      c.from('notes').select('content,updated_at').maybeSingle(),
      c.from('history').select('happened_at,text').order('happened_at', { ascending: false }),
      c.from('quiz_results').select('score,total,writing,created_at').order('created_at', { ascending: false }),
    ]);
    for (const r of [checks, days, words, notes, history, quiz]) {
      if (r.error && r.error.code !== 'PGRST116') throw r.error;
    }
    return {
      exported_at: new Date().toISOString(),
      checks: checks.data ?? [],
      study_days: (days.data ?? []).map((r) => r.day),
      words: words.data ?? [],
      notes: notes.data ?? null,
      history: history.data ?? [],
      quiz_results: quiz.data ?? [],
    };
  } catch (e) {
    throw fail(e, 'Gagal menyiapkan ekspor.');
  }
}

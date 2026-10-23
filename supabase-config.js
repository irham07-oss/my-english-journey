// Kredensial Supabase — ambil dari Dashboard Supabase → Settings → API.
// anon key aman dipublikasikan di frontend karena RLS membatasi tiap baris ke pemiliknya.
// JANGAN pernah menaruh service_role key di frontend — itu membypass RLS.
export const SUPABASE_URL = 'GANTI_URL_PROJECT_SUPABASE';
export const SUPABASE_ANON_KEY = 'GANTI_ANON_KEY';

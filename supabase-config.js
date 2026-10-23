// Kredensial Supabase — ambil dari Dashboard Supabase → Settings → API.
// anon key aman dipublikasikan di frontend karena RLS membatasi tiap baris ke pemiliknya.
// JANGAN pernah menaruh service_role key di frontend — itu membypass RLS.
export const SUPABASE_URL = "https://cqwltavkzlgayoybkyvp.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxd2x0YXZremxnYXlveWJreXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDQ5NjcsImV4cCI6MjEwODI4MDk2N30.oRELbYWYWjy_HTvUtB01qt-9jDKEWvjIPFrytblCA38";

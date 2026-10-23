// Halaman redirect lama: tawarkan unduhan data localStorage sebelum pindah.
(function () {
  const KEY = 'englishJourneyState';
  const APP = './index.html';
  const el = document.getElementById('legacy-migrate');
  if (!el) return;

  const isFile = location.protocol === 'file:';

  function showFileHelp() {
    el.hidden = false;
    el.innerHTML = `
      <h1>Perlu server lokal</h1>
      <p>Aplikasi baru memakai ES modules, jadi tidak bisa dijalankan dengan double-click.</p>
      <p>Dari folder project, jalankan:</p>
      <pre class="legacy-code"><code>php -S 127.0.0.1:8000</code></pre>
      <p>lalu buka <a href="http://127.0.0.1:8000/">http://127.0.0.1:8000/</a>
        (atau URL hosting GitHub Pages/Vercel).</p>`;
  }

  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = null; }

  if (!raw) {
    if (isFile) showFileHelp();
    else location.replace(APP);
    return;
  }

  let data;
  try { data = JSON.parse(raw); } catch {
    if (isFile) showFileHelp();
    else location.replace(APP);
    return;
  }

  const checks = data?.checks && typeof data.checks === 'object'
    ? Object.values(data.checks).filter(Boolean).length : 0;
  const words = Array.isArray(data?.words) ? data.words.length : 0;
  const days = Array.isArray(data?.studyDates) ? data.studyDates.length : 0;

  el.hidden = false;
  el.innerHTML = `
    <h1>Data lama ditemukan</h1>
    <p>Browser ini masih menyimpan progres dari aplikasi versi lama
      (<strong>${checks}</strong> checklist, <strong>${words}</strong> kata,
      <strong>${days}</strong> hari belajar).</p>
    <p>Unduh file JSON di bawah, lalu buka aplikasi baru dan gunakan tombol
      <strong>Impor data lama</strong> di halaman Progress. Data di browser ini tidak dihapus.</p>
    <div class="legacy-actions">
      <button class="button" id="legacy-download" type="button">Unduh data lama</button>
      <a class="button ghost" id="legacy-continue" href="${APP}">Buka aplikasi baru</a>
    </div>
    <p class="muted-note">Jika aplikasi baru dibuka di alamat yang sama, data juga dipindahkan
      otomatis saat login pertama.</p>
    ${isFile ? '<p class="muted-note">Aplikasi baru perlu dijalankan lewat server lokal (php -S 127.0.0.1:8000) atau URL hosting.</p>' : ''}`;

  document.getElementById('legacy-download').onclick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-english-journey-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };
})();

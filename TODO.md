# TODO - Pengembangan Dashboard Data Kosan

## Fitur Kontak Darurat
1. ✅ `code.gs`: Tambah konstanta `HEADERS` (termasuk Kontak Darurat & No. HP Kontak Darurat)
2. ✅ `code.gs`: Migrasi otomatis kolom baru pada sheet yang sudah ada
3. ✅ `code.gs`: Baca & simpan data kontak darurat di `getPenghuni()` / `tambahPenghuni()`
4. ✅ `index.html`: Tambah field form "Nama kontak darurat" & "No. HP kontak darurat"
5. ✅ `index.html`: Tambah kolom tabel "Kontak Darurat"

## Grafik Dashboard
6. ✅ Tambah Chart.js (CDN): bar chart, doughnut chart, line chart

## Pemisahan File
7. ✅ Pindahkan CSS ke `style.css`
8. ✅ Pindahkan JavaScript ke `script.js`
9. ✅ `index.html` hanya berisi struktur HTML + link ke file terpisah

## Fitur Login
10. ✅ Tambah layar login di `index.html`
11. ✅ Tambah CSS login di `style.css`
12. ✅ Tambah logika login/logout di `script.js` (sessionStorage)

## Fitur Popup (Modal)
13. ✅ Modal untuk tambah data kosan
14. ✅ Modal untuk tambah data penghuni
15. ✅ Update data kosan & penghuni muncul lewat modal yang sama
16. ✅ Tombol "＋ Tambah", tombol close (✕), dan klik di luar modal untuk menutup
17. ✅ Modal otomatis tertutup setelah data berhasil disimpan

## Catatan
- **Kredensial login default:** username `admin`, password `admin123` (ubah pada `LOGIN_USER` / `LOGIN_PASS` di `script.js`)
- Kontak darurat **WAJIB diisi** (validasi frontend & backend)
- Kolom baru ditempatkan di akhir sheet agar data lama tidak bergeser
- (Manual) Redeploy Google Apps Script agar perubahan backend aktif

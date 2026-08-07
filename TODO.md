# TODO - Penambahan Fitur Kontak Darurat & Kartu Jatuh Tempo Interaktif

## Bagian A - Fitur Kontak Darurat
1. ✅ `code.gs`: Tambah konstanta `HEADERS` (termasuk Kontak Darurat & No. HP Kontak Darurat)
2. ✅ `code.gs`: Migrasi otomatis kolom baru pada sheet yang sudah ada
3. ✅ `code.gs`: Baca & simpan data kontak darurat di `getPenghuni()` / `tambahPenghuni()`
4. ✅ `index.html`: Tambah field form "Nama kontak darurat" & "No. HP kontak darurat"
5. ✅ `index.html`: Tambah kolom tabel "Kontak Darurat"
6. ⬜ (Manual) Redeploy Google Apps Script agar backend aktif

## Bagian B - Kartu Jatuh Tempo Interaktif
1. ✅ `index.html`: Kartu "Jatuh tempo" kini bisa diklik (id `kartuTempo`)
2. ✅ `style.css`: Style klik kartu (hover + highlight aktif)
3. ✅ `script.js`: Fungsi `akanJatuhTempo()` dan filter `filterTempo`
4. ✅ `script.js`: Event listener kartu untuk toggle filter & scroll ke tabel

## Catatan
- Kontak darurat **WAJIB diisi** (validasi frontend & backend)
- Kolom baru ditempatkan di akhir sheet agar data lama tidak bergeser
- Perubahan pada `code.gs` **wajib di-redeploy** agar backend aktif



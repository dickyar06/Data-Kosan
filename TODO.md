# TODO - Penambahan Fitur Kontak Darurat

## Rencana
1. ✅ `code.gs`: Tambah konstanta `HEADERS` (termasuk Kontak Darurat & No. HP Kontak Darurat)
2. ✅ `code.gs`: Migrasi otomatis kolom baru pada sheet yang sudah ada
3. ✅ `code.gs`: Baca & simpan data kontak darurat di `getPenghuni()` / `tambahPenghuni()`
4. ✅ `index.html`: Tambah field form "Nama kontak darurat" & "No. HP kontak darurat"
5. ✅ `index.html`: Tambah kolom tabel "Kontak Darurat"
6. ⬜ (Manual) Redeploy Google Apps Script agar backend aktif

## Catatan
- Kontak darurat **WAJIB diisi** (validasi frontend & backend)
- Kolom baru ditempatkan di akhir sheet agar data lama tidak bergeser

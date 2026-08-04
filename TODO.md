# TODO - Fitur Kontak Darurat & Tombol Update

## Kontak Darurat
1. ✅ `code.gs`: Tambah konstanta `HEADERS` (termasuk Kontak Darurat & No. HP Kontak Darurat)
2. ✅ `code.gs`: Migrasi otomatis kolom baru pada sheet yang sudah ada
3. ✅ `code.gs`: Baca & simpan data kontak darurat di `getPenghuni_()` / `tambahPenghuni_()`
4. ✅ `index.html`: Tambah field form "Nama kontak darurat" & "No. HP kontak darurat"
5. ✅ `index.html`: Tambah kolom tabel "Kontak Darurat"

## Tombol Update
6. ✅ `code.gs`: Tambah aksi `update` di `doPost` + fungsi `updatePenghuni_()`
7. ✅ `index.html`: Tambah tombol "Update" di kolom Aksi
8. ✅ `index.html`: Mode edit (isi form otomatis, tombol "Simpan Perubahan", tombol "Batal")

## Deployment
9. ⬜ (Manual) Redeploy Google Apps Script agar backend aktif

## Catatan
- Kontak darurat **WAJIB diisi** (validasi frontend & backend)
- Kolom baru ditempatkan di akhir sheet agar data lama tidak bergeser
- `code.gs` sudah disesuaikan dengan versi yang memakai `SPREADSHEET_ID`, lock, dan JSONP

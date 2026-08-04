# TODO - Fitur Multi Kosan, Kontak Darurat & Update

## Fitur Pengelolaan Kosan
1. ✅ `code.gs`: Sheet baru "Kosan" + aksi CRUD (listKosan, addKosan, updateKosan, deleteKosan)
2. ✅ `index.html`: Form tambah/update kosan (nama + jumlah kamar)
3. ✅ `index.html`: Tabel data kosan + tombol Update/Hapus
4. ✅ `index.html`: Ringkasan kamar terisi & sisa per kosan

## Penghuni Terkait Kosan
5. ✅ `code.gs`: Kolom "Nama Kosan" pada penghuni (baca, simpan, update)
6. ✅ `index.html`: Dropdown "Nama Kosan" di form penghuni
7. ✅ `index.html`: Kolom "Kosan" di tabel penghuni

## Fitur Sebelumnya
8. ✅ `index.html`: Tombol Update/Hapus pada data penghuni + mode edit
9. ✅ `index.html`: Field & kolom kontak darurat (wajib diisi)

## Deployment
10. ⬜ (Manual) Redeploy Google Apps Script agar backend aktif

## Catatan
- Kontak darurat **WAJIB diisi** (validasi frontend & backend)
- Nama kosan & jumlah kamar **WAJIB diisi**
- Penghuni wajib memilih kosan dari dropdown
- Kolom baru ditempatkan di akhir sheet agar data lama tidak bergeser
- `code.gs` memakai `SPREADSHEET_ID`, `LockService`, dan dukungan JSONP

# TODO - Pemisahan Halaman Dashboard & Data

## Status
- ✅ `index.html`: Halaman Dashboard (login + menu nav + kartu + ringkasan kosan + grafik)
- ✅ `data.html`: Halaman Data (Status Kamar + tabel Data Kosan + tabel Data Penghuni + modal)
- ✅ `script.js`: Diadaptasi agar bekerja di kedua halaman (dashboard & data)
- ✅ `style.css`: Tambah gaya menu navigasi, header sticky, & panel Status Kamar
- ✅ Fitur Status Kamar: menampilkan kamar terisi & kosong per kosan

## Fitur Status Kamar
Panel baru "Status Kamar" di halaman Data:
- Pilih kosan → tampilkan ringkasan terisi/kosong + grid kamar
- Kamar TERISI merah, kamar KOSONG hijau
- Nomor kamar otomatis berurutan 01, 02, 03... sesuai "Jumlah kamar" kosan
- Kamar dianggap terisi jika nomor penghuni cocok dengan format berurutan tersebut

## Catatan
- Login menggunakan `sessionStorage`, tetap berfungsi saat pindah antar halaman
- Klik kartu "Jatuh tempo" di dashboard → membuka halaman data dengan filter jatuh tempo aktif
- Header bagian atas kini sticky (tidak bergerak saat scroll)
- `code.gs` mendukung aksi: list, listKosan, add, update, delete, addKosan, updateKosan, deleteKosan

## Akses
- **Dashboard**: `index.html`
- **Data**: `data.html`

Login: `admin` / `admin123`

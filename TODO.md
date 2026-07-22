# TODO - Perbaikan Dashboard & Data Kosan

## Masalah
Data berhasil disimpan ke Google Sheet tapi tidak muncul di dashboard web.  
**Penyebab:** Google Apps Script melakukan redirect pada request GET sehingga parameter `?action=list` hilang dan dashboard tidak bisa mengambil data.

## Solusi yang sudah diterapkan
- ✅ `code.gs`: Semua aksi (list, add, delete) sekarang diproses lewat `doPost()` via `doHandler()` — tidak ada redirect.
- ✅ `index.html`: Semua request (termasuk list) menggunakan method **POST** untuk menghindari redirect issue.

## Langkah Deployment (wajib dilakukan)

### 1. Redeploy Google Apps Script
1. Buka Google Sheet Anda → **Extensions** → **Apps Script**
2. **Replace semua kode** di editor dengan isi file `code.gs` yang sudah diperbarui
3. Klik tombol **Deploy** → **Manage deployments**
4. Klik **Edit** (icon pensil) pada deployment yang ada
5. Klik **New version** lalu isi deskripsi: `"Fix: ganti semua request ke POST"`
6. Klik **Deploy**
7. **Salin URL Web App** yang muncul (yang berakhiran `/exec`)

### 2. Update URL di index.html (jika berubah)
1. Buka `index.html`
2. Cari `const API_URL = '...'`
3. Pastikan URL nya sama dengan URL hasil deployment
4. Jika berbeda, ganti dengan URL yang baru

### 3. Buka ulang website
1. Buka `index.html` dengan Live Server / buka langsung di browser
2. Dashboard akan menampilkan data dari Google Sheet

### 4. Verifikasi
- ✅ Data dari sheet muncul di tabel dashboard
- ✅ Kartu statistik (Total, Aktif, Kamar, Tempo) terisi
- ✅ Input data baru berhasil masuk ke sheet dan dashboard
- ✅ Hapus data juga berfungsi

---

## Jika masih bermasalah
1. Buka **Developer Tools** (F12) → tab **Console** — lihat pesan error
2. Buka **Network** tab — cek response dari request POST ke API
3. Pastikan sheet di Google Sheets bernama persis **"Penghuni"** (case-sensitive)


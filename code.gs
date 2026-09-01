
const SHEET_NAME = 'Penghuni';
const SHEET_KOSAN = 'Kosan';
const SPREADSHEET_ID = '1_t-CmVldLgbTg5bpC_8RA5JXjAjd1rio5MWh5swTYkc';
const DRIVE_FOLDER_ID = '1Br5b2mV_xPzJbTU2IHgIrudjemT2-gM-';
const HEADERS = ['ID', 'Nama', 'No. HP', 'Kamar', 'Tanggal Masuk', 'Durasi (Bulan)', 'Tanggal Selesai', 'Status', 'Dibuat Pada', 'Kontak Darurat', 'No. HP Kontak Darurat', 'Nama Kosan', 'Foto Identitas'];
const HEADERS_KOSAN = ['ID', 'Nama Kosan', 'Jumlah Kamar', 'Dibuat Pada'];

/* Membaca data. URL /exec maupun /exec?action=... akan mengembalikan data. */
function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'list')
      .toLowerCase()
      .split('?')[0];

    const callback = (e && e.parameter && e.parameter.callback) || '';

    let hasil;

    // Penting: listkosan menggunakan huruf kecil
    if (action === 'listkosan') {
      hasil = {
        success: true,
        data: getKosan_()
      };
    } else if (action === 'list') {
      hasil = {
        success: true,
        data: getPenghuni_()
      };
    } else if (action === 'listpayments') {
      hasil = {
        success: true,
        data: getPayments_()
      };
    } else if (action === 'listkosanprices') {
      // return mapping { namaKosan: harga }
      const rows = getPrices_();
      const map = {};
      rows.forEach(r => { if (r.namaKosan) map[r.namaKosan] = Number(r.harga || 0); });
      hasil = { success: true, data: map };
    } else {
      hasil = {
        success: false,
        message: 'Aksi tidak ditemukan.'
      };
    }

    return jsonResponse_(hasil, callback);

  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}

/* Menambah, mengubah, atau menghapus data dari website. */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || "").toLowerCase();

    switch(action){

      case "add":
        return jsonResponse_(tambahPenghuni_(data));

      case "update":
        return jsonResponse_(updatePenghuni_(data));

      case "delete":
        return jsonResponse_(hapusPenghuni_(data.id));

      case "addkosan":
        return jsonResponse_(tambahKosan_(data));

      case "updatekosan":
        return jsonResponse_(updateKosan_(data));

      case "deletekosan":
        return jsonResponse_(hapusKosan_(data.id));

      case 'savepayment':
        return jsonResponse_(simpanPayment_(data));

      case 'savekosanprice':
        return jsonResponse_(simpanKosanPrice_(data));

      default:
        return jsonResponse_({
          success:false,
          message:"Aksi tidak ditemukan."
        });
    }

  } catch(err){
    return jsonResponse_({
      success:false,
      message:err.message
    });
  }
}
function getSheet_() {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID belum diisi.');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);

    sheet.appendRow(HEADERS);

    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#2563eb')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  } else {
    // Migrasi otomatis: tambahkan kolom header yang belum ada (agar data lama tidak bergeser).
    const lastColumn = sheet.getLastColumn();
    const current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    if (current.length < HEADERS.length) {
      const newHeaders = HEADERS.slice(current.length);
      sheet.getRange(1, current.length + 1, 1, newHeaders.length)
        .setValues([newHeaders])
        .setFontWeight('bold')
        .setBackground('#2563eb')
        .setFontColor('#ffffff');
      sheet.autoResizeColumns(current.length + 1, newHeaders.length);
    }
  }

  return sheet;
}

function getKosanSheet_() {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID belum diisi.');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_KOSAN);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_KOSAN);

    sheet.appendRow(HEADERS_KOSAN);

    sheet.getRange(1, 1, 1, HEADERS_KOSAN.length)
      .setFontWeight('bold')
      .setBackground('#059669')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS_KOSAN.length);
  }

  return sheet;
}

function getKosan_() {
  const sheet = getKosanSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    migrasiKosanDariPenghuni_(sheet);
  }

  const lastRowSetelahMigrasi = sheet.getLastRow();
  if (lastRowSetelahMigrasi < 2) return [];

  const rows = sheet.getRange(2, 1, lastRowSetelahMigrasi - 1, HEADERS_KOSAN.length).getValues();

  return rows
    .map(row => ({
      id: String(row[0] || ''),
      namaKosan: String(row[1] || ''),
      jumlahKamar: Number(row[2]) || 0
    }))
    .filter(data => data.id)
    .reverse();
}

/*
 * Migrasi satu kali untuk data lama: sebelum sheet Kosan dibuat, nama kosan
 * hanya tersimpan di sheet Penghuni. Jumlah kamar diambil dari nomor kamar
 * terbesar yang pernah dipakai. Nilai ini dapat diedit melalui menu Data.
 */
function migrasiKosanDariPenghuni_(sheetKosan) {
  const penghuni = getPenghuni_();
  const daftar = new Map();

  penghuni.forEach(data => {
    const nama = String(data.namaKosan || '').trim();
    if (!nama) return;

    const kunci = normalisasiTeks_(nama);
    const nomor = Number(normalisasiKamar_(data.kamar)) || 1;
    const lama = daftar.get(kunci);
    daftar.set(kunci, {
      namaKosan: lama ? lama.namaKosan : nama,
      jumlahKamar: Math.max(lama ? lama.jumlahKamar : 0, nomor)
    });
  });

  const rows = Array.from(daftar.values()).map(kosan => [
    Utilities.getUuid(),
    kosan.namaKosan,
    kosan.jumlahKamar,
    new Date()
  ]);

  if (rows.length) {
    sheetKosan.getRange(2, 1, rows.length, HEADERS_KOSAN.length).setValues(rows);
  }
}

function normalisasiTeks_(nilai) {
  return String(nilai || '').trim().toLowerCase();
}

function normalisasiKamar_(nilai) {
  const cocok = String(nilai || '').trim().match(/\d+/);
  return cocok ? String(Number(cocok[0])) : '';
}

function getKosanByName_(namaKosan) {
  const target = normalisasiTeks_(namaKosan);
  return getKosan_().find(kosan => normalisasiTeks_(kosan.namaKosan) === target) || null;
}

function jumlahKamarTerisi_(namaKosan, excludeId) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const target = normalisasiTeks_(namaKosan);
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
    .filter(row => String(row[0] || '') !== String(excludeId || ''))
    .filter(row => normalisasiTeks_(row[11]) === target)
    .filter(row => normalisasiTeks_(row[7] || 'Aktif') === 'aktif')
    .length;
}

function validasiKamarKosan_(namaKosan, kamar) {
  const kosan = getKosanByName_(namaKosan);
  if (!kosan) {
    throw new Error('Nama kosan tidak ditemukan. Tambahkan kosan terlebih dahulu.');
  }

  const nomorKamar = Number(normalisasiKamar_(kamar));
  if (!Number.isInteger(nomorKamar) || nomorKamar < 1 || nomorKamar > Number(kosan.jumlahKamar)) {
    throw new Error(`Nomor kamar harus antara 01 dan ${kosan.jumlahKamar} untuk ${kosan.namaKosan}.`);
  }

  return kosan;
}

function tambahKosan_(data) {
  if (!data.namaKosan || !data.jumlahKamar) {
    throw new Error('Nama kosan dan jumlah kamar wajib diisi.');
  }

  const jumlahKamar = Number(data.jumlahKamar);
  if (!Number.isInteger(jumlahKamar) || jumlahKamar < 1) {
    throw new Error('Jumlah kamar minimal 1.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getKosanSheet_();
    if (getKosanByName_(data.namaKosan)) {
      throw new Error('Nama kosan sudah terdaftar.');
    }
    sheet.appendRow([
      Utilities.getUuid(),
      String(data.namaKosan).trim(),
      jumlahKamar,
      new Date()
    ]);

    return {
      success: true,
      message: 'Kosan berhasil ditambahkan.'
    };
  } finally {
    lock.releaseLock();
  }
}

function updateKosan_(data) {
  if (!data.id) {
    throw new Error('ID kosan tidak ditemukan.');
  }

  if (!data.namaKosan || !data.jumlahKamar) {
    throw new Error('Nama kosan dan jumlah kamar wajib diisi.');
  }

  const jumlahKamar = Number(data.jumlahKamar);
  if (!Number.isInteger(jumlahKamar) || jumlahKamar < 1) {
    throw new Error('Jumlah kamar minimal 1.');
  }

  const sheet = getKosanSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data kosan kosong.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const baris = ids.findIndex(item => String(item) === String(data.id));
  if (baris === -1) throw new Error('Kosan tidak ditemukan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const rowIndex = baris + 2;
    const namaLama = String(sheet.getRange(rowIndex, 2).getValue() || '').trim();
    const namaBaru = String(data.namaKosan).trim();
    const kosanDenganNamaBaru = getKosanByName_(namaBaru);
    if (kosanDenganNamaBaru && String(kosanDenganNamaBaru.id) !== String(data.id)) {
      throw new Error('Nama kosan sudah digunakan oleh kosan lain.');
    }

    const kamarTerisi = jumlahKamarTerisi_(namaLama);
    if (normalisasiTeks_(namaLama) !== normalisasiTeks_(namaBaru) && kamarTerisi > 0) {
      throw new Error('Nama kosan tidak dapat diubah karena masih memiliki penghuni aktif.');
    }
    if (jumlahKamar < kamarTerisi) {
      throw new Error(`Jumlah kamar tidak boleh kurang dari kamar terisi (${kamarTerisi}).`);
    }

    sheet.getRange(rowIndex, 2).setValue(namaBaru);
    sheet.getRange(rowIndex, 3).setValue(jumlahKamar);

    return {
      success: true,
      message: 'Kosan berhasil diperbarui.'
    };
  } finally {
    lock.releaseLock();
  }
}

function hapusKosan_(id) {
  if (!id) {
    throw new Error('ID kosan tidak ditemukan.');
  }

  const sheet = getKosanSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data kosan kosong.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(item => String(item) === String(id));
  if (index === -1) throw new Error('Kosan tidak ditemukan.');

  const rowIndex = index + 2;
  const namaKosan = String(sheet.getRange(rowIndex, 2).getValue() || '');
  if (jumlahKamarTerisi_(namaKosan) > 0) {
    throw new Error('Kosan tidak dapat dihapus karena masih memiliki penghuni aktif. Pindahkan atau selesaikan data penghuni terlebih dahulu.');
  }

  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Kosan berhasil dihapus.'
  };
}

function getPenghuni_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);

  // values: nilai asli; displayValues: tampilan tanggal dari Google Sheet
  const rows = range.getValues();
  const tampilan = range.getDisplayValues();

  return rows
    .map((row, index) => ({
      id: String(row[0] || ''),
      nama: String(row[1] || ''),
      noHp: String(row[2] || ''),
      kamar: String(row[3] || ''),
      tanggalMasuk: formatTanggal_(row[4], tampilan[index][4]),
      durasi: Number(row[5]) || 0,
      tanggalSelesai: formatTanggal_(row[6], tampilan[index][6]),
      status: String(row[7] || 'Aktif'),
      kontakNama: String(row[9] || ''),
      kontakNoHp: String(row[10] || ''),
      namaKosan: String(row[11] || ''),
      fotoIdentitas: String(row[12] || '')
    }))
    .filter(data => data.id)
    .reverse();
}

/*
 * Cek apakah kamar (nama kosan + nomor kamar) sudah terisi oleh penghuni aktif.
 * excludeId digunakan saat update agar data yang sama tidak dianggap bentrok.
 */
function cekKamarTerisi_(namaKosan, kamar, excludeId) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const namaKosanTujuan = normalisasiTeks_(namaKosan);
  const kamarTujuan = normalisasiKamar_(kamar);

  return values.some(row => {
    const id = String(row[0] || '');
    const kosan = normalisasiTeks_(row[11]);
    const noKamar = normalisasiKamar_(row[3]);
    const status = normalisasiTeks_(row[7] || 'Aktif');

    // Abaikan jika ini data yang sedang di-update (id sama)
    if (excludeId && id === String(excludeId)) return false;

    // Hanya menghitung penghuni Aktif
    if (status !== 'aktif') return false;

    return kosan === namaKosanTujuan && noKamar === kamarTujuan;
  });
}

function simpanFotoIdentitas_(fotoDataUrl) {
  if (!fotoDataUrl) {
    Logger.log('[FOTO STEP 1] GAGAL: data URL kosong');
    return '';
  }

  const urlString = String(fotoDataUrl).trim();
  Logger.log('[FOTO STEP 1] Data URL length: ' + urlString.length + ' chars, prefix: ' + urlString.substring(0, 30));

  // Jika sudah URL (dari edit), return langsung
  if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
    Logger.log('[FOTO STEP 2] Sudah URL, return langsung');
    return urlString;
  }

  if (!urlString.startsWith('data:image/')) {
    Logger.log('[FOTO STEP 2] GAGAL: format bukan data:image/, prefix: ' + urlString.substring(0, 50));
    return '';
  }
  Logger.log('[FOTO STEP 2] Format OK: data:image/ terdeteksi');

  try {
    let folder;
    try {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      Logger.log('[FOTO STEP 3] Folder ditemukan: ' + DRIVE_FOLDER_ID);
    } catch (folderError) {
      folder = DriveApp.getRootFolder();
      Logger.log('[FOTO STEP 3] Folder custom GAGAL, fallback root: ' + folderError.message);
    }

    Logger.log('[FOTO STEP 4] Cek regex match untuk base64...');
    const match = urlString.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) {
      Logger.log('[FOTO STEP 4] GAGAL regex: prefix=' + urlString.substring(0, 80));
      return '';
    }

    const mimeType = match[1];
    const base64 = match[2];
    Logger.log('[FOTO STEP 5] Regex OK - MIME: ' + mimeType + ', base64 length: ' + base64.length);

    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'jpg';
    Logger.log('[FOTO STEP 6] Extension: ' + extension);

    Logger.log('[FOTO STEP 7] Decode base64...');
    const decodedBlob = Utilities.base64Decode(base64);
    Logger.log('[FOTO STEP 7] Decode OK, blob size: ' + decodedBlob.length);

    const fileName = `foto-identitas-${Utilities.getUuid()}.${extension}`;
    const blob = Utilities.newBlob(decodedBlob, mimeType, fileName);
    Logger.log('[FOTO STEP 8] Blob created: ' + fileName);

    Logger.log('[FOTO STEP 9] Create file di Drive...');
    const file = folder.createFile(blob);
    Logger.log('[FOTO STEP 9] File created: ' + file.getId());

    Logger.log('[FOTO STEP 10] Set sharing...');
    try {
      file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
      Logger.log('[FOTO STEP 10] Sharing OK via setSharing dengan ANYONE');
    } catch (sharingError) {
      Logger.log('[FOTO STEP 10] setSharing gagal, coba Drive API workaround: ' + sharingError.message);
      try {
        // Workaround: ganti owner ke "anyone" via Drive API advanced
        const fileId = file.getId();
        const response = UrlFetchApp.fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
          {
            method: 'post',
            headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
            payload: JSON.stringify({ role: 'reader', type: 'anyone' }),
            muteHttpExceptions: true,
            contentType: 'application/json'
          }
        );
        Logger.log('[FOTO STEP 10] Sharing via Drive API: ' + response.getResponseCode());
      } catch (apiError) {
        Logger.log('[FOTO STEP 10] Sharing via API juga gagal, lanjut ke URL: ' + apiError.message);
      }
    }

    const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
    Logger.log('[FOTO FINAL] Foto URL berhasil: ' + url);
    return url;
  } catch (error) {
    Logger.log('[FOTO ERROR] ' + error.message + ' | Stack: ' + error.stack);
    return '';
  }
}

function tambahPenghuni_(data) {
  Logger.log('tambahPenghuni_ dipanggil dengan data: ' + JSON.stringify(data).substring(0, 200));
  
  const wajib = ['nama', 'noHp', 'kamar', 'tanggalMasuk', 'durasi', 'kontakNama', 'kontakNoHp', 'namaKosan'];

  wajib.forEach(kolom => {
    if (!data[kolom]) {
      throw new Error(`Kolom ${kolom} wajib diisi.`);
    }
  });

  const tanggalMasuk = new Date(`${data.tanggalMasuk}T00:00:00`);

  if (isNaN(tanggalMasuk.getTime())) {
    throw new Error('Tanggal masuk tidak valid.');
  }

  const durasi = Number(data.durasi);

  if (!Number.isInteger(durasi) || durasi < 1) {
    throw new Error('Durasi sewa minimal 1 bulan.');
  }

  const kosanDipilih = validasiKamarKosan_(data.namaKosan, data.kamar);

  const tanggalSelesai = new Date(tanggalMasuk);
  tanggalSelesai.setMonth(tanggalSelesai.getMonth() + durasi);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // Pastikan 1 kamar hanya untuk 1 penghuni aktif
    if (cekKamarTerisi_(kosanDipilih.namaKosan, data.kamar)) {
      throw new Error('Kamar ' + data.kamar + ' di ' + data.namaKosan + ' sudah terisi oleh penghuni aktif.');
    }

    const sheet = getSheet_();
    Logger.log('fotoIdentitas diterima: ' + (data.fotoIdentitas ? 'ada (' + data.fotoIdentitas.substring(0, 50) + '...)' : 'TIDAK ADA/KOSONG'));
    const fotoUrl = simpanFotoIdentitas_(data.fotoIdentitas);
    Logger.log('Foto URL hasil simpan: ' + (fotoUrl || '[KOSONG - PERHATIAN!]'));

    const rowData = [
      Utilities.getUuid(),
      String(data.nama).trim(),
      String(data.noHp).trim(),
      String(data.kamar).trim(),
      tanggalMasuk,
      durasi,
      tanggalSelesai,
      data.status === 'Selesai' ? 'Selesai' : 'Aktif',
      new Date(),
      String(data.kontakNama).trim(),
      String(data.kontakNoHp).trim(),
      kosanDipilih.namaKosan,
      fotoUrl
    ];
    Logger.log('Menyimpan row dengan foto URL di kolom 13 (index 12): ' + (fotoUrl || '[KOSONG]'));
    sheet.appendRow(rowData);

    return {
      success: true,
      message: 'Data berhasil disimpan. Foto URL: ' + (fotoUrl || '[tidak ada/gagal upload]')
    };
  } finally {
    lock.releaseLock();
  }
}

function updatePenghuni_(data) {
  if (!data.id) {
    throw new Error('ID data tidak ditemukan.');
  }

  const wajib = ['nama', 'noHp', 'kamar', 'tanggalMasuk', 'durasi', 'kontakNama', 'kontakNoHp', 'namaKosan'];
  wajib.forEach(kolom => {
    if (!data[kolom]) {
      throw new Error(`Kolom ${kolom} wajib diisi.`);
    }
  });

  const tanggalMasuk = new Date(`${data.tanggalMasuk}T00:00:00`);
  if (isNaN(tanggalMasuk.getTime())) {
    throw new Error('Tanggal masuk tidak valid.');
  }

  const durasi = Number(data.durasi);
  if (!Number.isInteger(durasi) || durasi < 1) {
    throw new Error('Durasi sewa minimal 1 bulan.');
  }

  const kosanDipilih = validasiKamarKosan_(data.namaKosan, data.kamar);

  const tanggalSelesai = new Date(tanggalMasuk);
  tanggalSelesai.setMonth(tanggalSelesai.getMonth() + durasi);

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data penghuni kosong.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const baris = ids.findIndex(item => String(item) === String(data.id));
  if (baris === -1) throw new Error('Data penghuni tidak ditemukan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // Pastikan 1 kamar hanya untuk 1 penghuni aktif (abaikan data yang sedang di-update)
    if (cekKamarTerisi_(kosanDipilih.namaKosan, data.kamar, data.id)) {
      throw new Error('Kamar ' + data.kamar + ' di ' + data.namaKosan + ' sudah terisi oleh penghuni aktif.');
    }

    // Update baris (baris sheet = baris+2 karena header di baris 1)
    const rowIndex = baris + 2;
    const fotoLama = String(sheet.getRange(rowIndex, 13).getValue() || '');
    const hapusFoto = data.hapusFoto === '1' || data.hapusFoto === 1 || data.hapusFoto === true;
    const fotoUrl = hapusFoto ? '' : (simpanFotoIdentitas_(data.fotoIdentitas) || fotoLama);
    sheet.getRange(rowIndex, 2).setValue(String(data.nama).trim());
    sheet.getRange(rowIndex, 3).setValue(String(data.noHp).trim());
    sheet.getRange(rowIndex, 4).setValue(String(data.kamar).trim());
    sheet.getRange(rowIndex, 5).setValue(tanggalMasuk);
    sheet.getRange(rowIndex, 6).setValue(durasi);
    sheet.getRange(rowIndex, 7).setValue(tanggalSelesai);
    sheet.getRange(rowIndex, 8).setValue(data.status === 'Selesai' ? 'Selesai' : 'Aktif');
    sheet.getRange(rowIndex, 10).setValue(String(data.kontakNama).trim());
    sheet.getRange(rowIndex, 11).setValue(String(data.kontakNoHp).trim());
    sheet.getRange(rowIndex, 12).setValue(kosanDipilih.namaKosan);
    sheet.getRange(rowIndex, 13).setValue(fotoUrl);

    return {
      success: true,
      message: 'Data berhasil diperbarui.'
    };
  } finally {
    lock.releaseLock();
  }
}

function hapusPenghuni_(id) {
  if (!id) {
    throw new Error('ID data tidak ditemukan.');
  }

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Data penghuni kosong.');
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(item => String(item) === String(id));

  if (index === -1) {
    throw new Error('Data penghuni tidak ditemukan.');
  }

  sheet.deleteRow(index + 2);

  return {
    success: true,
    message: 'Data berhasil dihapus.'
  };
}

function formatTanggal_(nilai, tampilanTanggal) {
  // Jika Google Apps Script mengirim objek Date
  if (nilai instanceof Date && !isNaN(nilai.getTime())) {
    return Utilities.formatDate(
      nilai,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  // Cadangan: membaca tampilan Sheet, contoh 22/07/2026
  const cocok = String(tampilanTanggal || '').match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (cocok) {
    const hari = cocok[1].padStart(2, '0');
    const bulan = cocok[2].padStart(2, '0');
    const tahun = cocok[3];

    return `${tahun}-${bulan}-${hari}`;
  }

  return '';
}

function jsonResponse_(data, callback) {
  let hasil = JSON.stringify(data);

  // JSONP: agar index.html di Live Server boleh membaca Google Apps Script
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) {
    hasil = `${callback}(${hasil});`;

    return ContentService
      .createTextOutput(hasil)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(hasil)
    .setMimeType(ContentService.MimeType.JSON);
}
function testUploadFoto() {
  const sample = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAF';
  const result = simpanFotoIdentitas_(sample);
  Logger.log(result);
}

/* ===== Payments & Prices helpers ===== */
function getPayments_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName('Payments');
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h || '').trim());
  const rows = data.slice(1);
  return rows.map(r => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = r[i];
    return obj;
  }).reverse();
}

function getPrices_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName('Prices');
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h || '').trim());
  const rows = data.slice(1);
  return rows.map(r => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = r[i];
    return obj;
  }).reverse();
}

function simpanPayment_(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sh = ss.getSheetByName('Payments');
    if (!sh) sh = ss.insertSheet('Payments');
    // Ensure header
    if (sh.getLastRow() < 1) sh.appendRow(['id','penghuniId','nama','namaKosan','amount','date']);
    sh.appendRow([data.id || Utilities.getUuid(), data.penghuniId || '', data.nama || '', data.namaKosan || '', data.amount || 0, data.date || new Date()]);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function simpanKosanPrice_(data) {
  try {
    const nama = data.namaKosan;
    const harga = Number(data.harga || 0);
    if (!nama) throw new Error('namaKosan kosong');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sh = ss.getSheetByName('Prices');
    if (!sh) sh = ss.insertSheet('Prices');
    // Ensure header
    if (sh.getLastRow() < 1) sh.appendRow(['namaKosan','harga']);
    const rows = sh.getDataRange().getValues();
    const ids = rows.slice(1).map(r => String(r[0] || ''));
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i]) === String(nama)) {
        sh.getRange(i + 2, 2).setValue(harga);
        return { success: true };
      }
    }
    sh.appendRow([nama, harga]);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

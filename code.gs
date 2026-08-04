const SHEET_NAME = 'Penghuni';
const SHEET_KOSAN = 'Kosan';
const SPREADSHEET_ID = '1_t-CmVldLgbTg5bpC_8RA5JXjAjd1rio5MWh5swTYkc';
const HEADERS = ['ID', 'Nama', 'No. HP', 'Kamar', 'Tanggal Masuk', 'Durasi (Bulan)', 'Tanggal Selesai', 'Status', 'Dibuat Pada', 'Kontak Darurat', 'No. HP Kontak Darurat', 'Nama Kosan'];
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
    return [];
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS_KOSAN.length).getValues();

  return rows
    .map(row => ({
      id: String(row[0] || ''),
      namaKosan: String(row[1] || ''),
      jumlahKamar: Number(row[2]) || 0
    }))
    .filter(data => data.id)
    .reverse();
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
    sheet.getRange(rowIndex, 2).setValue(String(data.namaKosan).trim());
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

  sheet.deleteRow(index + 2);

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
      namaKosan: String(row[11] || '')
    }))
    .filter(data => data.id)
    .reverse();
}

function tambahPenghuni_(data) {
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

  const tanggalSelesai = new Date(tanggalMasuk);
  tanggalSelesai.setMonth(tanggalSelesai.getMonth() + durasi);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();

    sheet.appendRow([
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
      String(data.namaKosan).trim()
    ]);

    return {
      success: true,
      message: 'Data berhasil disimpan.'
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
    // Update baris (baris sheet = baris+2 karena header di baris 1)
    const rowIndex = baris + 2;
    sheet.getRange(rowIndex, 2).setValue(String(data.nama).trim());
    sheet.getRange(rowIndex, 3).setValue(String(data.noHp).trim());
    sheet.getRange(rowIndex, 4).setValue(String(data.kamar).trim());
    sheet.getRange(rowIndex, 5).setValue(tanggalMasuk);
    sheet.getRange(rowIndex, 6).setValue(durasi);
    sheet.getRange(rowIndex, 7).setValue(tanggalSelesai);
    sheet.getRange(rowIndex, 8).setValue(data.status === 'Selesai' ? 'Selesai' : 'Aktif');
    sheet.getRange(rowIndex, 10).setValue(String(data.kontakNama).trim());
    sheet.getRange(rowIndex, 11).setValue(String(data.kontakNoHp).trim());
    sheet.getRange(rowIndex, 12).setValue(String(data.namaKosan).trim());

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

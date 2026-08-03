const SHEET_NAME = 'Penghuni';
const SPREADSHEET_ID = '1_t-CmVldLgbTg5bpC_8RA5JXjAjd1rio5MWh5swTYkc';
const HEADERS = ['ID', 'Nama', 'No. HP', 'Kamar', 'Tanggal Masuk', 'Durasi (Bulan)', 'Tanggal Selesai', 'Status', 'Dibuat Pada', 'Kontak Darurat', 'No. HP Kontak Darurat'];

/* Membaca data. URL /exec maupun /exec?action=list akan mengembalikan data. */
function doGet(e) {
  try {
    const hasil = {
      success: true,
      data: getPenghuni_()
    };

    const callback = (e && e.parameter && e.parameter.callback) || '';
    return jsonResponse_(hasil, callback);

  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}

/* Menambah atau menghapus data dari website. */
function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String(data.action || '').toLowerCase();

    if (action === 'add') {
      return jsonResponse_(tambahPenghuni_(data));
    }

    if (action === 'delete') {
      return jsonResponse_(hapusPenghuni_(data.id));
    }

    return jsonResponse_({
      success: false,
      message: 'Aksi tidak ditemukan.'
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}

function normalisasiAction_(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'list')
    .toLowerCase()
    .split('?')[0];

  return action || 'list';
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

function getPenghuni_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const range = sheet.getRange(2, 1, lastRow - 1, 9);

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
      status: String(row[7] || 'Aktif')
    }))
    .filter(data => data.id)
    .reverse();
}

function tambahPenghuni_(data) {
  const wajib = ['nama', 'noHp', 'kamar', 'tanggalMasuk', 'durasi'];

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
      new Date()
    ]);

    return {
      success: true,
      message: 'Data berhasil disimpan.'
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
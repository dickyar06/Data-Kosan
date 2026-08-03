/*
 * Backend Google Apps Script untuk aplikasi Data Kosan.
 * Buat Google Sheet baru, lalu buka Extensions > Apps Script dan tempel file ini.
 */
const SHEET_NAME = 'Penghuni';
const HEADERS = ['ID', 'Nama', 'No. HP', 'Kamar', 'Tanggal Masuk', 'Durasi (Bulan)', 'Tanggal Selesai', 'Status', 'Dibuat Pada', 'Kontak Darurat', 'No. HP Kontak Darurat'];

function doGet(e) {
  return doHandler(e, /* isGet */ true);
}

function doPost(e) {
  return doHandler(e, /* isGet */ false);
}

function doHandler(e, isGet) {
  try {
    var data;
    if (isGet) {
      data = { action: e.parameter.action || '' };
    } else {
      data = JSON.parse(e.postData.contents);
    }
    
    if (data.action === 'list') return jsonResponse({ success: true, data: getPenghuni() });
    if (data.action === 'add') return jsonResponse(tambahPenghuni(data));
    if (data.action === 'delete') return jsonResponse(hapusPenghuni(data.id));
    return jsonResponse({ success: false, message: 'Aksi tidak ditemukan.' });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else {
    // Migrasi otomatis: tambahkan kolom header yang belum ada (agar data lama tidak bergeser).
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (current.length < HEADERS.length) {
      const newHeaders = HEADERS.slice(current.length);
      sheet.getRange(1, current.length + 1, 1, newHeaders.length).setValues([newHeaders])
        .setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    }
  }
  return sheet;
}

function getPenghuni() {
  const values = getSheet().getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(row => row[0]).map(row => ({
    id: String(row[0]), nama: row[1], noHp: row[2], kamar: row[3],
    tanggalMasuk: dateToString(row[4]), durasi: Number(row[5]),
    tanggalSelesai: dateToString(row[6]), status: row[7],
    kontakNama: row[9] || '', kontakNoHp: row[10] || ''
  })).reverse();
}

function tambahPenghuni(data) {
  ['nama', 'noHp', 'kamar', 'tanggalMasuk', 'durasi', 'kontakNama', 'kontakNoHp'].forEach(k => { if (!data[k]) throw new Error('Semua kolom wajib diisi.'); });
  const mulai = new Date(data.tanggalMasuk + 'T00:00:00');
  const selesai = new Date(mulai); selesai.setMonth(selesai.getMonth() + Number(data.durasi));
  getSheet().appendRow([Utilities.getUuid(), data.nama, data.noHp, data.kamar, mulai, Number(data.durasi), selesai, data.status || 'Aktif', new Date(), data.kontakNama, data.kontakNoHp]);
  return { success: true, message: 'Data berhasil disimpan.' };
}

function hapusPenghuni(id) {
  const sheet = getSheet();
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().flat();
  const index = ids.findIndex(x => String(x) === String(id));
  if (index < 0) throw new Error('Data tidak ditemukan.');
  sheet.deleteRow(index + 2);
  return { success: true };
}

function dateToString(date) {
  return date instanceof Date ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(date || '');
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
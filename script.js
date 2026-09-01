// URL Web App Apps Script. Jangan tambahkan action di sini.
const API_URL = 'https://script.google.com/macros/s/AKfycby8dhKxMKqdAJ-ccTDOPvya310xBKLSeLlJfUYXRXVL_5seTfNLTBI-l5i9v6eI92eRtg/exec';

// Kredensial login (tanpa backend). Ubah sesuai keinginan.
const LOGIN_USER = 'admin';
const LOGIN_PASS = 'admin123';
const SESSION_KEY = 'diva_kosan_login';

let penghuni = [];
let kosan = [];
let filterTempo = false;
let columnFilters = {
  nama: [],
  noHp: [],
  kontakNama: [],
  namaKosan: [],
  kamar: [],
  tanggalMasuk: [],
  durasi: [],
  tanggalSelesai: [],
  status: []
};
let editId = null;
let editKosanId = null;
let chartKosan = null, chartStatus = null, chartBulan = null;
let selectedPenghuniIds = new Set();

// Penyimpanan lokal untuk fitur pembayaran
const PAYMENTS_KEY = 'diva_kosan_payments';
const KOSAN_PRICE_KEY = 'diva_kosan_prices';
let payments = [];
let kosanPrices = {}; // { namaKosan: number }

const $ = id => document.getElementById(id);

const FOTO_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#e2e8f0"/>
  <circle cx="60" cy="42" r="22" fill="#94a3b8"/>
  <path d="M24 98c7-17 25-26 36-26s29 9 36 26" fill="#94a3b8"/>
</svg>`);

const formatTanggal = value => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00:00')) : '-';

const selisihHari = value => Math.ceil((new Date(value + 'T00:00:00') - new Date()) / 86400000);

const setStatus = (el, teks, error = false) => { if (el) { el.textContent = teks; el.className = error ? 'error' : ''; } };

const escapeHtml = teks => { const el = document.createElement('div'); el.textContent = teks || ''; return el.innerHTML; };

// Normalisasi nomor kamar menjadi format berurutan 01, 02, dst.
// Contoh: "1" -> "01", "A-01" -> "01", "B-02" -> "02", "12" -> "12"
const normKamar = teks => {
  const s = String(teks || '').trim();
  const cocok = s.match(/(?:^|[^0-9])(\d+)(?:[^0-9]|$)/);
  const angka = cocok ? cocok[1] : '';
  return angka ? angka.padStart(2, '0') : '';
};

/* ===== Helper Modal ===== */
function bukaModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('terbuka');
}

/* ===== Fitur Pembayaran (localStorage) ===== */
function loadPaymentsFromStorage() {
  // Prefer server data when available; fallback to localStorage
  payments = [];
  kosanPrices = {};
  // Attempt to load from server via JSONP (GET). If it fails, fallback to localStorage.
  ambilDataJSONP('listPayments').then(result => {
    if (result && result.success && Array.isArray(result.data)) {
      payments = result.data;
    } else {
      try { const raw = localStorage.getItem(PAYMENTS_KEY); payments = raw ? JSON.parse(raw) : []; } catch (e) { payments = []; }
    }
    // Try to load prices
    ambilDataJSONP('listKosanPrices').then(res2 => {
      if (res2 && res2.success && typeof res2.data === 'object') kosanPrices = res2.data;
      else {
        try { kosanPrices = JSON.parse(localStorage.getItem(KOSAN_PRICE_KEY) || '{}'); } catch (e) { kosanPrices = {}; }
      }
      renderPaymentsPage();
    }).catch(() => {
      try { kosanPrices = JSON.parse(localStorage.getItem(KOSAN_PRICE_KEY) || '{}'); } catch (e) { kosanPrices = {}; }
      renderPaymentsPage();
    });
  }).catch(() => {
    try { const raw = localStorage.getItem(PAYMENTS_KEY); payments = raw ? JSON.parse(raw) : []; } catch (e) { payments = []; }
    try { kosanPrices = JSON.parse(localStorage.getItem(KOSAN_PRICE_KEY) || '{}'); } catch (e) { kosanPrices = {}; }
    renderPaymentsPage();
  });
}

function savePaymentsToStorage() {
  try { localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments)); } catch (e) { console.warn('Gagal menyimpan payments', e); }
  try { localStorage.setItem(KOSAN_PRICE_KEY, JSON.stringify(kosanPrices)); } catch (e) { console.warn('Gagal menyimpan kosanPrices', e); }
}

// Try to save price to server; fallback to localStorage when server not available
async function saveKosanPriceToServer(nama, harga) {
  try {
    const res = await kirimData({ action: 'saveKosanPrice', namaKosan: nama, harga: Number(harga) });
    return res && res.success === true;
  } catch (e) {
    console.warn('Gagal menyimpan harga ke server, gunakan localStorage sebagai fallback.', e);
    return false;
  }
}

// Try to save a single payment to server; fallback to localStorage
async function savePaymentToServer(payment) {
  try {
    const res = await kirimData({ ...payment, action: 'savePayment' });
    return res && res.success === true;
  } catch (e) {
    console.warn('Gagal menyimpan pembayaran ke server, gunakan localStorage sebagai fallback.', e);
    return false;
  }
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(amount));
}

function renderPaymentsPage() {
  // Hanya jalankan bila elemen ada di halaman
  loadPaymentsFromStorage();
  const sel = $('paymentsKosanSelect');
  const inputHarga = $('inputHargaKosan');
  const table = $('paymentsTable');
  if (sel) {
    sel.innerHTML = kosan.length ? '<option value="">-- Pilih kosan --</option>' + kosan.map(k => `<option value="${escapeHtml(k.namaKosan)}">${escapeHtml(k.namaKosan)}</option>`).join('') : '<option value="">Belum ada kosan</option>';
  }

  if (sel && inputHarga) {
    sel.addEventListener('change', () => {
      const v = sel.value;
      inputHarga.value = kosanPrices[v] || '';
    });
  }

  if (table) {
    const rows = penghuni.map(p => {
      const tagihan = kosanPrices[p.namaKosan] ? Number(kosanPrices[p.namaKosan]) : 0;
      const sudah = payments.filter(x => x.penghuniId === p.id).reduce((s, x) => s + Number(x.amount || 0), 0);
      const sisa = Math.max(0, tagihan - sudah);
      const status = tagihan === 0 ? '-' : (sudah === 0 ? 'Belum' : (sisa === 0 ? 'Lunas' : (sudah < tagihan ? 'DP' : 'Lunas')));
      return `<tr>
        <td>${escapeHtml(p.nama)}</td>
        <td>${escapeHtml(p.namaKosan)}</td>
        <td>${escapeHtml(normKamar(p.kamar))}</td>
        <td>${tagihan ? formatCurrency(tagihan) : '-'}</td>
        <td>${formatCurrency(sudah)}</td>
        <td>${tagihan ? formatCurrency(sisa) : '-'}</td>
        <td><button class="green btn-bayar" data-id="${escapeHtml(p.id)}">Bayar</button></td>
      </tr>`;
    });
    table.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" class="empty">Belum ada penghuni.</td></tr>';
  }

  // Bind tombol set harga
  const btnSet = $('btnSetHarga');
  if (btnSet) {
    btnSet.onclick = async () => {
      const nama = sel ? sel.value : '';
      const harga = inputHarga ? Number(inputHarga.value || 0) : 0;
      if (!nama) { alert('Pilih kosan dulu.'); return; }
      if (!harga || harga <= 0) { if (!confirm('Harga kosong atau 0. Tetap simpan?')) return; }
      kosanPrices[nama] = harga;
      const ok = await saveKosanPriceToServer(nama, harga);
      savePaymentsToStorage();
      renderPaymentsPage();
      alert(ok ? 'Harga kosan disimpan ke server.' : 'Harga disimpan di localStorage (server gagal).');
    };
  }

  const btnRefresh = $('btnRefreshPayments');
  if (btnRefresh) btnRefresh.onclick = renderPaymentsPage;
}

async function recordPayment(penghuniId) {
  const p = penghuni.find(x => x.id === penghuniId);
  if (!p) { alert('Penghuni tidak ditemukan'); return; }
  const tagihan = kosanPrices[p.namaKosan] ? Number(kosanPrices[p.namaKosan]) : 0;
  const sudah = payments.filter(x => x.penghuniId === p.id).reduce((s, x) => s + Number(x.amount || 0), 0);
  const sisa = Math.max(0, tagihan - sudah);
  const teks = sisa > 0 ? `Sisa tagihan ${formatCurrency(sisa)}. Masukkan jumlah pembayaran:` : 'Tagihan sudah lunas. Masukkan jumlah pembayaran ekstra jika perlu:';
  const input = prompt(teks, sisa > 0 ? sisa : '0');
  if (input === null) return;
  const jumlah = Number(input);
  if (isNaN(jumlah) || jumlah <= 0) { alert('Jumlah tidak valid.'); return; }
  const payment = { id: 'pmt-' + Date.now(), penghuniId: p.id, nama: p.nama, namaKosan: p.namaKosan, amount: jumlah, date: new Date().toISOString() };
  payments.push(payment);
  // Attempt server save; if fails, keep local copy
  const ok = await savePaymentToServer(payment);
  savePaymentsToStorage();
  renderPaymentsPage();
  alert(ok ? 'Pembayaran tercatat di server.' : 'Pembayaran tercatat di localStorage (server gagal).');
}

function tutupModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('terbuka');
}

// Membaca data memakai JSONP agar berfungsi dari Live Server (127.0.0.1) tanpa masalah CORS.
function ambilDataJSONP(aksi) {
  return new Promise((resolve, reject) => {
    const callback = 'kosanCallback' + Date.now();
    const script = document.createElement('script');
    const bersihkan = () => { delete window[callback]; script.remove(); };
    window[callback] = hasil => { bersihkan(); resolve(hasil); };
    script.onerror = () => { bersihkan(); reject(new Error('Tidak dapat membaca data dari Google Sheet. Pastikan Code.gs versi JSONP sudah di-deploy.')); };
    script.src = API_URL + '?action=' + aksi + '&callback=' + callback;
    document.body.appendChild(script);
  });
}

async function kirimData(data) {
  const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
  const hasil = await response.json();
  if (!hasil.success) throw new Error(hasil.message || 'Terjadi kesalahan pada server.');
  return hasil;
}

function isiDropdownKosan() {
  const form = $('formPenghuni');
  if (!form || !form.namaKosan) return;
  const sel = form.namaKosan;
  sel.innerHTML = '<option value="">-- Pilih kosan --</option>' + kosan.map(k => `<option value="${escapeHtml(k.namaKosan)}">${escapeHtml(k.namaKosan)}</option>`).join('');
  isiDropdownKamar();
}

// Mengisi dropdown "Nomor kamar" berdasarkan kosan yang dipilih.
// Hanya menampilkan kamar yang KOSONG (belum diisi penghuni aktif).
function isiDropdownKamar() {
  const form = $('formPenghuni');
  if (!form || !form.kamar) return;
  const namaKosan = form.namaKosan ? form.namaKosan.value : '';
  const sel = form.kamar;

  if (!namaKosan) {
    sel.innerHTML = '<option value="">-- Pilih kosan dulu --</option>';
    return;
  }

  const kosanDipilih = kosan.find(k => k.namaKosan === namaKosan);
  const jumlah = kosanDipilih ? Number(kosanDipilih.jumlahKamar) : 0;

// Daftar kamar yang sudah terisi oleh penghuni aktif pada kosan ini (dinormalisasi)
  const terisi = new Set(penghuni.filter(p => p.namaKosan === namaKosan && p.status === 'Aktif').map(p => normKamar(p.kamar)));

  // Saat mengedit, kamar penghuni sekarang harus tetap tersedia (ditandai meski terisi)
  const sedangEditKamar = editId ? normKamar(form.kamar.dataset.kamarSaatIni) : '';

  const opsi = [];
  for (let i = 1; i <= jumlah; i++) {
    const label = String(i).padStart(2, '0');
    const sudahTerisi = terisi.has(label);
    if (sudahTerisi && label !== sedangEditKamar) continue; // sembunyikan kamar yang terisi (kecuali kamar yang sedang diedit)
    opsi.push(`<option value="${label}">Kamar ${label}${sudahTerisi ? ' (kamar ini)' : ''}</option>`);
  }

  sel.innerHTML = opsi.length
    ? '<option value="">-- Pilih kamar --</option>' + opsi.join('')
    : '<option value="">Semua kamar sudah terisi</option>';
}

function renderStatusKamar() {
  const pilih = $('pilihKamarKosan');
  const kontainer = $('statusKamar');
  if (!pilih || !kontainer) return;

  // Tampilkan kosan pertama secara otomatis agar status tidak tampak kosong.
  const nilaiSaatIni = pilih.value;
  if (!kosan.length) {
    pilih.disabled = true;
    pilih.innerHTML = '<option value="">Belum ada data kosan</option>';
    kontainer.innerHTML = '<div class="empty">Belum ada kosan. Tambahkan data kosan terlebih dahulu.</div>';
    return;
  }

  pilih.disabled = false;
  pilih.innerHTML = kosan.map(k => `<option value="${escapeHtml(k.namaKosan)}">${escapeHtml(k.namaKosan)}</option>`).join('');
  pilih.value = kosan.some(k => k.namaKosan === nilaiSaatIni) ? nilaiSaatIni : kosan[0].namaKosan;

  const namaKosan = pilih.value;
  if (!namaKosan) {
    kontainer.innerHTML = '<div class="empty">Pilih kosan untuk melihat status kamar.</div>';
    return;
  }

  const kosanDipilih = kosan.find(k => k.namaKosan === namaKosan);
  const jumlah = kosanDipilih ? Number(kosanDipilih.jumlahKamar) : 0;
  const penghuniKosan = penghuni.filter(p => p.namaKosan === namaKosan && p.status === 'Aktif');

  // Bangun daftar kamar 01..jumlah; tandai yang terisi (dinormalisasi agar cocok dengan A-01, 01, 1)
  const kamarTerisi = new Set(penghuniKosan.map(p => normKamar(p.kamar)));
  const daftar = [];
  for (let i = 1; i <= jumlah; i++) {
    const label = String(i).padStart(2, '0');
    daftar.push({ label, terisi: kamarTerisi.has(label) });
  }

  const terisi = daftar.filter(k => k.terisi).length;
  const kosong = jumlah - terisi;

  kontainer.innerHTML = `
    <div class="status-kamar-ringkasan">
      <div class="sk-item"><span class="sk-dot terisi"></span> Terisi: <strong>${terisi}</strong></div>
      <div class="sk-item"><span class="sk-dot kosong"></span> Kosong: <strong>${kosong}</strong></div>
    </div>
    <div class="status-kamar-grid">
      ${daftar.map(k => `<div class="sk-tile ${k.terisi ? 'terisi' : 'kosong'}">Kamar ${k.label}</div>`).join('')}
    </div>`;
}

function renderKosan() {
  // Tabel Data Kosan (halaman data)
  const dataKosan = $('dataKosan');
  if (dataKosan) {
    dataKosan.innerHTML = kosan.length ? kosan.map(k => {
      const aksi = k.sementara
        ? '<span class="data-sementara">Menunggu sinkronisasi</span>'
        : `<button class="update" onclick="editKosan('${k.id}')">Update</button><button class="delete" onclick="hapusKosan('${k.id}')">Hapus</button>`;
      return `<tr><td>${escapeHtml(k.namaKosan)}</td><td>${k.jumlahKamar} kamar</td><td>${aksi}</td></tr>`;
    }).join('') : '<tr><td colspan="3" class="empty">Belum ada kosan. Tambahkan kosan terlebih dahulu.</td></tr>';
  }

  // Ringkasan kosan (halaman dashboard)
  const ringkasan = $('ringkasanKosan');
  if (ringkasan) {
    ringkasan.innerHTML = kosan.length ? kosan.map(k => {
      const terisi = penghuni.filter(p => p.namaKosan === k.namaKosan && p.status === 'Aktif').length;
      const sisa = Math.max(0, k.jumlahKamar - terisi);
      return `<div class="item"><h3>${escapeHtml(k.namaKosan)}</h3><p>Kamar terisi <strong>${terisi}</strong> / ${k.jumlahKamar}</p><p>Sisa kamar: <strong>${sisa}</strong></p></div>`;
    }).join('') : '<div class="item"><h3>Belum ada kosan</h3><p>Tambahkan kosan untuk melihat ringkasan.</p></div>';
  }

  const totalKosan = $('totalKosan');
  if (totalKosan) totalKosan.textContent = kosan.length;
}

function renderCharts() {
  if (!window.Chart) return;
  const canvasKosan = $('chartKosan');
  const canvasStatus = $('chartStatus');
  const canvasBulan = $('chartBulan');

  // Bar chart: penghuni per kosan
  if (canvasKosan) {
    const labelKosan = kosan.map(k => k.namaKosan);
    const dataKosan = kosan.map(k => penghuni.filter(p => p.namaKosan === k.namaKosan).length);
    if (chartKosan) chartKosan.destroy();
    chartKosan = new Chart(canvasKosan, {
      type: 'bar',
      data: { labels: labelKosan, datasets: [{ label: 'Penghuni', data: dataKosan, backgroundColor: ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#8b5cf6', '#0ea5e9'], borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  // Doughnut chart: status penghuni
  if (canvasStatus) {
    const aktifCount = penghuni.filter(p => p.status === 'Aktif').length;
    const selesaiCount = penghuni.filter(p => p.status === 'Selesai').length;
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(canvasStatus, {
      type: 'doughnut',
      data: { labels: ['Aktif', 'Selesai'], datasets: [{ data: [aktifCount, selesaiCount], backgroundColor: ['#059669', '#dc2626'], borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // Line chart: penghuni masuk per bulan (6 bulan terakhir)
  if (canvasBulan) {
    const bulanList = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bulanList.push(d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }));
    }
    const dataBulan = bulanList.map((b, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return penghuni.filter(p => p.tanggalMasuk && p.tanggalMasuk.startsWith(ymd)).length;
    });
    if (chartBulan) chartBulan.destroy();
    chartBulan = new Chart(canvasBulan, {
      type: 'line',
      data: { labels: bulanList, datasets: [{ label: 'Penghuni masuk', data: dataBulan, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)', fill: true, tension: 0.4, pointBackgroundColor: '#2563eb' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
}

// Penghuni yang masa sewanya habis (jatuh tempo / habis kontrak) <= 7 hari.
const akanJatuhTempo = p => {
  if (p.status !== 'Aktif' || !p.tanggalSelesai) return false;
  const hari = selisihHari(p.tanggalSelesai);
  return hari !== null && hari >= 0 && hari <= 7;
};

function getColumnValue(column, p) {
  if (column === 'kamar') return normKamar(p.kamar);
  if (column === 'tanggalMasuk') return p.tanggalMasuk;
  if (column === 'tanggalSelesai') return p.tanggalSelesai || 'Belum ada';
  if (column === 'durasi') return String(p.durasi);
  return p[column];
}

function getColumnFilterValues(column) {
  const values = new Set(['Semua']);
  const list = penghuni.filter(p => {
    return Object.entries(columnFilters).every(([key, selectedValues]) => {
      if (key === column || !selectedValues || selectedValues.length === 0) return true;
      return selectedValues.includes(String(getColumnValue(key, p)));
    });
  });

  list.forEach(p => {
    const key = getColumnValue(column, p);
    if (key !== undefined && key !== null && key !== '') values.add(String(key));
  });
  return [...values];
}

function renderFilterMenuForColumn(column, searchText = '') {
  const button = document.querySelector(`.filter-trigger[data-column="${column}"]`);
  const menu = button && button.parentElement.querySelector('.filter-menu');
  if (!menu) return;

  const selectedValues = columnFilters[column] || [];
  const activeCount = selectedValues.length;
  const isFiltered = activeCount > 0;
  button.classList.toggle('active', isFiltered);
  button.textContent = isFiltered ? `▼ ${activeCount}` : '⏷';

  const values = getColumnFilterValues(column).filter(value => {
    if (value === 'Semua') return true;
    return String(value).toLowerCase().includes(searchText.toLowerCase());
  });

  const options = values.map(value => {
    const label = value === 'Semua' ? 'Semua' : value;
    const selected = value === 'Semua' ? activeCount === 0 : selectedValues.includes(value);
    return `<button type="button" class="filter-option ${selected ? 'active' : ''}" data-column="${column}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  }).join('');

  const headerActions = `
    <div class="filter-actions">
      <button type="button" class="filter-select-all" data-column="${column}">Pilih semua</button>
      <button type="button" class="filter-clear-all" data-column="${column}">Kosongkan</button>
    </div>
    <div class="filter-search-wrap">
      <input type="text" class="filter-search" data-column="${column}" value="${escapeHtml(searchText)}" placeholder="Cari...">
    </div>
  `;

  menu.innerHTML = `${headerActions}${options}`;
}

function renderColumnFilterMenus() {
  document.querySelectorAll('.filter-trigger').forEach(button => {
    renderFilterMenuForColumn(button.dataset.column, '');
  });
}

function getFilteredPenghuniList() {
  const search = $('search');
  const kata = search ? search.value.toLowerCase() : '';

  return penghuni.filter(p => {
    const columnMatches = Object.entries(columnFilters).every(([column, selectedValues]) => {
      if (!selectedValues || selectedValues.length === 0) return true;
      const target = getColumnValue(column, p);
      return selectedValues.includes(String(target));
    });

    const cocokCari = `${p.nama} ${p.kamar} ${p.namaKosan} ${p.noHp}`.toLowerCase().includes(kata);
    const cocokTempo = !filterTempo || akanJatuhTempo(p);
    return columnMatches && cocokCari && cocokTempo;
  });
}

function render() {
  renderColumnFilterMenus();

  // Dapatkan daftar penghuni yang sudah difilter (digunakan oleh beberapa bagian)
  const list = getFilteredPenghuniList();

  // Tabel penghuni (halaman data)
  const dataPenghuni = $('dataPenghuni');
  if (dataPenghuni) {
    dataPenghuni.innerHTML = list.length ? list.map(p => {
      const jatuh = p.tanggalSelesai || '';
      const hariJatuh = jatuh ? selisihHari(jatuh) : null;
      const mendekati = p.status === 'Aktif' && hariJatuh !== null && hariJatuh >= 0 && hariJatuh <= 7;
      const fotoUrl = p.fotoIdentitas ? normalizeImageUrl(p.fotoIdentitas) : FOTO_PLACEHOLDER;
      const fotoThumb = p.fotoIdentitas ? normalizeImageUrl(p.fotoIdentitas, true) : FOTO_PLACEHOLDER;
      const fotoData = encodeURIComponent(fotoUrl);
      const isSelected = selectedPenghuniIds.has(p.id);
      return `<tr class="${isSelected ? 'row-selected' : ''}"><td class="select-cell"><input type="checkbox" class="select-item" data-id="${escapeHtml(p.id)}" ${isSelected ? 'checked' : ''}></td><td class="foto-cell"><img class="foto-thumb" src="${escapeHtml(fotoThumb)}" alt="Foto identitas ${escapeHtml(p.nama)}" data-image="${fotoData}" data-nama="${escapeHtml(p.nama)}" /></td><td>${escapeHtml(p.nama)}</td><td>${escapeHtml(p.noHp)}</td><td>${escapeHtml(p.kontakNama)}<br><small>${escapeHtml(p.kontakNoHp)}</small></td><td>${escapeHtml(p.namaKosan)}</td><td>${escapeHtml(normKamar(p.kamar))}</td><td>${formatTanggal(p.tanggalMasuk)}</td><td>${p.durasi} bulan</td><td class="${mendekati ? 'tempo-dekat' : ''}">${formatTanggal(jatuh)}</td><td><span class="badge ${p.status === 'Aktif' ? 'aktif' : 'selesai'}">${p.status}</span></td><td><button class="green btn-bayar" data-id="${escapeHtml(p.id)}">Bayar</button></td></tr>`;
    }).join('') : '<tr><td colspan="11" class="empty">' + (filterTempo ? 'Tidak ada penghuni yang akan jatuh tempo.' : 'Belum ada data penghuni.') + '</td></tr>';
    }).join('') : '<tr><td colspan="12" class="empty">' + (filterTempo ? 'Tidak ada penghuni yang akan jatuh tempo.' : 'Belum ada data penghuni.') + '</td></tr>';
  }

  // Kartu statistik (halaman dashboard)
  const aktif = penghuni.filter(p => p.status === 'Aktif');
  const totalEl = $('total');
  const aktifEl = $('aktif');
  const tempoEl = $('tempo');
  if (totalEl) totalEl.textContent = penghuni.length;
  if (aktifEl) aktifEl.textContent = aktif.length;
  if (tempoEl) tempoEl.textContent = aktif.filter(akanJatuhTempo).length;

  // Tandai kartu jatuh tempo aktif saat filter sedang berjalan.
  const kartu = $('kartuTempo');
  if (kartu) kartu.classList.toggle('aktif-kartu', filterTempo);

  updateBatchActions(list);
  renderKosan();
  renderStatusKamar();
  renderCharts();
  renderPaymentsPage();
}

function updateBatchActions(visibleList = []) {
  const selectedCountElement = $('selectedCount');
  const clearBtn = $('btnClearSelection');
  const updateBtn = $('btnUpdateSelected');
  const deleteBtn = $('btnDeleteSelected');
  const selectAll = $('selectAllPenghuni');
  const selectedCount = selectedPenghuniIds.size;

  if (selectedCountElement) selectedCountElement.textContent = `${selectedCount} terpilih`;
  if (clearBtn) clearBtn.disabled = selectedCount === 0;
  if (updateBtn) updateBtn.disabled = selectedCount !== 1;
  if (deleteBtn) deleteBtn.disabled = selectedCount === 0;
  const topRight = $('topRightActions');
  if (topRight) topRight.classList.toggle('hidden', selectedCount === 0);

  if (selectAll) {
    const visibleIds = visibleList.map(p => p.id);
    const visibleSelected = visibleIds.filter(id => selectedPenghuniIds.has(id));
    selectAll.checked = visibleIds.length > 0 && visibleSelected.length === visibleIds.length;
    selectAll.indeterminate = visibleSelected.length > 0 && visibleSelected.length < visibleIds.length;
  }
}

async function loadData() {
  const hasilPenghuni = await ambilDataJSONP('list');
  if (!hasilPenghuni || hasilPenghuni.success !== true || !Array.isArray(hasilPenghuni.data)) {
    throw new Error((hasilPenghuni && hasilPenghuni.message) || 'Data penghuni tidak dapat dibaca.');
  }
  penghuni = hasilPenghuni.data;

  try {
    const hasilKosan = await ambilDataJSONP('listkosan');
    if (!hasilKosan || hasilKosan.success !== true || !Array.isArray(hasilKosan.data)) {
      throw new Error((hasilKosan && hasilKosan.message) || 'Data kosan tidak valid.');
    }
    kosan = hasilKosan.data;
  } catch (error) {
    // Tetap tampilkan kosan lama bila deployment Apps Script belum diperbarui.
    console.warn('Data Kosan tidak dapat dimuat; menggunakan data Penghuni sebagai cadangan.', error);
    kosan = buatKosanDariPenghuni();
  }

  if (!kosan.length && penghuni.length) kosan = buatKosanDariPenghuni();
  isiDropdownKosan();
  render();
}

function buatKosanDariPenghuni() {
  const hasil = new Map();
  penghuni.forEach(p => {
    const nama = String(p.namaKosan || '').trim();
    if (!nama) return;

    const kunci = nama.toLocaleLowerCase('id-ID');
    const jumlahKamar = Math.max(1, Number(normKamar(p.kamar)) || 1);
    const lama = hasil.get(kunci);
    hasil.set(kunci, {
      id: `sementara-${encodeURIComponent(kunci)}`,
      namaKosan: lama ? lama.namaKosan : nama,
      jumlahKamar: Math.max(lama ? lama.jumlahKamar : 0, jumlahKamar),
      sementara: true
    });
  });
  return Array.from(hasil.values());
}

function normalizeImageUrl(url, isThumb = false) {
  if (!url) return FOTO_PLACEHOLDER;
  let normalized = url;
  try {
    normalized = decodeURIComponent(url);
  } catch (err) {
    normalized = url;
  }

  let id = '';
  if (normalized.startsWith('data:image/')) {
    return normalized;
  }

  const driveViewMatch = normalized.match(/([?&])id=([a-zA-Z0-9_-]+)/);
  if (driveViewMatch) {
    id = driveViewMatch[2];
  } else {
    const fileMatch = normalized.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) id = fileMatch[1];
  }

  if (id) {
    if (isThumb) {
      return `https://drive.google.com/thumbnail?authuser=0&sz=w160&id=${id}`;
    }
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  if (normalized.startsWith('https://drive.google.com/uc?export=download&id=')) {
    normalized = normalized.replace('uc?export=download&id=', 'uc?export=view&id=');
  }

  return normalized;
}

function setFotoPreview(url, nama = '') {
  const preview = $('fotoPreview');
  const hidden = $('fotoIdentitasHidden');
  const fotoInput = $('fotoIdentitasInput');
  const hapusFoto = $('hapusFotoHidden');

  if (hidden) hidden.value = url || '';
  if (hapusFoto) hapusFoto.value = '0';
  if (preview) {
    preview.src = url || '';
    preview.classList.toggle('aktif', Boolean(url));
  }
  if (fotoInput && !url) fotoInput.value = '';
  if (nama && $('fotoZoomNama')) $('fotoZoomNama').textContent = nama;
}

function bukaFotoIdentitas(url, nama = '') {
  const zoom = $('fotoZoom');
  const downloadBtn = $('fotoDownloadBtn');
  if (!zoom) return;

  const imageUrl = normalizeImageUrl(url || FOTO_PLACEHOLDER);
  zoom.src = imageUrl;
  if ($('fotoZoomNama')) $('fotoZoomNama').textContent = nama || 'Foto identitas';

  if (downloadBtn) {
    downloadBtn.href = imageUrl === FOTO_PLACEHOLDER ? '#' : imageUrl;
    downloadBtn.style.display = imageUrl === FOTO_PLACEHOLDER ? 'none' : 'inline-flex';
  }

  bukaModal('modalFoto');
}

function edit(id) {
const p = penghuni.find(x => x.id === id);
  if (!p) return;
  editId = id;
  const f = $('formPenghuni');
  f.nama.value = p.nama;
  f.noHp.value = p.noHp;
  f.namaKosan.value = p.namaKosan;
  // Simpan kamar yang sedang diedit agar tetap tampil di dropdown kamar
  f.kamar.dataset.kamarSaatIni = p.kamar;
  isiDropdownKamar();
  f.kamar.value = p.kamar;
  f.tanggalMasuk.value = p.tanggalMasuk;
  f.durasi.value = p.durasi;
  f.status.value = p.status;
  f.kontakNama.value = p.kontakNama;
  f.kontakNoHp.value = p.kontakNoHp;
  const hapusFoto = $('hapusFotoHidden');
  if (hapusFoto) hapusFoto.value = '0';
  setFotoPreview(p.fotoIdentitas || '', p.nama);
  $('judulForm').textContent = 'Update Data Penghuni';
  $('btnSimpan').textContent = 'Simpan Perubahan';
  $('btnReset').textContent = 'Batal';
  if (editKosanId) batalEditKosan();
  setStatus($('status'), 'Sedang mengedit data. Ubah lalu klik Simpan Perubahan.');
  bukaModal('modalPenghuni');
}

function batalEdit() {
  editId = null;
  const f = $('formPenghuni');
  if (!f) return;
  f.reset();
  f.durasi.value = 12;
  const hapusFoto = $('hapusFotoHidden');
  if (hapusFoto) hapusFoto.value = '0';
  setFotoPreview('', '');
  $('judulForm').textContent = 'Tambah Penghuni';
  $('btnSimpan').textContent = 'Simpan Data';
  $('btnReset').textContent = 'Bersihkan';
  setStatus($('status'), '');
  tutupModal('modalPenghuni');
}

function editKosan(id) {
  const k = kosan.find(x => x.id === id);
  if (!k) return;
  editKosanId = id;
  const f = $('formKosan');
  f.namaKosan.value = k.namaKosan;
  f.jumlahKamar.value = k.jumlahKamar;
  $('judulKosan').textContent = 'Update Kosan';
  $('btnSimpanKosan').textContent = 'Simpan Perubahan';
  $('btnResetKosan').textContent = 'Batal';
  if (editId) batalEdit();
  setStatus($('statusKosan'), 'Sedang mengedit kosan. Ubah lalu klik Simpan Perubahan.');
  bukaModal('modalKosan');
}

function batalEditKosan() {
  editKosanId = null;
  const f = $('formKosan');
  if (!f) return;
  f.reset();
  $('judulKosan').textContent = 'Tambah Kosan';
  $('btnSimpanKosan').textContent = 'Simpan Kosan';
  $('btnResetKosan').textContent = 'Bersihkan';
  setStatus($('statusKosan'), '');
  tutupModal('modalKosan');
}

// Tombol tambah membuka modal (halaman data)
const btnTambahKosan = $('btnTambahKosan');
if (btnTambahKosan) btnTambahKosan.addEventListener('click', () => { batalEditKosan(); bukaModal('modalKosan'); });

const btnTambahPenghuni = $('btnTambahPenghuni');
if (btnTambahPenghuni) btnTambahPenghuni.addEventListener('click', () => { batalEdit(); bukaModal('modalPenghuni'); });

// Tombol close pada modal
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    if (modalId === 'modalKosan') batalEditKosan();
    if (modalId === 'modalPenghuni') batalEdit();
    tutupModal(modalId);
  });
});

// Klik di luar modal menutupnya
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target === ov) {
      const modalId = ov.id;
      if (modalId === 'modalKosan') batalEditKosan();
      if (modalId === 'modalPenghuni') batalEdit();
      tutupModal(modalId);
    }
  });
});

const formPenghuni = $('formPenghuni');
if (formPenghuni) formPenghuni.addEventListener('submit', async e => {
  e.preventDefault();
  const fotoHidden = $('fotoIdentitasHidden');
  const hapusFoto = $('hapusFotoHidden');
  const data = Object.fromEntries(new FormData(e.target));
  data.fotoIdentitas = fotoHidden ? fotoHidden.value : '';
  data.hapusFoto = hapusFoto ? hapusFoto.value : '0';
  const mode = editId ? 'update' : 'add';
  if (editId) data.id = editId;
  data.action = mode;
  console.log('DEBUG: Mengirim form dengan fotoIdentitas:', data.fotoIdentitas ? '(ada, panjang: ' + data.fotoIdentitas.length + ' karakter)' : '(KOSONG)');
  try {
    setStatus($('status'), mode === 'update' ? 'Menyimpan perubahan ke Google Sheet...' : 'Menyimpan ke Google Sheet...');
    const result = await kirimData(data);
    console.log('DEBUG: Response dari server:', result);
    await loadData();
    if (mode === 'update') { batalEdit(); setStatus($('status'), 'Data berhasil diperbarui.'); }
    else { e.target.reset(); e.target.durasi.value = 12; setFotoPreview('', ''); setStatus($('status'), 'Data berhasil tersimpan.'); }
    tutupModal('modalPenghuni');
  }
  catch (error) { setStatus($('status'), 'Gagal: ' + error.message, true); }
});

const btnReset = $('btnReset');
if (btnReset) btnReset.addEventListener('click', batalEdit);

const fotoInput = $('fotoIdentitasInput');
if (fotoInput) {
  fotoInput.addEventListener('change', () => {
    const file = fotoInput.files && fotoInput.files[0];
    if (!file) {
      setFotoPreview('', '');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const hapusFoto = $('hapusFotoHidden');
      if (hapusFoto) hapusFoto.value = '0';
      setFotoPreview(String(reader.result || ''), '');
    };
    reader.readAsDataURL(file);
  });
}

const btnHapusFoto = $('btnHapusFoto');
if (btnHapusFoto) {
  btnHapusFoto.addEventListener('click', () => {
    const hapusFoto = $('hapusFotoHidden');
    if (hapusFoto) hapusFoto.value = '1';
    setFotoPreview('', '');
  });
}

// Saat kosan dipilih pada form penghuni, isi ulang dropdown kamar
const formPenghuni2 = $('formPenghuni');
if (formPenghuni2 && formPenghuni2.namaKosan) {
  formPenghuni2.namaKosan.addEventListener('change', isiDropdownKamar);
}

const formKosan = $('formKosan');
if (formKosan) formKosan.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const mode = editKosanId ? 'updateKosan' : 'addKosan';
  if (editKosanId) data.id = editKosanId;
  data.action = mode;
  try {
    setStatus($('statusKosan'), 'Menyimpan kosan ke Google Sheet...');
    await kirimData(data);
    await loadData();
    if (mode === 'updateKosan') { batalEditKosan(); setStatus($('statusKosan'), 'Kosan berhasil diperbarui.'); }
    else { e.target.reset(); setStatus($('statusKosan'), 'Kosan berhasil ditambahkan.'); }
    tutupModal('modalKosan');
  }
  catch (error) { setStatus($('statusKosan'), 'Gagal: ' + error.message, true); }
});

const btnResetKosan = $('btnResetKosan');
if (btnResetKosan) btnResetKosan.addEventListener('click', batalEditKosan);

const search = $('search');
if (search) search.addEventListener('input', render);

const btnResetFilter = $('btnResetFilter');
if (btnResetFilter) btnResetFilter.addEventListener('click', () => {
  Object.keys(columnFilters).forEach(key => columnFilters[key] = []);
  filterTempo = false;
  if (search) search.value = '';
  render();
});

const btnUpdateSelected = $('btnUpdateSelected');
if (btnUpdateSelected) btnUpdateSelected.addEventListener('click', () => {
  if (selectedPenghuniIds.size !== 1) return;
  edit(Array.from(selectedPenghuniIds)[0]);
});

const btnDeleteSelected = $('btnDeleteSelected');
if (btnDeleteSelected) btnDeleteSelected.addEventListener('click', async () => {
  const ids = Array.from(selectedPenghuniIds);
  if (!ids.length) return;
  if (!confirm(`Hapus ${ids.length} penghuni terpilih?`)) return;
  await deleteMultiple(ids);
});

const btnClearSelection = $('btnClearSelection');
if (btnClearSelection) btnClearSelection.addEventListener('click', () => {
  selectedPenghuniIds.clear();
  document.querySelectorAll('.select-item').forEach(item => item.checked = false);
  const selectAll = $('selectAllPenghuni');
  if (selectAll) selectAll.checked = false;
  updateBatchActions(getFilteredPenghuniList());
});

const btnExportExcel = $('btnExportExcel');
if (btnExportExcel) btnExportExcel.addEventListener('click', () => {
  if (!window.XLSX) {
    alert('Library Excel belum siap. Silakan muat ulang halaman.');
    return;
  }

  const list = getFilteredPenghuniList();
  if (!list.length) {
    alert('Tidak ada data penghuni yang bisa diekspor.');
    return;
  }

  const rows = list.map(p => ({
    Nama: p.nama,
    'No. HP': p.noHp,
    'Kontak Darurat': p.kontakNama,
    'No. HP Kontak Darurat': p.kontakNoHp,
    Kosan: p.namaKosan,
    Kamar: normKamar(p.kamar),
    'Tanggal Masuk': formatTanggal(p.tanggalMasuk),
    Durasi: `${p.durasi} bulan`,
    'Jatuh Tempo': formatTanggal(p.tanggalSelesai || ''),
    Status: p.status
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Penghuni');
  XLSX.writeFile(workbook, 'data-penghuni.xlsx');
  alert('File Excel berhasil diekspor.');
});

function openFilterMenu(trigger) {
  const menu = trigger.parentElement.querySelector('.filter-menu');
  if (!menu) return;

  const rect = trigger.getBoundingClientRect();
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
  menu.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 240)}px`;
  menu.style.width = '180px';

  document.querySelectorAll('.filter-menu').forEach(item => {
    if (item !== menu) item.classList.add('hidden');
  });
  menu.classList.remove('hidden');
}

document.addEventListener('click', event => {
  const fotoThumb = event.target.closest('.foto-thumb');
  if (fotoThumb) {
    const imageValue = fotoThumb.dataset.image || encodeURIComponent(FOTO_PLACEHOLDER);
    const imageUrl = decodeURIComponent(imageValue);
    bukaFotoIdentitas(imageUrl, fotoThumb.dataset.nama || 'Foto identitas');
    return;
  }

  const selectItem = event.target.closest('.select-item');
  if (selectItem) {
    const id = selectItem.dataset.id;
    if (id) {
      if (selectItem.checked) selectedPenghuniIds.add(id);
      else selectedPenghuniIds.delete(id);
      updateBatchActions(getFilteredPenghuniList());
    }
    return;
  }

  const selectAll = event.target.closest('#selectAllPenghuni');
  if (selectAll) {
    const checked = selectAll.checked;
    document.querySelectorAll('.select-item').forEach(checkbox => {
      const id = checkbox.dataset.id;
      if (!id) return;
      checkbox.checked = checked;
      if (checked) selectedPenghuniIds.add(id);
      else selectedPenghuniIds.delete(id);
    });
    updateBatchActions(getFilteredPenghuniList());
    return;
  }

  const clearSelection = event.target.closest('#btnClearSelection');
  if (clearSelection) {
    selectedPenghuniIds.clear();
    document.querySelectorAll('.select-item').forEach(item => item.checked = false);
    if ($('selectAllPenghuni')) $('selectAllPenghuni').checked = false;
    updateBatchActions(getFilteredPenghuniList());
    return;
  }

  const updateSelected = event.target.closest('#btnUpdateSelected');
  if (updateSelected) {
    if (selectedPenghuniIds.size !== 1) return;
    const id = Array.from(selectedPenghuniIds)[0];
    edit(id);
    return;
  }

  const deleteSelected = event.target.closest('#btnDeleteSelected');
  if (deleteSelected) {
    const ids = Array.from(selectedPenghuniIds);
    if (!ids.length) return;
    if (!confirm(`Hapus ${ids.length} penghuni terpilih?`)) return;
    deleteMultiple(ids);
    return;
  }

  const bayarBtn = event.target.closest('.btn-bayar');
  if (bayarBtn) {
    const id = bayarBtn.dataset.id;
    if (id) recordPayment(id);
    return;
  }

  const trigger = event.target.closest('.filter-trigger');
  if (trigger) {
    const menu = trigger.parentElement.querySelector('.filter-menu');
    const willOpen = menu && menu.classList.contains('hidden');
    if (willOpen) {
      openFilterMenu(trigger);
    } else {
      menu.classList.add('hidden');
    }
    return;
  }

  const filterSearch = event.target.closest('.filter-search');
  if (filterSearch) {
    filterSearch.focus();
    return;
  }

  const clearAction = event.target.closest('.filter-clear');
  if (clearAction) {
    const column = clearAction.dataset.column;
    columnFilters[column] = [];
    render();
    return;
  }

  const clearAllAction = event.target.closest('.filter-clear-all');
  if (clearAllAction) {
    const column = clearAllAction.dataset.column;
    columnFilters[column] = [];
    render();
    return;
  }

  const selectAllAction = event.target.closest('.filter-select-all');
  if (selectAllAction) {
    const column = selectAllAction.dataset.column;
    const values = getColumnFilterValues(column).filter(value => value !== 'Semua');
    columnFilters[column] = values;
    render();
    return;
  }

  const option = event.target.closest('.filter-option');
  if (option) {
    const column = option.dataset.column;
    const value = option.dataset.value;
    if (value === 'Semua') {
      columnFilters[column] = [];
    } else {
      const current = columnFilters[column] || [];
      const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
      columnFilters[column] = next;
    }
    render();
    return;
  }

  if (!event.target.closest('.filter-menu') && !event.target.closest('.filter-trigger')) {
    document.querySelectorAll('.filter-menu').forEach(item => item.classList.add('hidden'));
  }
});

document.addEventListener('input', event => {
  const searchInput = event.target.closest('.filter-search');
  if (!searchInput) return;
  renderFilterMenuForColumn(searchInput.dataset.column, searchInput.value);
});

// Pilih kosan pada panel Status Kamar
const pilihKamarKosan = $('pilihKamarKosan');
if (pilihKamarKosan) pilihKamarKosan.addEventListener('change', renderStatusKamar);

// Klik kartu "Jatuh tempo" (halaman dashboard) untuk membuka halaman data dengan filter jatuh tempo.
const kartuTempo = $('kartuTempo');
if (kartuTempo) kartuTempo.addEventListener('click', () => {
  filterTempo = true;
  sessionStorage.setItem('filterTempo', '1');
  location.href = 'data.html';
});

async function hapus(id) {
  if (!confirm('Hapus data penghuni ini?')) return;
  try {
    await kirimData({ action: 'delete', id });
    await loadData();
    setStatus($('status'), 'Data berhasil dihapus.');
  }
  catch (error) { setStatus($('status'), 'Gagal: ' + error.message, true); }
}

async function hapusKosan(id) {
  if (!confirm('Hapus kosan ini?')) return;
  try {
    await kirimData({ action: 'deleteKosan', id });
    await loadData();
    setStatus($('statusKosan'), 'Kosan berhasil dihapus.');
  }
  catch (error) { setStatus($('statusKosan'), 'Gagal: ' + error.message, true); }
}

async function deleteMultiple(ids) {
  try {
    for (const id of ids) {
      await kirimData({ action: 'delete', id });
    }
    selectedPenghuniIds.clear();
    await loadData();
    setStatus($('status'), `${ids.length} penghuni berhasil dihapus.`);
  } catch (error) {
    setStatus($('status'), 'Gagal menghapus beberapa data: ' + error.message, true);
  }
}

/* ===== Login & Logout ===== */
function showLogin() {
  $('loginScreen').style.display = 'flex';
  $('dashboard').style.display = 'none';
}

function showDashboard() {
  $('loginScreen').style.display = 'none';
  $('dashboard').style.display = 'block';
}

function cekSesi() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

const formLogin = $('formLogin');
if (formLogin) formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const statusLogin = $('statusLogin');
  if (data.username === LOGIN_USER && data.password === LOGIN_PASS) {
    sessionStorage.setItem(SESSION_KEY, '1');
    showDashboard();
    setStatus(statusLogin, '');
    e.target.reset();
    try { await loadData(); }
    catch (error) { setStatus($('status'), 'Gagal memuat dashboard: ' + error.message, true); }
  } else {
    setStatus(statusLogin, 'Username atau password salah.', true);
  }
});

const btnLogout = $('btnLogout');
if (btnLogout) btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

// Ambil filter jatuh tempo dari sesi (saat berpindah dari halaman dashboard).
if (cekSesi() && sessionStorage.getItem('filterTempo') === '1') {
  sessionStorage.removeItem('filterTempo');
  filterTempo = true;
}

// Saat halaman dimuat: tampilkan dashboard jika sudah login, selain itu tampilkan layar login.
if (cekSesi()) {
  showDashboard();
  loadData().catch(error => setStatus($('status'), 'Gagal memuat dashboard: ' + error.message, true));
} else {
  showLogin();
}

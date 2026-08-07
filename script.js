// URL Web App Apps Script. Jangan tambahkan action di sini.
const API_URL = 'https://script.google.com/macros/s/AKfycby8dhKxMKqdAJ-ccTDOPvya310xBKLSeLlJfUYXRXVL_5seTfNLTBI-l5i9v6eI92eRtg/exec';

// Kredensial login (tanpa backend). Ubah sesuai keinginan.
const LOGIN_USER = 'admin';
const LOGIN_PASS = 'admin123';
const SESSION_KEY = 'diva_kosan_login';

let penghuni = [];
let kosan = [];
let filterTempo = false;
let editId = null;
let editKosanId = null;
let chartKosan = null, chartStatus = null, chartBulan = null;

const $ = id => document.getElementById(id);

const formatTanggal = value => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00:00')) : '-';

const selisihHari = value => Math.ceil((new Date(value + 'T00:00:00') - new Date()) / 86400000);

// Hitung tanggal jatuh tempo bulanan: jatuh tempo jatuh pada tanggal yang sama dengan tanggal masuk.
// Contoh: masuk 12 Juli -> jatuh tempo bulanan setiap tanggal 12.
const hitungJatuhTempo = (tanggalMasuk, tanggalSelesai) => {
  if (!tanggalMasuk) return '';
  const mulai = new Date(tanggalMasuk + 'T00:00:00');
  const dayMasuk = mulai.getDate();
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Kandidat jatuh tempo bulan ini (hari = tanggal masuk, menyesuaikan akhir bulan).
  const lastDayThis = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let t = new Date(today.getFullYear(), today.getMonth(), Math.min(dayMasuk, lastDayThis));

  // Jika sudah lewat, ambil bulan berikutnya.
  if (t < now) {
    const lastDayNext = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
    t = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(dayMasuk, lastDayNext));
  }

  // Jangan melewati tanggal selesai sewa.
  if (tanggalSelesai) {
    const selesai = new Date(tanggalSelesai + 'T00:00:00');
    if (t > selesai) t = selesai;
  }

  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const setStatus = (el, teks, error = false) => { if (el) { el.textContent = teks; el.className = error ? 'error' : ''; } };

const escapeHtml = teks => { const el = document.createElement('div'); el.textContent = teks || ''; return el.innerHTML; };

/* ===== Helper Modal ===== */
function bukaModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('terbuka');
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
}

function renderKosan() {
  // Tabel Data Kosan (halaman data)
  const dataKosan = $('dataKosan');
  if (dataKosan) {
    dataKosan.innerHTML = kosan.length ? kosan.map(k => `<tr><td>${escapeHtml(k.namaKosan)}</td><td>${k.jumlahKamar} kamar</td><td><button class="update" onclick="editKosan('${k.id}')">Update</button><button class="delete" onclick="hapusKosan('${k.id}')">Hapus</button></td></tr>`).join('') : '<tr><td colspan="3" class="empty">Belum ada kosan. Tambahkan kosan terlebih dahulu.</td></tr>';
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

// Penghuni yang jatuh temponya <= 7 hari (sesuai kartu statistik).
const akanJatuhTempo = p => {
  const j = hitungJatuhTempo(p.tanggalMasuk, p.tanggalSelesai);
  const hari = j ? selisihHari(j) : null;
  return p.status === 'Aktif' && hari !== null && hari >= 0 && hari <= 7;
};

function render() {
  // Tabel penghuni (halaman data)
  const dataPenghuni = $('dataPenghuni');
  const search = $('search');
  if (dataPenghuni) {
    const kata = search ? search.value.toLowerCase() : '';
    let list = penghuni.filter(p => `${p.nama} ${p.kamar} ${p.namaKosan}`.toLowerCase().includes(kata));
    if (filterTempo) list = list.filter(akanJatuhTempo);
    dataPenghuni.innerHTML = list.length ? list.map(p => {
      const jatuh = hitungJatuhTempo(p.tanggalMasuk, p.tanggalSelesai);
      const hariJatuh = jatuh ? selisihHari(jatuh) : null;
      const mendekati = p.status === 'Aktif' && hariJatuh !== null && hariJatuh >= 0 && hariJatuh <= 7;
      return `<tr><td>${escapeHtml(p.nama)}</td><td>${escapeHtml(p.noHp)}</td><td>${escapeHtml(p.kontakNama)}<br><small>${escapeHtml(p.kontakNoHp)}</small></td><td>${escapeHtml(p.namaKosan)}</td><td>${escapeHtml(p.kamar)}</td><td>${formatTanggal(p.tanggalMasuk)}</td><td>${p.durasi} bulan</td><td class="${mendekati ? 'tempo-dekat' : ''}">${formatTanggal(jatuh)}</td><td><span class="badge ${p.status === 'Aktif' ? 'aktif' : 'selesai'}">${p.status}</span></td><td><button class="update" onclick="edit('${p.id}')">Update</button><button class="delete" onclick="hapus('${p.id}')">Hapus</button></td></tr>`;
    }).join('') : '<tr><td colspan="10" class="empty">' + (filterTempo ? 'Tidak ada penghuni yang akan jatuh tempo.' : 'Belum ada data penghuni.') + '</td></tr>';
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

  renderKosan();
  renderCharts();
}

async function loadData() {
  const hasilPenghuni = await ambilDataJSONP('list');
  const hasilKosan = await ambilDataJSONP('listKosan');
  penghuni = hasilPenghuni.data || [];
  kosan = hasilKosan.data || [];
  isiDropdownKosan();
  render();
}

function edit(id) {
  const p = penghuni.find(x => x.id === id);
  if (!p) return;
  editId = id;
  const f = $('formPenghuni');
  f.nama.value = p.nama;
  f.noHp.value = p.noHp;
  f.namaKosan.value = p.namaKosan;
  f.kamar.value = p.kamar;
  f.tanggalMasuk.value = p.tanggalMasuk;
  f.durasi.value = p.durasi;
  f.status.value = p.status;
  f.kontakNama.value = p.kontakNama;
  f.kontakNoHp.value = p.kontakNoHp;
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
  const data = Object.fromEntries(new FormData(e.target));
  const mode = editId ? 'update' : 'add';
  if (editId) data.id = editId;
  data.action = mode;
  try {
    setStatus($('status'), mode === 'update' ? 'Menyimpan perubahan ke Google Sheet...' : 'Menyimpan ke Google Sheet...');
    await kirimData(data);
    await loadData();
    if (mode === 'update') { batalEdit(); setStatus($('status'), 'Data berhasil diperbarui.'); }
    else { e.target.reset(); e.target.durasi.value = 12; setStatus($('status'), 'Data berhasil tersimpan.'); }
    tutupModal('modalPenghuni');
  }
  catch (error) { setStatus($('status'), 'Gagal: ' + error.message, true); }
});

const btnReset = $('btnReset');
if (btnReset) btnReset.addEventListener('click', batalEdit);

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

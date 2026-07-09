// ============================================================
// FinanceMe — Google Apps Script Backend
// Paste seluruh kode ini ke Google Apps Script Editor
// Deploy sebagai: Web App | Execute as: Me | Access: Anyone
// ============================================================

const SHEET_TRANSAKSI  = 'Transaksi';
const SHEET_KATEGORI   = 'Kategori';
const SHEET_BUDGET     = 'Budget';
const SHEET_PENGATURAN = 'Pengaturan';
const SHEET_HABITS     = 'Habits';
const SHEET_HABIT_LOGS = 'HabitLogs';
const SHEET_AKUN       = 'Akun';
const SHEET_SCOS_LOGS  = 'SCOSLogs';

const HEADERS = {
  Transaksi:  ['ID', 'Tanggal', 'Keterangan', 'Kategori', 'Jenis', 'Jumlah', 'Catatan', 'Dibuat', 'AkunAsal', 'AkunTujuan'],
  Kategori:   ['ID', 'Nama', 'Jenis', 'Icon', 'Warna'],
  Budget:     ['ID', 'Kategori', 'Bulan', 'Limit'],
  Pengaturan: ['Key', 'Value'],
  Habits:     ['ID', 'Nama', 'Tipe', 'Target', 'Frekuensi', 'Waktu', 'Ikon', 'Dibuat'],
  HabitLogs:  ['ID', 'HabitID', 'Tanggal', 'Value'],
  Akun:       ['ID', 'Nama', 'Jenis', 'SaldoAwal', 'Ikon', 'Warna'],
  SCOSLogs:   ['ID', 'Tanggal', 'Stress', 'Criticism', 'Urge', 'Presence', 'Outcome', 'SelfRespect', 'Notes']
};

const DEFAULT_KATEGORI = [
  { id: 'KAT-001', nama: 'Gaji',              jenis: 'Pemasukan',   icon: '💼', warna: '#10b981' },
  { id: 'KAT-002', nama: 'Freelance',          jenis: 'Pemasukan',   icon: '💻', warna: '#3b82f6' },
  { id: 'KAT-003', nama: 'Investasi',          jenis: 'Pemasukan',   icon: '📈', warna: '#8b5cf6' },
  { id: 'KAT-004', nama: 'Bonus',              jenis: 'Pemasukan',   icon: '🎁', warna: '#f59e0b' },
  { id: 'KAT-005', nama: 'Hadiah',             jenis: 'Pemasukan',   icon: '🎀', warna: '#ec4899' },
  { id: 'KAT-006', nama: 'Lainnya (Masuk)',    jenis: 'Pemasukan',   icon: '➕', warna: '#6b7280' },
  { id: 'KAT-007', nama: 'Makan & Minum',      jenis: 'Pengeluaran', icon: '🍽️', warna: '#ef4444' },
  { id: 'KAT-008', nama: 'Transport',          jenis: 'Pengeluaran', icon: '🚗', warna: '#f97316' },
  { id: 'KAT-009', nama: 'Belanja',            jenis: 'Pengeluaran', icon: '🛒', warna: '#eab308' },
  { id: 'KAT-010', nama: 'Tagihan & Utilitas', jenis: 'Pengeluaran', icon: '🧾', warna: '#14b8a6' },
  { id: 'KAT-011', nama: 'Kesehatan',          jenis: 'Pengeluaran', icon: '🏥', warna: '#06b6d4' },
  { id: 'KAT-012', nama: 'Hiburan',            jenis: 'Pengeluaran', icon: '🎮', warna: '#a855f7' },
  { id: 'KAT-013', nama: 'Pendidikan',         jenis: 'Pengeluaran', icon: '📚', warna: '#3b82f6' },
  { id: 'KAT-014', nama: 'Tabungan',           jenis: 'Pengeluaran', icon: '🏦', warna: '#10b981' },
  { id: 'KAT-015', nama: 'Lainnya (Keluar)',   jenis: 'Pengeluaran', icon: '➖', warna: '#6b7280' },
];

// ─── ENTRY POINTS ──────────────────────────────────────────
function doGet(e) {
  const params   = e.parameter;
  const callback = params.callback; // JSONP support

  let result;
  try {
    ensureSheetsExist();
    const action = params.action;

    switch (action) {
      case 'getTransaksi':    result = getTransaksi(params);    break;
      case 'addTransaksi':    result = addTransaksi(params);    break;
      case 'updateTransaksi': result = updateTransaksi(params); break;
      case 'deleteTransaksi': result = deleteTransaksi(params); break;
      case 'getKategori':    result = getKategori();            break;
      case 'addKategori':    result = addKategori(params);      break;
      case 'updateKategori': result = updateKategori(params);   break;
      case 'deleteKategori': result = deleteKategori(params);   break;
      case 'getBudget':    result = getBudget(params);          break;
      case 'setBudget':    result = setBudget(params);          break;
      case 'deleteBudget': result = deleteBudget(params);       break;
      case 'getPengaturan':  result = getPengaturan();          break;
      case 'savePengaturan': result = savePengaturan(params);   break;
      case 'getHabits':      result = getHabits();              break;
      case 'addHabit':       result = addHabit(params);         break;
      case 'updateHabit':    result = updateHabit(params);      break;
      case 'deleteHabit':    result = deleteHabit(params);      break;
      case 'getHabitLogs':   result = getHabitLogs(params);     break;
      case 'toggleHabitLog': result = toggleHabitLog(params);   break;
      case 'getAkun':        result = getAkun();                break;
      case 'addAkun':        result = addAkun(params);          break;
      case 'updateAkun':     result = updateAkun(params);       break;
      case 'deleteAkun':     result = deleteAkun(params);       break;
      case 'getSCOS':        result = getSCOS(params);          break;
      case 'addSCOS':        result = addSCOS(params);          break;
      case 'ping': result = { message: 'pong', ts: new Date().toISOString() }; break;
      case undefined: case null: case '':
        result = { app:'FinanceMe API', status:'running', version:'2.0.0',
                   message:'API berjalan normal!', ts: new Date().toISOString() };
        break;
      default: throw new Error('Action tidak dikenal: ' + action);
    }

    const payload = JSON.stringify({ success: true, data: result });
    const out = ContentService.createTextOutput();
    if (callback) {
      out.setContent(callback + '(' + payload + ')');
      out.setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      out.setContent(payload);
      out.setMimeType(ContentService.MimeType.JSON);
    }
    return out;

  } catch (err) {
    const payload = JSON.stringify({ success: false, error: err.message });
    const out = ContentService.createTextOutput();
    if (callback) {
      out.setContent(callback + '(' + payload + ')');
      out.setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      out.setContent(payload);
      out.setMimeType(ContentService.MimeType.JSON);
    }
    return out;
  }
}

function doPost(e) {
  // doPost tetap ada untuk fallback, tapi JSONP via doGet lebih andal
  let params;
  try { params = JSON.parse(e.postData.contents); }
  catch (_) { params = e.parameter; }
  return doGet({ parameter: params });
}

function handleAction(params) {
  // Legacy wrapper — tidak dipakai lagi, doGet menangani langsung
  return doGet({ parameter: params });
}


// ─── SHEET INITIALIZATION ───────────────────────────────────
function ensureSheetsExist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(HEADERS).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      const hdrs = HEADERS[name];
      const hdrRange = sheet.getRange(1, 1, 1, hdrs.length);
      hdrRange.setValues([hdrs]);
      hdrRange.setFontWeight('bold');
      hdrRange.setBackground('#1e293b');
      hdrRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, hdrs.length, 160);

      if (name === SHEET_KATEGORI) {
        const rows = DEFAULT_KATEGORI.map(k => [k.id, k.nama, k.jenis, k.icon, k.warna]);
        sheet.getRange(2, 1, rows.length, 5).setValues(rows);
      }
    }
  });
}

// ─── HELPERS ────────────────────────────────────────────────
function generateId(prefix) {
  const date = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + '-' + date + '-' + rand;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0].map(function(h) { return h.toString().toLowerCase(); });
  return data.slice(1)
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        let val = row[i];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
        }
        obj[h] = val;
      });
      return obj;
    })
    .filter(function(o) { return o.id || o.key; });
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// ─── TRANSAKSI ──────────────────────────────────────────────
function getTransaksi(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRANSAKSI);
  let list = sheetToObjects(sheet);
  list.sort(function(a, b) { return new Date(b.tanggal) - new Date(a.tanggal); });
  if (params && params.bulan && params.tahun) {
    const m = parseInt(params.bulan), y = parseInt(params.tahun);
    list = list.filter(function(t) {
      const d = new Date(t.tanggal);
      return (d.getMonth() + 1) === m && d.getFullYear() === y;
    });
  }
  return list;
}

function addTransaksi(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRANSAKSI);
  const id = generateId('TRX');
  sheet.appendRow([
    id, p.tanggal, p.keterangan, p.kategori, p.jenis,
    parseFloat(p.jumlah) || 0, p.catatan || '', new Date().toISOString(),
    p.akunAsal || '', p.akunTujuan || ''
  ]);
  return { id: id, message: 'Transaksi berhasil ditambahkan' };
}

function updateTransaksi(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRANSAKSI);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Transaksi tidak ditemukan: ' + p.id);
  sheet.getRange(row, 2, 1, 9).setValues([[
    p.tanggal, p.keterangan, p.kategori, p.jenis,
    parseFloat(p.jumlah) || 0, p.catatan || '', new Date().toISOString(),
    p.akunAsal || '', p.akunTujuan || ''
  ]]);
  return { message: 'Transaksi berhasil diupdate' };
}

function deleteTransaksi(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRANSAKSI);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Transaksi tidak ditemukan: ' + p.id);
  sheet.deleteRow(row);
  return { message: 'Transaksi berhasil dihapus' };
}

// ─── KATEGORI ───────────────────────────────────────────────
function getKategori() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KATEGORI);
  return sheetToObjects(sheet);
}

function addKategori(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KATEGORI);
  const id = generateId('KAT');
  sheet.appendRow([id, p.nama, p.jenis, p.icon || '📌', p.warna || '#6b7280']);
  return { id: id, message: 'Kategori berhasil ditambahkan' };
}

function updateKategori(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KATEGORI);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Kategori tidak ditemukan: ' + p.id);
  sheet.getRange(row, 2, 1, 4).setValues([[p.nama, p.jenis, p.icon || '📌', p.warna || '#6b7280']]);
  return { message: 'Kategori berhasil diupdate' };
}

function deleteKategori(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KATEGORI);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Kategori tidak ditemukan: ' + p.id);
  sheet.deleteRow(row);
  return { message: 'Kategori berhasil dihapus' };
}

// ─── BUDGET ─────────────────────────────────────────────────
function getBudget(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BUDGET);
  let list = sheetToObjects(sheet);
  if (params && params.bulan) {
    list = list.filter(function(b) { return b.bulan === params.bulan; });
  }
  return list;
}

function setBudget(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BUDGET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(p.kategori) && String(data[i][2]) === String(p.bulan)) {
      sheet.getRange(i + 1, 4).setValue(parseFloat(p.limit) || 0);
      return { message: 'Budget berhasil diupdate' };
    }
  }
  const id = generateId('BUD');
  sheet.appendRow([id, p.kategori, p.bulan, parseFloat(p.limit) || 0]);
  return { id: id, message: 'Budget berhasil ditambahkan' };
}

function deleteBudget(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BUDGET);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Budget tidak ditemukan');
  sheet.deleteRow(row);
  return { message: 'Budget berhasil dihapus' };
}

// ─── PENGATURAN ─────────────────────────────────────────────
function getPengaturan() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PENGATURAN);
  const data = sheet.getDataRange().getValues();
  const result = {};
  if (data.length <= 1) return result;
  data.slice(1).forEach(function(row) { if (row[0]) result[row[0]] = row[1]; });
  return result;
}

function savePengaturan(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PENGATURAN);
  const data = sheet.getDataRange().getValues();
  const settings = p.settings || {};
  Object.keys(settings).forEach(function(key) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(key)) {
        sheet.getRange(i + 1, 2).setValue(settings[key]);
        data[i][1] = settings[key];
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, settings[key]]);
      data.push([key, settings[key]]);
    }
  });
  return { message: 'Pengaturan berhasil disimpan' };
}

// ─── HABITS ───────────────────────────────────────────────
function getHabits() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HABITS);
  return sheetToObjects(sheet);
}

function addHabit(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HABITS);
  const id = generateId('HBT');
  const now = new Date().toISOString();
  sheet.appendRow([id, p.nama, p.tipe || 'Counter', p.target || '', p.frekuensi || 'Daily', p.waktu || '', p.ikon || 'check-circle', now]);
  return { id: id, message: 'Habit berhasil ditambahkan' };
}

function updateHabit(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HABITS);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Habit tidak ditemukan');
  sheet.getRange(row, 2, 1, 6).setValues([[p.nama, p.tipe || 'Counter', p.target || '', p.frekuensi || 'Daily', p.waktu || '', p.ikon || 'check-circle']]);
  return { message: 'Habit berhasil diupdate' };
}

function deleteHabit(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HABITS);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Habit tidak ditemukan');
  sheet.deleteRow(row);
  return { message: 'Habit berhasil dihapus' };
}

function getHabitLogs(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HABIT_LOGS);
  return sheetToObjects(sheet);
}

function toggleHabitLog(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HABIT_LOGS);
  const data = sheet.getDataRange().getValues();
  // Cari apakah log untuk habitId dan tanggal ini sudah ada
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(p.habitId) && String(data[i][2]) === String(p.tanggal)) {
      if (p.status == "1" || p.status == true || p.status == "true") {
        sheet.getRange(i + 1, 4).setValue("1");
      } else {
        sheet.deleteRow(i + 1); // Hapus log jika batal dicentang agar bersih
      }
      return { message: 'Log habit diupdate' };
    }
  }
  // Jika belum ada dan statusnya true, tambahkan
  if (p.status == "1" || p.status == true || p.status == "true") {
    const id = generateId('HLG');
    sheet.appendRow([id, p.habitId, p.tanggal, "1"]);
    return { message: 'Log habit dicatat' };
  }
    return { message: 'Tidak ada tindakan' };
  }

// ─── AKUN (DOMPET) ──────────────────────────────────────────
function getAkun() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_AKUN);
  return sheetToObjects(sheet);
}

function addAkun(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_AKUN);
  const id = generateId('AKN');
  sheet.appendRow([id, p.nama, p.jenis || 'Bank', p.saldoAwal || 0, p.ikon || 'credit-card', p.warna || '#111111']);
  return { id: id, message: 'Akun berhasil ditambahkan' };
}

function updateAkun(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_AKUN);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Akun tidak ditemukan');
  sheet.getRange(row, 2, 1, 5).setValues([[p.nama, p.jenis || 'Bank', p.saldoAwal || 0, p.ikon || 'credit-card', p.warna || '#111111']]);
  return { message: 'Akun berhasil diupdate' };
}

function deleteAkun(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_AKUN);
  const row = findRowById(sheet, p.id);
  if (row < 0) throw new Error('Akun tidak ditemukan');
  sheet.deleteRow(row);
  return { message: 'Akun berhasil dihapus' };
}

// ─── SCOS LOGS ──────────────────────────────────────────────
function getSCOS() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCOS_LOGS);
  return sheetToObjects(sheet);
}

function addSCOS(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCOS_LOGS);
  const id = generateId('SCS');
  // Overwrite if same date exists
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(p.tanggal)) {
      sheet.getRange(i + 1, 3, 1, 7).setValues([[
        p.stress || 0, p.criticism || 0, p.urge || 0, p.presence || 0, 
        p.outcome || 'Stable', p.selfRespect || 'Yes', p.notes || ''
      ]]);
      return { message: 'SCOS harian berhasil diupdate' };
    }
  }
  
  sheet.appendRow([
    id, p.tanggal, p.stress || 0, p.criticism || 0, p.urge || 0, p.presence || 0, 
    p.outcome || 'Stable', p.selfRespect || 'Yes', p.notes || ''
  ]);
  return { id: id, message: 'SCOS harian berhasil ditambahkan' };
}

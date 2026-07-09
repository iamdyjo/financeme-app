/* ════════════════════════════════════════════════════════════
   FinanceMe — iOS Minimalist Logic
   ════════════════════════════════════════════════════════════ */

'use strict';

// ══ CONFIG & STATE ════════════════════════════════════════════
const CFG = {
  scriptUrl: localStorage.getItem('fm_script_url') || '',
};

const S = {
  page: 'dashboard',
  month: new Date().getMonth() + 1,
  year:  new Date().getFullYear(),
  transaksi: [],
  kategori:  [],
  budget:    [],
  habits:    [],
  habitLogs: [],
  akun:      [],
  scosLogs:  [],
  jenisTrx:  'Pengeluaran',
};

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                'Juli','Agustus','September','Oktober','November','Desember'];

// ══ UTILS ═════════════════════════════════════════════════════
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function rp(n) {
  const abs = Math.abs(Number(n)||0);
  return 'Rp ' + abs.toLocaleString('id-ID');
}

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function fmtDateShort(s) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('id-ID',{day:'numeric',month:'short'});
}
function today() { return new Date().toISOString().split('T')[0]; }
function monthStr(m,y) { return `${y}-${String(m||S.month).padStart(2,'0')}`; }

function numInput(val) {
  const raw = String(val).replace(/\D/g,'');
  return raw ? Number(raw).toLocaleString('id-ID') : '';
}
function parseNum(val) { return parseFloat(String(val).replace(/\./g,'').replace(',','.')) || 0; }

function updateIcons() {
  if(window.feather) window.feather.replace();
}

// ══ TOAST ═════════════════════════════════════════════════════
function toast(msg, type='info') {
  const icons = { info:'<i data-feather="info"></i>', err:'<i data-feather="alert-circle"></i>', warn:'<i data-feather="alert-triangle"></i>' };
  const el = document.createElement('div');
  el.className = `toast`;
  el.innerHTML = `<span>${icons[type]||icons.info}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  updateIcons();
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-20px)';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// ══ API LAYER (JSONP) ═════════════════════════════════════════
function apiCall(params) {
  return new Promise(function(resolve, reject) {
    if (!CFG.scriptUrl) {
      toast('Setup Google Apps Script URL di Pengaturan dulu', 'warn');
      goTo('pengaturan');
      return reject(new Error('no_url'));
    }
    const cbName = '_fm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const url = new URL(CFG.scriptUrl);
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    url.searchParams.set('callback', cbName);
    
    const cleanup = () => {
      delete window[cbName];
      const el = document.getElementById('jsonp_' + cbName);
      if (el) el.remove();
    };
    
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout — server tidak merespons dalam 12 detik.'));
    }, 12000);
    
    window[cbName] = function(data) {
      clearTimeout(timer);
      cleanup();
      if (data && data.success) resolve(data.data);
      else reject(new Error((data && data.error) || 'Server error'));
    };
    
    const script = document.createElement('script');
    script.id = 'jsonp_' + cbName;
    script.src = url.toString();
    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Script gagal dimuat — URL tidak valid'));
    };
    document.head.appendChild(script);
  });
}
const apiGet = apiCall;
const apiPost = apiCall;

// ══ CUSTOM SELECT SYSTEM ══════════════════════════════════════
const CS = {
  _options: {},   // options per selectId
  _placeholders: {},
  _current: null,

  // Register options for a custom select trigger
  setOptions(selectId, options, placeholder) {
    CS._options[selectId] = options;
    if (placeholder) CS._placeholders[selectId] = placeholder;
    // Refresh label if value already set
    const val = (document.getElementById(selectId) || {}).value || '';
    const found = options.find(o => o.value === val);
    CS._updateLabel(selectId, found ? found.label : null);
  },

  // Programmatically set value and update label
  setValue(selectId, value) {
    const el = document.getElementById(selectId);
    if (el) el.value = value;
    const options = CS._options[selectId] || [];
    const found = options.find(o => o.value === value);
    CS._updateLabel(selectId, found ? found.label : null);
  },

  // Open the bottom-sheet picker
  open(selectId, title) {
    CS._current = selectId;
    const options = CS._options[selectId] || [];
    const currentVal = (document.getElementById(selectId) || {}).value || '';
    const titleEl = document.getElementById('cs-overlay-title');
    if (titleEl) titleEl.textContent = title || CS._placeholders[selectId] || 'Pilih';

    const container = document.getElementById('cs-options-list');
    if (!container) return;
    container.innerHTML = options.map(opt => {
      const vEsc = JSON.stringify(opt.value).replace(/"/g, '&quot;');
      const lEsc = JSON.stringify(opt.label).replace(/"/g, '&quot;');
      return `
      <div class="cs-option ${opt.value === currentVal ? 'cs-selected' : ''}"
           onclick="CS._pick(${vEsc}, ${lEsc})">
        ${opt.icon ? `<span style="font-size:18px;">${opt.icon}</span>` : ''}
        <span style="flex:1;">${esc(opt.label)}</span>
        ${opt.value === currentVal ? '<svg class="cs-option-check" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
      </div>
      `;
    }).join('');

    openModal('cs-overlay');
  },

  // Called when an option is tapped
  _pick(value, label) {
    const id = CS._current;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    CS._updateLabel(id, label);
    closeModal('cs-overlay');
    CS._current = null;
  },

  _updateLabel(selectId, label) {
    const labelEl = document.getElementById('cs-label-' + selectId);
    if (!labelEl) return;
    const placeholder = CS._placeholders[selectId] || 'Pilih...';
    if (label) {
      labelEl.textContent = label;
      labelEl.classList.remove('cs-placeholder');
    } else {
      labelEl.textContent = placeholder;
      labelEl.classList.add('cs-placeholder');
    }
  }
};

// ══ DATA LOADING ══════════════════════════════════════════════
async function loadAll() {
  if (!CFG.scriptUrl) return;
  toast('Memuat data dari Google Sheets…', 'info');
  try {
    const [trx, kat, bud, hab, hlog, akn, scs] = await Promise.all([
      apiGet({ action:'getTransaksi' }),
      apiGet({ action:'getKategori'  }),
      apiGet({ action:'getBudget', bulan: monthStr() }),
      apiGet({ action:'getHabits' }),
      apiGet({ action:'getHabitLogs' }),
      apiGet({ action:'getAkun' }),
      apiGet({ action:'getSCOS' }),
    ]);
    S.transaksi = trx || [];
    S.kategori  = kat || [];
    S.budget    = bud || [];
    S.habits    = hab || [];
    S.habitLogs = hlog || [];
    S.akun      = akn || [];
    S.scosLogs  = scs || [];
    renderPage();
    checkBudgetNotifications();
  } catch(e) {
    if (e.message !== 'no_url') toast('Gagal memuat: ' + e.message, 'err');
  }
}

// ══ NOTIFICATIONS ═════════════════════════════════════════════
let notifiedBudgets = new Set();

async function checkBudgetNotifications() {
  if (!S.budget.length || !S.transaksi.length) return;
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  const currentMonthTrx = S.transaksi.filter(t => t.jenis === 'Pengeluaran' && t.tanggal.startsWith(monthStr()));
  
  S.budget.forEach(b => {
    const katName = S.kategori.find(k => k.id === b.kategoriId)?.nama || b.kategoriId;
    const spent = currentMonthTrx.filter(t => t.kategori === katName).reduce((sum, t) => sum + t.jumlah, 0);
    const limit = b.limit;
    
    if (limit > 0) {
      const percentage = (spent / limit) * 100;
      const budgetKey = `${b.id}-${monthStr()}`;

      if (percentage >= 100 && !notifiedBudgets.has(budgetKey + '-100')) {
        sendNotification(`⚠️ Over Budget: ${katName}`, `Anda telah melampaui batas anggaran Rp ${limit.toLocaleString('id-ID')} untuk ${katName}.`);
        notifiedBudgets.add(budgetKey + '-100');
        notifiedBudgets.add(budgetKey + '-80');
      } 
      else if (percentage >= 80 && !notifiedBudgets.has(budgetKey + '-80')) {
        sendNotification(`⚠️ Hampir Over Budget: ${katName}`, `Pengeluaran ${katName} sudah mencapai ${Math.round(percentage)}% dari limit Rp ${limit.toLocaleString('id-ID')}.`);
        notifiedBudgets.add(budgetKey + '-80');
      }
    }
  });
}

function sendNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: '/icon-192.svg' });
  } else {
    toast(`${title} — ${body}`, 'warn');
  }
}

async function reloadTrx() {
  try { S.transaksi = await apiGet({ action:'getTransaksi' }) || []; }
  catch(e) { toast(e.message, 'err'); }
}
async function reloadBudget() {
  try { S.budget = await apiGet({ action:'getBudget', bulan: monthStr() }) || []; }
  catch(e) { toast(e.message, 'err'); }
}
async function reloadKat() {
  try { S.kategori = await apiGet({ action:'getKategori' }) || []; }
  catch(e) { toast(e.message, 'err'); }
}

// ══ HELPERS ═══════════════════════════════════════════════════
function trxBulan(m, y) {
  const mm = m || S.month, yy = y || S.year;
  return S.transaksi.filter(t => {
    const d = new Date(t.tanggal);
    return (d.getMonth()+1) === mm && d.getFullYear() === yy;
  });
}
function sumPemasukan(list)   { return list.filter(t=>t.jenis==='Pemasukan').reduce((a,t)=>a+Number(t.jumlah),0); }
function sumPengeluaran(list) { return list.filter(t=>t.jenis==='Pengeluaran').reduce((a,t)=>a+Number(t.jumlah),0); }

// Convert emoji to simple feather icons for minimalist look
function getKatIconHtml(name, size=24) {
  const iconMap = {
    'Makan': 'coffee', 'Transportasi': 'navigation', 'Rumah': 'home', 'Hiburan': 'film',
    'Kesehatan': 'heart', 'Tagihan': 'file-text', 'Gaji': 'dollar-sign', 'Belanja': 'shopping-cart'
  };
  const iconStr = iconMap[name] || 'tag';
  return `<i data-feather="${iconStr}" style="width:${size}px; height:${size}px;"></i>`;
}

// ══ NAVIGATION ════════════════════════════════════════════════
let chartDonut = null, chartBar = null;

function goTo(page) {
  S.page = page;
  
  // Update Nav
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  
  // Update Pages
  document.querySelectorAll('.page').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== `page-${page}`);
  });

  renderPage();
  window.scrollTo(0,0);
}

function renderPage() {
  switch(S.page) {
    case 'dashboard':  renderDashboard();  break;
    case 'transaksi':  renderTransaksi();  break;
    case 'budget':     renderBudget();     break;
    case 'kategori':   renderKategori();   break;
    case 'laporan':    renderLaporan();    break;
    case 'growth':     renderGrowth();     break;
    case 'pengaturan': renderPengaturan(); break;
  }
}

// ══ DASHBOARD ═════════════════════════════════════════════════
function renderDashboard() {
  const data  = trxBulan();
  const pem   = sumPemasukan(data);
  const pen   = sumPengeluaran(data);

  document.getElementById('stat-pemasukan').textContent = rp(pem);
  document.getElementById('stat-pengeluaran').textContent = rp(pen);
  
  // Hitung Saldo Global
  let saldoAwalGlobal = 0;
  S.akun.forEach(a => { saldoAwalGlobal += Number(a.saldoAwal) || 0; });
  const allPem = sumPemasukan(S.transaksi);
  const allPen = sumPengeluaran(S.transaksi);
  const totalKekayaan = saldoAwalGlobal + allPem - allPen;

  const saldoEl = document.getElementById('stat-saldo');
  saldoEl.textContent = rp(totalKekayaan);
  saldoEl.style.color = totalKekayaan < 0 ? 'var(--expense)' : 'var(--text-1)';

  // Render Akun/Dompet Horizontal
  const elAkun = document.getElementById('dashboard-akun-list');
  if (!S.akun.length) {
    elAkun.innerHTML = `
      <div style="min-width: 140px; padding: 12px; border: 1px dashed var(--border); border-radius: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin: 0 16px;" onclick="openAddAkun()">
        <span style="font-size: 13px; font-weight: 500; color: var(--text-3);">+ Tambah Dompet</span>
      </div>`;
  } else {
    const akunBalances = S.akun.map(a => {
      let b = Number(a.saldoAwal) || 0;
      S.transaksi.forEach(t => {
        if (t.jenis === 'Pemasukan' && t.akunTujuan === a.nama) b += Number(t.jumlah);
        if (t.jenis === 'Pengeluaran' && t.akunAsal === a.nama) b -= Number(t.jumlah);
        if (t.jenis === 'Transfer' && t.akunAsal === a.nama) b -= Number(t.jumlah);
        if (t.jenis === 'Transfer' && t.akunTujuan === a.nama) b += Number(t.jumlah);
        if (!t.akunAsal && !t.akunTujuan && S.akun.length === 1) {
           if (t.jenis === 'Pemasukan') b += Number(t.jumlah);
           if (t.jenis === 'Pengeluaran') b -= Number(t.jumlah);
        }
      });
      return { ...a, balance: b };
    });
    
    elAkun.innerHTML = akunBalances.map(a => `
      <div style="background: var(--bg-base); padding: 12px 16px; border-radius: 16px; min-width: 140px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border); cursor: pointer;" onclick="editAkun('${esc(a.id)}')">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${a.warna}20; color: ${a.warna}; display: flex; align-items: center; justify-content: center;">
            <i data-feather="${a.ikon}" style="width:12px; height:12px;"></i>
          </div>
          <span style="font-size:12px; font-weight:600;">${esc(a.nama)}</span>
        </div>
        <div style="font-size: 14px; font-weight: 700; color: var(--text-1);">${rp(a.balance)}</div>
      </div>
    `).join('') + `
      <div style="background: transparent; padding: 12px; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border); cursor: pointer;" onclick="openAddAkun()">
        <i data-feather="plus" style="color:var(--text-3);"></i>
      </div>
    `;
  }

  // SCOS Widget
  calcSCOSWidget();

  renderRecentList(data.slice(0,5));
}

function calcSCOSWidget() {
  const todayDate = today();
  const logToday = S.scosLogs.find(l => l.tanggal === todayDate);
  const scoreEl = document.getElementById('widget-stability');
  if (logToday) {
    const presence = Number(logToday.presence) || 0;
    const stress = Number(logToday.stress) || 0;
    const crit = Number(logToday.criticism) || 0;
    // Formula sederhana: rata-rata dari (Presence, Kebalikan Stress, Kebalikan Crit) x 10
    const score = Math.round(((presence + (10 - stress) + (10 - crit)) / 30) * 100);
    scoreEl.textContent = score;
    scoreEl.style.color = score > 60 ? 'var(--income)' : (score < 40 ? 'var(--expense)' : 'var(--text-1)');
  } else {
    scoreEl.textContent = '-';
    scoreEl.style.color = 'var(--text-3)';
  }

  // Habit completion for today
  const todaysHabits = S.habits.filter(h => h.frekuensi === 'Daily');
  let completed = 0;
  todaysHabits.forEach(h => {
    if(S.habitLogs.find(l => l.habitId === h.id && l.tanggal === todayDate)) completed++;
  });
  const pct = todaysHabits.length ? Math.round((completed / todaysHabits.length) * 100) : 0;
  const habitPath = document.getElementById('widget-habit-path');
  if (habitPath) habitPath.style.strokeDasharray = `${pct}, 100`;
}

function renderRecentList(items) {
  const el = document.getElementById('recent-list');
  if (!items.length) {
    el.innerHTML = `<div class="text-center mt-24"><p>Belum ada transaksi</p></div>`;
    return;
  }
  
  el.innerHTML = items.map(t => {
    const inc = t.jenis === 'Pemasukan';
    return `
      <div class="list-item" style="cursor:pointer;" onclick="openEditTrx('${esc(t.id)}')">
        <div class="item-left">
          <div class="item-icon" style="color: ${inc ? 'var(--income)' : 'var(--text-1)'}">
            ${getKatIconHtml(t.kategori, 20)}
          </div>
          <div class="item-info">
            <span class="item-title">${esc(t.keterangan)}</span>
            <span class="item-subtitle">${esc(t.kategori)} · ${fmtDateShort(t.tanggal)}</span>
          </div>
        </div>
        <div class="item-amount ${inc ? 'amt-inc' : 'amt-exp'}">
          ${inc ? '+' : '-'}${rp(t.jumlah)}
        </div>
      </div>
    `;
  }).join('');
  updateIcons();
}

// ── Charts ──
function renderChartDonut(bulanData) {
  const ctx = document.getElementById('chart-donut');
  if (!ctx) return;

  const exp = bulanData.filter(t=>t.jenis==='Pengeluaran');
  const grouped = {};
  exp.forEach(t=>{ grouped[t.kategori]=(grouped[t.kategori]||0)+Number(t.jumlah); });

  if (chartDonut) { chartDonut.destroy(); chartDonut=null; }
  
  if (!Object.keys(grouped).length) {
    ctx.parentNode.innerHTML = `<p class="text-center mt-24">Tidak ada data pengeluaran</p>`;
    return;
  }

  const labels = Object.keys(grouped);
  const values = labels.map(l=>grouped[l]);
  
  // Minimalist palette
  const colors = ['#111111', '#52525B', '#A1A1AA', '#D4D4D8', '#E4E4E7', '#F4F4F5'];

  chartDonut = new Chart(ctx, {
    type:'doughnut',
    data: {
      labels,
      datasets:[{ data:values, backgroundColor:colors, borderWidth:0, hoverOffset:4 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'75%',
      plugins:{
        legend:{ display:false },
        tooltip:{ backgroundColor:'#111', padding:12, titleFont:{family:'Inter'}, bodyFont:{family:'Inter'} }
      }
    }
  });
}

function renderChartBar() {
  const ctx = document.getElementById('chart-bar');
  if (!ctx) return;

  const labels=[], pemArr=[], penArr=[];
  for (let i=5;i>=0;i--) {
    let m=S.month-i, y=S.year;
    while(m<1){m+=12;y--;}
    labels.push(MONTHS[m-1].substring(0,3));
    const md = trxBulan(m,y);
    pemArr.push(sumPemasukan(md));
    penArr.push(sumPengeluaran(md));
  }

  if (chartBar) { chartBar.destroy(); chartBar=null; }

  chartBar = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Pemasukan', data:pemArr, backgroundColor:'#E4E4E7', borderRadius:4},
        {label:'Pengeluaran', data:penArr, backgroundColor:'#111111', borderRadius:4},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{display:false}, ticks:{font:{family:'Inter'}} },
        y:{ display:false, beginAtZero:true }
      }
    }
  });
}

// ══ TRANSAKSI PAGE ═════════════════════════════════════════════
function renderTransaksi() {
  const prevKat = (document.getElementById('filter-kat') || {}).value || '';
  
  // Populate filter-jenis custom select
  CS.setOptions('filter-jenis', [
    { value: '', label: 'Semua Jenis' },
    { value: 'Pemasukan', label: 'Pemasukan' },
    { value: 'Pengeluaran', label: 'Pengeluaran' },
  ], 'Semua Jenis');

  // Populate filter-kat custom select
  const katOptions = [{ value: '', label: 'Semua Kategori' }].concat(
    S.kategori.map(k => ({ value: k.nama, label: k.nama }))
  );
  CS.setOptions('filter-kat', katOptions, 'Semua Kategori');
  if (prevKat) CS.setValue('filter-kat', prevKat);
  
  applyFilter();
}

function applyFilter() {
  const q    = (document.getElementById('filter-search')?.value||'').toLowerCase();
  const jns  = document.getElementById('filter-jenis')?.value||'';
  const kat  = document.getElementById('filter-kat')?.value||'';

  let data = trxBulan();
  if (q)   data = data.filter(t=>(t.keterangan+t.catatan).toLowerCase().includes(q));
  if (jns) data = data.filter(t=>t.jenis===jns);
  if (kat) data = data.filter(t=>t.kategori===kat);

  const el = document.getElementById('trx-list');
  if (!data.length) {
    el.innerHTML = `<p class="text-center mt-24">Tidak ada transaksi ditemukan</p>`;
    return;
  }
  
  el.innerHTML = data.map(t => {
    const inc = t.jenis === 'Pemasukan';
    return `
      <div class="list-item" style="cursor:pointer;" onclick="openEditTrx('${esc(t.id)}')">
        <div class="item-left">
          <div class="item-icon" style="color: ${inc ? 'var(--income)' : 'var(--text-1)'}">
            ${getKatIconHtml(t.kategori, 20)}
          </div>
          <div class="item-info">
            <span class="item-title">${esc(t.keterangan)}</span>
            <span class="item-subtitle">${esc(t.kategori)} · ${fmtDateShort(t.tanggal)}</span>
          </div>
        </div>
        <div class="item-amount ${inc ? 'amt-inc' : 'amt-exp'}">
          ${inc ? '+' : '-'}${rp(t.jumlah)}
        </div>
      </div>
    `;
  }).join('');
  updateIcons();
}

// ── Modal Transaksi ──
function openAddTrx(jenis='Pengeluaran') {
  document.getElementById('trx-id').value = '';
  document.getElementById('trx-tanggal').value = today();
  document.getElementById('trx-jumlah').value = '';
  document.getElementById('trx-keterangan').value = '';
  document.getElementById('trx-catatan').value = '';
  const akunOptions = [{ value: '', label: '-- Pilih Dompet --' }].concat(
    S.akun.map(a => ({ value: a.nama, label: a.nama }))
  );
  CS.setOptions('trx-akun', akunOptions, '-- Pilih Dompet --');
  CS.setValue('trx-akun', '');

  setJenis(jenis);
  document.getElementById('modal-trx-title').textContent = 'Tambah Transaksi';
  openModal('modal-trx');
}

function openEditTrx(id) {
  const t = S.transaksi.find(x=>x.id===id); if (!t) return;
  document.getElementById('trx-id').value = t.id;
  document.getElementById('trx-tanggal').value = t.tanggal;
  document.getElementById('trx-jumlah').value = numInput(t.jumlah);
  document.getElementById('trx-keterangan').value = t.keterangan;
  document.getElementById('trx-catatan').value = t.catatan||'';
  
  const akunOptions2 = [{ value: '', label: '-- Pilih Dompet --' }].concat(
    S.akun.map(a => ({ value: a.nama, label: a.nama }))
  );
  CS.setOptions('trx-akun', akunOptions2, '-- Pilih Dompet --');
  const akunVal = t.jenis === 'Pemasukan' ? (t.akunTujuan || '') : (t.akunAsal || '');
  CS.setValue('trx-akun', akunVal);

  setJenis(t.jenis);
  setTimeout(() => { CS.setValue('trx-kategori', t.kategori); }, 30);
  document.getElementById('modal-trx-title').textContent = 'Edit Transaksi';
  openModal('modal-trx');
}

function setJenis(jenis) {
  S.jenisTrx = jenis;
  document.querySelectorAll('#jenis-toggle .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.jenis === jenis);
  });
  // Reset kategori
  document.getElementById('trx-kategori').value = '';
  const katOptions = [{ value: '', label: 'Pilih kategori...' }].concat(
    S.kategori.filter(k => k.jenis === jenis).map(k => ({ value: k.nama, label: k.nama }))
  );
  CS.setOptions('trx-kategori', katOptions, 'Pilih kategori...');
}

async function submitTrx() {
  const id        = document.getElementById('trx-id').value;
  const tanggal   = document.getElementById('trx-tanggal').value;
  const jumlah    = parseNum(document.getElementById('trx-jumlah').value);
  const keterangan= document.getElementById('trx-keterangan').value.trim();
  const kategori  = document.getElementById('trx-kategori').value;
  const catatan   = document.getElementById('trx-catatan').value.trim();
  const akun      = document.getElementById('trx-akun').value;
  const jenis     = S.jenisTrx;

  if (!tanggal||!jumlah||!keterangan||!kategori) { toast('Isi semua field wajib', 'warn'); return; }
  
  const payload = { id, tanggal, jumlah, keterangan, kategori, catatan, jenis };
  if (jenis === 'Pemasukan') {
    payload.akunTujuan = akun;
    payload.akunAsal = '';
  } else {
    payload.akunAsal = akun;
    payload.akunTujuan = '';
  }
  
  const btn = document.getElementById('btn-submit-trx');
  btn.disabled=true; btn.textContent='Menyimpan...';

  try {
    if (id) {
      payload.action = 'updateTransaksi';
      await apiPost(payload);
      toast('Berhasil diupdate');
    } else {
      payload.action = 'addTransaksi';
      await apiPost(payload);
      toast('Berhasil ditambahkan');
    }
    closeModal('modal-trx');
    toast('Memperbarui data...', 'info');
    await reloadTrx();
    renderPage();
    checkBudgetNotifications();
  } catch(e) {
    toast(e.message, 'err');
  } finally {
    btn.disabled=false; btn.textContent='Simpan';
  }
}

function deleteTrx(id) {
  if(!confirm('Hapus transaksi ini?')) return;
  apiPost({action:'deleteTransaksi', id}).then(()=>{
    toast('Terhapus'); reloadTrx().then(renderPage);
  }).catch(e=>toast(e.message,'err'));
}

// ══ BUDGET PAGE ════════════════════════════════════════════════
function renderBudget() {
  const el = document.getElementById('budget-list');
  const data = trxBulan();

  if (!S.budget.length) {
    el.innerHTML=`<p class="text-center mt-24">Belum ada budget</p>`; return;
  }
  
  el.innerHTML = S.budget.map(b => {
    const spent = data.filter(t=>t.jenis==='Pengeluaran'&&t.kategori===b.kategori).reduce((a,t)=>a+Number(t.jumlah),0);
    const lim = Number(b.limit);
    const pct = lim>0 ? Math.min(spent/lim*100,100) : 0;
    
    return `
      <div class="mb-16" style="cursor:pointer;" onclick="openEditBudget('${esc(b.id)}')">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="font-weight:600;">${esc(b.kategori)}</span>
          <span style="font-weight:700;">${rp(spent)} <span style="color:var(--text-3); font-weight:500;">/ ${rp(lim)}</span></span>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar" style="width:${pct}%; background: ${pct>=100 ? 'var(--expense)' : 'var(--text-1)'}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddBudget() {
  document.getElementById('budget-id').value = '';
  document.getElementById('budget-limit').value = '';
  const katOpts = [{ value: '', label: 'Pilih kategori...' }].concat(
    S.kategori.filter(k => k.jenis === 'Pengeluaran').map(k => ({ value: k.nama, label: k.nama }))
  );
  CS.setOptions('budget-kategori', katOpts, 'Pilih kategori...');
  CS.setValue('budget-kategori', '');
  document.getElementById('modal-budget-title').textContent = 'Tambah Budget';
  openModal('modal-budget');
}

function openEditBudget(id) {
  const b = S.budget.find(x => x.id === id); if (!b) return;
  document.getElementById('budget-id').value = id;
  document.getElementById('budget-limit').value = numInput(b.limit);
  const katOpts2 = [{ value: '', label: 'Pilih kategori...' }].concat(
    S.kategori.filter(k => k.jenis === 'Pengeluaran').map(k => ({ value: k.nama, label: k.nama }))
  );
  CS.setOptions('budget-kategori', katOpts2, 'Pilih kategori...');
  CS.setValue('budget-kategori', b.kategori);
  document.getElementById('modal-budget-title').textContent = 'Edit Budget';
  openModal('modal-budget');
}

async function submitBudget() {
  const id       = document.getElementById('budget-id').value;
  const kategori = document.getElementById('budget-kategori').value;
  const limit    = parseNum(document.getElementById('budget-limit').value);
  if (!kategori||!limit||limit<=0) { toast('Isi limit dengan benar','warn'); return; }

  closeModal('modal-budget');
  try {
    await apiPost({action:'setBudget', kategori, limit, bulan:monthStr(), ...(id?{id}:{})});
    toast('Tersimpan');
    await reloadBudget();
    renderPage();
  } catch(e){ toast(e.message,'err'); }
}

// ══ KATEGORI PAGE ══════════════════════════════════════════════
function renderKategori() {
  const renderList = (jenis, containerId) => {
    const el = document.getElementById(containerId);
    const list = S.kategori.filter(k=>k.jenis===jenis);
    
    if (!list.length) { el.innerHTML=`<p class="text-center">Belum ada kategori</p>`; return; }
    
    el.innerHTML = list.map(k=>`
      <div class="list-item">
        <div class="item-left">
          <div class="item-icon">${getKatIconHtml(k.nama, 18)}</div>
          <span class="item-title">${esc(k.nama)}</span>
        </div>
      </div>
    `).join('');
  };
  
  renderList('Pemasukan','kat-pemasukan-list');
  renderList('Pengeluaran','kat-pengeluaran-list');
  updateIcons();
}

function openAddKat(jenis) {
  document.getElementById('kat-id').value    = '';
  document.getElementById('kat-jenis').value = jenis;
  document.getElementById('kat-nama').value  = '';
  document.getElementById('kat-icon').value  = jenis==='Pemasukan'?'💰':'💸';
  document.getElementById('kat-warna').value = '#111111';
  document.getElementById('modal-kat-title').textContent = `Tambah Kategori ${jenis}`;
  openModal('modal-kategori');
}

async function submitKat() {
  const id    = document.getElementById('kat-id').value;
  const jenis = document.getElementById('kat-jenis').value;
  const nama  = document.getElementById('kat-nama').value.trim();
  const icon  = document.getElementById('kat-icon').value.trim()||'📌';
  const warna = document.getElementById('kat-warna').value;
  if (!nama) { toast('Nama kategori wajib diisi','warn'); return; }
  
  closeModal('modal-kategori');
  try {
    if (id) await apiPost({action:'updateKategori',id,nama,jenis,icon,warna});
    else await apiPost({action:'addKategori',nama,jenis,icon,warna});
    toast('Tersimpan');
    await reloadKat();
    renderPage();
  } catch(e){ toast(e.message,'err'); }
}

// ══ LAPORAN PAGE ═══════════════════════════════════════════════
function renderLaporan() {
  renderChartBar();
}

// ── Export ──
function exportCSV() {
  const data = trxBulan();
  if (!data.length) { toast('Tidak ada data','warn'); return; }
  const hdrs = ['Tanggal','Keterangan','Kategori','Jenis','Jumlah','Catatan'];
  const rows = data.map(t=>[t.tanggal,`"${t.keterangan}"`,t.kategori,t.jenis,t.jumlah,`"${t.catatan||''}"`]);
  const csv  = [hdrs.join(','), ...rows.map(r=>r.join(','))].join('\\n');
  const blob = new Blob(['\\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  dlFile(blob, `FinanceMe_${monthStr()}.csv`);
}

function exportXLSX() {
  if (typeof XLSX==='undefined') { toast('Library Excel belum termuat','err'); return; }
  const data = trxBulan();
  if (!data.length) { toast('Tidak ada data','warn'); return; }
  const ws_data = [
    ['Tanggal','Keterangan','Kategori','Jenis','Jumlah (Rp)','Catatan'],
    ...data.map(t=>[t.tanggal,t.keterangan,t.kategori,t.jenis,Number(t.jumlah),t.catatan||''])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[S.month-1]} ${S.year}`);
  XLSX.writeFile(wb, `FinanceMe_${monthStr()}.xlsx`);
}

function dlFile(blob, name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),100);
}

// ══ PENGATURAN PAGE ════════════════════════════════════════════
function renderPengaturan() {
  document.getElementById('input-script-url').value = CFG.scriptUrl||'';
  updateConnStatus();
}

function updateConnStatus() {
  const el = document.getElementById('conn-status');
  if (CFG.scriptUrl) { el.textContent='✅ Terhubung'; el.style.color='var(--income)'; }
  else { el.textContent='⚠️ Belum Terhubung'; el.style.color='var(--warn)'; }
}

async function testConn() {
  const url = document.getElementById('input-script-url').value.trim();
  if(!url) return;
  
  const oldUrl = CFG.scriptUrl;
  CFG.scriptUrl = url; // Temporarily use the input URL
  
  try {
    toast('Menguji koneksi...', 'info');
    await apiCall({ action:'ping' }); // Ping test
    toast('Koneksi berhasil!', 'info');
  } catch(e) {
    toast('Koneksi gagal: pastikan URL Apps Script benar', 'err');
  }
  
  CFG.scriptUrl = oldUrl; // Revert
}

function saveSettings() {
  const url = document.getElementById('input-script-url').value.trim();
  localStorage.setItem('fm_script_url', url);
  CFG.scriptUrl = url;
  toast('Tersimpan', 'info');
  setTimeout(()=>location.reload(), 500);
}

function clearCache() {
  if(!confirm('Hapus pengaturan URL?')) return;
  localStorage.clear();
  location.reload();
}

// ══ MODAL & THEME LOGIC ═══════════════════════════════════════
function openModal(id) {
  // Close any other open modals first
  document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(el => {
    if (el.id !== id) el.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Re-run feather icons after modal opens
  setTimeout(updateIcons, 50);
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  // Re-enable scroll if no modals are open
  const anyOpen = document.querySelectorAll('.modal-overlay:not(.hidden)').length > 0;
  if (!anyOpen) document.body.style.overflow = '';
}

// Apply Theme
function applyTheme(isLight) {
  // Theme logic can be simplified since the base is light mode.
  // Dark mode could be added back later by toggling .dark-mode on body.
  const el = document.getElementById('btn-theme-toggle');
  if(isLight) {
    document.body.classList.remove('dark-mode');
    if(el) el.querySelector('.item-title').textContent = 'Mode Gelap';
  } else {
    document.body.classList.add('dark-mode');
    if(el) el.querySelector('.item-title').textContent = 'Mode Terang';
  }
}

// ══ HABITS ════════════════════════════════════════════════════
function renderGrowth() {
  const dToday = today();
  let allLogs = S.habitLogs || [];
  let habits = S.habits || [];
  
  // Hitung total completed per hari
  const logsByDate = {};
  allLogs.forEach(lg => {
    if(!logsByDate[lg.tanggal]) logsByDate[lg.tanggal] = 0;
    logsByDate[lg.tanggal]++;
  });

  // 1. SCOS Metrics Calculation
  let sumStability = 0;
  let sumImpulse = 0;
  let stableDays = 0;
  const scosCount = S.scosLogs.length;

  S.scosLogs.forEach(log => {
    const p = Number(log.presence) || 0;
    const s = Number(log.stress) || 0;
    const c = Number(log.criticism) || 0;
    const u = Number(log.urge) || 0;
    
    // Stability = Avg(Presence, 10-Stress, 10-Criticism) * 10
    sumStability += ((p + (10 - s) + (10 - c)) / 30) * 100;
    // Impulse Pressure = Avg(Stress, Criticism, Urge) * 10
    sumImpulse += ((s + c + u) / 30) * 100;
    
    if (log.outcome === 'Stable') stableDays++;
  });

  const avgStability = scosCount ? Math.round(sumStability / scosCount) : 0;
  const avgImpulse = scosCount ? Math.round(sumImpulse / scosCount) : 0;
  
  // Discipline Score logic
  // Simplified: ratio of stable days + ratio of habits done today
  let todayDone = logsByDate[dToday] || 0;
  let pctHabit = habits.length ? (todayDone / habits.length) : 0;
  let pctStable = scosCount ? (stableDays / scosCount) : 0;
  let disciplineScore = Math.round(((pctHabit + pctStable) / 2) * 100) || 0;
  if (!habits.length && !scosCount) disciplineScore = 0;

  document.getElementById('scos-stability-score').textContent = avgStability;
  document.getElementById('scos-discipline-score').textContent = disciplineScore;

  // 2. Insight Engine (AI)
  const insightEl = document.getElementById('scos-insight-text');
  const todayScos = S.scosLogs.find(l => l.tanggal === dToday);
  
  if (!todayScos) {
    insightEl.textContent = "Observe, Understand, Improve. Lakukan Daily Check-in hari ini untuk melihat analisanya.";
  } else {
    const s = Number(todayScos.stress) || 0;
    const c = Number(todayScos.criticism) || 0;
    const u = Number(todayScos.urge) || 0;
    const out = todayScos.outcome;

    if (s > 7 && c > 7 && u > 7) {
      insightEl.textContent = "Kemungkinan besar urge hari ini dipengaruhi tekanan psikologis yang sangat tinggi, bukan murni dorongan fisik. Cobalah bernapas dan rileks.";
    } else if (c > 8) {
      insightEl.textContent = "Coba evaluasi diri tanpa menghakimi. Kesalahan adalah data, bukan identitas. Self-criticism Anda hari ini sangat tinggi.";
    } else if (out === 'Relapse' && avgStability > 60) {
      insightEl.textContent = "Terjadi peningkatan stabilitas jangka panjang meskipun masih ada relapse hari ini. Fokus pada tren, jangan menyerah!";
    } else if (out === 'Stable' && u > 7) {
      insightEl.textContent = "Luar biasa! Dorongan (Urge) Anda sangat tinggi hari ini, tapi Anda berhasil tetap stabil. Discipline otot mental Anda sedang berkembang pesat.";
    } else {
      insightEl.textContent = "Kondisi Anda cukup stabil hari ini. Terus bertumbuh, stabil lebih penting daripada sempurna.";
    }
  }

  // 3. Render Today List (Habits in Grid)
  const listEl = document.getElementById('habit-today-list');
  document.getElementById('habit-today-count').textContent = `${todayDone} dari ${habits.length}`;

  if (habits.length === 0) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-3); grid-column: 1 / -1;">Belum ada kebiasaan.</div>';
  } else {
    listEl.innerHTML = habits.map(h => {
      const isDone = allLogs.find(lg => lg.habitId === h.id && lg.tanggal === dToday);
      return `
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; padding: 12px; border-radius: 16px; margin:0; border: 1px solid var(--border); box-shadow: none;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="color: var(--text-1); background: var(--bg-base); padding: 8px; border-radius: 50%;"><i data-feather="${h.ikon || 'check-circle'}" style="width: 16px; height: 16px;"></i></div>
            <button class="habit-check-btn ${isDone ? 'done' : ''}" style="width: 24px; height: 24px;" onclick="toggleHabit('${h.id}', this)">
              <i data-feather="check" style="width: 12px; height: 12px;"></i>
            </button>
          </div>
          <div style="overflow: hidden;">
            <h4 style="font-size: 13px; font-weight: 600; margin-bottom: 2px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${esc(h.nama)}</h4>
            <span style="font-size: 10px; color: var(--text-3);">${esc(h.target)}</span>
          </div>
        </div>
      `;
    }).join('');
  }
  
  renderHeatmap(logsByDate, habits.length);
  updateIcons();
}

function renderHeatmap(logsByDate = {}, maxHabits = 1) {
  const grid = document.getElementById('habit-heatmap-grid');
  if(!grid) return;
  // Buat array 28 hari (4 minggu) terakhir
  let html = '';
  let d = new Date();
  d.setDate(d.getDate() - 27); // Mulai 28 hari lalu
  
  for(let i=0; i<28; i++) {
    const ds = d.toISOString().split('T')[0];
    const done = logsByDate[ds] || 0;
    const pct = maxHabits ? (done / maxHabits) : 0;
    
    let bg = 'var(--bg-base)';
    if (pct > 0 && pct <= 0.25) bg = 'rgba(17,17,17,0.25)';
    else if (pct > 0.25 && pct <= 0.5) bg = 'rgba(17,17,17,0.5)';
    else if (pct > 0.5 && pct < 1) bg = 'rgba(17,17,17,0.75)';
    else if (pct >= 1) bg = 'var(--text-1)';
    
    html += `<div class="habit-heatmap-cell" style="background: ${bg};" title="${ds}: ${done} selesai"></div>`;
    d.setDate(d.getDate() + 1);
  }
  grid.innerHTML = html;
}

async function toggleHabit(habitId, btn) {
  if (!CFG.scriptUrl) {
    toast('Atur URL Google Apps Script di Pengaturan terlebih dahulu', 'warn');
    return;
  }

  const isDone = !btn.classList.contains('done');
  // Optimistic UI update
  btn.classList.toggle('done');
  
  try {
    await apiPost({ action: 'toggleHabitLog', habitId: habitId, tanggal: today(), status: isDone ? "1" : "0" });
    // Reload logs
    S.habitLogs = await apiGet({ action: 'getHabitLogs' });
    if (S.page === 'growth') renderGrowth();
  } catch(e) {
    btn.classList.toggle('done'); // revert
    if (e.message !== 'no_url') toast('Gagal mencatat habit: ' + e.message, 'err');
  }
}

function openAddHabit() {
  document.getElementById('habit-id').value = '';
  document.getElementById('habit-nama').value = '';
  document.getElementById('habit-target').value = '';
  openModal('modal-habit');
}

async function submitHabit() {
  if (!CFG.scriptUrl) {
    toast('Atur URL Google Apps Script di Pengaturan terlebih dahulu', 'warn');
    goTo('pengaturan');
    return;
  }

  const nama = document.getElementById('habit-nama').value.trim();
  if (!nama) return toast('Nama habit wajib diisi', 'warn');
  
  const payload = {
    action: 'addHabit',
    nama: nama,
    target: document.getElementById('habit-target').value || '',
    tipe: document.getElementById('habit-tipe').value || 'Counter',
    frekuensi: document.getElementById('habit-frekuensi').value || 'Daily',
    ikon: document.getElementById('habit-ikon').value || 'check-circle',
  };
  
  const btn = document.getElementById('btn-submit-habit');
  const origText = btn.textContent;
  btn.textContent = '...';
  btn.disabled = true;
  try {
    await apiPost(payload);
    toast('Habit tersimpan ✓');
    closeModal('modal-habit');
    S.habits = await apiGet({ action: 'getHabits' });
    S.habitLogs = await apiGet({ action: 'getHabitLogs' });
    if(S.page === 'growth') renderGrowth();
  } catch(e) {
    if (e.message !== 'no_url') toast('Gagal: ' + e.message, 'err');
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

// ─── SCOS, AKUN & TRANSFER LOGIC ─────────────────────────────

// SCOS UI Helpers
const SCOS_EMOJIS = {
  stress:    ['😌','😌','🙂','😐','😟','😟','😰','😰','😡','😡','🤯'],
  criticism: ['🤗','🤗','🙂','😐','😕','😕','😞','😞','😤','😤','🔥'],
  urge:      ['🧘','🧘','😊','😐','😬','😬','😫','😫','😈','😈','💥'],
  presence:  ['🌙','🌑','🌒','🌓','🌔','🌕','🌕','✨','✨','🌟','🌟'],
};

function updateSCOSSlider(field, val) {
  const v = parseInt(val);
  document.getElementById(`scos-${field}-badge`).textContent = v;
  document.getElementById(`scos-${field}-emoji`).textContent = SCOS_EMOJIS[field][v];

  // Update fill gradient
  const pct = (v / 10) * 100;
  const el = document.getElementById(`scos-${field}`);
  if (field === 'presence') {
    el.style.background = `linear-gradient(to right, var(--income) ${pct}%, var(--border) ${pct}%)`;
  } else {
    // Danger: low is good (grey), high is dark
    el.style.background = `linear-gradient(to right, var(--text-1) ${pct}%, var(--border) ${pct}%)`;
  }
}

function selectOutcome(val) {
  document.getElementById('scos-outcome').value = val;
  document.querySelectorAll('.scos-outcome-btn').forEach(btn => {
    const isActive = btn.dataset.value === val;
    btn.style.background = isActive ? 'var(--text-1)' : 'transparent';
    btn.style.color = isActive ? 'white' : 'var(--text-2)';
    btn.style.borderColor = isActive ? 'var(--text-1)' : 'var(--border)';
  });
}

function toggleSelfRespect() {
  const hidden = document.getElementById('scos-respect');
  const toggle = document.getElementById('scos-respect-toggle');
  const thumb = document.getElementById('scos-respect-thumb');
  const isYes = hidden.value === 'Yes';
  hidden.value = isYes ? 'No' : 'Yes';
  if (isYes) {
    // Switch to No
    toggle.style.background = 'var(--border)';
    thumb.style.right = 'auto';
    thumb.style.left = '3px';
  } else {
    // Switch to Yes
    toggle.style.background = 'var(--text-1)';
    thumb.style.left = 'auto';
    thumb.style.right = '3px';
  }
}

function initSCOSModal(logToday) {
  const vals = logToday ? {
    stress: logToday.stress || 0,
    criticism: logToday.criticism || 0,
    urge: logToday.urge || 0,
    presence: logToday.presence || 5,
    outcome: logToday.outcome || 'Stable',
    respect: logToday.selfRespect || 'Yes',
    notes: logToday.notes || ''
  } : { stress: 0, criticism: 0, urge: 0, presence: 5, outcome: 'Stable', respect: 'Yes', notes: '' };

  // Set sliders
  ['stress','criticism','urge','presence'].forEach(f => {
    document.getElementById(`scos-${f}`).value = vals[f];
    updateSCOSSlider(f, vals[f]);
  });

  // Set outcome pills
  selectOutcome(vals.outcome);

  // Set self-respect toggle
  document.getElementById('scos-respect').value = vals.respect;
  const toggle = document.getElementById('scos-respect-toggle');
  const thumb = document.getElementById('scos-respect-thumb');
  if (vals.respect === 'Yes') {
    toggle.style.background = 'var(--text-1)';
    thumb.style.left = 'auto'; thumb.style.right = '3px';
  } else {
    toggle.style.background = 'var(--border)';
    thumb.style.right = 'auto'; thumb.style.left = '3px';
  }

  // Set notes
  document.getElementById('scos-notes').value = vals.notes;

  // Set date
  const dateEl = document.getElementById('scos-modal-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function openAddSCOS() {
  const dToday = today();
  const logToday = S.scosLogs.find(l => l.tanggal === dToday);
  initSCOSModal(logToday || null);
  openModal('modal-scos');
}

async function submitSCOS() {
  const payload = {
    action: 'addSCOS',
    tanggal: today(),
    stress: document.getElementById('scos-stress').value,
    criticism: document.getElementById('scos-criticism').value,
    urge: document.getElementById('scos-urge').value,
    presence: document.getElementById('scos-presence').value,
    outcome: document.getElementById('scos-outcome').value,
    selfRespect: document.getElementById('scos-respect').value,
    notes: document.getElementById('scos-notes').value
  };
  const btn = document.getElementById('btn-submit-scos');
  btn.textContent = '...';
  try {
    await apiPost(payload);
    toast('SCOS Check-in tersimpan');
    closeModal('modal-scos');
    S.scosLogs = await apiGet({ action: 'getSCOS' });
    if(S.page === 'growth') renderGrowth();
    else if(S.page === 'dashboard') renderDashboard();
  } catch(e) { toast(e.message, 'err'); }
  btn.textContent = 'Simpan Check-in';
}

function openAddAkun() {
  document.getElementById('akun-id').value = '';
  document.getElementById('akun-nama').value = '';
  document.getElementById('akun-saldo').value = '';
  openModal('modal-akun');
}

async function submitAkun() {
  const nama = document.getElementById('akun-nama').value.trim();
  if(!nama) return toast('Nama dompet wajib diisi','warn');
  const payload = {
    action: 'addAkun',
    nama: nama,
    saldoAwal: parseNum(document.getElementById('akun-saldo').value)
  };
  const btn = document.getElementById('btn-submit-akun');
  btn.textContent = '...';
  try {
    await apiPost(payload);
    toast('Dompet tersimpan');
    closeModal('modal-akun');
    S.akun = await apiGet({ action: 'getAkun' });
    if(S.page === 'dashboard') renderDashboard();
  } catch(e) { toast(e.message, 'err'); }
  btn.textContent = 'Simpan Dompet';
}

function openAddTransfer() {
  if (S.akun.length < 2) return toast('Minimal harus ada 2 dompet untuk transfer','warn');
  const akunOpts = S.akun.map(a => ({ value: a.nama, label: a.nama }));
  CS.setOptions('transfer-asal', akunOpts, 'Pilih dompet...');
  CS.setOptions('transfer-tujuan', akunOpts, 'Pilih dompet...');
  CS.setValue('transfer-asal', S.akun[0]?.nama || '');
  CS.setValue('transfer-tujuan', S.akun[1]?.nama || '');
  document.getElementById('transfer-tanggal').value = today();
  document.getElementById('transfer-jumlah').value = '';
  openModal('modal-transfer');
}

async function submitTransfer() {
  const asal = document.getElementById('transfer-asal').value;
  const tujuan = document.getElementById('transfer-tujuan').value;
  const jumlah = parseNum(document.getElementById('transfer-jumlah').value);
  if(asal === tujuan) return toast('Dompet asal dan tujuan tidak boleh sama','warn');
  if(jumlah <= 0) return toast('Nominal harus lebih dari 0','warn');

  const payload = {
    action: 'addTransaksi',
    tanggal: document.getElementById('transfer-tanggal').value,
    keterangan: `Transfer dari ${asal} ke ${tujuan}`,
    kategori: 'Transfer',
    jenis: 'Transfer',
    jumlah: jumlah,
    akunAsal: asal,
    akunTujuan: tujuan
  };
  const btn = document.getElementById('btn-submit-transfer');
  btn.textContent = '...';
  try {
    await apiPost(payload);
    toast('Transfer berhasil');
    closeModal('modal-transfer');
    S.transaksi = await apiGet({ action: 'getTransaksi' });
    if(S.page === 'dashboard') renderDashboard();
  } catch(e) { toast(e.message, 'err'); }
  btn.textContent = 'Transfer';
}

// ══ INIT & EVENTS ═════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Bind Nav
  document.querySelectorAll('.nav-item').forEach(b => {
    b.addEventListener('click', () => goTo(b.dataset.page));
  });

  // Action Buttons
  document.getElementById('btn-fab')?.addEventListener('click', ()=>openModal('modal-fab'));
  document.getElementById('btn-fab-out')?.addEventListener('click', ()=>{ closeModal('modal-fab'); openAddTrx('Pengeluaran'); });
  document.getElementById('btn-fab-in')?.addEventListener('click', ()=>{ closeModal('modal-fab'); openAddTrx('Pemasukan'); });
  document.getElementById('btn-fab-habit')?.addEventListener('click', ()=>{ closeModal('modal-fab'); openAddHabit(); });
  document.getElementById('btn-fab-scos')?.addEventListener('click', ()=>{ closeModal('modal-fab'); openAddSCOS(); });
  document.getElementById('btn-fab-transfer')?.addEventListener('click', ()=>{ closeModal('modal-fab'); openAddTransfer(); });
  
  document.getElementById('btn-nav-budget')?.addEventListener('click', ()=>goTo('budget'));
  document.getElementById('btn-nav-kategori')?.addEventListener('click', ()=>goTo('kategori'));
  
  // Trx Toggle
  document.querySelectorAll('#jenis-toggle .seg-btn').forEach(b=>{
    b.addEventListener('click', ()=>setJenis(b.dataset.jenis));
  });

  // Budget
  document.getElementById('btn-add-budget')?.addEventListener('click', openAddBudget);
  
  // Kategori
  document.getElementById('btn-add-kat-masuk')?.addEventListener('click', ()=>openAddKat('Pemasukan'));
  document.getElementById('btn-add-kat-keluar')?.addEventListener('click', ()=>openAddKat('Pengeluaran'));
  
  // Submit
  document.getElementById('btn-submit-trx')?.addEventListener('click', submitTrx);
  document.getElementById('btn-submit-budget')?.addEventListener('click', submitBudget);
  document.getElementById('btn-submit-kat')?.addEventListener('click', submitKat);
  document.getElementById('btn-submit-habit')?.addEventListener('click', submitHabit);
  document.getElementById('btn-submit-akun')?.addEventListener('click', submitAkun);
  document.getElementById('btn-submit-transfer')?.addEventListener('click', submitTransfer);
  document.getElementById('btn-submit-scos')?.addEventListener('click', submitSCOS);
  
  // Export
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-export-xlsx')?.addEventListener('click', exportXLSX);
  
  // Settings
  document.getElementById('btn-test-conn')?.addEventListener('click', testConn);
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
  document.getElementById('btn-clear-cache')?.addEventListener('click', clearCache);
  document.getElementById('btn-pengaturan')?.addEventListener('click', ()=>goTo('pengaturan'));

  // Theme Toggle
  const btnTheme = document.getElementById('btn-theme-toggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      applyTheme(isDark);
      localStorage.setItem('fm_theme', isDark ? 'light' : 'dark');
    });
  }
  
  // Filters
  document.getElementById('filter-search')?.addEventListener('input', applyFilter);
  document.getElementById('filter-jenis')?.addEventListener('change', applyFilter);
  document.getElementById('filter-kat')?.addEventListener('change', applyFilter);

  // Modals
  document.querySelectorAll('.modal-overlay').forEach(o=>{
    o.addEventListener('click', e=>{ if(e.target===o) closeModal(o.id); });
  });
  document.querySelectorAll('[data-close]').forEach(b=>{
    b.addEventListener('click', ()=>closeModal(b.dataset.close));
  });
  
  // Input formatting
  ['trx-jumlah','budget-limit'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', function(){ this.value = numInput(this.value); });
  });

  // Startup
  const savedTheme = localStorage.getItem('fm_theme') || 'light';
  applyTheme(savedTheme === 'light');

  goTo('dashboard');
  if (CFG.scriptUrl) {
    loadAll();
  } else {
    goTo('pengaturan');
  }
  
  // PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
    });
  }
});

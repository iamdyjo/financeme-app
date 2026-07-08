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

// ══ DATA LOADING ══════════════════════════════════════════════
async function loadAll() {
  if (!CFG.scriptUrl) return;
  toast('Memuat data dari Google Sheets…', 'info');
  try {
    const [trx, kat, bud, hab, hlog] = await Promise.all([
      apiGet({ action:'getTransaksi' }),
      apiGet({ action:'getKategori'  }),
      apiGet({ action:'getBudget', bulan: monthStr() }),
      apiGet({ action:'getHabits' }),
      apiGet({ action:'getHabitLogs' }),
    ]);
    S.transaksi = trx || [];
    S.kategori  = kat || [];
    S.budget    = bud || [];
    S.habits    = hab || [];
    S.habitLogs = hlog || [];
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
    case 'habits':     renderHabits();     break;
    case 'pengaturan': renderPengaturan(); break;
  }
}

// ══ DASHBOARD ═════════════════════════════════════════════════
function renderDashboard() {
  const data  = trxBulan();
  const pem   = sumPemasukan(data);
  const pen   = sumPengeluaran(data);
  const saldo = pem - pen;

  document.getElementById('stat-pemasukan').textContent = rp(pem);
  document.getElementById('stat-pengeluaran').textContent = rp(pen);
  
  const saldoEl = document.getElementById('stat-saldo');
  saldoEl.textContent = rp(saldo);
  saldoEl.style.color = saldo < 0 ? 'var(--expense)' : 'var(--text-1)';

  renderRecentList(data.slice(0,5));
  renderChartDonut(data);
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
  const fk = document.getElementById('filter-kat');
  const prev = fk.value;
  fk.innerHTML = '<option value="">Semua Kategori</option>' + 
                 S.kategori.map(k=>`<option value="${esc(k.nama)}">${esc(k.nama)}</option>`).join('');
  fk.value = prev;
  
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
  setJenis(t.jenis);
  setTimeout(()=>{ document.getElementById('trx-kategori').value=t.kategori; },30);
  document.getElementById('modal-trx-title').textContent = 'Edit Transaksi';
  openModal('modal-trx');
}

function setJenis(jenis) {
  S.jenisTrx = jenis;
  document.querySelectorAll('#jenis-toggle .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.jenis === jenis);
  });
  const sel = document.getElementById('trx-kategori');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Pilih kategori…</option>' +
    S.kategori.filter(k=>k.jenis===jenis).map(k=>`<option value="${esc(k.nama)}">${esc(k.nama)}</option>`).join('');
  if (cur) sel.value = cur;
}

async function submitTrx() {
  const id        = document.getElementById('trx-id').value;
  const tanggal   = document.getElementById('trx-tanggal').value;
  const jumlah    = parseNum(document.getElementById('trx-jumlah').value);
  const keterangan= document.getElementById('trx-keterangan').value.trim();
  const kategori  = document.getElementById('trx-kategori').value;
  const catatan   = document.getElementById('trx-catatan').value.trim();
  const jenis     = S.jenisTrx;

  if (!tanggal||!jumlah||!keterangan||!kategori) { toast('Isi semua field wajib', 'warn'); return; }
  
  const btn = document.getElementById('btn-submit-trx');
  btn.disabled=true; btn.textContent='Menyimpan...';

  try {
    if (id) {
      await apiPost({action:'updateTransaksi', id, tanggal, jumlah, keterangan, kategori, catatan, jenis});
      toast('Berhasil diupdate');
    } else {
      await apiPost({action:'addTransaksi', tanggal, jumlah, keterangan, kategori, catatan, jenis});
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
  const sel = document.getElementById('budget-kategori');
  sel.innerHTML = '<option value="">Pilih kategori…</option>' +
    S.kategori.filter(k=>k.jenis==='Pengeluaran').map(k=>`<option value="${esc(k.nama)}">${esc(k.nama)}</option>`).join('');
  document.getElementById('modal-budget-title').textContent = 'Tambah Budget';
  openModal('modal-budget');
}

function openEditBudget(id) {
  const b = S.budget.find(x=>x.id===id); if(!b)return;
  document.getElementById('budget-id').value = id;
  document.getElementById('budget-limit').value = numInput(b.limit);
  const sel = document.getElementById('budget-kategori');
  sel.innerHTML = '<option value="">Pilih kategori…</option>' +
    S.kategori.filter(k=>k.jenis==='Pengeluaran').map(k=>`<option value="${esc(k.nama)}">${esc(k.nama)}</option>`).join('');
  setTimeout(()=>{ sel.value=b.kategori; },30);
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
  try {
    toast('Menguji koneksi...', 'info');
    await apiCall({ action:'ping' }); // We can mock ping by changing logic or assume URL works if it doesn't fail
    toast('Koneksi berhasil!', 'info');
  } catch(e) {
    toast('Koneksi gagal: pastikan URL Apps Script benar', 'err');
  }
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
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
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
function renderHabits() {
  const dToday = today();
  
  // 1. Stats Calculation
  let perfectDays = 0;
  let streak = 0;
  let currentStreak = 0;
  let allLogs = S.habitLogs || [];
  let habits = S.habits || [];
  
  if (habits.length === 0) {
    document.getElementById('habit-streak-days').textContent = '0';
    document.getElementById('habit-perfect-days').textContent = '0';
    document.getElementById('habit-overall-text').textContent = '0%';
    document.getElementById('habit-overall-path').style.strokeDasharray = '0, 100';
    
    document.getElementById('habit-today-list').innerHTML = '<div class="text-center" style="font-size:12px;color:var(--text-3);">Belum ada kebiasaan</div>';
    document.getElementById('habit-today-pct').textContent = '0%';
    document.getElementById('habit-today-bar').style.width = '0%';
    document.getElementById('habit-today-count').textContent = '0 dari 0';
    
    renderHeatmap();
    return;
  }
  
  // Hitung total completed per hari
  const logsByDate = {};
  allLogs.forEach(lg => {
    if(!logsByDate[lg.tanggal]) logsByDate[lg.tanggal] = 0;
    logsByDate[lg.tanggal]++;
  });

  // Urutkan tanggal
  const sortedDates = Object.keys(logsByDate).sort();
  
  // Hitung Perfect Days (hari dimana jumlah log == jumlah habit aktif)
  // Untuk simplifikasi, anggap semua habit aktif sejak awal
  for (const d of sortedDates) {
    if (logsByDate[d] >= habits.length) perfectDays++;
  }
  
  // Streak
  // (Simplified streak counting backward from today or yesterday)
  let checkDate = new Date();
  let streakCount = 0;
  for(let i=0; i<365; i++) {
    const ds = checkDate.toISOString().split('T')[0];
    if (logsByDate[ds] > 0) {
      streakCount++;
    } else {
      if (i > 0) break; // if today is missing, we check yesterday. if yesterday missing, break.
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  // Overall Rate (Total Log / (Total Hari aktif * Total Habit))
  // Simplified to percentage of today
  
  document.getElementById('habit-streak-days').textContent = streakCount;
  document.getElementById('habit-perfect-days').textContent = perfectDays;
  
  // 2. Today's Progress
  let todayDone = logsByDate[dToday] || 0;
  let pct = habits.length ? Math.round((todayDone / habits.length) * 100) : 0;
  
  document.getElementById('habit-today-count').textContent = `${todayDone} dari ${habits.length}`;
  document.getElementById('habit-today-pct').textContent = `${pct}%`;
  document.getElementById('habit-today-bar').style.width = `${pct}%`;
  
  document.getElementById('habit-overall-text').textContent = `${pct}%`;
  document.getElementById('habit-overall-path').style.strokeDasharray = `${pct}, 100`;

  // Quote
  const qTitle = document.getElementById('habit-quote-title');
  const qDesc = document.getElementById('habit-quote-desc');
  if (pct === 0) {
    qTitle.textContent = "Ayo Mulai!"; qDesc.textContent = "Selesaikan satu kebiasaan untuk memulai harimu.";
  } else if (pct < 100) {
    qTitle.textContent = "Semangat!"; qDesc.textContent = "Sedikit lagi, selesaikan kebiasaan hari ini.";
  } else {
    qTitle.textContent = "Luar Biasa!"; qDesc.textContent = "Semua target hari ini tercapai. Pertahankan besok!";
  }

  // 3. Render Today List
  const listEl = document.getElementById('habit-today-list');
  listEl.innerHTML = habits.map(h => {
    const isDone = allLogs.find(lg => lg.habitId === h.id && lg.tanggal === dToday);
    return `
      <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-radius: 16px; margin:0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="color: var(--text-1);"><i data-feather="${h.ikon || 'check-circle'}" style="width: 20px; height: 20px;"></i></div>
          <div>
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 2px;">${esc(h.nama)}</h4>
            <span style="font-size: 11px; color: var(--text-3);">${esc(h.target)}</span>
          </div>
        </div>
        <button class="habit-check-btn ${isDone ? 'done' : ''}" onclick="toggleHabit('${h.id}', this)">
          <i data-feather="check"></i>
        </button>
      </div>
    `;
  }).join('');
  
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
  if (!navigator.onLine && !CFG.scriptUrl) { toast("Offline", 'warn'); return; }
  
  const isDone = !btn.classList.contains('done');
  // Optimistic UI update
  btn.classList.toggle('done');
  
  try {
    await apiPost({ action: 'toggleHabitLog', habitId: habitId, tanggal: today(), status: isDone ? "1" : "0" });
    // Reload logs
    S.habitLogs = await apiGet({ action: 'getHabitLogs' });
    renderHabits(); // Re-render to update stats
  } catch(e) {
    btn.classList.toggle('done'); // revert
    toast('Gagal mencatat habit', 'err');
  }
}

function openAddHabit() {
  document.getElementById('habit-id').value = '';
  document.getElementById('habit-nama').value = '';
  document.getElementById('habit-target').value = '';
  openModal('modal-habit');
}

async function submitHabit() {
  const nama = document.getElementById('habit-nama').value.trim();
  if (!nama) return toast('Nama habit wajib diisi', 'warn');
  
  const payload = {
    action: 'addHabit',
    nama: nama,
    target: document.getElementById('habit-target').value,
    tipe: document.getElementById('habit-tipe').value,
    frekuensi: document.getElementById('habit-frekuensi').value,
    ikon: document.getElementById('habit-ikon').value,
  };
  
  const btn = document.getElementById('btn-submit-habit');
  btn.textContent = '...';
  try {
    await apiPost(payload);
    toast('Habit tersimpan');
    closeModal('modal-habit');
    S.habits = await apiGet({ action: 'getHabits' });
    if(S.page === 'habits') renderHabits();
  } catch(e) {
    toast(e.message, 'err');
  }
  btn.textContent = 'Simpan';
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

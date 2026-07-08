# 📖 Panduan Setup FinanceMe

## Struktur File
```
keuangan-app/
├── index.html   ← Buka file ini di browser / upload ke Netlify
├── style.css    ← Styling (otomatis dimuat)
├── app.js       ← Logic aplikasi (otomatis dimuat)
└── Code.gs      ← Kode backend untuk Google Apps Script
```

---

## 🚀 Setup Cepat (5 Langkah)

### Langkah 1 — Buat Google Spreadsheet
1. Buka [sheets.new](https://sheets.new)
2. Beri nama spreadsheet: **"FinanceMe"**

### Langkah 2 — Buka Google Apps Script
1. Di spreadsheet, klik menu **Extensions** → **Apps Script**
2. Hapus semua kode yang sudah ada di editor

### Langkah 3 — Paste Kode Backend
1. Buka file `Code.gs` dari folder ini
2. Copy **seluruh isinya**
3. Paste ke editor Apps Script
4. Klik **Save** (Ctrl+S atau ⌘+S)

### Langkah 4 — Deploy sebagai Web App
1. Klik tombol **Deploy** (kanan atas)
2. Pilih **New deployment**
3. Klik ikon ⚙️ di "Select type" → pilih **Web app**
4. Isi pengaturan:
   - **Description**: FinanceMe API
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Klik **Deploy**
6. Jika diminta **Authorize** → klik dan ikuti langkahnya
7. **Copy URL** yang muncul (format: `https://script.google.com/macros/s/.../exec`)

### Langkah 5 — Hubungkan ke Aplikasi
1. Buka `index.html` di browser (atau deploy ke Netlify)
2. Aplikasi akan otomatis membuka halaman **Pengaturan**
3. Paste URL Apps Script ke field yang tersedia
4. Klik **🔍 Test** untuk verifikasi koneksi
5. Klik **💾 Simpan & Muat Data**

---

## 🌐 Deploy ke Netlify (Gratis)

### Cara Termudah — Drag & Drop
1. Buka [netlify.com](https://netlify.com) dan buat akun gratis
2. Di dashboard, scroll ke bawah sampai ada area **"Drag and drop your site folder here"**
3. Drag folder `keuangan-app/` ke area tersebut
4. Tunggu beberapa detik → Aplikasi langsung live! 🎉

### Atau via GitHub
1. Upload folder ke GitHub repository
2. Di Netlify → **Add new site** → **Import from Git**
3. Pilih repository → Deploy

---

## ⚠️ Catatan Penting

- **Data tersimpan di Google Sheets Anda sendiri** — bukan di server pihak ketiga
- **Tidak ada biaya** — Google Apps Script free tier sangat lebih dari cukup untuk personal use
- **Jika mengubah kode Apps Script**, Anda harus deploy ulang (New deployment) dan update URL-nya di Pengaturan
- **Backup rutin**: Data ada di Google Sheets, pastikan tidak menghapus spreadsheet tersebut

---

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "Gagal terhubung" | Pastikan URL Apps Script benar dan deployed dengan access "Anyone" |
| Data tidak muncul | Coba klik tombol 🔍 Test di Pengaturan, pastikan koneksi berhasil |
| CORS error di console | Pastikan Apps Script di-deploy ulang setelah perubahan kode |
| Kategori tidak muncul | Data kategori default otomatis dibuat saat pertama kali terhubung |

---

## 📱 Fitur Aplikasi

| Fitur | Keterangan |
|-------|------------|
| Dashboard | Ringkasan pemasukan/pengeluaran + grafik |
| Transaksi | Input, edit, hapus, cari, filter |
| Budget | Batas anggaran per kategori + progress bar |
| Kategori | 15 default + bisa tambah kustom |
| Laporan | Ringkasan bulanan + export CSV/Excel |
| Pengaturan | Konfigurasi URL + panduan setup |

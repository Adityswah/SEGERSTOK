# 📋 Product Requirements Document (PRD)
## SotoStock — Sistem Manajemen Stok Soto Seger JoyoBoyo
**Versi:** 2.0 | **Tanggal:** Mei 2026 | **Status:** Draft Initial | **Klasifikasi:** Konfidensial

---

## A. Overview

**SotoStock** adalah aplikasi manajemen stok berbasis web (PWA) yang dikembangkan khusus untuk operasional **Soto Seger JoyoBoyo**. Dokumen ini menyatukan visi antara owner, tim pengembang, dan operator sebelum proses development dimulai.

| Atribut | Detail |
|---|---|
| Nama Sistem | SotoStock — Manajemen Stok Kuliner |
| Klien | Soto Seger JoyoBoyo |
| Platform | Progressive Web App (PWA) — Chrome / Safari / Edge |
| Pengguna Aktif | Owner, Admin, Kasir (3 akun — PIN 6 digit) |
| Total Fitur | 25 fitur (termasuk 4 fitur AI) |
| Versi Dokumen | 2.0 — Revisi Lengkap |

### Ringkasan Metrik

| Metrik | Nilai |
|---|---|
| Total Fitur | 25 |
| Fitur AI | 4 |
| Role Pengguna | 3 akun aktif |
| Kategori Bahan Baku | 4 kategori |
| Fase Roadmap | 3 fase (MVP → Pro) |

---

## B. Ringkasan Eksekutif

**SotoStock** adalah aplikasi web manajemen stok bahan baku yang dirancang spesifik untuk warung soto skala UMKM. Sistem ini menggantikan pencatatan manual, mempercepat stock opname, dan — melalui modul AI — membantu owner mengantisipasi kenaikan harga bahan baku sebelum terjadi, sehingga bisa mengatur pembelian lebih hemat.

### 4 Nilai Utama

1. **Kontrol Stok Real-time** — Owner tahu kondisi stok kapanpun dari mana saja, tanpa harus datang ke warung.
2. **Stock Opname dari 3 Jam → 30 Menit** — Checklist digital menggantikan hitung manual di buku tulis.
3. **AI Prediksi Harga Bahan Baku** — Modul AI menganalisis tren harga historis + data musiman untuk memperingatkan kenaikan harga yang akan datang.
4. **Keamanan Data via PIN** — Setiap peran memiliki PIN dan hak akses berbeda.

---

## C. Latar Belakang & Masalah

### 15 Masalah Utama Bisnis Kuliner Indonesia

| # | Masalah | Dampak Bisnis | Prioritas |
|---|---|---|---|
| 01 | Stok dicatat manual di buku | Data hilang, tidak bisa diakses jarak jauh | 🔴 Sangat Tinggi |
| 02 | Tidak ada alert stok habis | Kehabisan bahan saat jam sibuk, revenue hilang | 🔴 Sangat Tinggi |
| 03 | Stock opname butuh waktu lama | 3–5 jam hitung fisik, operasional terganggu | 🔴 Sangat Tinggi |
| 04 | Tidak bisa lacak stok masuk vs keluar | Tidak tahu bahan "hilang" karena dipakai atau dicuri | 🔴 Sangat Tinggi |
| 05 | Harga bahan naik tiba-tiba | Tidak ada antisipasi, margin untung tergerus mendadak | 🔴 Sangat Tinggi |
| 06 | Pembelian bahan tidak terencana | Over-buying → busuk; under-buying → kehabisan | 🟠 Tinggi |
| 07 | Tidak ada histori pergerakan stok | Tidak bisa analisis pola konsumsi untuk optimasi menu | 🟠 Tinggi |
| 08 | Bahan expired tidak terdeteksi | Risiko menyajikan makanan tidak layak konsumsi | 🟠 Tinggi |
| 09 | Akses data tidak dibatasi per peran | Semua karyawan bisa ubah/manipulasi data | 🟠 Tinggi |
| 10 | Tidak ada laporan kerugian food waste | Owner tidak tahu nilai bahan terbuang per bulan | 🟠 Tinggi |
| 11 | Supplier tidak terdata | Sulit lacak harga terbaik, tidak bisa negosiasi data | 🔵 Sedang |
| 12 | Tidak ada standar reorder point | Tidak ada patokan kapan harus beli bahan lagi | 🔵 Sedang |
| 13 | Rekonsiliasi keuangan stok sulit | Pengeluaran bahan tidak bisa diverifikasi dengan stok aktual | 🔵 Sedang |
| 14 | Onboarding karyawan baru lama | Pencatatan tidak konsisten antar karyawan | 🔵 Sedang |
| 15 | Tidak ada backup data stok | Buku hilang/rusak = semua histori stok hilang selamanya | 🟢 Rendah |

---

## D. Pengguna & Kebutuhan

### 4 Tipe Pengguna Sistem

| Role | Level Akses | Fitur Kunci | Autentikasi |
|---|---|---|---|
| **Owner** | Penuh | Semua fitur + hapus data + setting AI + ekspor laporan | PIN 6 digit |
| **Admin** | Operasional | Input stok masuk/keluar, stock opname, tambah bahan baru | PIN 6 digit |
| **Kasir** | Terbatas | Lihat stok (read-only), input pemakaian harian, notifikasi | PIN 6 digit |
| **Chef** | View-only | Lihat ketersediaan bahan, request tambah stok ke Admin | Fase 2 |

> **Catatan:** Hanya 3 akun yang bisa login aktif sesuai permintaan klien. Chef ditambahkan di Fase 2. Tidak ada email — semua autentikasi via PIN 6 digit.

---

## E. Fitur & Spesifikasi — 25 Fitur

### Fitur Inti Manajemen Stok (F01–F08)

| Kode | Nama Fitur | User | Prioritas |
|---|---|---|---|
| F01 | Dashboard ringkasan real-time | Semua | 🔴 Sangat Tinggi |
| F02 | Manajemen master data bahan | Owner, Admin | 🔴 Sangat Tinggi |
| F03 | Pencatatan stok masuk (inbound) | Owner, Admin | 🔴 Sangat Tinggi |
| F04 | Pencatatan stok keluar (outbound) | Semua | 🔴 Sangat Tinggi |
| F05 | Stock opname digital | Owner, Admin | 🔴 Sangat Tinggi |
| F06 | Laporan histori pergerakan stok | Owner, Admin | 🟠 Tinggi |
| F07 | Alert & notifikasi stok kritis | Owner, Admin | 🟠 Tinggi |
| F08 | Manajemen akun & PIN per role | Owner | 🔵 Sedang |

### Fitur Laporan & Analitik (F09–F14)

| Kode | Nama Fitur | User | Prioritas |
|---|---|---|---|
| F09 | Chart konsumsi bahan 7 / 30 hari | Owner, Admin | 🟠 Tinggi |
| F10 | Laporan nilai total stok (Rupiah) | Owner | 🟠 Tinggi |
| F11 | Ekspor laporan ke PDF & Excel | Owner, Admin | 🟠 Tinggi |
| F12 | Laporan food waste & selisih opname | Owner | 🔵 Sedang |
| F13 | Top 10 bahan paling cepat habis | Owner, Admin | 🔵 Sedang |
| F14 | Riwayat opname & audit trail | Owner | 🔵 Sedang |

### Fitur Operasional Lanjutan (F15–F21)

| Kode | Nama Fitur | User | Prioritas |
|---|---|---|---|
| F15 | Manajemen data supplier | Owner, Admin | 🔵 Sedang |
| F16 | Pencatatan tanggal kadaluarsa bahan | Admin | 🔵 Sedang |
| F17 | Reorder point otomatis per bahan | Owner, Admin | 🔵 Sedang |
| F18 | Input batch multi-bahan satu form | Admin | 🔵 Sedang |
| F19 | Pencarian & filter bahan canggih | Semua | 🟢 Rendah |
| F20 | Riwayat harga beli per supplier | Owner | 🟢 Rendah |
| F21 | Notifikasi WhatsApp (webhook) | Owner | 🟢 Rendah |

### 🤖 Fitur AI — Prediksi Harga Bahan Baku (F22–F25)

| Kode | Nama Fitur | Fase | Prioritas |
|---|---|---|---|
| F22 | AI Prediksi Kenaikan Harga Bahan | Fase 2 | 🟠 Tinggi |
| F23 | Rekomendasi Waktu Beli Terbaik | Fase 2 | 🟠 Tinggi |
| F24 | Deteksi Anomali Stok Otomatis | Fase 2 | 🔵 Sedang |
| F25 | Proyeksi Kebutuhan Stok Mingguan | Fase 3 | 🔵 Sedang |

#### Detail Fitur AI

**F22 — AI Prediksi Kenaikan Harga Bahan**
Model time-series (ARIMA/Prophet) menganalisis histori harga beli tiap bahan baku. Sistem menampilkan prediksi harga 2–4 minggu ke depan dengan indikator: **Stabil / Waspada / Akan Naik**. Data diperkaya dengan pola musiman (Ramadan, Lebaran, akhir tahun) dan tren inflasi pangan Indonesia.

**F23 — Rekomendasi Waktu Beli Terbaik**
Berdasarkan prediksi harga dan stok saat ini, AI merekomendasikan: *"Beli daging sapi minggu ini sebelum harga naik ~12% menjelang Lebaran."* Owner mendapat notifikasi push beserta estimasi penghematan dalam Rupiah jika beli lebih awal.

**F24 — Deteksi Anomali Stok Otomatis**
AI mendeteksi pola tidak wajar: stok keluar jauh di atas rata-rata harian (potensi pemborosan/pencurian), stok tidak berkurang padahal ada transaksi penjualan, atau selisih opname yang berulang pada item yang sama.

**F25 — Proyeksi Kebutuhan Stok Mingguan**
AI menganalisis pola pemakaian historis dan memproyeksikan kebutuhan minggu depan — termasuk penyesuaian hari ramai (Jumat–Minggu) vs sepi. Output: draft daftar belanja otomatis yang bisa dikirim ke supplier via WhatsApp.

---

## F. Core Features

### Dashboard Utama
- Kartu metrik real-time: total item aktif, item kritis (stok < minimum), nilai stok total (Rp), jumlah transaksi hari ini
- Chart stok masuk vs keluar (7 hari) — line chart interaktif
- Panel AI insight: 1–2 rekomendasi AI terbaru (prediksi harga naik / anomali)
- Alert banner merah: daftar bahan stok kritis, klik langsung buka form input

### Manajemen Produk (Master Data)
- CRUD bahan baku: nama, kategori, satuan, stok minimum, harga beli rata-rata
- Kategorisasi: Protein & Daging, Sayuran, Bumbu Basah, Bahan Kering
- Chart dari master data: pie chart distribusi kategori, bar chart stok per bahan

### Pencatatan Stok Masuk (Inbound)
- Form pembelian bahan baku: tanggal, nama bahan, jumlah, satuan, harga satuan, supplier
- Support multi-item dalam satu transaksi pembelian
- Auto-update stok saat ini setelah form disimpan

### Pencatatan Stok Keluar (Outbound)
- Form pemakaian bahan saat memasak: tanggal, sesi (pagi/siang/malam), bahan, jumlah, keterangan
- Support input batch untuk satu sesi memasak lengkap
- Auto-kurangi stok saat ini setelah tersimpan

### Stock Opname Digital
- **Buat sesi:** nama sesi, tanggal, penanggung jawab — sistem load semua bahan aktif ke checklist
- **Input stok aktual:** per bahan tampilkan stok sistem vs kolom input stok fisik, progress bar % selesai
- **Rekonsiliasi:** selisih dihitung otomatis, stok sistem diupdate ke nilai aktual
- **Laporan:** ringkasan per kategori, total nilai selisih (Rp), ekspor ke PDF

### Laporan Riwayat (Movement Logs)
- Tabel semua transaksi (masuk, keluar, opname) dengan kolom: tanggal, waktu, tipe, bahan, jumlah, satuan, operator, keterangan
- Filter by: rentang tanggal, tipe transaksi, kategori bahan, operator
- Export ke Excel / PDF

---

## G. Requirements

### Aksesibilitas

| Platform | Spesifikasi |
|---|---|
| Desktop (utama) | Chrome/Edge/Firefox, resolusi min 1280×768px |
| Mobile | Responsive 375px+, fitur terbatas: monitoring & input cepat |
| Koneksi | Online first; PWA cache untuk dashboard + form input saat offline sementara |

### Pengguna & Autentikasi

| Aspek | Spesifikasi |
|---|---|
| Jumlah akun | Maks. 3 akun aktif (Owner, Admin, Kasir) |
| Autentikasi | PIN 6 digit per akun — tidak perlu email/password |
| Sesi login | Auto-logout setelah 8 jam tidak aktif |
| PIN reset | Hanya Owner yang bisa reset PIN semua akun |
| Brute force | Kunci 30 menit setelah 5x salah PIN, Owner notifikasi |

### Data Input & Validasi

| Field | Aturan Validasi |
|---|---|
| Nama bahan | Min 3 karakter, unik, tidak boleh kosong |
| Jumlah stok | Angka positif, desimal 2 digit, tidak negatif |
| Tanggal | Tidak boleh melebihi hari ini (tanpa izin Owner) |
| Harga | Bilangan bulat Rupiah, min Rp 100 |
| Stok minimum | Angka ≥ 0, default = 0 |

### Notifikasi

| Tipe | Trigger | Channel |
|---|---|---|
| Stok kritis | Stok ≤ stok minimum | Banner merah dashboard |
| Stok rendah | Stok 20% di atas minimum | Label kuning, sidebar list |
| Opname terlambat | Tidak ada sesi opname 7+ hari | Pop-up dashboard |
| AI harga naik | Prediksi AI kenaikan >8% | Widget dashboard + email |
| Anomali stok | Pola konsumsi abnormal terdeteksi | Alert banner khusus |

---

## H. Architecture

### Diagram Arsitektur (5 Layer)

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1 — PENGGUNA                       │
│         Owner  ·  Admin  ·  Kasir                           │
│         via Web Browser (Chrome / Safari / Edge)            │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS / TLS 1.3
┌─────────────────────────▼───────────────────────────────────┐
│                LAYER 2 — FRONTEND (PWA)                     │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────────┐  │
│  │ React + Vite │ │ Tailwind CSS│ │ Chart.js / Recharts  │  │
│  └──────────────┘ └─────────────┘ └──────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Service Worker (PWA Offline Cache)          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API / JSON
┌─────────────────────────▼───────────────────────────────────┐
│              LAYER 3 — BACKEND API + AI ENGINE              │
│                                                             │
│  ┌────────────────────────┐  ┌────────────────────────────┐ │
│  │     BACKEND API        │  │       AI ENGINE            │ │
│  │  Node.js + Express     │◄►│  Python + Prophet/ARIMA    │ │
│  │  REST API + JWT Auth   │  │  Anomaly Detection         │ │
│  │  Role Middleware       │  │  Price Forecasting         │ │
│  │  PIN bcrypt (salt 12)  │  │  Nightly Cron Job          │ │
│  └────────────────────────┘  └────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 LAYER 4 — DATA LAYER                        │
│   PostgreSQL (primary) · Redis (cache + session)            │
│   Local Storage (PWA offline)                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│             LAYER 5 — CLOUD INFRASTRUCTURE                  │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────────┐  │
│  │    Vercel    │ │   Railway   │ │ Supabase (PostgreSQL) │  │
│  │  (Frontend)  │ │  (Backend)  │ │     + Edge Fn        │  │
│  └──────────────┘ └─────────────┘ └──────────────────────┘  │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────────┐  │
│  │  Cloudflare  │ │GitHub Action│ │  Upstash Redis Cloud │  │
│  │  CDN + SSL   │ │   (CI/CD)   │ │      (Cache)         │  │
│  └──────────────┘ └─────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Skema Database — 5 Tabel Utama

| Tabel | Field Kunci | Relasi |
|---|---|---|
| `bahan_baku` | id, nama, kategori, satuan, stok_saat_ini, stok_minimum, harga_beli_avg, status | Parent → transaksi, opname_detail |
| `transaksi_stok` | id, bahan_id, tipe (masuk/keluar), jumlah, harga_satuan, tanggal, operator_id, catatan | Child ← bahan_baku |
| `stock_opname` | id, tanggal, operator_id, status (draft/selesai), total_selisih_nilai | Parent → opname_detail |
| `opname_detail` | id, opname_id, bahan_id, stok_sistem, stok_aktual, selisih, nilai_selisih | Child ← opname, bahan_baku |
| `ai_predictions` | id, bahan_id, tanggal_prediksi, harga_prediksi, confidence, status (stabil/waspada/naik), model_version | Child ← bahan_baku |

---

## I. Kebutuhan Non-Fungsional

### Performa

| Metrik | Target |
|---|---|
| First Contentful Paint | ≤ 2 detik (4G Indonesia) |
| Time to Interactive | ≤ 3.5 detik |
| API Response CRUD | ≤ 500ms |
| AI Prediction Load | ≤ 2 detik (hasil cache nightly) |
| Uptime | 99.5% per bulan |

### Keamanan PIN

| Aspek | Implementasi |
|---|---|
| Enkripsi PIN | bcrypt hash, salt rounds 12 — tidak pernah plain text |
| Brute force | Kunci 30 menit setelah 5x salah, Owner mendapat notifikasi |
| Session | JWT short-lived (8 jam), refresh token di server |
| Transport | HTTPS/TLS 1.3 wajib, HTTP auto-redirect |
| Audit log | Semua aksi: siapa, apa, kapan, IP — disimpan 90 hari |

### UX — Desain Apple-style

| Prinsip | Implementasi |
|---|---|
| Minimalism | Putih/abu dominan, satu aksen oranye brand #FF6B35 |
| Typography | SF Pro Display / system-ui, hierarki font jelas 4 level |
| Spacing | 8px grid system, padding 16/20/24px konsisten |
| Motion | Ease-in-out 200–300ms, tidak ada animasi berlebihan |
| Feedback | Loading skeleton, success toast 3 detik, error inline form |

### Online / Offline

Aplikasi berjalan secara **online** sebagai kebutuhan utama. Dengan arsitektur PWA, service worker akan cache halaman dashboard, master data bahan baku, dan form input stok keluar — tetap bisa digunakan saat koneksi putus sementara. Data yang diinput offline tersinkronisasi otomatis saat koneksi kembali aktif.

---

## J. Data Awal Bahan Baku

### Kategori 1 — Protein & Daging

| # | Nama Bahan | Satuan |
|---|---|---|
| 1 | Daging sapi sandung lamur | kg |
| 2 | Daging sapi has dalam | kg |
| 3 | Daging sapi iga | kg |
| 4 | Babat sapi | kg |
| 5 | Kikil sapi | kg |
| 6 | Paru sapi | kg |
| 7 | Lidah sapi | kg |
| 8 | Sumsum tulang sapi | kg |
| 9 | Tulang sapi kaldu | kg |
| 10 | Ayam kampung utuh | ekor |
| 11 | Telur ayam kampung | butir |
| 12 | Telur ayam negeri | butir |
| 13 | Tahu putih | buah |
| 14 | Tempe | papan |
| 15 | Perkedel kentang | buah |
| 16 | Sate usus | tusuk |
| 17 | Sate ayam | tusuk |
| 18 | Pindang telur | butir |

### Kategori 2 — Sayuran & Pelengkap

| # | Nama Bahan | Satuan |
|---|---|---|
| 1 | Kol / kubis segar | kg |
| 2 | Taoge pendek | kg |
| 3 | Wortel | kg |
| 4 | Kentang | kg |
| 5 | Tomat segar | kg |
| 6 | Sawi hijau | ikat |
| 7 | Daun bawang | ikat |
| 8 | Seledri | ikat |
| 9 | Peterseli | ikat |
| 10 | Buncis | kg |
| 11 | Jeruk nipis | buah |
| 12 | Jeruk kunci | buah |
| 13 | Taoge panjang | kg |
| 14 | Kacang tanah goreng | kg |

### Kategori 3 — Bumbu Basah & Rempah Segar

| # | Nama Bahan | Satuan |
|---|---|---|
| 1 | Bawang merah | kg |
| 2 | Bawang putih | kg |
| 3 | Jahe segar | kg |
| 4 | Kunyit segar | kg |
| 5 | Lengkuas | kg |
| 6 | Serai | batang |
| 7 | Daun jeruk | lembar |
| 8 | Daun salam | lembar |
| 9 | Cabai rawit merah | kg |
| 10 | Cabai merah keriting | kg |
| 11 | Kemiri | biji |
| 12 | Kencur | kg |
| 13 | Daun kunyit | lembar |
| 14 | Daun pandan | lembar |

### Kategori 4 — Bahan Kering & Bumbu Kering

| # | Nama Bahan | Satuan |
|---|---|---|
| 1 | Ketumbar bubuk | gram |
| 2 | Jinten bubuk | gram |
| 3 | Merica bubuk | gram |
| 4 | Pala bubuk | gram |
| 5 | Kayu manis | gram |
| 6 | Cengkeh | gram |
| 7 | Kapulaga | gram |
| 8 | Bunga lawang | gram |
| 9 | Kunyit bubuk | gram |
| 10 | Garam dapur | kg |
| 11 | Gula pasir | kg |
| 12 | Gula merah | kg |
| 13 | Penyedap kaldu sapi | sachet |
| 14 | Vetsin / MSG | gram |
| 15 | Kecap manis | botol |
| 16 | Kecap asin | botol |
| 17 | Cuka makan | botol |
| 18 | Minyak goreng | liter |
| 19 | Santan instan | kotak |
| 20 | Santan segar | liter |
| 21 | Bawang goreng siap pakai | kg |
| 22 | Mie kuning basah | kg |
| 23 | Mie bihun | kg |
| 24 | Mie soun | kg |
| 25 | Lontong | bungkus |
| 26 | Beras putih | kg |
| 27 | Kerupuk udang | kg |
| 28 | Emping melinjo | kg |
| 29 | Sambal pecel botol | botol |
| 30 | Teh celup | box |
| 31 | Gula aren | kg |
| 32 | Air mineral galon | galon |

---

## K. Roadmap — 3 Fase Pengembangan

### Fase 1 — MVP: Fondasi Stok Digital
**Estimasi:** 6–8 Minggu

Fokus pada kebutuhan paling mendasar: mencatat stok masuk-keluar secara digital dan melakukan stock opname.

**Deliverable:**
- [ ] Dashboard ringkasan (F01)
- [ ] Master data bahan 4 kategori (F02)
- [ ] Input stok masuk / keluar (F03, F04)
- [ ] Stock opname digital (F05)
- [ ] Login PIN 3 akun (F08)
- [ ] Alert stok kritis (F07)
- [ ] Chart 7 hari (F09)

### Fase 2 — Analitik + AI Dasar
**Estimasi:** 4–6 Minggu setelah Fase 1

Memperkuat laporan, menambah chart analitik, dan meluncurkan modul AI prediksi harga.

**Deliverable:**
- [ ] Laporan lengkap + ekspor PDF/Excel (F10, F11, F12, F13)
- [ ] Audit trail & riwayat opname (F14)
- [ ] Manajemen supplier (F15)
- [ ] Tracking kadaluarsa (F16)
- [ ] Reorder point otomatis (F17)
- [ ] Role Chef (view-only)
- [ ] **AI F22** — Prediksi kenaikan harga
- [ ] **AI F23** — Rekomendasi waktu beli terbaik
- [ ] **AI F24** — Deteksi anomali stok otomatis
- [ ] Notifikasi WhatsApp webhook (F21)

### Fase 3 — AI Lanjutan & Integrasi
**Estimasi:** 6–8 Minggu setelah Fase 2

Fitur lanjutan untuk scale-up bisnis dan integrasi sistem.

**Deliverable:**
- [ ] **AI F25** — Proyeksi kebutuhan stok mingguan
- [ ] Draft daftar belanja otomatis ke WhatsApp
- [ ] Resep & Bill of Materials (BOM)
- [ ] Integrasi POS / kasir
- [ ] Multi-cabang support

---

## L. Kriteria Keberhasilan

### KPI Teknis

| Metrik | Target |
|---|---|
| Akurasi data stok vs fisik | Selisih ≤ 2% setelah 30 hari operasional |
| Load time dashboard | ≤ 3 detik pada 4G rata-rata Indonesia |
| Uptime bulanan | ≥ 99.5% (maks. downtime 3.6 jam/bulan) |
| Keamanan | Zero unauthorized access, semua aksi di audit trail |
| Akurasi AI prediksi harga | Mean Absolute Error (MAE) ≤ 8% setelah 3 bulan data |

### KPI Pengguna (1 Bulan Pertama)

| Indikator | Target |
|---|---|
| Adopsi harian | Ketiga akun aktif setiap hari operasional |
| Frekuensi opname | Min. 1 sesi per minggu |
| Onboarding | Karyawan baru bisa pakai fitur dasar ≤ 30 menit tanpa training |
| Waktu opname | Berkurang dari ~3 jam menjadi ≤ 45 menit |

### KPI Bisnis (3 Bulan)

| Indikator | Target |
|---|---|
| Pengurangan food waste | Turun ≥ 20% dibanding sebelum pakai sistem |
| Zero stockout | Tidak ada kehabisan bahan saat jam operasional |
| Efisiensi pembelian | Over-buying berkurang ≥ 15% via rekomendasi AI |
| Penghematan harga bahan | Owner berhasil beli lebih murah 1x/bulan berdasarkan prediksi AI |

---

## M. Catatan & Asumsi

### Asumsi Pengembangan

| # | Asumsi | Implikasi |
|---|---|---|
| A1 | Satu lokasi warung saja | Multi-branch ditunda ke Fase 3 |
| A2 | Koneksi internet tersedia | Online-first; offline mode adalah bonus |
| A3 | Tidak ada integrasi POS di Fase 1 | Stok keluar input manual; otomasi di Fase 3 |
| A4 | Mata uang IDR saja | Format Rp, tidak perlu multi-currency |
| A5 | Owner tidak berlatar belakang teknis | UI sangat intuitif, onboarding wizard wajib ada |
| A6 | Minimal 90 hari data harga diperlukan | Fitur AI prediksi tampil setelah data cukup |

### Pertanyaan yang Perlu Dikonfirmasi Owner

| Pertanyaan | Status |
|---|---|
| Apakah perlu tracking tanggal kadaluarsa per bahan? | ⏳ Perlu konfirmasi |
| Berapa sesi memasak per hari (pagi/siang/malam)? | ⏳ Perlu konfirmasi |
| Apakah kasir boleh lihat harga beli bahan? | ⏳ Perlu konfirmasi |
| Supplier utama yang sering digunakan? | ⏳ Perlu konfirmasi |
| Apakah ada karyawan yang bisa jadi Admin selain Owner? | ⏳ Perlu konfirmasi |

### Rekomendasi Tech Stack

| Komponen | Teknologi | Alasan |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Ekosistem besar, cepat, mudah cari developer |
| Backend | Node.js + Express + Prisma ORM | JavaScript end-to-end, development cepat |
| Database | PostgreSQL via Supabase | Free tier cukup, realtime built-in, auto-backup |
| AI Engine | Python + Prophet / statsforecast | Library time-series terbaik untuk use case ini |
| Hosting FE | Vercel | Free tier, auto-deploy dari GitHub |
| Hosting BE | Railway | Simple deployment, Node.js support |
| Cache | Upstash Redis | Serverless Redis, free tier tersedia |
| CDN + SSL | Cloudflare | Gratis, performa tinggi di Indonesia |
| CI/CD | GitHub Actions | Otomasi testing & deployment |

---

*Dokumen ini adalah milik Soto Seger JoyoBoyo. Dilarang disebarluaskan tanpa izin pemilik.*

**PRD SotoStock v2.0 — Mei 2026**
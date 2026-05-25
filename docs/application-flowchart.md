# SEGERSTOK Application Flowchart

Dokumen ini memetakan cara kerja aplikasi full-stack SEGERSTOK berdasarkan struktur kode saat ini: frontend Next.js, API routes, auth role, database PostgreSQL/Supabase via Drizzle, AI pipeline, dan Owner AI Bot.

## 1. Flow Utama Aplikasi

```mermaid
flowchart TD
  A["User membuka segerstok.vercel.app"] --> B["Next.js App Router render halaman utama"]
  B --> C["SotoStockApp client component"]
  C --> D["Better Auth session check"]
  D --> E{"Session valid?"}
  E -->|"Tidak"| F["Tampilkan auth/sign-in flow"]
  E -->|"Ya"| G["Ambil user role"]

  G --> H{"Role user"}
  H -->|"Owner"| I["Akses semua menu"]
  H -->|"Kasir / Cheef / Waiters"| J["Akses terbatas: stok masuk, stok keluar, opname"]

  I --> K["Load data awal Owner"]
  K --> K1["GET /api/ingredients"]
  K --> K2["GET /api/transactions"]
  K --> K3["GET /api/price-predictions"]
  K1 --> DB1[("ingredients")]
  K2 --> DB2[("stock_transactions")]
  K3 --> P1{"Ada data AI terbaru?"}
  P1 -->|"Ya"| DB3[("ai_material_risk_daily")]
  P1 -->|"Tidak"| DB4[("price_predictions legacy")]
  DB3 --> K4["Render Dashboard, Stock, Prediksi Harga, Laporan"]
  DB4 --> K4

  J --> L["Load data staff"]
  L --> L1["GET /api/ingredients"]
  L1 --> DB1
  L1 --> L2["Render input stok dan opname"]

  K4 --> M["User menjalankan workflow"]
  L2 --> M
  M --> N{"Jenis workflow"}
  N -->|"Input stok masuk / keluar"| O["POST /api/transactions atau /api/transactions/batch"]
  N -->|"Opname tanggal 30"| Q["POST /api/opname"]
  N -->|"Master bahan Owner"| R["POST/PATCH/PUT /api/ingredients"]
  N -->|"AI Bot Owner"| S["POST /api/ai-bot/query"]

  O --> T["Validasi session, role, rate limit, schema"]
  T --> U["Insert transaksi"]
  U --> V["Update stock ingredients"]
  V --> DB1
  U --> DB2

  Q --> W["Validasi role dan tanggal 30 Asia/Jakarta"]
  W --> X["Insert stock_opname dan stock_opname_details"]
  X --> DB5[("stock_opname")]
  X --> DB6[("stock_opname_details")]

  R --> Y["Validasi Owner dan schema master data"]
  Y --> DB1

  S --> Z["AI Bot response ke Owner"]
```

## 2. Flow Prediksi Harga dan AI Pipeline

```mermaid
flowchart TD
  A["Trigger AI pipeline"] --> B{"Sumber trigger"}
  B -->|"Cron / monitor"| C["GET /api/ai/refresh dengan CRON_SECRET"]
  B -->|"Owner manual refresh"| D["POST /api/ai/refresh"]
  B -->|"AI summary kosong"| E["GET /api/ai/summary menjalankan runAiPipeline"]
  B -->|"AI Bot data kosong"| F["POST /api/ai-bot/query menjalankan runAiPipeline"]

  C --> G["runAiPipeline"]
  D --> G
  E --> G
  F --> G

  G --> H["Record run start"]
  H --> R1[("ai_pipeline_runs")]
  H --> I["Load input data paralel"]
  I --> I1["loadExternalFeedSignals"]
  I --> I2["Select active ingredients"]
  I --> I3["Select price_predictions legacy"]
  I2 --> DB1[("ingredients")]
  I3 --> DB2[("price_predictions")]

  I1 --> J["Build static + external source signals"]
  J --> K["Persist source signals"]
  K --> DB3[("ai_source_signals")]

  K --> L["Ambil recent signals 7 hari terakhir"]
  L --> DB3
  L --> M{"price_predictions legacy ada?"}
  M -->|"Ya"| N["Gunakan price_predictions sebagai baseline"]
  M -->|"Tidak"| O["Gunakan buildFallbackPredictions dari data statis"]

  N --> P["buildMaterialRisks"]
  O --> P
  P --> Q["Hitung riskScore, risk, trendPercent, predictedPrice"]
  Q --> R["Persist material risk harian"]
  R --> DB4[("ai_material_risk_daily")]

  R --> S["Ambil transaksi keluar 28 hari terakhir"]
  S --> DB5[("stock_transactions")]
  S --> T["buildWeeklyProjections"]
  T --> U["Persist proyeksi stok mingguan"]
  U --> DB6[("ai_weekly_stock_projections")]

  U --> V["buildRecommendations"]
  V --> W["Persist rekomendasi beli"]
  W --> DB7[("ai_buy_recommendations")]

  W --> X["Purge data lama sesuai retention"]
  X --> Y["Record run finish: success / partial / failed"]
  Y --> R1

  DB4 --> Z["GET /api/price-predictions"]
  Z --> ZA{"Ada ai_material_risk_daily terbaru?"}
  ZA -->|"Ya"| ZB["Return data AI real ke halaman Prediksi Harga"]
  ZA -->|"Tidak"| ZC["Fallback ke price_predictions lama"]
```

## 3. Flow Owner AI Bot

```mermaid
flowchart TD
  A["Owner membuka aplikasi"] --> B["OwnerAiBot muncul"]
  B --> C{"Aksi Owner"}
  C -->|"Klik refresh"| D["POST /api/ai/refresh"]
  C -->|"Kirim pertanyaan"| E["POST /api/ai-bot/query"]

  D --> F["Validasi session dan role Owner"]
  F --> G["runAiPipeline"]
  G --> H["Update risks, projections, recommendations"]

  E --> I["guardMutation rate limit"]
  I --> J["requireSession"]
  J --> K{"Role Owner?"}
  K -->|"Tidak"| L["403 Forbidden"]
  K -->|"Ya"| M["Parse message dengan Zod"]

  M --> N["readAiSummaryForOwner"]
  N --> N1[("ai_material_risk_daily")]
  N --> N2[("ai_weekly_stock_projections")]
  N --> N3[("ai_buy_recommendations")]
  N --> N4[("ai_pipeline_runs")]

  N --> O{"Summary kosong?"}
  O -->|"Ya"| P["runAiPipeline lalu read ulang summary"]
  O -->|"Tidak"| Q["Gunakan summary existing"]
  P --> Q

  Q --> R["searchIngredientsForBot dari pesan Owner"]
  R --> R1[("ingredients")]
  Q --> S["Tokenisasi pertanyaan dan deteksi intent"]
  R --> S

  S --> T{"Intent pertanyaan"}
  T -->|"Stok / tersedia"| U["Jawab stok, minimum, status aman/kritis"]
  T -->|"Harga / prediksi / naik"| V["Jawab risiko harga, prediksi, trendPercent"]
  T -->|"Kapan / rekomendasi beli"| W["Jawab action: beli sekarang, bertahap, tunda"]
  T -->|"Minggu / proyeksi"| X["Jawab proyeksi stok mingguan dan stock cover days"]
  T -->|"Umum"| Y["Jawab ringkasan cepat prioritas operasional"]

  U --> Z["Return reply ke chat UI"]
  V --> Z
  W --> Z
  X --> Z
  Y --> Z
```

## 4. Ringkasan Endpoint dan Tabel

| Area | Endpoint | Role | Tabel utama | Fungsi |
|---|---|---:|---|---|
| Auth | `/api/auth/[...all]` | Semua | `user`, `session`, `account`, `verification` | Login/session via Better Auth |
| Stok bahan | `GET /api/ingredients` | Semua login | `ingredients` | Ambil master bahan aktif |
| Master bahan | `POST/PATCH/PUT /api/ingredients` | Owner | `ingredients` | Tambah/edit bahan, kategori, unit |
| Transaksi stok | `POST /api/transactions` | Owner/Kasir/Cheef/Waiters | `stock_transactions`, `ingredients` | Catat stok masuk/keluar dan update stok |
| Batch transaksi | `POST /api/transactions/batch` | Owner/Kasir/Cheef/Waiters | `stock_transactions`, `ingredients` | Input banyak transaksi sekaligus |
| Riwayat transaksi | `GET /api/transactions` | Owner | `stock_transactions` | Audit transaksi |
| Opname | `POST /api/opname` | Owner/Kasir/Cheef/Waiters | `stock_opname`, `stock_opname_details` | Input aktual lapangan tanggal 30 |
| Laporan opname | `GET /api/opname` | Owner | `stock_opname` | Lihat laporan opname |
| Prediksi harga | `GET /api/price-predictions` | Owner | `ai_material_risk_daily`, fallback `price_predictions` | Tampilkan prediksi harga real dari AI |
| AI summary | `GET /api/ai/summary` | Owner | `ai_material_risk_daily`, `ai_weekly_stock_projections`, `ai_buy_recommendations`, `ai_pipeline_runs` | Ringkasan AI dashboard/bot |
| AI refresh | `GET/POST /api/ai/refresh` | Cron/Owner | Semua tabel AI | Jalankan pipeline AI |
| AI bot | `POST /api/ai-bot/query` | Owner | Tabel AI + `ingredients` | Jawab pertanyaan operasional Owner |
| Health check | `GET /api/health`, `GET /api/ai/health` | Publik/internal | DB + `ai_pipeline_runs` | Monitoring status aplikasi |

## 5. Catatan Teknis Penting

- AI Bot saat ini bekerja sebagai rule-based operational assistant: ia membaca database internal dan hasil pipeline AI, lalu menyusun jawaban berdasarkan intent pertanyaan.
- Data prediksi harga di halaman `Prediksi Kenaikan Harga` sekarang diprioritaskan dari `ai_material_risk_daily` terbaru. Jika tabel AI kosong, endpoint baru fallback ke `price_predictions` lama.
- Role staff hanya masuk ke workflow input operasional. Role Owner adalah satu-satunya role yang membaca dashboard, laporan, prediksi harga, dan AI Bot.
- `POST /api/transactions` dan `POST /api/transactions/batch` memakai transaksi database untuk menjaga konsistensi: insert transaksi dan update stok dilakukan dalam satu unit kerja.
- Opname dibatasi ke tanggal 30 zona waktu `Asia/Jakarta`, sehingga validasi waktu ada di backend, bukan hanya di UI.

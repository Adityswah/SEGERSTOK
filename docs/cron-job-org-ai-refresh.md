# Setup cron-job.org untuk AI Refresh

Dokumen ini dipakai untuk menjalankan pipeline AI SotoStock setiap 30-60 menit melalui scheduler eksternal `cron-job.org`.

## Target Endpoint

```text
GET https://stokara.vercel.app/api/ai/refresh
```

Header wajib:

```text
Authorization: Bearer <CRON_SECRET_PRODUCTION>
```

`CRON_SECRET_PRODUCTION` harus sama dengan environment variable `CRON_SECRET` di Vercel Production.

## Jadwal Rekomendasi

| Kebutuhan | Cron Expression | Frekuensi |
|---|---:|---:|
| Stabil awal | `0 * * * *` | 60 menit |
| Lebih cepat | `*/30 * * * *` | 30 menit |
| Hemat request | `0 */2 * * *` | 2 jam |

Rekomendasi awal: pakai `0 * * * *` selama 1-2 minggu. Jika metrik `/api/ai/health` stabil, naikkan ke `*/30 * * * *`.

## Langkah di cron-job.org

1. Login ke `https://cron-job.org`.
2. Buat cron job baru.
3. Isi URL dengan `https://stokara.vercel.app/api/ai/refresh`.
4. Method: `GET`.
5. Schedule: pilih custom cron expression.
6. Masukkan `0 * * * *` untuk update tiap 60 menit, atau `*/30 * * * *` untuk tiap 30 menit.
7. Tambahkan HTTP header:

```text
Authorization: Bearer <CRON_SECRET_PRODUCTION>
```

8. Aktifkan response saving/logging jika tersedia, minimal untuk header/status code.
9. Simpan job dan jalankan manual sekali untuk test.

## Setup Otomatis via API

Jika ingin membuat/memperbarui job lewat terminal, buat API key di cron-job.org Console > Settings > API keys, lalu jalankan:

```bash
$env:CRON_JOB_ORG_API_KEY="isi_api_key_cron_job_org"
npm run cron-job:connect -- --interval 60
```

Untuk interval 30 menit:

```bash
$env:CRON_JOB_ORG_API_KEY="isi_api_key_cron_job_org"
npm run cron-job:connect -- --interval 30
```

Script akan:

1. Membaca `CRON_SECRET` dari `.env.vercel.production.local`.
2. Membuat job `SotoStock AI Refresh (Production)` jika belum ada.
3. Mengupdate job yang sudah ada jika URL/title sama.
4. Mengatur header `Authorization: Bearer <CRON_SECRET_PRODUCTION>`.
5. Menyimpan response log dari eksekusi cron.

## Validasi

Cek endpoint berikut setelah cron pertama berjalan:

```text
https://stokara.vercel.app/api/ai/health
```

Output sehat harus berisi:

```json
{
  "data": {
    "status": "success"
  }
}
```

Metrik yang perlu dicek:

| Metrik | Target |
|---|---:|
| `status` | `success` atau `partial` |
| `failedFeeds` | `0` idealnya |
| `generatedRisks` | Lebih dari `0` |
| `generatedProjections` | Lebih dari `0` |
| `generatedRecommendations` | Lebih dari `0` |

## Troubleshooting

| Error | Penyebab Umum | Solusi |
|---|---|---|
| `401 Invalid cron secret` | Header Authorization salah/kosong | Samakan value dengan `CRON_SECRET` Vercel Production |
| `500 Internal server error` | DB/env/pipeline error | Cek `/api/ai/health`, Vercel logs, dan koneksi `DATABASE_URL` |
| Timeout | Pipeline terlalu lama | Pakai jadwal 60 menit dulu, kurangi feed eksternal, cek performa DB |
| `generatedRisks: 0` | Data prediksi kosong | Pastikan baseline `priceForecast` aktif dan refresh ulang |

## Catatan Operasional

`cron-job.org` menjalankan HTTP request terjadwal ke endpoint aplikasi. Untuk SotoStock, cron eksternal tetap disarankan jika Anda ingin benar-benar menjaga refresh 24/7 setiap 30-60 menit dan memantau log eksekusinya secara terpisah.

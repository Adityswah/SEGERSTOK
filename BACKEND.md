# SotoStock Backend

Backend berjalan di Next.js API Route Handlers dengan Drizzle ORM, PostgreSQL, dan Better Auth.

## Environment

Copy `.env.example` ke `.env.local`, lalu sesuaikan:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:55432/sotostock
BETTER_AUTH_SECRET=change-this-to-a-long-random-secret
BETTER_AUTH_URL=http://127.0.0.1:3001
NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.1:3001
CRON_SECRET=change-this-to-a-strong-cron-secret
AI_NEWS_FEED_URLS=
```

Untuk production, `BETTER_AUTH_SECRET` wajib diganti dengan secret random yang kuat.
Saat domain production berubah, `BETTER_AUTH_URL` dan `NEXT_PUBLIC_BETTER_AUTH_URL` juga wajib ikut diubah ke domain baru.

## Database

Catatan deployment: Drizzle Kit dijalankan via `npx` pada script database, bukan disimpan sebagai dependency project. Ini menjaga install/build Vercel tetap bersih dari warning deprecated `@esbuild-kit/*` yang masih dibawa oleh `drizzle-kit@0.31.x`.

Start PostgreSQL lokal via Docker pada host port `55432`:

```bash
npm run docker:postgres
```

Generate migration:

```bash
npm run db:generate
```

Apply migration ke PostgreSQL:

```bash
npm run db:migrate
```

Seed master bahan dan prediksi harga awal:

```bash
npm run db:seed
```

Atau push schema langsung saat development:

```bash
npm run db:push
```

Open Drizzle Studio:

```bash
npm run db:studio
```

Atau gunakan port Studio eksplisit:

```bash
npm run db:studio:local
```

Buka UI Studio di browser:

```text
https://local.drizzle.studio
```

Catatan: `http://127.0.0.1:4983` adalah gateway lokal Drizzle Studio, bukan halaman UI. Jika dibuka langsung dan muncul `404`, itu normal.

## Supabase

Untuk memakai Supabase Postgres:

1. Buka Supabase Dashboard > Project Settings > Database.
2. Ambil connection string Postgres. Untuk aplikasi server, pakai Transaction Pooler.
3. Pastikan URL memiliki `sslmode=require`.
4. Isi `.env.local`:

```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
BETTER_AUTH_SECRET=change-this-to-a-long-random-secret
BETTER_AUTH_URL=http://127.0.0.1:3001
NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.1:3001
```

5. Jalankan migrasi dan seed:

```bash
npm run db:supabase:migrate
npm run db:supabase:seed
```

Jika deploy production, ganti `BETTER_AUTH_URL` dan `NEXT_PUBLIC_BETTER_AUTH_URL` ke domain production.
Untuk cron pipeline AI di Vercel, set juga `CRON_SECRET` pada environment project.

## Auth

Better Auth mounted di:

```text
/api/auth/[...all]
```

Email/password auth aktif. Role disimpan pada tabel `user.role`:

```text
Owner | Kasir | Cheef | Waiters
```

## API Routes

```text
GET  /api/health
GET  /api/ingredients
POST /api/ingredients          Owner only
GET  /api/transactions         Owner only
POST /api/transactions         Owner, Kasir, Cheef, Waiters
GET  /api/opname               Owner only
POST /api/opname               Owner, Kasir, Cheef, Waiters; only day 30
GET  /api/price-predictions    Owner only
POST /api/price-predictions    Owner only
GET  /api/ai/summary           Owner only
POST /api/ai/refresh           Owner only (manual trigger)
GET  /api/ai/refresh           Cron only (Bearer CRON_SECRET)
GET  /api/ai/health            Monitoring endpoint
POST /api/ai-bot/query         Owner only
```

Semua route operasional selain `/api/health` membutuhkan session Better Auth.

## AI 24/7 Pipeline

Sistem AI berjalan dengan 5 komponen:

1. `Data Ingestion`: feed berita/pemerintah + data internal.
2. `AI Risk Engine`: scoring risiko bahan (Rendah/Sedang/Tinggi).
3. `Storage Layer`: tabel AI untuk sinyal, risk harian, proyeksi mingguan, rekomendasi beli, dan log run.
4. `Automation & Monitoring`: cron Vercel `/api/ai/refresh` harian pada akun Hobby, atau tiap 30-60 menit jika memakai Vercel Pro/scheduler eksternal, plus `/api/ai/health`.
5. `Serving/API`: `/api/ai/summary` dan `/api/ai-bot/query` untuk dashboard/bot owner.

## Scheduler Eksternal

Untuk update AI tiap 30-60 menit pada Vercel Hobby, gunakan `cron-job.org` untuk memanggil endpoint:

```text
GET https://stokara.vercel.app/api/ai/refresh
Authorization: Bearer <CRON_SECRET_PRODUCTION>
```

Jadwal yang disarankan:

```text
0 * * * *      # setiap 60 menit
*/30 * * * *   # setiap 30 menit
```

Panduan setup lengkap ada di:

```text
docs/cron-job-org-ai-refresh.md
```

Setup otomatis via API cron-job.org:

```bash
$env:CRON_JOB_ORG_API_KEY="isi_api_key_cron_job_org"
npm run cron-job:connect -- --interval 60
```

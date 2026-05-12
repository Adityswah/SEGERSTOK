# SotoStock Backend

Backend berjalan di Next.js API Route Handlers dengan Drizzle ORM, PostgreSQL, dan Better Auth.

## Environment

Copy `.env.example` ke `.env.local`, lalu sesuaikan:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:55432/sotostock
BETTER_AUTH_SECRET=change-this-to-a-long-random-secret
BETTER_AUTH_URL=http://127.0.0.1:3001
NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.1:3001
```

Untuk production, `BETTER_AUTH_SECRET` wajib diganti dengan secret random yang kuat.

## Database

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
```

Semua route operasional selain `/api/health` membutuhkan session Better Auth.

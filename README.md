# Attendance / Davomat Mini App

Telegram Mini App ichida ishlashga mos, sodda va production-like attendance dashboard.

## Nimalar bor

- Next.js App Router frontend
- Route Handler API backend
- Prisma PostgreSQL schema
- Demo mode bilan darrov ishlaydigan seeded in-memory repository
- Admin va employee view
- Check-in / check-out
- Late, early leave, absent, worked hours, earned, penalties, net salary
- Dashboard charts
- Employee detail va manual correction
- Reports with CSV export
- Settings page
- Telegram Mini App session integration architecture

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Prisma
- Recharts
- date-fns / date-fns-tz
- Zod ready dependency

## Folder Tuzilishi

```text
miniapp/
  app/                  # Pages + API routes
  components/           # UI, charts, providers, screens
  lib/                  # Business logic, store, auth, utils
  prisma/               # Prisma schema + seed
  .env.example
  README.md
```

## Local Run

1. Env fayl yarating:

```bash
cp .env.example .env
```

2. Dependency o'rnating:

```bash
npm install
```

3. Prisma client generatsiya qiling:

```bash
npm run prisma:generate
```

4. Development server:

```bash
npm run dev
```

5. Brauzerda oching:

```text
http://localhost:3000
```

## Demo Mode

`.env.example` da `NEXT_PUBLIC_DEMO_MODE=true` turibdi.

Bu holatda:

- Telegram bo'lmasa ham loyiha ochiladi
- demo user switcher chiqadi
- seeded employees va attendance bilan dashboard to'lib ko'rinadi
- database shart emas

## PostgreSQL / Prisma Ishlatish

Prisma schema tayyor. Production uchun:

1. `.env` ichida `DATABASE_URL` ni to'g'ri qo'ying.
2. Migration ishlating:

```bash
npm run prisma:migrate
```

3. Demo ma'lumotlarni DB ga seed qiling:

```bash
npm run prisma:seed
```

Hozirgi UI demo repository bilan ishlaydi. Keyingi qadamda `lib/repository.ts` ni Prisma adapter bilan almashtirish juda oson.

## Telegram Mini App Setup

1. `BotFather` orqali bot yarating.
2. Mini App URL sifatida deploy qilingan frontend URL ni ulang.
3. `.env` ichida quyidagilarni to'ldiring:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_MINI_APP_URL=
TELEGRAM_BOT_USERNAME=
```

4. Productionda demo mode ni o'chiring:

```env
NEXT_PUBLIC_DEMO_MODE=false
```

5. Frontend Telegram ichida ochilganda `window.Telegram.WebApp.initData` backendga yuboriladi va session tekshiriladi.

## Attendance Logic

- Work start: `10:00`
- Work end: `18:00`
- Weekly off: Sunday
- Daily rate = monthly salary / monthdagi yakshanbasiz ish kunlari
- Hourly rate = daily rate / 8
- Minute penalty = hourly rate / 60
- Late penalty = late minutes * minute penalty
- Early leave penalty = early leave minutes * minute penalty
- Absent penalty = full daily rate
- Daily earned = worked minutes * hourly rate
- Net daily amount = earned - penalties
- Net monthly amount = total earned - total penalties

## Sahifalar

- `/dashboard`
- `/attendance`
- `/employees`
- `/employees/[id]`
- `/reports`
- `/salary`
- `/settings`

## Asosiy API Lar

- `GET /api/auth/session`
- `GET /api/dashboard`
- `GET /api/attendance`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `POST /api/attendance/manual-correction`
- `GET/POST /api/employees`
- `GET/PATCH/DELETE /api/employees/:id`
- `GET /api/reports`
- `GET /api/reports/export.csv`
- `GET /api/salary`
- `GET/PATCH /api/settings`

## Eslatma

Loyiha hozir demo-first ishlaydigan holatda qurilgan:

- UI va business logic tayyor
- Prisma schema va seed tayyor
- Telegram auth integration tayyor
- Production DB adapter uchun repository qatlamini almashtirish kifoya

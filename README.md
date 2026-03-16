# Nuxt Nitro Drizzle dengan PostgreSQL dan TailwindCSS

Aplikasi full-stack menggunakan Nuxt 3 dengan Nitro server engine, Drizzle ORM untuk PostgreSQL, dan TailwindCSS untuk styling.

## 📋 Prasyarat

- Node.js 18 atau lebih baru
- PostgreSQL database
- pnpm (disarankan) atau npm

## 🚀 Instalasi

1. Clone repository ini:
```bash
git clone <repository-url>
cd nuxt-nitro-drizzle-app
```

2. Install dependencies:
```bash
pnpm install
# atau
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
```
Edit file `.env` dan sesuaikan dengan konfigurasi database Anda:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/nuxt_db
```

4. Setup database:
```bash
# Generate migration
pnpm db:generate

# Jalankan migration
pnpm db:migrate

# (Opsional) Push schema langsung ke database
pnpm db:push

# (Opsional) Buka Drizzle Studio untuk melihat data
pnpm db:studio
```

5. Jalankan aplikasi:
```bash
pnpm dev
# atau
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

## 📁 Struktur Project

```
.
├── assets/
│   └── css/
│       └── main.css          # Tailwind CSS imports
├── components/                # Vue components
├── pages/
│   ├── index.vue             # Halaman utama
│   └── users.vue             # Halaman users dengan CRUD
├── public/                    # Static assets
├── server/
│   ├── api/
│   │   └── users/
│   │       ├── [id].get.ts    # GET single user
│   │       ├── index.get.ts   # GET all users
│   │       └── index.post.ts  # POST new user
│   ├── database/
│   │   ├── migrations/        # Database migrations
│   │   └── schema/
│   │       ├── index.ts       # Schema exports
│   │       └── users.ts       # Users table schema
│   └── utils/
│       └── db.ts              # Database utility
├── .env                        # Environment variables
├── drizzle.config.ts           # Drizzle ORM config
├── nuxt.config.ts              # Nuxt config
├── package.json                # Dependencies
├── tailwind.config.js          # Tailwind CSS config
└── tsconfig.json               # TypeScript config
```

## 🔧 Scripts yang Tersedia

| Script | Deskripsi |
|--------|-----------|
| `pnpm dev` | Jalankan development server |
| `pnpm build` | Build untuk production |
| `pnpm preview` | Preview build production |
| `pnpm generate` | Generate static site |
| `pnpm db:generate` | Generate database migrations |
| `pnpm db:migrate` | Jalankan migrations |
| `pnpm db:push` | Push schema ke database (development) |
| `pnpm db:studio` | Buka Drizzle Studio UI |

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### TypeScript Interface
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/users` | Mendapatkan semua users |
| GET | `/api/users/:id` | Mendapatkan user by ID |
| POST | `/api/users` | Membuat user baru |

### Contoh Request

**GET /api/users**
```bash
curl http://localhost:3000/api/users
```

Response:
```json
{
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-03-14T10:00:00Z",
      "updatedAt": "2024-03-14T10:00:00Z"
    }
  ]
}
```

**POST /api/users**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

## 🎨 Teknologi yang Digunakan

- **Frontend Framework**: [Nuxt 3](https://nuxt.com/)
- **Server Engine**: [Nitro](https://nitro.unjs.io/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: PostgreSQL
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Language**: TypeScript

## 🚢 Deployment

### Build untuk Production
```bash
pnpm build
```

Hasil build akan berada di direktori `.output/`

### Environment Variables untuk Production
Pastikan untuk mengatur environment variable `DATABASE_URL` di server production Anda.

## 🔧 Konfigurasi Lanjutan

### Menambah Table Baru

1. Buat file schema baru di `server/database/schema/`:
```typescript
// server/database/schema/posts.ts
import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

2. Export di `server/database/schema/index.ts`:
```typescript
export * from './users';
export * from './posts';
```

3. Generate migration:
```bash
pnpm db:generate
```

4. Jalankan migration:
```bash
pnpm db:migrate
```

## 🐛 Troubleshooting

### Database Connection Error
Pastikan PostgreSQL berjalan dan konfigurasi di `.env` benar:
```bash
# Test koneksi database
psql -d nuxt_db -U username -h localhost
```

### Migration Error
Jika ada error saat migrasi, hapus folder `migrations` dan generate ulang:
```bash
rm -rf server/database/migrations
pnpm db:generate
pnpm db:migrate
```

## 📝 Lisensi

MIT

## 🤝 Kontribusi

Silakan buat pull request atau issue untuk perbaikan atau penambahan fitur.

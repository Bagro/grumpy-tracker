# Grumpy Tracker

Grumpy Tracker is a time tracking system for keeping track of work hours and flex time.

## Features

- Time reporting: work, travel, breaks, and extra time
- Flex balance calculation and summary
- Multilingual support (Swedish, English, Finnish, Norwegian, Latvian, Estonian, Lithuanian, Danish)
- User profiles and settings
- GDPR: data export and deletion
- Admin: user and translation management
- Responsive design with Tailwind CSS

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [Docker](https://www.docker.com/) (for easy local development)
- [PostgreSQL](https://www.postgresql.org/) v16 (if not running via Docker)

### 1. Clone the repository

```sh
git clone https://github.com/Bagro/grumpy-tracker.git
cd grumpy-tracker
```

### 2. Create environment variables

Copy `.env.example` to `.env` and fill in your values:

```sh
cp .env.example .env
```

| Variable         | Description                                      | Example                                                     |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string                     | `postgres://grumpy:grumpysecret@localhost:5432/grumpytracker` |
| `SESSION_SECRET` | Secret key for session management (keep private) | `a-long-random-string`                                      |
| `NODE_ENV`       | Environment (`development` / `production`)       | `development`                                               |

> **Note:** `DATABASE_URL` is used at runtime by the app (via `prisma.config.ts` and `src/db.js`) and by `npx prisma migrate` for CLI operations.

### 3. Start with Docker (recommended)

```sh
docker-compose up --build
```

- App: [http://localhost:3000](http://localhost:3000)
- Database: port 5432

The container automatically runs `npx prisma migrate deploy` on startup before launching the server (see `start.sh`).

> **Note:** The `docker-compose.yml` sets `DATABASE_URL` for the app container. Add `SESSION_SECRET` to the environment section in `docker-compose.yml` for production deployments.

### 4. Run locally without Docker

1. Start PostgreSQL and create the database `grumpytracker`

2. Install dependencies:

   ```sh
   npm install
   ```

3. Run database migrations:

   ```sh
   npx prisma migrate deploy
   ```

   For a brand new local environment (creates migration history):

   ```sh
   npx prisma migrate dev
   ```

4. Build Tailwind CSS:

   ```sh
   npm run tailwind:build
   ```

   Or watch for changes during development:

   ```sh
   npm run tailwind:watch
   ```

5. Start the app:

   ```sh
   npm run dev
   ```

### 5. Create admin user

Register a user with the email `admin@grumpy.local` — it will automatically receive admin rights.

## Configuration Files

| File                | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `.env`              | Runtime environment variables (not committed)                           |
| `prisma.config.ts`  | Prisma 7 datasource config — provides the `pg` adapter for CLI and ORM  |
| `prisma/schema.prisma` | Database schema (models and relations)                               |
| `eslint.config.js`  | ESLint flat config (ESLint 10+)                                         |
| `vitest.config.js`  | Vitest config with `globals: true` for Jest-compatible test syntax      |
| `tailwind.config.js` | Tailwind CSS configuration                                             |
| `docker-compose.yml` | Local Docker setup (app + PostgreSQL)                                  |

## Testing

The project has two test runners:

**Vitest** (default, recommended):

```sh
npx vitest run
```

**Jest** (legacy, used by `npm test`):

```sh
npm test
```

> Integration tests require a running PostgreSQL database with `DATABASE_URL` set.

## Docker: Verify Prisma migrations

To ensure all tables are created when using Docker:

```sh
docker compose down
docker compose up --build -d db
sleep 10
docker compose run --rm app npx prisma migrate deploy
docker compose exec db psql -U grumpy -d grumpytracker -c '\dt'
```

You should see all tables from `schema.prisma` (User, TimeEntry, ExtraTime, Settings, WorkPeriod, Absence, Session, \_prisma\_migrations).

> Make sure `prisma/migrations/` is committed and not listed in `.dockerignore` or `.gitignore`.

## Code Style & Architecture

- **Backend:** Node.js (ESM), Express 5, Prisma 7, Passport.js, i18next
- **Frontend:** EJS templates, Tailwind CSS 4, htmx (attribute-based, forms also work without JS)
- **Database:** PostgreSQL 16 via `@prisma/adapter-pg`
- **Linting:** ESLint 10 with flat config (`eslint.config.js`)
- See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for code standards

## License

This project is licensed under the MIT License. See the LICENSE file for details.

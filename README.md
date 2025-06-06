<!-- ============================= -->
<!-- 🚨🚨🚨 100% AI-GENERATED CODE 🚨🚨🚨 -->
<!-- ⚠️ NO HUMAN HAS REVIEWED THIS! ⚠️ -->
<!-- 🤖 Use at your own risk! 🤖 -->
<!-- ============================= -->

# ⚠️🤖🚨 **AI-GENERATED PROJECT DISCLAIMER** 🚨🤖⚠️

> **🟡 This project is 100% AI-generated! 🟡**
>
> - 🤖 _All code, documentation, and logic were created by artificial intelligence._
> - 👀 _No human has reviewed or audited this code._
> - 🧪 _Use at your own risk! Bugs, security issues, and weirdness are possible._
> - 📝 _Contributions and code reviews are **highly encouraged**!_
>
> **If you see this, you know you're living in the future.**

---

# Grumpy Tracker

Grumpy Tracker is a time tracking system for keeping track of work hours and flex time.

## Features

- Time reporting: work, travel, breaks, extra time
- Flex calculation and summary
- Multilingual support (Swedish, English, Finnish, Norwegian, Latvian, Estonian, Lithuanian, Danish)
- User profiles and settings
- GDPR: data export and deletion
- Admin: user and translation management
- Responsive design with Tailwind CSS

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Docker](https://www.docker.com/) (for easy local development)
- [PostgreSQL](https://www.postgresql.org/) (if not running via Docker)

### 1. Clone the repository

```sh
git clone https://github.com/Bagro/grumpy-tracker.git
cd grumpy-tracker
```

### 2. Create environment variables

Copy `.env.example` to `.env` and fill in (or create a `.env`):

```
DATABASE_URL=postgres://grumpy:grumpy@localhost:5432/grumpytracker
SESSION_SECRET=change-me
```

### 3. Start with Docker (recommended)

```sh
docker-compose up --build
```

- The app runs at [http://localhost:3000](http://localhost:3000)
- The database runs on port 5432

### 4. Alternative: Run locally without Docker

1. Start PostgreSQL and create the database `grumpytracker`
2. Install dependencies:

   ```sh
   npm install
   ```

3. Run database migrations:

   ```sh
   npx prisma migrate dev --name init
   ```

4. Build Tailwind CSS (one-time build):

   ```sh
   npm run tailwind:build
   ```

   Or run in "watch" mode for automatic updates on changes:

   ```sh
   npm run tailwind:watch
   ```

5. Start the app:

   ```sh
   npm run dev
   ```

### 5. Create admin user

The first user with the email `admin@grumpy.local` gets admin rights.

### 6. Test

Run tests with:

```sh
npm test
```

## Verify Prisma migrations in Docker

To ensure all tables are created automatically when using Docker and a prebuilt image:

1. Make sure the `prisma/migrations/` directory exists in your repo and is NOT listed in `.dockerignore` or `.gitignore`.
2. Rebuild and restart the database:

   ```zsh
   docker compose down
   docker compose up --build -d db
   sleep 10
   docker compose run --rm app npx prisma migrate deploy
   docker compose exec db psql -U grumpy -d grumpytracker -c '\dt'
   ```

3. You should now see all tables from `schema.prisma` (e.g. User, TimeEntry, ExtraTime, Settings, WorkPeriod, session, _prisma_migrations).

If you only see the _prisma_migrations table, the migration files are missing from the image. Make sure `prisma/migrations/` is included in both the repo and the Docker image.

## Code Style & Architecture

- Backend: Node.js, Express, Prisma, Passport.js, i18next
- Frontend: EJS, Tailwind CSS, htmx (optional)
- See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for code standards and architecture

## License

This project is licensed under the MIT License. See the LICENSE file for details.

# grumpy-tracker

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

## Code Style & Architecture

- Backend: Node.js, Express, Prisma, Passport.js, i18next
- Frontend: EJS, Tailwind CSS, htmx (optional)
- See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for code standards and architecture

## License

This project is licensed under the MIT License. See the LICENSE file for details.

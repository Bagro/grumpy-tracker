# grumpy-tracker

Grumpy Tracker är ett tidrapporteringssystem för att hålla koll på arbetstid och flextid.

## Funktioner

- Tidrapportering: arbete, resor, raster, extra tid
- Flexberäkning och sammanställning
- Flerspråkigt stöd (svenska, engelska, finska, norska, lettiska, estniska, litauiska, danska)
- Användarprofiler och inställningar
- GDPR: export och radering av data
- Admin: användar- och översättningshantering
- Responsiv design med Tailwind CSS

## Kom igång

### Förutsättningar

- [Node.js](https://nodejs.org/) (v18 eller senare rekommenderas)
- [Docker](https://www.docker.com/) (för enkel lokal utveckling)
- [PostgreSQL](https://www.postgresql.org/) (om du inte kör via Docker)

### 1. Klona repot

```sh
git clone https://github.com/ditt-användarnamn/grumpy-tracker.git
cd grumpy-tracker
```

### 2. Skapa miljövariabler

Kopiera `.env.example` till `.env` och fyll i (eller skapa en `.env`):

```
DATABASE_URL=postgres://grumpy:grumpy@localhost:5432/grumpytracker
SESSION_SECRET=byt-mig
```

### 3. Starta med Docker (rekommenderat)

```sh
docker-compose up --build
```

- Appen körs på [http://localhost:3000](http://localhost:3000)
- Databasen körs på port 5432

### 4. Alternativ: Starta lokalt utan Docker

1. Starta PostgreSQL och skapa databasen `grumpytracker`
2. Installera beroenden:

   ```sh
   npm install
   ```

3. Kör databas-migreringar:

   ```sh
   npx prisma migrate dev --name init
   ```

4. Bygg Tailwind CSS (engångsbygge):

   ```sh
   npm run tailwind:build
   ```

   Eller kör i "watch"-läge för automatisk uppdatering vid ändringar:

   ```sh
   npm run tailwind:watch
   ```

5. Starta appen:

   ```sh
   npm run dev
   ```

### 5. Skapa admin-användare

Första användaren med e-post `admin@grumpy.local` får admin-rättigheter.

### 6. Testa

Kör tester med:

```sh
npm test
```

## Kodstil & Arkitektur

- Backend: Node.js, Express, Prisma, Passport.js, i18next
- Frontend: EJS, Tailwind CSS, htmx (valfritt)
- Se [`.github/copilot-instructions.md`](.github/copilot-instructions.md) för kodstandard och arkitektur

## Licens

MIT

---

För mer info, se [prd.md](prd.md).

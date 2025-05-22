# Time Tracking System – Architecture & Coding Guidelines

This document outlines the technology stack, architecture, and coding standards for the **Grumpy Tracker** time tracking system, now based on Node.js and Express.

---

## **1. Tech Stack (Selected Technologies)**

### **Backend**
- **Node.js** (LTS)
- **Express.js** (web framework)
- **EJS** (server-rendered templates)
- **Passport.js** (authentication, sessions)
- **Prisma** or **Kysely** (type-safe ORM/database client)
- **PostgreSQL** (database)
- **i18next** (internationalization)
- **Jest** or **Vitest** (testing)

### **Frontend**
- **HTML First** (semantic HTML, forms, classic SSR)
- **Tailwind CSS** (utility-first styling)
- **htmx** (progressive enhancement – AJAX, partial updates, etc.)

### **Other**
- **Prettier & ESLint** (code standards)
- **Docker** (local development & deployment)
- **GitHub Actions** (CI/CD, optional)

---

## **2. Architectural Principles**

- **HTML First:**  
  Prioritize server-rendered HTML, minimize client-side JS. Use JS only for progressive enhancement.
- **Separation of concerns:**  
  - Backend: API, business logic, server-rendered views  
  - Frontend: Forms, clear and semantic HTML
- **Security:**  
  - Secure password handling (hashing via bcrypt or similar)
  - CSRF protection (can use [csurf](https://www.npmjs.com/package/csurf)), server-side validation
- **Testability:**  
  - Unit and integration tests for backend logic and routes
- **Accessibility & Responsiveness:**  
  - All HTML should comply with WCAG 2.1
  - Responsive design via Tailwind CSS

---

## **3. Data Model – Basic Structure**

### **User**
- id (UUID)
- email
- name
- password_hash
- preferred_language
- created_at, updated_at

### **TimeEntry**
- id (UUID)
- user_id (FK)
- date
- travel_start_time (optional)
- work_start_time
- work_end_time
- break_start_time (optional)
- break_end_time (optional)
- travel_end_time (optional)
- extra_time (optional, e.g., evening work)
- comments (optional)
- created_at, updated_at

### **Settings (per user or global)**
- normal_work_time (default 08:00)
- summer_work_time (default 07:15)

---

## **4. Coding Guidelines**

### **Backend**
- Use `async/await` syntax throughout.
- Validate all input both on the frontend (for UX) and backend (for security).
- Never expose sensitive data in templates or responses.
- Use parameterized queries and avoid raw SQL to prevent injection.
- Authentication managed with Passport.js; password hashing with bcrypt.
- Sessions stored securely using httpOnly cookies.

### **Frontend**
- Write **semantic HTML** – use `<form>`, `<label>`, `<input>`, `<table>`, etc.
- All forms should have clear error messages, including on server errors.
- Use Tailwind CSS classes for styling, no inline styles.
- Use htmx for AJAX-based interactivity where it improves UX; otherwise, stick to classic page reloads.

### **Internationalization**
- All text rendered via translation functions using i18next.
- Initial support for Swedish, English, Finnish, Norwegian, Latvian, Estonian, Lithuanian, Danish.
- Texts stored in JSON/YAML or i18next format.

### **Testing**
- Backend logic and endpoints must be covered by tests (Jest or Vitest).
- Database functions should be tested against a test database.

---

## **5. Project Structure (Recommended)**

```text
/project-root
│
├── src/
│ ├── index.js # Express main entrypoint
│ ├── routes/ # Route handlers, divided by feature
│ ├── views/ # EJS templates (views)
│ ├── db/ # Prisma/Kysely db classes and migrations
│ ├── auth/ # Passport.js setup, strategies, middleware
│ ├── i18n/ # Language files and i18next config
│ ├── public/ # Static files: CSS (Tailwind), JS, images
│
├── tests/ # Jest/Vitest tests
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md
```


---

## **6. Branching and Git Workflow**

- Use **main/master** as the stable branch.
- Create **feature branches** for new features.
- Pull requests must be reviewed before merging to main.
- All code should pass linting and testing before merge.
- **All code must pass linting and testing before merge.**
- **All code changes must be verified to build and run successfully (locally or in CI) before being merged.**

---

## **7. Deployment & DevOps**

- Local: Docker Compose for development (Node.js + Postgres)
- Production: Docker or any preferred PaaS (Railway, DigitalOcean, etc.)
- CI/CD (optional): GitHub Actions for lint, test, build

---

## **8. Security & Privacy**

- Only store hashed passwords in the database.
- Sessions are handled with httpOnly cookies.
- All auth and session data must be validated on every request.
- GDPR: users’ data must be exportable and deletable.

---

## **9. Roadmap – Phases**

1. **Setup & Base Structure**
   - Project structure, repo, CI/CD, Docker
2. **Auth & User Management**
   - Passport.js, registration, login, sessions
3. **Time Tracking & Database Model**
   - CRUD endpoints, server-rendered forms
4. **Flex Time Calculation & Settings**
   - Backend calculation, configurable normal/summer hours
5. **Multilingual Support**
   - i18n, language selection per user
6. **Testing & Documentation**
   - Unit tests, user documentation
7. **Deployment**
   - To chosen environment, production configuration

---

## **10. Links & References**

- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [EJS](https://ejs.co/)
- [Passport.js](http://www.passportjs.org/)
- [Prisma](https://www.prisma.io/) / [Kysely](https://kysely.dev/)
- [PostgreSQL](https://www.postgresql.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [htmx](https://htmx.org/)
- [i18next](https://www.i18next.com/)
- [Jest](https://jestjs.io/) / [Vitest](https://vitest.dev/)

---



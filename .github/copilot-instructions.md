# Time Tracking System – Architecture & Coding Guidelines

This document outlines the technology stack, architecture, and coding standards for our time tracking system with flex time calculation and multilingual support.

---

## **1. Tech Stack (Selected Technologies)**

### **Backend**
- **Bun** (runtime & package manager)
- **ElysiaJS** (web API & HTML server)
- **EJS** (server-rendered templates)
- **lucia-auth** (authentication, sessions)
- **Kysely** (type-safe SQL/ORM)
- **PostgreSQL** (database)

### **Frontend**
- **HTML First** (semantic HTML, forms, classic SSR)
- **Tailwind CSS** (utility-first styling)
- **htmx** (progressive enhancement – AJAX, partial updates, etc.)

### **Other**
- **i18next** (internationalization support)
- **Prettier & ESLint** (code standards)
- **Vitest** (testing)
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
  - Secure password handling (hashing via lucia-auth)
  - CSRF protection, server-side validation
- **Testability:**  
  - Unit tests for backend logic
- **Accessibility & Responsiveness:**  
  - All HTML should comply with WCAG 2.1
  - Responsive design via Tailwind

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
- Prefer `async/await` syntax.
- All input must be validated both on frontend (for UX) and backend (for security).
- Never expose sensitive data in templates.
- Use parameterized queries via Kysely.
- Authentication via lucia-auth, handle sessions securely (httpOnly cookies).

### **Frontend**
- Write **semantic HTML** – use `<form>`, `<label>`, `<input>`, `<table>`, etc.
- All forms should have clear error messages, including on server errors.
- Use Tailwind CSS classes for styling, no inline styles.
- Use htmx for AJAX-based interactivity where it improves UX; otherwise, stick to classic page reloads.

### **Internationalization**
- All text rendered via translation functions.
- Initial support for Swedish, English, Finnish, Norwegian, Latvian, Estonian, Lithuanian, Danish.
- Texts stored in JSON/YAML or i18next format.

### **Testing**
- Backend logic must be covered by unit tests using Vitest.
- Database functions should be tested against a test database.

---

## **5. Project Structure (Recommended)**

```text
/project-root
│
├── src/
│   ├── index.ts          # Elysia main entrypoint
│   ├── routes/           # Route handlers, divided by feature
│   ├── templates/        # EJS templates (views)
│   ├── db/               # Kysely db classes and migrations
│   ├── auth/             # lucia-auth setup
│   ├── i18n/             # Language files
│   ├── static/           # CSS (Tailwind), JS, images
│
├── tests/                # Vitest tests
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

---

## **7. Deployment & DevOps**

- Local: Docker Compose for development (Bun + Postgres)
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
   - lucia-auth, registration, login, sessions
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

- [Bun](https://bun.sh/)
- [ElysiaJS](https://elysiajs.com/)
- [EJS](https://ejs.co/)
- [lucia-auth](https://lucia-auth.com/)
- [Kysely](https://kysely.dev/)
- [PostgreSQL](https://www.postgresql.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [htmx](https://htmx.org/)
- [i18next](https://www.i18next.com/)

---

For questions and suggestions, use the project’s GitHub issues or discuss within the team.

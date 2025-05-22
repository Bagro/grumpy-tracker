// Express main entrypoint for Grumpy Tracker
import express from 'express';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import passport from 'passport';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import csurf from 'csurf';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authRoutes from './routes/auth.js';
import setupI18n from './i18n/index.js';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false },
}));

// Passport.js
app.use(passport.initialize());
app.use(passport.session());

// i18next setup
await setupI18n();
app.use(middleware.handle(i18next));

// CSRF protection
app.use(csurf());

// Middleware: redirect unauthenticated users to login (except /login, /register)
app.use((req, res, next) => {
  const publicPaths = ['/login', '/register', '/public', '/logout'];
  if (!req.user && !publicPaths.some(p => req.path.startsWith(p))) {
    return res.redirect('/login');
  }
  next();
});

// Basic home route
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// Auth routes
app.use(authRoutes);

// Error handler for CSRF and others
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send('Form tampered with.');
  }
  res.status(500).send('Internal Server Error');
});

// TODO: Add routes, auth, db, i18n, error handling

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Grumpy Tracker running on http://localhost:${PORT}`);
});

export default app;

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
import timeRoutes from './routes/time.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';
import gdprRoutes from './routes/gdpr.js';
import adminRoutes from './routes/admin.js';
import setupI18n from './i18n/index.js';
import { PrismaClient } from '@prisma/client';
import flash from 'connect-flash';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const prisma = new PrismaClient();

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

// Set language from user profile if logged in
app.use((req, res, next) => {
  if (req.user && req.user.preferred_language) {
    res.cookie('i18next', req.user.preferred_language, { httpOnly: false });
    req.language = req.user.preferred_language;
    req.lng = req.user.preferred_language;
    if (req.i18next && typeof req.i18next.changeLanguage === 'function') {
      req.i18next.changeLanguage(req.user.preferred_language);
    }
  }
  next();
});

// i18next setup
await setupI18n();
app.use(middleware.handle(i18next));

// CSRF protection
app.use(csurf());

// Connect-flash middleware
app.use(flash());

// Middleware: redirect unauthenticated users to login (except /login, /register)
app.use((req, res, next) => {
  const publicPaths = ['/login', '/register', '/public', '/logout'];
  if (!req.user && !publicPaths.some(p => req.path.startsWith(p))) {
    return res.redirect('/login');
  }
  next();
});

// Make flash messages available in all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Make request object available in all views
app.use((req, res, next) => {
  res.locals.request = req;
  next();
});

// Basic home route
app.get('/', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  // Calculate flex time for today and total
  const entries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id } });
  // Simple flex calculation: (work_end - work_start - breaks) - normal_work_time
  let flexToday = 0, flexTotal = 0;
  const today = new Date().toISOString().slice(0,10);
  // Fetch user settings for normal work time
  let normal = 480;
  const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  if (userSettings) normal = userSettings.normal_work_time;
  for (const e of entries) {
    const workMinutes = (e.work_end_time - e.work_start_time) / 60000;
    const breakMinutes = (e.break_start_time || []).reduce((sum, b, i) => {
      const end = (e.break_end_time||[])[i];
      return sum + (end && b ? (end - b) / 60000 : 0);
    }, 0);
    const extra = e.extra_time || 0;
    const flex = workMinutes - breakMinutes + extra - normal;
    if (e.date.toISOString().slice(0,10) === today) flexToday += flex;
    flexTotal += flex;
  }
  res.render('index', { user: req.user, flexToday, flexTotal, csrfToken: req.csrfToken() });
});

// Auth routes
app.use(authRoutes);
app.use(timeRoutes);
app.use(profileRoutes);
app.use(settingsRoutes);
app.use(gdprRoutes);
app.use(adminRoutes);

// Error handler for CSRF and others
app.use((err, req, res, next) => {
  console.error('INTERNAL ERROR:', err);
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send('Form tampered with.');
  }
  res.status(500).send('Internal Server Error: ' + (err.message || 'Unknown error'));
});

// TODO: Add routes, auth, db, i18n, error handling

export default app;

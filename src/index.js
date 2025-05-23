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
import { getWorkTimeForDate } from './utils.js';

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
  // Fetch all entries for user
  const entries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id } });
  let flexTodayWork = 0, flexTodayWorkTravel = 0;
  let flexTotalWork = 0, flexTotalWorkTravel = 0;
  let flexPeriodWork = 0, flexPeriodWorkTravel = 0;
  const today = new Date().toISOString().slice(0,10);
  const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  // For graph
  const period = req.query.period || 'week';
  let chartLabels = [], chartWork = [], chartWorkTravel = [];
  // Group entries by day for the selected period
  let start, end;
  const now = new Date();
  if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else { // week
    const day = now.getDay();
    start = new Date(now);
    start.setDate(now.getDate() - day);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  }
  // Map for graph
  const dayMap = {};
  for (const e of entries) {
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    const dayKey = d.toISOString().slice(0,10);
    // Use correct work time for this entry
    const normal = await getWorkTimeForDate(d, userSettings, req.user.id);
    // Flex (work only)
    const workMinutes = (e.work_end_time && e.work_start_time) ? (new Date(e.work_end_time).getTime() - new Date(e.work_start_time).getTime()) / 60000 : 0;
    const breakMinutes = (e.break_start_time || []).reduce((sum, b, i) => {
      const end = (e.break_end_time||[])[i];
      if (b && end) {
        return sum + ((new Date(end).getTime() - new Date(b).getTime()) / 60000);
      }
      return sum;
    }, 0);
    const extra = e.extra_time || 0;
    const flexWork = workMinutes - breakMinutes + extra - normal;
    // Flex (work + travel) - correct formula: (work_end - work_start) + (work_start - travel_start) + (travel_end - work_end) - breaks + extra - normal
    let flexWorkTravel = flexWork;
    if (e.travel_start_time && e.travel_end_time && e.work_start_time && e.work_end_time) {
      const travelStart = new Date(e.travel_start_time).getTime();
      const workStart = new Date(e.work_start_time).getTime();
      const workEnd = new Date(e.work_end_time).getTime();
      const travelEnd = new Date(e.travel_end_time).getTime();
      const beforeWork = workStart - travelStart;
      const afterWork = travelEnd - workEnd;
      flexWorkTravel = workMinutes + (beforeWork / 60000) + (afterWork / 60000) - breakMinutes + extra - normal;
    }
    if (dayKey === today) {
      flexTodayWork += flexWork;
      flexTodayWorkTravel += flexWorkTravel;
    }
    flexTotalWork += flexWork;
    flexTotalWorkTravel += flexWorkTravel;
    // For graph, only include days in period
    if (d >= start && d < end) {
      if (!dayMap[dayKey]) dayMap[dayKey] = { work: 0, workTravel: 0 };
      dayMap[dayKey].work += workMinutes;
      // Calculate workTravel for graph (same logic as flexWorkTravel, but without -breaks, +extra, -normal)
      let workTravelForGraph = workMinutes;
      if (e.travel_start_time && e.travel_end_time && e.work_start_time && e.work_end_time) {
        const travelStart = new Date(e.travel_start_time).getTime();
        const workStart = new Date(e.work_start_time).getTime();
        const workEnd = new Date(e.work_end_time).getTime();
        const travelEnd = new Date(e.travel_end_time).getTime();
        const beforeWork = workStart - travelStart;
        const afterWork = travelEnd - workEnd;
        workTravelForGraph = workMinutes + (beforeWork / 60000) + (afterWork / 60000);
      }
      dayMap[dayKey].workTravel += workTravelForGraph;
      flexPeriodWork += flexWork;
      flexPeriodWorkTravel += flexWorkTravel;
    }
  }
  // Prepare chart data
  const days = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0,10);
    days.push(key);
    cursor.setDate(cursor.getDate() + (period === 'year' ? 30 : period === 'month' ? 1 : 1));
  }
  chartLabels = days;
  chartWork = days.map(d => dayMap[d]?.work || 0);
  chartWorkTravel = days.map(d => dayMap[d]?.workTravel || 0);
  res.render('index', {
    user: req.user,
    flexPeriodWork: Math.round(flexPeriodWork),
    flexPeriodWorkTravel: Math.round(flexPeriodWorkTravel),
    flexTodayWork: Math.round(flexTodayWork),
    flexTodayWorkTravel: Math.round(flexTodayWorkTravel),
    flexTotalWork: Math.round(flexTotalWork),
    flexTotalWorkTravel: Math.round(flexTotalWorkTravel),
    chartLabels,
    chartWork,
    chartWorkTravel,
    period,
    csrfToken: req.csrfToken()
  });
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

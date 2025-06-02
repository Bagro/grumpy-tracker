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
import pgSession from 'connect-pg-simple';

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
  store: new (pgSession(session))({
    conString: process.env.DATABASE_URL,
    tableName: 'session'
  }),
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

// Middleware: redirect unauthenticated users to login (except /login, /register, /public, /logout)
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
  const entryIds = entries.map(e => e.id);
  // Fetch all extraTimes for these entries
  const extraTimesAll = await prisma.extraTime.findMany({ where: { time_entry_id: { in: entryIds } } });
  // Map extraTimes to entry id
  const extraMap = {};
  for (const et of extraTimesAll) {
    if (!extraMap[et.time_entry_id]) extraMap[et.time_entry_id] = [];
    extraMap[et.time_entry_id].push(et);
  }
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
    // Always use Monday as the first day of the week
    const day = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Calculate how many days to subtract to get to Monday
    const diffToMonday = (day === 0 ? 6 : day - 1); // Sunday (6), Monday (0), Tuesday (1), ...
    start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, 0);
    // For week period, ensure chartLabels are always Monday-Sunday
    chartLabels = [];
    let weekCursor = new Date(start);
    for (let i = 0; i < 7; i++) {
      chartLabels.push(weekCursor.toISOString().slice(0, 10));
      weekCursor.setDate(weekCursor.getDate() + 1);
    }
  }
  // Map for graph
  const dayMap = {};
  for (const e of entries) {
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    // Debug: print date comparison
    console.log('Entry date:', d, 'Start:', start, 'End:', end, 'd >= start:', d >= start, 'd < end:', d < end);
    const dayKey = d.toISOString().slice(0,10);
    // Use correct work time for this entry
    const normal = await getWorkTimeForDate(d, userSettings, req.user.id);
    // Work, breaks, extra (all in minutes)
    const workMinutes = (typeof e.work_end_time === 'number' && typeof e.work_start_time === 'number') ? (e.work_end_time - e.work_start_time) : 0;
    const breakMinutes = (Array.isArray(e.break_start_time) && Array.isArray(e.break_end_time)) ? e.break_start_time.reduce((sum, b, i) => {
      const end = e.break_end_time[i];
      return sum + (typeof b === 'number' && typeof end === 'number' && end > b ? (end - b) : 0);
    }, 0) : 0;
    const extraMinutes = (extraMap[e.id] || []).reduce((sum, et) => sum + (typeof et.start === 'number' && typeof et.end === 'number' && et.end > et.start ? (et.end - et.start) : 0), 0);
    const flexWork = workMinutes - breakMinutes + extraMinutes - normal;
    // Flex (work + travel) - correct formula: (work_end - work_start) + (work_start - travel_start) + (travel_end - work_end) - breaks + extra - normal
    let flexWorkTravel = flexWork;
    if (typeof e.travel_start_time === 'number' && typeof e.travel_end_time === 'number' && typeof e.work_start_time === 'number' && typeof e.work_end_time === 'number') {
      const beforeWork = e.work_start_time - e.travel_start_time;
      const afterWork = e.travel_end_time - e.work_end_time;
      flexWorkTravel = workMinutes + beforeWork + afterWork - breakMinutes + extraMinutes - normal;
    }
    if (dayKey === today) {
      flexTodayWork += flexWork;
      flexTodayWorkTravel += flexWorkTravel;
    }
    flexTotalWork += flexWork;
    flexTotalWorkTravel += flexWorkTravel;
    // För period-summering: summera flex för alla entries i perioden
    if (d >= start && d < end) {
      flexPeriodWork += flexWork;
      flexPeriodWorkTravel += flexWorkTravel;
      if (!dayMap[dayKey]) dayMap[dayKey] = { work: 0, workTravel: 0 };
      dayMap[dayKey].work += workMinutes;
      // Calculate workTravel for graph (same logic as flexWorkTravel, but without -breaks, +extra, -normal)
      let workTravelForGraph = workMinutes;
      if (typeof e.travel_start_time === 'number' && typeof e.travel_end_time === 'number' && typeof e.work_start_time === 'number' && typeof e.work_end_time === 'number') {
        const beforeWork = e.work_start_time - e.travel_start_time;
        const afterWork = e.travel_end_time - e.work_end_time;
        workTravelForGraph = workMinutes + beforeWork + afterWork;
      }
      dayMap[dayKey].workTravel += workTravelForGraph;
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
  // Convert minutes to hours (with decimals)
  chartWork = days.map(d => (dayMap[d]?.work || 0) / 60);
  chartWorkTravel = days.map(d => (dayMap[d]?.workTravel || 0) / 60);
  // Normal time line (hours)
  let chartNormal = [];
  for (const d of days) {
    const dateObj = new Date(d);
    let normalMinutes = 480;
    if (userSettings) {
      normalMinutes = await getWorkTimeForDate(dateObj, userSettings, req.user.id);
    }
    chartNormal.push(normalMinutes / 60);
  }
  // Debug: log chart data
  console.log('chartLabels', chartLabels);
  console.log('chartWork', chartWork);
  console.log('chartWorkTravel', chartWorkTravel);
  console.log('chartNormal', chartNormal);

  // Debug: print user id and all loaded entries
  console.log('Current user id:', req.user.id);
  console.log('Loaded entries:', entries);

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
    chartNormal,
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
  if (res.headersSent) {
    // Prevent double-send errors
    return next(err);
  }
  if (err.code === 'EBADCSRFTOKEN') {
    // CSRF error
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    return res.status(403).render('error', { message: 'Invalid CSRF token', error: err });
  }
  res.status(500).render('error', { message: 'Internal Server Error', error: err });
});

// TODO: Add routes, auth, db, i18n, error handling

export default app;

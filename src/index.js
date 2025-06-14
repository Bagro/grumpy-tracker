// Express main entrypoint for Grumpy Tracker
import express from 'express';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import passport from 'passport';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import { doubleCsrf } from 'csrf-csrf';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authRoutes from './routes/auth.js';
import timeRoutes from './routes/time.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';
import gdprRoutes from './routes/gdpr.js';
import adminRoutes from './routes/admin.js';
import absenceRoutes from './routes/absence.js';
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

// Cookie parser (needed for csrf-csrf)
app.use(cookieParser());

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
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'changeme',
  getSessionIdentifier: (req) => req.sessionID,
  cookieName: "csrf-token", // Simpler name for testing
  cookieOptions: {
    sameSite: "lax", // Needed for cross-site requests
    path: "/",
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  },
  size: 32,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"] || (req.body && req.body._csrf)
});

app.use(doubleCsrfProtection);

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
  // Fetch absences for user in the period
  // We'll fetch for the whole year to cover all periods, then filter in-memory
  const allAbsences = await prisma.absence.findMany({ where: { user_id: req.user.id } });
  const allFlexUsages = []; // FlexUsage-modellen är borttagen

  let flexTodayWork = 0, flexTodayWorkTravel = 0;
  let flexTotalWork = 0, flexTotalWorkTravel = 0;
  let flexPeriodWork = 0, flexPeriodWorkTravel = 0;
  const today = new Date().toISOString().slice(0,10);
  const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  // For graph
  const period = req.query.period || 'week';
  const selectedMonth = typeof req.query.month !== 'undefined' ? Number(req.query.month) : undefined;
  const selectedWeek = typeof req.query.week !== 'undefined' ? Number(req.query.week) : undefined;
  let chartLabels = [], chartWork = [], chartWorkTravel = [];
  // Group entries by day for the selected period
  let start, end;
  const now = new Date();
  let currentWeek = getISOWeek(now);
  let currentMonth = now.getMonth();
  if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  } else if (period === 'month') {
    const month = typeof selectedMonth === 'number' ? selectedMonth : now.getMonth();
    start = new Date(now.getFullYear(), month, 1);
    end = new Date(now.getFullYear(), month + 1, 1);
    currentMonth = month;
  } else { // week
    let week = typeof selectedWeek === 'number' ? selectedWeek : getISOWeek(now);
    let year = now.getFullYear();
    function getMondayOfISOWeek(week, year) {
      const simple = new Date(year, 0, 1 + (week - 1) * 7);
      const dow = simple.getDay();
      const day = dow === 0 ? 7 : dow;
      simple.setDate(simple.getDate() - day + 1);
      simple.setHours(0, 0, 0, 0);
      return simple;
    }
    const monday = getMondayOfISOWeek(week, year);
    start = new Date(monday);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, 0);
    currentWeek = week;
    chartLabels = [];
    let weekCursor = new Date(start);
    for (let i = 0; i < 7; i++) {
      chartLabels.push(weekCursor.toISOString().slice(0, 10));
      weekCursor.setDate(weekCursor.getDate() + 1);
    }
  }
  // Map for graph
  const dayMap = {};
  // Build a map of absences and flex usages by date
  const absenceMap = {};
  for (const a of allAbsences) {
    if (!absenceMap[a.date]) absenceMap[a.date] = [];
    absenceMap[a.date].push(a);
  }
  const flexUsageMap = {};
  for (const f of allFlexUsages) {
    if (!flexUsageMap[f.date]) flexUsageMap[f.date] = [];
    flexUsageMap[f.date].push(f);
  }
  for (const e of entries) {
    // Only include entries with both work_start_time and work_end_time as valid numbers > 0 and work_end_time > work_start_time
    if (!(typeof e.work_start_time === 'number' && typeof e.work_end_time === 'number' && e.work_start_time > 0 && e.work_end_time > e.work_start_time)) {
      continue;
    }
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    const dayKey = d.toISOString().slice(0,10);
    // Use correct work time for this entry
    let normal = await getWorkTimeForDate(d, userSettings, req.user.id);
    // Adjust normal for absences (subtract partial, handle full day)
    let absenceMinutes = 0;
    let fullDayAbsence = false;
    if (absenceMap[dayKey]) {
      for (const a of absenceMap[dayKey]) {
        if (a.full_day) {
          fullDayAbsence = true;
          absenceMinutes += normal; // treat as full normal work time
        } else if (a.start_time != null && a.end_time != null) {
          absenceMinutes += (a.end_time - a.start_time);
        }
      }
    }
    // If full day absence, all work time is flex (normal=0)
    if (fullDayAbsence) {
      normal = 0;
    } else if (absenceMinutes > 0) {
      // Otherwise, reduce normal work time by partial absences
      normal = Math.max(0, normal - absenceMinutes);
    }
    // Work, breaks, extra (all in minutes)
    const workMinutes = (typeof e.work_end_time === 'number' && typeof e.work_start_time === 'number') ? (e.work_end_time - e.work_start_time) : 0;
    const breakMinutes = (Array.isArray(e.break_start_time) && Array.isArray(e.break_end_time)) ? e.break_start_time.reduce((sum, b, i) => {
      const end = e.break_end_time[i];
      return sum + (typeof b === 'number' && typeof end === 'number' && end > b ? (end - b) : 0);
    }, 0) : 0;
    const extraMinutes = (extraMap[e.id] || []).reduce((sum, et) => sum + (typeof et.start === 'number' && typeof et.end === 'number' && et.end > et.start ? (et.end - et.start) : 0), 0);
    let flexWork = workMinutes - breakMinutes + extraMinutes - normal;
    // Subtract flex usage for this day
    if (flexUsageMap[dayKey]) {
      for (const f of flexUsageMap[dayKey]) {
        if (f.full_day) {
          flexWork -= normal; // full day = normal work time (now 0 if full absence)
        } else if (f.amount != null) {
          flexWork -= f.amount;
        } else if (f.start_time != null && f.end_time != null) {
          flexWork -= (f.end_time - f.start_time);
        }
      }
    }
    // Flex (work + travel)
    let flexWorkTravel = flexWork;
    if (typeof e.travel_start_time === 'number' && typeof e.travel_end_time === 'number' && typeof e.work_start_time === 'number' && typeof e.work_end_time === 'number') {
      const beforeWork = e.work_start_time - e.travel_start_time;
      const afterWork = e.travel_end_time - e.work_end_time;
      flexWorkTravel = workMinutes + beforeWork + afterWork - breakMinutes + extraMinutes - normal;
      // Subtract flex usage for this day (same as above)
      if (flexUsageMap[dayKey]) {
        for (const f of flexUsageMap[dayKey]) {
          if (f.full_day) {
            flexWorkTravel -= normal;
          } else if (f.amount != null) {
            flexWorkTravel -= f.amount;
          } else if (f.start_time != null && f.end_time != null) {
            flexWorkTravel -= (f.end_time - f.start_time);
          }
        }
      }
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
    // If full day absence, normalMinutes = 0 for chart
    if (absenceMap[d] && absenceMap[d].some(a => a.full_day)) {
      normalMinutes = 0;
    } else if (absenceMap[d]) {
      // Subtract partial absences
      let absenceMinutes = 0;
      for (const a of absenceMap[d]) {
        if (!a.full_day && a.start_time != null && a.end_time != null) {
          absenceMinutes += (a.end_time - a.start_time);
        }
      }
      normalMinutes = Math.max(0, normalMinutes - absenceMinutes);
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

  // Find today's entry for the widget logic
  const todaysEntry = entries.find(e => {
    const d = e.date instanceof Date ? e.date.toISOString().slice(0,10) : (typeof e.date === 'string' ? e.date.slice(0,10) : '');
    return d === today;
  }) || {};
  // Attach extraTimes for today (for dashboard widget logic)
  if (todaysEntry && todaysEntry.id) {
    todaysEntry.extraTimes = extraMap[todaysEntry.id] ? [...extraMap[todaysEntry.id]] : [];
  } else {
    todaysEntry.extraTimes = [];
  }
  // Ensure break_start_time and break_end_time are arrays for widget logic
  if (!Array.isArray(todaysEntry.break_start_time)) todaysEntry.break_start_time = [];
  if (!Array.isArray(todaysEntry.break_end_time)) todaysEntry.break_end_time = [];

  // Calculate go home time if work has started and not ended
  let goHomeTime = null;
  if (
    typeof todaysEntry.work_start_time === 'number' &&
    todaysEntry.work_start_time > 0 &&
    !(typeof todaysEntry.work_end_time === 'number' && todaysEntry.work_end_time > 0)
  ) {
    // Get normal work duration for today (in minutes)
    let normalMinutes = 480;
    if (userSettings) {
      normalMinutes = await getWorkTimeForDate(new Date(today), userSettings, req.user.id);
    }
    // If a break is ongoing, use (now - break start) for the ongoing break, otherwise sum all completed breaks
    let breakMinutes = 0;
    if (Array.isArray(todaysEntry.break_start_time)) {
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      for (let i = 0; i < todaysEntry.break_start_time.length; i++) {
        const start = todaysEntry.break_start_time[i];
        const end = (Array.isArray(todaysEntry.break_end_time) && todaysEntry.break_end_time[i] != null) ? todaysEntry.break_end_time[i] : null;
        if (typeof start === 'number') {
          if (typeof end === 'number' && end > start) {
            breakMinutes += (end - start);
          } else if (i === todaysEntry.break_start_time.length - 1) {
            // Ongoing break: only add (now - break start) for the last break
            breakMinutes += nowMinutes - start;
          }
        }
      }
    }
    // work_start_time is in minutes since midnight
    let startMinutes = todaysEntry.work_start_time;
    let endMinutes = startMinutes + normalMinutes + breakMinutes;
    // Convert to HH:mm
    let hours = Math.floor(endMinutes / 60);
    let minutes = endMinutes % 60;
    if (hours >= 24) hours = hours % 24;
    goHomeTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

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
    month: currentMonth,
    week: currentWeek,
    currentWeek,
    currentMonth,
    csrfToken: req.csrfToken(),
    currentPath: '/', // Add this line for menu highlighting
    todaysEntry // Pass today's entry for widget logic
    , goHomeTime // Pass go home time for widget
  });
});

// Helper to get ISO week number
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// Auth routes
app.use(authRoutes);
app.use(timeRoutes);
app.use(profileRoutes);
app.use(settingsRoutes);
app.use(gdprRoutes);
app.use(adminRoutes);
app.use(absenceRoutes);

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

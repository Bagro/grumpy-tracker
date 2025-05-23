import express from "express";
import { PrismaClient } from "@prisma/client";
import { parseISO } from "date-fns";
import { Parser } from 'json2csv';
import { getWorkTimeForDate } from '../utils.js';

const prisma = new PrismaClient();
const router = express.Router();

// List time entries for current user
router.get("/time", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const entries = await prisma.timeEntry.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: "desc" },
  });
  let flexToday = 0;
  let flexTotal = 0;
  if (entries.length) {
    const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
    const today = new Date().toISOString().slice(0, 10);
    for (const e of entries) {
      const entryDate = e.date instanceof Date ? e.date : new Date(e.date);
      const normal = await getWorkTimeForDate(entryDate, userSettings, req.user.id);
      const work = (e.work_end_time && e.work_start_time) ? (new Date(e.work_end_time) - new Date(e.work_start_time)) / 60000 : 0;
      const breaks = (e.break_start_time || []).reduce((sum, b, i) => {
        const end = (e.break_end_time||[])[i];
        return sum + (end && b ? (new Date(end) - new Date(b)) / 60000 : 0);
      }, 0);
      const extra = e.extra_time || 0;
      const flex = work - breaks + extra - normal;
      flexTotal += flex;
      if (e.date instanceof Date ? e.date.toISOString().slice(0,10) === today : e.date === today) {
        flexToday += flex;
      }
    }
  }
  res.render("time-list", { entries, user: req.user, csrfToken: req.csrfToken(), flexToday, flexTotal });
});

// New time entry form
router.get("/time/new", (req, res) => {
  let entry = {
    date: '',
    work_start_time: '',
    work_end_time: '',
    travel_start_time: '',
    travel_end_time: '',
    break_start_time: [],
    break_end_time: [],
    extraTimes: [],
    comments: ''
  };
  let error = null;
  if (req.query.error) error = req.query.error;
  if (req.query.entry) {
    try {
      const parsed = JSON.parse(req.query.entry);
      entry = { ...entry, ...parsed };
    } catch {}
  }
  res.render("time-form", { entry, user: req.user, error, csrfToken: req.csrfToken() });
});

// Create time entry
router.post("/time/new", async (req, res) => {
  try {
    const { date, work_start_time, work_end_time, travel_start_time, travel_end_time, break_start_time, break_end_time, extra_time_start, extra_time_end, comments } = req.body;
    function parseTime(date, time) {
      if (!date || !time) return null;
      if (!/^\d{2}:\d{2}$/.test(time)) return null;
      const [h, m] = time.split(":");
      const d = new Date(date);
      d.setHours(Number(h), Number(m), 0, 0);
      return d;
    }
    const entryDate = date;
    const workStart = parseTime(entryDate, work_start_time);
    const workEnd = parseTime(entryDate, work_end_time);
    const travelStart = travel_start_time ? parseTime(entryDate, travel_start_time) : null;
    const travelEnd = travel_end_time ? parseTime(entryDate, travel_end_time) : null;
    const breaksStart = Array.isArray(break_start_time) ? break_start_time.map(t => parseTime(entryDate, t)).filter(Boolean) : [];
    const breaksEnd = Array.isArray(break_end_time) ? break_end_time.map(t => parseTime(entryDate, t)).filter(Boolean) : [];
    // Handle multiple extra times
    let extraTimes = [];
    if (extra_time_start && extra_time_end) {
      const starts = Array.isArray(extra_time_start) ? extra_time_start : [extra_time_start];
      const ends = Array.isArray(extra_time_end) ? extra_time_end : [extra_time_end];
      for (let i = 0; i < starts.length; ++i) {
        if (starts[i] && ends[i]) {
          const start = parseTime(entryDate, starts[i]);
          const end = parseTime(entryDate, ends[i]);
          if (start && end && end > start) {
            extraTimes.push({ start, end });
          }
        }
      }
    }
    const created = await prisma.timeEntry.create({
      data: {
        user_id: req.user.id,
        date: parseISO(entryDate),
        work_start_time: workStart,
        work_end_time: workEnd,
        travel_start_time: travelStart,
        travel_end_time: travelEnd,
        break_start_time: breaksStart,
        break_end_time: breaksEnd,
        comments,
      },
    });
    // Save extraTimes
    for (const et of extraTimes) {
      await prisma.extraTime.create({
        data: {
          time_entry_id: created.id,
          start: et.start,
          end: et.end,
        },
      });
    }
    res.redirect("/time");
  } catch (err) {
    res.render("time-form", { entry: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Time summary (daily/weekly/monthly)
router.get("/time/summary", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { period = "week", date } = req.query;
  const baseDate = date ? new Date(date) : new Date();
  let start, end;
  if (period === "day") {
    start = new Date(baseDate);
    end = new Date(baseDate);
    end.setDate(end.getDate() + 1);
  } else if (period === "week") {
    start = new Date(baseDate);
    start.setDate(start.getDate() - start.getDay());
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (period === "month") {
    start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  }
  const entries = await prisma.timeEntry.findMany({
    where: {
      user_id: req.user.id,
      date: { gte: start, lt: end },
    },
    orderBy: { date: "asc" },
  });
  // Fetch all extraTimes for these entries
  const entryIds = entries.map(e => e.id);
  const extraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: { in: entryIds } } });
  const extraMap = {};
  for (const et of extraTimes) {
    if (!extraMap[et.time_entry_id]) extraMap[et.time_entry_id] = [];
    extraMap[et.time_entry_id].push(et);
  }
  const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  const summaryMap = {};
  let totalFlex = 0;
  for (const e of entries) {
    const d = e.date.toISOString().slice(0, 10);
    if (!summaryMap[d]) summaryMap[d] = { work: 0, travel: 0, breaks: 0, extra: 0, flex: 0 };
    const normal = await getWorkTimeForDate(e.date instanceof Date ? e.date : new Date(e.date), userSettings, req.user.id);
    const work = (e.work_end_time - e.work_start_time) / 60000;
    const travel = e.travel_start_time && e.travel_end_time ? (e.travel_end_time - e.travel_start_time) / 60000 : 0;
    const breaks = (e.break_start_time || []).reduce((sum, b, i) => {
      const end = (e.break_end_time||[])[i];
      return sum + (end && b ? (end - b) / 60000 : 0);
    }, 0);
    // Sum all extra intervals for this entry
    const extra = (extraMap[e.id] || []).reduce((sum, et) => sum + ((et.end - et.start) / 60000), 0);
    const flex = work - breaks + extra - normal;
    summaryMap[d].work += work;
    summaryMap[d].travel += travel;
    summaryMap[d].breaks += breaks;
    summaryMap[d].extra += extra;
    summaryMap[d].flex += flex;
    totalFlex += flex;
  }
  const summary = Object.entries(summaryMap).map(([date, row]) => ({ date, ...row }));
  res.render("time-summary", { summary, totalFlex, period, date: baseDate.toISOString().slice(0,10), user: req.user, csrfToken: req.csrfToken() });
});

// CSV export of time entries
router.get('/time/export/csv', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  const entries = await prisma.timeEntry.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: 'asc' },
  });
  const entryIds = entries.map(e => e.id);
  const extraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: { in: entryIds } } });
  const extraMap = {};
  for (const et of extraTimes) {
    if (!extraMap[et.time_entry_id]) extraMap[et.time_entry_id] = [];
    extraMap[et.time_entry_id].push(et);
  }
  const fields = [
    'date', 'work_start_time', 'work_end_time', 'travel_start_time', 'travel_end_time',
    'break_start_time', 'break_end_time', 'extra_times', 'comments', 'created_at', 'updated_at'
  ];
  const data = entries.map(e => ({
    ...e,
    break_start_time: Array.isArray(e.break_start_time) ? e.break_start_time.map(dt => {
      if (dt instanceof Date) return dt.toISOString();
      if (typeof dt === 'string' && !isNaN(Date.parse(dt))) return new Date(dt).toISOString();
      return '';
    }).join(';') : '',
    break_end_time: Array.isArray(e.break_end_time) ? e.break_end_time.map(dt => {
      if (dt instanceof Date) return dt.toISOString();
      if (typeof dt === 'string' && !isNaN(Date.parse(dt))) return new Date(dt).toISOString();
      return '';
    }).join(';') : '',
    extra_times: (extraMap[e.id] || []).map(et => `${et.start.toISOString().slice(11,16)}-${et.end.toISOString().slice(11,16)}`).join(';'),
    date: e.date instanceof Date ? e.date.toISOString() : (typeof e.date === 'string' && !isNaN(Date.parse(e.date)) ? new Date(e.date).toISOString() : ''),
    work_start_time: e.work_start_time instanceof Date ? e.work_start_time.toISOString() : (typeof e.work_start_time === 'string' && !isNaN(Date.parse(e.work_start_time)) ? new Date(e.work_start_time).toISOString() : ''),
    work_end_time: e.work_end_time instanceof Date ? e.work_end_time.toISOString() : (typeof e.work_end_time === 'string' && !isNaN(Date.parse(e.work_end_time)) ? new Date(e.work_end_time).toISOString() : ''),
    travel_start_time: e.travel_start_time ? (e.travel_start_time instanceof Date ? e.travel_start_time.toISOString() : (typeof e.travel_start_time === 'string' && !isNaN(Date.parse(e.travel_start_time)) ? new Date(e.travel_start_time).toISOString() : '')) : '',
    travel_end_time: e.travel_end_time ? (e.travel_end_time instanceof Date ? e.travel_end_time.toISOString() : (typeof e.travel_end_time === 'string' && !isNaN(Date.parse(e.travel_end_time)) ? new Date(e.travel_end_time).toISOString() : '')) : '',
    created_at: e.created_at instanceof Date ? e.created_at.toISOString() : (typeof e.created_at === 'string' && !isNaN(Date.parse(e.created_at)) ? new Date(e.created_at).toISOString() : ''),
    updated_at: e.updated_at instanceof Date ? e.updated_at.toISOString() : (typeof e.updated_at === 'string' && !isNaN(Date.parse(e.updated_at)) ? new Date(e.updated_at).toISOString() : ''),
  }));
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.header('Content-Disposition', 'attachment; filename="time-entries.csv"');
  res.send('\uFEFF' + csv); // Add BOM for Excel compatibility
});

// Edit time entry form
router.get("/time/:id/edit", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const entry = await prisma.timeEntry.findUnique({
    where: { id: req.params.id, user_id: req.user.id },
  });
  if (!entry) return res.status(404).send("Not found");
  // Fetch extraTimes
  const extraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: entry.id } });
  entry.extraTimes = extraTimes.map(et => ({ start: et.start, end: et.end }));
  res.render("time-form", { entry, user: req.user, error: null, csrfToken: req.csrfToken() });
});

// Update time entry
router.post("/time/:id/edit", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");
    const { date, work_start_time, work_end_time, travel_start_time, travel_end_time, break_start_time, break_end_time, extra_time_start, extra_time_end, comments } = req.body;
    function parseTime(date, time) {
      if (!date || !time) return null;
      if (!/^\d{2}:\d{2}$/.test(time)) return null;
      const [h, m] = time.split(":");
      const d = new Date(date);
      d.setHours(Number(h), Number(m), 0, 0);
      return d;
    }
    const entryDate = date;
    const workStart = parseTime(entryDate, work_start_time);
    const workEnd = parseTime(entryDate, work_end_time);
    const travelStart = travel_start_time ? parseTime(entryDate, travel_start_time) : null;
    const travelEnd = travel_end_time ? parseTime(entryDate, travel_end_time) : null;
    const breaksStart = Array.isArray(break_start_time) ? break_start_time.map(t => parseTime(entryDate, t)).filter(Boolean) : [];
    const breaksEnd = Array.isArray(break_end_time) ? break_end_time.map(t => parseTime(entryDate, t)).filter(Boolean) : [];
    // Handle multiple extra times
    let extraTimes = [];
    if (extra_time_start && extra_time_end) {
      const starts = Array.isArray(extra_time_start) ? extra_time_start : [extra_time_start];
      const ends = Array.isArray(extra_time_end) ? extra_time_end : [extra_time_end];
      for (let i = 0; i < starts.length; ++i) {
        if (starts[i] && ends[i]) {
          const start = parseTime(entryDate, starts[i]);
          const end = parseTime(entryDate, ends[i]);
          if (start && end && end > start) {
            extraTimes.push({ start, end });
          }
        }
      }
    }
    await prisma.timeEntry.update({
      where: { id: req.params.id, user_id: req.user.id },
      data: {
        date: parseISO(entryDate),
        work_start_time: workStart,
        work_end_time: workEnd,
        travel_start_time: travelStart,
        travel_end_time: travelEnd,
        break_start_time: breaksStart,
        break_end_time: breaksEnd,
        comments,
      },
    });
    // Remove old extraTimes and insert new
    await prisma.extraTime.deleteMany({ where: { time_entry_id: req.params.id } });
    for (const et of extraTimes) {
      await prisma.extraTime.create({
        data: {
          time_entry_id: req.params.id,
          start: et.start,
          end: et.end,
        },
      });
    }
    res.redirect("/time");
  } catch (err) {
    res.render("time-form", { entry: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

export default router;

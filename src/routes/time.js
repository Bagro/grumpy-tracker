import express from "express";
import { PrismaClient } from "@prisma/client";
import { parseISO } from "date-fns";
import { Parser } from 'json2csv';

const prisma = new PrismaClient();
const router = express.Router();

// List time entries for current user
router.get("/time", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const entries = await prisma.timeEntry.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: "desc" },
  });
  res.render("time-list", { entries, user: req.user, csrfToken: req.csrfToken() });
});

// New time entry form
router.get("/time/new", (req, res) => {
  let entry = null;
  let error = null;
  if (req.query.error) error = req.query.error;
  if (req.query.entry) entry = JSON.parse(req.query.entry);
  res.render("time-form", { entry, user: req.user, error, csrfToken: req.csrfToken() });
});

// Create time entry
router.post("/time/new", async (req, res) => {
  try {
    const { date, work_start_time, work_end_time, travel_start_time, travel_end_time, break_start_time, break_end_time, extra_time, comments } = req.body;
    await prisma.timeEntry.create({
      data: {
        user_id: req.user.id,
        date: parseISO(date),
        work_start_time: parseISO(work_start_time),
        work_end_time: parseISO(work_end_time),
        travel_start_time: travel_start_time ? parseISO(travel_start_time) : null,
        travel_end_time: travel_end_time ? parseISO(travel_end_time) : null,
        break_start_time: break_start_time ? break_start_time.map(parseISO) : [],
        break_end_time: break_end_time ? break_end_time.map(parseISO) : [],
        extra_time: extra_time ? parseInt(extra_time) : null,
        comments,
      },
    });
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
  // Fetch user settings for normal work time
  let normal = 480;
  const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  if (userSettings) normal = userSettings.normal_work_time;
  // Group by day
  const summaryMap = {};
  let totalFlex = 0;
  for (const e of entries) {
    const d = e.date.toISOString().slice(0, 10);
    if (!summaryMap[d]) summaryMap[d] = { work: 0, travel: 0, breaks: 0, extra: 0, flex: 0 };
    const work = (e.work_end_time - e.work_start_time) / 60000;
    const travel = e.travel_start_time && e.travel_end_time ? (e.travel_end_time - e.travel_start_time) / 60000 : 0;
    const breaks = (e.break_start_time || []).reduce((sum, b, i) => {
      const end = (e.break_end_time||[])[i];
      return sum + (end && b ? (end - b) / 60000 : 0);
    }, 0);
    const extra = e.extra_time || 0;
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
  const fields = [
    'date', 'work_start_time', 'work_end_time', 'travel_start_time', 'travel_end_time',
    'break_start_time', 'break_end_time', 'extra_time', 'comments', 'created_at', 'updated_at'
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

export default router;

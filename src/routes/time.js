import express from "express";
import { PrismaClient } from "@prisma/client";
import { parseISO } from "date-fns";

const prisma = new PrismaClient();
const router = express.Router();

// List time entries for current user
router.get("/time", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const entries = await prisma.timeEntry.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: "desc" },
  });
  res.render("time-list", { entries, user: req.user });
});

// New time entry form
router.get("/time/new", (req, res) => {
  res.render("time-form", { entry: null, user: req.user, error: null });
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
    res.render("time-form", { entry: req.body, user: req.user, error: err.message });
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
  res.render("time-summary", { summary, totalFlex, period, date: baseDate.toISOString().slice(0,10), user: req.user });
});

export default router;

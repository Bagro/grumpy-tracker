import express from "express";
import { PrismaClient } from "@prisma/client";
import { getWorkTimeForDate } from '../utils.js';

const prisma = new PrismaClient();
const router = express.Router();

// Helper: Calculate flex for a single time entry (same logic as i time.js)
async function calculateFlexForEntry({ userId, date, work_start_time, work_end_time, break_start_time, break_end_time, extraTimes }) {
  const userSettings = await prisma.settings.findUnique({ where: { user_id: userId } });
  const d = typeof date === 'string' ? new Date(date) : date;
  let normal = await getWorkTimeForDate(d, userSettings, userId);
  // Absence
  const absences = await prisma.absence.findMany({ where: { user_id: userId, date: d.toISOString().slice(0,10) } });
  let absenceMinutes = 0;
  let fullDayAbsence = false;
  for (const a of absences) {
    if (a.full_day) {
      fullDayAbsence = true;
      absenceMinutes += normal;
    } else if (a.start_time != null && a.end_time != null) {
      absenceMinutes += (a.end_time - a.start_time);
    }
  }
  if (fullDayAbsence) {
    normal = 0;
  } else if (absenceMinutes > 0) {
    normal = Math.max(0, normal - absenceMinutes);
  }
  // Flex
  const work = (typeof work_end_time === 'number' && typeof work_start_time === 'number') ? (work_end_time - work_start_time) : 0;
  const breaksMin = (break_start_time||[]).reduce((sum, b, i) => sum + (typeof b === 'number' && typeof (break_end_time||[])[i] === 'number' && (break_end_time||[])[i] > b ? ((break_end_time||[])[i] - b) : 0), 0);
  const extraMin = (extraTimes||[]).reduce((sum, et) => sum + (typeof et.start === 'number' && typeof et.end === 'number' && et.end > et.start ? (et.end - et.start) : 0), 0);
  let flex = work - breaksMin + extraMin - normal;
  // Subtract flex usage for this day
  const flexusages = await prisma.flexUsage.findMany({ where: { user_id: userId, date: d.toISOString().slice(0,10) } });
  for (const f of flexusages) {
    if (f.full_day) {
      const normalForDay = await getWorkTimeForDate(d, userSettings, userId);
      flex -= normalForDay;
    } else if (f.amount != null) {
      flex -= f.amount;
    } else if (f.start_time != null && f.end_time != null) {
      flex -= (f.end_time - f.start_time);
    }
  }
  return Math.round(flex);
}

// List flex usages for current user
router.get("/flexusage", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const flexusages = await prisma.flexUsage.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: "desc" },
  });
  res.render("flexusage-list", { flexusages, user: req.user, csrfToken: req.csrfToken() });
});

// New flex usage form
router.get("/flexusage/new", (req, res) => {
  res.render("flexusage-form", { flexusage: {}, user: req.user, error: null, csrfToken: req.csrfToken() });
});

// Create flex usage
router.post("/flexusage/new", async (req, res) => {
  try {
    const { date, full_day, start_time, end_time, amount, comments } = req.body;
    if (!date) {
      return res.render("flexusage-form", { flexusage: req.body, user: req.user, error: "Missing required fields", csrfToken: req.csrfToken() });
    }
    await prisma.flexUsage.create({
      data: {
        user_id: req.user.id,
        date,
        full_day: full_day === "on" || full_day === true,
        start_time: full_day === "on" ? null : (start_time ? parseInt(start_time) : null),
        end_time: full_day === "on" ? null : (end_time ? parseInt(end_time) : null),
        amount: amount ? parseInt(amount) : null,
        comments,
      },
    });
    // Efter att en flex usage lagts till, räkna om flex_balance för användaren (alla dagar)
    const allEntries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id } });
    let totalFlex = 0;
    for (const entry of allEntries) {
      const extraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: entry.id } });
      const flex = await calculateFlexForEntry({
        userId: req.user.id,
        date: entry.date,
        work_start_time: entry.work_start_time,
        work_end_time: entry.work_end_time,
        break_start_time: entry.break_start_time,
        break_end_time: entry.break_end_time,
        extraTimes
      });
      totalFlex += flex;
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { flex_balance: { set: totalFlex } } });
    res.redirect("/flexusage");
  } catch (err) {
    res.render("flexusage-form", { flexusage: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Delete flex usage
router.post("/flexusage/:id/delete", async (req, res) => {
  try {
    await prisma.flexUsage.delete({ where: { id: req.params.id, user_id: req.user.id } });
    // Efter att en flex usage tagits bort, räkna om flex_balance för användaren (hela dagen)
    const flexusage = await prisma.flexUsage.findUnique({ where: { id: req.params.id, user_id: req.user.id } });
    if (flexusage) {
      const timeEntries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id, date: flexusage.date } });
      let totalFlex = 0;
      for (const entry of timeEntries) {
        const extraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: entry.id } });
        const flex = await calculateFlexForEntry({
          userId: req.user.id,
          date: entry.date,
          work_start_time: entry.work_start_time,
          work_end_time: entry.work_end_time,
          break_start_time: entry.break_start_time,
          break_end_time: entry.break_end_time,
          extraTimes
        });
        totalFlex += flex;
      }
      await prisma.user.update({ where: { id: req.user.id }, data: { flex_balance: { set: totalFlex } } });
    }
    res.redirect("/flexusage");
  } catch (err) {
    res.status(500).send("Failed to delete flex usage: " + err.message);
  }
});

export default router;

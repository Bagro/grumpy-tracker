import express from "express";
import { PrismaClient } from "@prisma/client";
import { getWorkTimeForDate } from '../utils.js';

const prisma = new PrismaClient();
const router = express.Router();

// Helper: Calculate flex for a single time entry (same logic as in time.js)
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
  // const flexusages = await prisma.flexUsage.findMany({ where: { user_id: userId, date: d.toISOString().slice(0,10) } });
  const flexusages = [];
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

// List absences for current user
router.get("/absence", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const absences = await prisma.absence.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: "desc" },
  });
  res.render("absence-list", { absences, user: req.user, csrfToken: req.csrfToken() });
});

// New absence form
router.get("/absence/new", (req, res) => {
  res.render("absence-form", { absence: {}, user: req.user, error: null, csrfToken: req.csrfToken() });
});

// Create absence
router.post("/absence/new", async (req, res) => {
  try {
    const { date, type, full_day, start_time, end_time, comments } = req.body;
    if (!date || !type) {
      return res.render("absence-form", { absence: req.body, user: req.user, error: "Missing required fields", csrfToken: req.csrfToken() });
    }
    await prisma.absence.create({
      data: {
        user_id: req.user.id,
        date,
        type,
        full_day: full_day === "on" || full_day === true,
        start_time: full_day === "on" ? null : (start_time ? parseInt(start_time) : null),
        end_time: full_day === "on" ? null : (end_time ? parseInt(end_time) : null),
        comments,
      },
    });
    // Efter att en absence lagts till, räkna om flex_balance för användaren (hela dagen)
    // För enkelhet: summera om alla entries för dagen och sätt flex_balance till summan
    // (Kan optimeras senare)
    // Hämta alla time entries för dagen
    const timeEntries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id, date } });
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
    res.redirect("/absence");
  } catch (err) {
    res.render("absence-form", { absence: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Delete absence
router.post("/absence/:id/delete", async (req, res) => {
  try {
    await prisma.absence.delete({ where: { id: req.params.id, user_id: req.user.id } });
    // Efter att en absence tagits bort, räkna om flex_balance för användaren (hela dagen)
    const absence = await prisma.absence.findUnique({ where: { id: req.params.id, user_id: req.user.id } });
    if (absence) {
      const timeEntries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id, date: absence.date } });
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
    res.redirect("/absence");
  } catch (err) {
    res.status(500).send("Failed to delete absence: " + err.message);
  }
});

// Flexuttag = frånvaro: typ "flex_leave", alltid full_day=true, start/end_time null
router.post("/absence/flex_leave", async (req, res) => {
  try {
    const { date, comments } = req.body;
    if (!date) {
      return res.status(400).send("Missing required fields");
    }
    await prisma.absence.create({
      data: {
        user_id: req.user.id,
        date,
        type: "flex_leave",
        full_day: true,
        start_time: null,
        end_time: null,
        comments,
      },
    });
    res.redirect("/absence");
  } catch (err) {
    res.status(500).send("Failed to create flex leave: " + err.message);
  }
});

export default router;

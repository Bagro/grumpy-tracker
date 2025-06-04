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
  let hasFullDayFlexLeave = false;
  let hasFullDayVacationOrVab = false;
  for (const a of absences) {
    if (a.full_day) {
      if (a.type === 'flex_leave') {
        hasFullDayFlexLeave = true;
      } else if (a.type === 'vacation' || a.type === 'care_of_sick_child') {
        hasFullDayVacationOrVab = true;
      }
    } else if (a.start_time != null && a.end_time != null && a.type !== 'flex_leave') {
      absenceMinutes += (a.end_time - a.start_time);
    }
  }
  if (hasFullDayVacationOrVab) {
    normal = 0;
  } else if (absenceMinutes > 0) {
    normal = Math.max(0, normal - absenceMinutes);
  }
  // Flex
  const work = (typeof work_end_time === 'number' && typeof work_start_time === 'number') ? (work_end_time - work_start_time) : 0;
  const breaksMin = (break_start_time||[]).reduce((sum, b, i) => sum + (typeof b === 'number' && typeof (break_end_time||[])[i] === 'number' && (break_end_time||[])[i] > b ? ((break_end_time||[])[i] - b) : 0), 0);
  const extraMin = (extraTimes||[]).reduce((sum, et) => sum + (typeof et.start === 'number' && typeof et.end === 'number' && et.end > et.start ? (et.end - et.start) : 0), 0);
  let flex = work - breaksMin + extraMin - normal;
  if (hasFullDayFlexLeave) {
    flex -= await getWorkTimeForDate(d, userSettings, userId);
  }
  return Math.round(flex);
}

// Helper: Räkna om flex_balance och flex_balance_travel för användaren
export async function recalculateFlexBalances(userId) {
  // Hämta alla time entries
  const timeEntries = await prisma.timeEntry.findMany({ where: { user_id: userId } });
  let totalFlex = 0;
  let totalFlexTravel = 0;
  const userSettings = await prisma.settings.findUnique({ where: { user_id: userId } });
  for (const entry of timeEntries) {
    const extraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: entry.id } });
    // Flex
    const flex = await calculateFlexForEntry({
      userId,
      date: entry.date,
      work_start_time: entry.work_start_time,
      work_end_time: entry.work_end_time,
      break_start_time: entry.break_start_time,
      break_end_time: entry.break_end_time,
      extraTimes
    });
    totalFlex += flex;
    // Flex + Travel
    let flexTravel = flex;
    if (typeof entry.travel_start_time === 'number' && typeof entry.travel_end_time === 'number' && typeof entry.work_start_time === 'number' && typeof entry.work_end_time === 'number') {
      const beforeWork = entry.work_start_time - entry.travel_start_time;
      const afterWork = entry.travel_end_time - entry.work_end_time;
      flexTravel = entry.work_end_time - entry.work_start_time + beforeWork + afterWork - (entry.break_start_time||[]).reduce((sum, b, i) => sum + (typeof b === 'number' && typeof (entry.break_end_time||[])[i] === 'number' && (entry.break_end_time||[])[i] > b ? ((entry.break_end_time||[])[i] - b) : 0), 0) + (extraTimes||[]).reduce((sum, et) => sum + (typeof et.start === 'number' && typeof et.end === 'number' && et.end > et.start ? (et.end - et.start) : 0), 0) - (await getWorkTimeForDate(new Date(entry.date), userSettings, userId));
    }
    totalFlexTravel += flexTravel;
  }
  // Dra av normaltid för alla heldags flex_leave-absences
  const flexLeaves = await prisma.absence.findMany({ where: { user_id: userId, type: 'flex_leave', full_day: true } });
  for (const absence of flexLeaves) {
    const normal = await getWorkTimeForDate(new Date(absence.date), userSettings, userId);
    totalFlex -= normal;
    totalFlexTravel -= normal;
  }
  await prisma.user.update({ where: { id: userId }, data: { flex_balance: totalFlex, flex_balance_travel: totalFlexTravel } });
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
    let { date, type, full_day, start_time, end_time, comments } = req.body;
    if (!date || !type) {
      return res.render("absence-form", { absence: req.body, user: req.user, error: "Missing required fields", csrfToken: req.csrfToken() });
    }
    // Enforce flex_leave rules
    if (type === "flex_leave") {
      full_day = true;
      start_time = null;
      end_time = null;
    }
    await prisma.absence.create({
      data: {
        user_id: req.user.id,
        date,
        type,
        full_day: full_day === "on" || full_day === true,
        start_time: full_day === "on" || type === "flex_leave" ? null : (start_time ? parseInt(start_time) : null),
        end_time: full_day === "on" || type === "flex_leave" ? null : (end_time ? parseInt(end_time) : null),
        comments,
      },
    });
    await recalculateFlexBalances(req.user.id);
    res.redirect("/absence");
  } catch (err) {
    res.render("absence-form", { absence: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Delete absence
router.post("/absence/:id/delete", async (req, res) => {
  try {
    await prisma.absence.delete({ where: { id: req.params.id, user_id: req.user.id } });
    await recalculateFlexBalances(req.user.id);
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
    // Dra av normaltiden för dagen från flex_balance och flex_balance_travel
    const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
    const normal = await getWorkTimeForDate(new Date(date), userSettings, req.user.id);
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        flex_balance: { decrement: normal },
        flex_balance_travel: { decrement: normal }
      }
    });
    res.redirect("/absence");
  } catch (err) {
    res.status(500).send("Failed to create flex leave: " + err.message);
  }
});

// Edit absence form
router.get("/absence/:id", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const absence = await prisma.absence.findUnique({ where: { id: req.params.id, user_id: req.user.id } });
  if (!absence) return res.status(404).render("error", { message: "Absence not found", user: req.user });
  res.render("absence-form", { absence, user: req.user, error: null, csrfToken: req.csrfToken() });
});

// (Future) Edit absence - ensure flex_leave rules are enforced
router.post("/absence/:id", async (req, res) => {
  try {
    let { date, type, full_day, start_time, end_time, comments } = req.body;
    if (!date || !type) {
      return res.render("absence-form", { absence: req.body, user: req.user, error: "Missing required fields", csrfToken: req.csrfToken() });
    }
    // Enforce flex_leave rules
    if (type === "flex_leave") {
      full_day = true;
      start_time = null;
      end_time = null;
    }
    await prisma.absence.update({
      where: { id: req.params.id, user_id: req.user.id },
      data: {
        date,
        type,
        full_day: full_day === "on" || full_day === true,
        start_time: full_day === "on" || type === "flex_leave" ? null : (start_time ? parseInt(start_time) : null),
        end_time: full_day === "on" || type === "flex_leave" ? null : (end_time ? parseInt(end_time) : null),
        comments,
      },
    });
    await recalculateFlexBalances(req.user.id);
    res.redirect("/absence");
  } catch (err) {
    res.render("absence-form", { absence: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

export default router;

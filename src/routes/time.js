import express from "express";
import { PrismaClient } from "@prisma/client";
import { parseISO } from "date-fns";
import { Parser } from 'json2csv';
import { getWorkTimeForDate } from '../utils.js';

const prisma = new PrismaClient();
const router = express.Router();

// Helper: HH:mm -> minuter
function timeToMinutes(t) {
  if (!t || typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) return 0;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}
// Helper: skillnad i minuter mellan två HH:mm
function diffMinutes(start, end) {
  return timeToMinutes(end) - timeToMinutes(start);
}

// List time entries for current user
router.get("/time", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const entriesRaw = await prisma.timeEntry.findMany({
    where: { user_id: req.user.id },
    orderBy: { date: "desc" },
  });
  const entryIds = entriesRaw.map(e => e.id);
  const extraTimesAll = await prisma.extraTime.findMany({ where: { time_entry_id: { in: entryIds } } });
  // Map extraTimes to entry id
  const extraMap = {};
  for (const et of extraTimesAll) {
    if (!extraMap[et.time_entry_id]) extraMap[et.time_entry_id] = [];
    extraMap[et.time_entry_id].push(et);
  }
  let flexToday = 0;
  let flexTotal = 0;
  let flexTotalTravel = 0;
  const userSettings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  const today = new Date().toISOString().slice(0, 10);
  const entries = await Promise.all(entriesRaw.map(async e => {
    // Breaks
    const breaks = (e.break_start_time || []).map((b, i) => ({
      start: b,
      end: (e.break_end_time||[])[i]
    })).filter(b => b.start !== undefined && b.end !== undefined && b.start !== null && b.end !== null);
    // Extra
    const extraTimes = (extraMap[e.id] || []).map(et => ({
      start: et.start,
      end: et.end
    }));
    // Absence and flex usage integration (match dashboard logic)
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    const dayKey = d.toISOString().slice(0,10);
    let normal = await getWorkTimeForDate(d, userSettings, req.user.id);
    // Fetch absences for this day
    const absences = await prisma.absence.findMany({ where: { user_id: req.user.id, date: dayKey } });
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
    const work = (typeof e.work_end_time === 'number' && typeof e.work_start_time === 'number') ? (e.work_end_time - e.work_start_time) : 0;
    const breaksMin = breaks.reduce((sum, b) => sum + (typeof b.start === 'number' && typeof b.end === 'number' && b.end > b.start ? (b.end - b.start) : 0), 0);
    const extraMin = extraTimes.reduce((sum, et) => sum + (typeof et.start === 'number' && typeof et.end === 'number' && et.end > et.start ? (et.end - et.start) : 0), 0);
    let flex = work - breaksMin + extraMin - normal;
    // Subtract flex usage for this day (fix: always subtract, even if normal=0)
    const flexusages = await prisma.flexUsage.findMany({ where: { user_id: req.user.id, date: dayKey } });
    for (const f of flexusages) {
      if (f.full_day) {
        // Subtract the user's normal work time for this date (not the possibly reduced normal)
        const normalForDay = await getWorkTimeForDate(d, userSettings, req.user.id);
        flex -= normalForDay;
      } else if (f.amount != null) {
        flex -= f.amount;
      } else if (f.start_time != null && f.end_time != null) {
        flex -= (f.end_time - f.start_time);
      }
    }
    // Flex + Travel (samma logik som dashboard)
    let flexTravel = flex;
    if (typeof e.travel_start_time === 'number' && typeof e.travel_end_time === 'number' && typeof e.work_start_time === 'number' && typeof e.work_end_time === 'number') {
      const beforeWork = e.work_start_time - e.travel_start_time;
      const afterWork = e.travel_end_time - e.work_end_time;
      flexTravel = work + beforeWork + afterWork - breaksMin + extraMin - normal;
      for (const f of flexusages) {
        if (f.full_day) {
          const normalForDay = await getWorkTimeForDate(d, userSettings, req.user.id);
          flexTravel -= normalForDay;
        } else if (f.amount != null) {
          flexTravel -= f.amount;
        } else if (f.start_time != null && f.end_time != null) {
          flexTravel -= (f.end_time - f.start_time);
        }
      }
    }
    if (e.date === today) flexToday += flex;
    flexTotal += flex;
    flexTotalTravel += flexTravel;
    return {
      id: e.id,
      date: e.date,
      travel_start_time: e.travel_start_time || '',
      work_start_time: e.work_start_time || '',
      work_end_time: e.work_end_time || '',
      travel_end_time: e.travel_end_time || '',
      breaks,
      extraTimes,
      flex: Math.round(flex),
      comments: e.comments || ''
    };
  }));
  res.render("time-list", { entries, user: req.user, csrfToken: req.csrfToken(), flexToday, flexTotal, flexTotalTravel });
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
    // Spara tider som minuter från midnatt
    const entryDate = date;
    // Check for existing entry for this user and date
    const existing = await prisma.timeEntry.findFirst({
      where: { user_id: req.user.id, date: entryDate },
    });
    if (existing) {
      return res.render("time-form", {
        entry: req.body,
        user: req.user,
        error: req.t ? req.t('time_entry_exists', 'You already have a time entry for this date.') : 'You already have a time entry for this date.',
        csrfToken: req.csrfToken(),
      });
    }
    const workStart = timeToMinutes(work_start_time);
    const workEnd = timeToMinutes(work_end_time);
    const travelStart = travel_start_time ? timeToMinutes(travel_start_time) : null;
    const travelEnd = travel_end_time ? timeToMinutes(travel_end_time) : null;
    const breaksStart = Array.isArray(break_start_time) ? break_start_time.map(timeToMinutes) : (break_start_time ? [timeToMinutes(break_start_time)] : []);
    const breaksEnd = Array.isArray(break_end_time) ? break_end_time.map(timeToMinutes) : (break_end_time ? [timeToMinutes(break_end_time)] : []);
    // Handle multiple extra times
    let extraTimes = [];
    if (extra_time_start && extra_time_end) {
      const starts = Array.isArray(extra_time_start) ? extra_time_start : [extra_time_start];
      const ends = Array.isArray(extra_time_end) ? extra_time_end : [extra_time_end];
      for (let i = 0; i < starts.length; ++i) {
        if (starts[i] && ends[i]) {
          const start = timeToMinutes(starts[i]);
          const end = timeToMinutes(ends[i]);
          if (start >= 0 && end > start) {
            extraTimes.push({ start, end });
          }
        }
      }
    }
    const created = await prisma.timeEntry.create({
      data: {
        user_id: req.user.id,
        date: entryDate,
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
    // Uppdatera flex_balance
    const flex = await calculateFlexForEntry({
      userId: req.user.id,
      date: entryDate,
      work_start_time: workStart,
      work_end_time: workEnd,
      break_start_time: breaksStart,
      break_end_time: breaksEnd,
      extraTimes
    });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { flex_balance: { increment: flex } }
    });
    res.redirect("/time");
  } catch (err) {
    res.render("time-form", { entry: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
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
  // Helper: Int (minuter från midnatt) -> HH:mm
  function minToTime(mins) {
    if (mins === null || mins === undefined || mins === '') return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  // Convert all time fields to HH:mm for the form
  entry.travel_start_time = minToTime(entry.travel_start_time);
  entry.work_start_time = minToTime(entry.work_start_time);
  entry.work_end_time = minToTime(entry.work_end_time);
  entry.travel_end_time = minToTime(entry.travel_end_time);
  entry.break_start_time = Array.isArray(entry.break_start_time) ? entry.break_start_time.map(minToTime) : [];
  entry.break_end_time = Array.isArray(entry.break_end_time) ? entry.break_end_time.map(minToTime) : [];
  entry.extraTimes = extraTimes.map(et => ({ start: minToTime(et.start), end: minToTime(et.end) }));
  res.render("time-form", { entry, user: req.user, error: null, csrfToken: req.csrfToken() });
});

// Update time entry
router.post("/time/:id/edit", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");
    const { date, work_start_time, work_end_time, travel_start_time, travel_end_time, break_start_time, break_end_time, extra_time_start, extra_time_end, comments } = req.body;
    // Spara tider som minuter från midnatt
    const entryDate = date;
    const workStart = timeToMinutes(work_start_time);
    const workEnd = timeToMinutes(work_end_time);
    const travelStart = travel_start_time ? timeToMinutes(travel_start_time) : null;
    const travelEnd = travel_end_time ? timeToMinutes(travel_end_time) : null;
    const breaksStart = Array.isArray(break_start_time) ? break_start_time.map(timeToMinutes) : (break_start_time ? [timeToMinutes(break_start_time)] : []);
    const breaksEnd = Array.isArray(break_end_time) ? break_end_time.map(timeToMinutes) : (break_end_time ? [timeToMinutes(break_end_time)] : []);
    // Handle multiple extra times
    let extraTimes = [];
    if (extra_time_start && extra_time_end) {
      const starts = Array.isArray(extra_time_start) ? extra_time_start : [extra_time_start];
      const ends = Array.isArray(extra_time_end) ? extra_time_end : [extra_time_end];
      for (let i = 0; i < starts.length; ++i) {
        if (starts[i] && ends[i]) {
          const start = timeToMinutes(starts[i]);
          const end = timeToMinutes(ends[i]);
          if (start >= 0 && end > start) {
            extraTimes.push({ start, end });
          }
        }
      }
    }
    // Hämta gammal entry för att räkna ut skillnad
    const oldEntry = await prisma.timeEntry.findUnique({ where: { id: req.params.id, user_id: req.user.id } });
    const oldExtraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: req.params.id } });
    const oldFlex = await calculateFlexForEntry({
      userId: req.user.id,
      date: oldEntry.date,
      work_start_time: oldEntry.work_start_time,
      work_end_time: oldEntry.work_end_time,
      break_start_time: oldEntry.break_start_time,
      break_end_time: oldEntry.break_end_time,
      extraTimes: oldExtraTimes
    });
    await prisma.timeEntry.update({
      where: { id: req.params.id, user_id: req.user.id },
      data: {
        date: entryDate,
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
    // Räkna ut ny flex och uppdatera skillnaden
    const newFlex = await calculateFlexForEntry({
      userId: req.user.id,
      date: entryDate,
      work_start_time: workStart,
      work_end_time: workEnd,
      break_start_time: breaksStart,
      break_end_time: breaksEnd,
      extraTimes
    });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { flex_balance: { increment: newFlex - oldFlex } }
    });
    res.redirect("/time");
  } catch (err) {
    res.render("time-form", { entry: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Delete time entry
router.post("/time/:id/delete", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");
    await prisma.extraTime.deleteMany({ where: { time_entry_id: req.params.id } });
    await prisma.timeEntry.delete({ where: { id: req.params.id, user_id: req.user.id } });
    // Uppdatera flex_balance (dra bort flex för denna entry)
    const oldEntry = await prisma.timeEntry.findUnique({ where: { id: req.params.id, user_id: req.user.id } });
    if (oldEntry) {
      const oldExtraTimes = await prisma.extraTime.findMany({ where: { time_entry_id: req.params.id } });
      const oldFlex = await calculateFlexForEntry({
        userId: req.user.id,
        date: oldEntry.date,
        work_start_time: oldEntry.work_start_time,
        work_end_time: oldEntry.work_end_time,
        break_start_time: oldEntry.break_start_time,
        break_end_time: oldEntry.break_end_time,
        extraTimes: oldExtraTimes
      });
      await prisma.user.update({
        where: { id: req.user.id },
        data: { flex_balance: { decrement: oldFlex } }
      });
    }
    res.redirect("/time");
  } catch (err) {
    res.status(500).send("Failed to delete time entry: " + err.message);
  }
});

// Helper: Calculate flex for a single time entry (same logic as in list)
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

export default router;

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

export default router;

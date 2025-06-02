import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

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
    res.redirect("/absence");
  } catch (err) {
    res.render("absence-form", { absence: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Delete absence
router.post("/absence/:id/delete", async (req, res) => {
  try {
    await prisma.absence.delete({ where: { id: req.params.id, user_id: req.user.id } });
    res.redirect("/absence");
  } catch (err) {
    res.status(500).send("Failed to delete absence: " + err.message);
  }
});

export default router;

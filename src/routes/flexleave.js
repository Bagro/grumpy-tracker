import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// Flex leave form (register flex leave as absence)
router.get("/absence/flex-leave", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("absence-form", {
    absence: { type: "flex_leave", full_day: true },
    user: req.user,
    error: null,
    csrfToken: req.csrfToken(),
    flexLeave: true
  });
});

// Create flex leave (absence)
router.post("/absence/flex-leave", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");
    const { date, comments } = req.body;
    if (!date) {
      return res.render("absence-form", {
        absence: { type: "flex_leave", full_day: true, date, comments },
        user: req.user,
        error: "Date is required",
        csrfToken: req.csrfToken(),
        flexLeave: true
      });
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
    res.render("absence-form", {
      absence: { type: "flex_leave", full_day: true, date: req.body.date, comments: req.body.comments },
      user: req.user,
      error: err.message,
      csrfToken: req.csrfToken(),
      flexLeave: true
    });
  }
});

export default router;

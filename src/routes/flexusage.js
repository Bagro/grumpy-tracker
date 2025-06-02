import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

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
    res.redirect("/flexusage");
  } catch (err) {
    res.render("flexusage-form", { flexusage: req.body, user: req.user, error: err.message, csrfToken: req.csrfToken() });
  }
});

// Delete flex usage
router.post("/flexusage/:id/delete", async (req, res) => {
  try {
    await prisma.flexUsage.delete({ where: { id: req.params.id, user_id: req.user.id } });
    res.redirect("/flexusage");
  } catch (err) {
    res.status(500).send("Failed to delete flex usage: " + err.message);
  }
});

export default router;

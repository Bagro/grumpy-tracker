import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// Show settings form
router.get("/settings", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  let settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: { user_id: req.user.id, normal_work_time: 480, summer_work_time: 435 },
    });
  }
  res.render("settings", { user: req.user, settings, error: null, success: null });
});

// Update settings
router.post("/settings", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { normal_work_time, summer_work_time } = req.body;
  let error = null, success = null;
  try {
    await prisma.settings.upsert({
      where: { user_id: req.user.id },
      update: {
        normal_work_time: parseInt(normal_work_time),
        summer_work_time: parseInt(summer_work_time),
      },
      create: {
        user_id: req.user.id,
        normal_work_time: parseInt(normal_work_time),
        summer_work_time: parseInt(summer_work_time),
      },
    });
    success = "Settings updated.";
    const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
    res.render("settings", { user: req.user, settings, error, success });
  } catch (err) {
    const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
    res.render("settings", { user: req.user, settings, error: err.message, success: null });
  }
});

export default router;

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
      data: { user_id: req.user.id, normal_work_time: 480 },
    });
  }
  const workPeriods = await prisma.workPeriod.findMany({ where: { user_id: req.user.id }, orderBy: { start: 'asc' } });
  res.render("settings", {
    user: req.user,
    settings,
    workPeriods,
    error: null,
    success: null,
    csrfToken: req.csrfToken(),
  });
});

// Update normal work time
router.post("/settings", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const normal_work_time =
    parseInt(req.body.normal_work_time_h || 0) * 60 + parseInt(req.body.normal_work_time_m || 0);
  let error = null, success = null;
  try {
    await prisma.settings.upsert({
      where: { user_id: req.user.id },
      update: { normal_work_time },
      create: { user_id: req.user.id, normal_work_time },
    });
    success = "Settings updated.";
  } catch (err) {
    error = err.message;
  }
  const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  const workPeriods = await prisma.workPeriod.findMany({ where: { user_id: req.user.id }, orderBy: { start: 'asc' } });
  res.render("settings", { user: req.user, settings, workPeriods, error, success, csrfToken: req.csrfToken() });
});

// Add or update a work period
router.post("/settings/work-period", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { id, name, start, end, work_time_h, work_time_m } = req.body;
  const work_time_minutes = parseInt(work_time_h || 0) * 60 + parseInt(work_time_m || 0);
  let error = null, success = null;
  try {
    if (id) {
      await prisma.workPeriod.update({
        where: { id },
        data: { name, start: new Date(start), end: new Date(end), work_time_minutes },
      });
      success = "Work period updated.";
    } else {
      console.log('DEBUG: Creating work period', { user_id: req.user.id, name, start, end, work_time_minutes });
      await prisma.workPeriod.create({
        data: { user_id: req.user.id, name, start: new Date(start), end: new Date(end), work_time_minutes },
      });
      success = "Work period added.";
    }
  } catch (err) {
    error = err.message;
    console.error('WorkPeriod error:', err);
  }
  const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  const workPeriods = await prisma.workPeriod.findMany({ where: { user_id: req.user.id }, orderBy: { start: 'asc' } });
  res.render("settings", { user: req.user, settings, workPeriods, error, success, csrfToken: req.csrfToken() });
});

// Delete a work period
router.post("/settings/work-period/delete", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { id } = req.body;
  let error = null, success = null;
  try {
    await prisma.workPeriod.delete({ where: { id } });
    success = "Work period deleted.";
  } catch (err) {
    error = err.message;
  }
  const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  const workPeriods = await prisma.workPeriod.findMany({ where: { user_id: req.user.id }, orderBy: { start: 'asc' } });
  res.render("settings", { user: req.user, settings, workPeriods, error, success, csrfToken: req.csrfToken() });
});

export default router;

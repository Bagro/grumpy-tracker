import express from "express";
import { PrismaClient } from "@prisma/client";
import { Parser } from "json2csv";

const prisma = new PrismaClient();
const router = express.Router();

// GDPR: Actions page
router.get("/gdpr", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("gdpr", { user: req.user });
});

// GDPR: Data export (all user data)
router.get("/gdpr/export", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const timeEntries = await prisma.timeEntry.findMany({ where: { user_id: req.user.id } });
  const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } });
  const exportData = {
    user: { ...user, password_hash: undefined },
    settings,
    timeEntries,
  };
  res.header('Content-Type', 'application/json');
  res.attachment('gdpr-export.json');
  res.send(JSON.stringify(exportData, null, 2));
});

// GDPR: Data delete (user and all related data)
router.post("/gdpr/delete", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  await prisma.timeEntry.deleteMany({ where: { user_id: req.user.id } });
  await prisma.settings.deleteMany({ where: { user_id: req.user.id } });
  await prisma.user.delete({ where: { id: req.user.id } });
  req.logout(() => {
    res.redirect("/login?deleted=1");
  });
});

export default router;

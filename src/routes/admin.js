import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// Middleware: Only allow admin (for demo, first user is admin)
function isAdmin(req, res, next) {
  if (req.user && req.user.email === 'admin@grumpy.local') return next();
  return res.status(403).send('Forbidden');
}

// Admin: List users
router.get("/admin/users", isAdmin, async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { created_at: 'asc' } });
  res.render("admin-users", { users, user: req.user });
});

// Admin: Deactivate/reactivate user
router.post("/admin/users/:id/toggle", isAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).send('User not found');
  await prisma.user.update({ where: { id: user.id }, data: { deactivated: !user.deactivated } });
  res.redirect("/admin/users");
});

// Admin: Delete user
router.post("/admin/users/:id/delete", isAdmin, async (req, res) => {
  await prisma.timeEntry.deleteMany({ where: { user_id: req.params.id } });
  await prisma.settings.deleteMany({ where: { user_id: req.params.id } });
  await prisma.user.delete({ where: { id: req.params.id } });
  res.redirect("/admin/users");
});

export default router;

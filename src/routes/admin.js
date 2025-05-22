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

// Admin translation management
router.get('/admin/translations', async (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).send('Forbidden');
  const fs = await import('fs/promises');
  const path = await import('path');
  const localesDir = path.resolve('src/i18n/locales');
  const languages = await fs.readdir(localesDir);
  res.render('admin-translations', { languages, user: req.user });
});

// Admin translation file editor
router.get('/admin/translations/:lang', async (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).send('Forbidden');
  const fs = await import('fs/promises');
  const path = await import('path');
  const lang = req.params.lang;
  const filePath = path.resolve('src/i18n/locales', lang, 'translation.json');
  let translations = {};
  try {
    const file = await fs.readFile(filePath, 'utf-8');
    translations = JSON.parse(file);
  } catch (e) {
    return res.status(404).send('Translation file not found');
  }
  res.render('admin-translation-edit', { lang, translations, user: req.user });
});

// Save translation file changes
router.post('/admin/translations/:lang', async (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).send('Forbidden');
  const fs = await import('fs/promises');
  const path = await import('path');
  const lang = req.params.lang;
  const filePath = path.resolve('src/i18n/locales', lang, 'translation.json');
  const translations = req.body.translations || {};
  try {
    await fs.writeFile(filePath, JSON.stringify(translations, null, 2), 'utf-8');
    // Optionally reload i18next here
    req.flash('success', 'Translations updated');
    res.redirect(`/admin/translations/${lang}`);
  } catch (e) {
    req.flash('error', 'Failed to save translations');
    res.redirect(`/admin/translations/${lang}`);
  }
});

export default router;

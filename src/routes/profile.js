import express from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/profile", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("profile", { user: req.user, error: null, success: null });
});

router.post("/profile", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { name, email, language, password, new_password } = req.body;
  let error = null, success = null;
  try {
    if (password && new_password) {
      const valid = await bcrypt.compare(password, req.user.password_hash);
      if (!valid) throw new Error("Current password incorrect");
      const password_hash = await bcrypt.hash(new_password, 12);
      await prisma.user.update({ where: { id: req.user.id }, data: { password_hash } });
      success = "Password updated.";
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { name, email, preferred_language: language },
    });
    success = success || "Profile updated.";
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.render("profile", { user, error, success });
  } catch (err) {
    res.render("profile", { user: req.user, error: err.message, success: null });
  }
});

export default router;

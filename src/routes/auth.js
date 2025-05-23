import express from "express";
import passport from "../auth/passport.js";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// Helper for i18n in views
function getT(req) {
  return req.t || ((k) => k);
}

// Login GET
router.get("/login", (req, res) => {
  res.render("auth-login", { error: null, t: getT(req), csrfToken: req.csrfToken() });
});

// Login POST
router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login?error=1",
    failureFlash: false,
  }),
  (req, res) => {
    res.redirect("/");
  }
);

// Register GET
router.get("/register", (req, res) => {
  res.render("auth-register", { error: null, t: getT(req), csrfToken: req.csrfToken() });
});

// Register POST
router.post("/register", async (req, res) => {
  const { name, email, password, language } = req.body;
  const t = getT(req);
  if (!name || !email || !password) {
    return res.render("auth-register", { error: t("error") + ": Missing fields", t, csrfToken: req.csrfToken() });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.render("auth-register", { error: t("error") + ": Email already registered", t, csrfToken: req.csrfToken() });
    }
    const password_hash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        preferred_language: language || "en",
      },
    });
    res.redirect("/login");
  } catch (err) {
    res.render("auth-register", { error: t("error") + ": " + err.message, t, csrfToken: req.csrfToken() });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login");
  });
});

export default router;

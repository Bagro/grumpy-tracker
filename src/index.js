// Express main entrypoint for Grumpy Tracker
import express from 'express';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import passport from 'passport';
import i18next from 'i18next';
import i18nextMiddleware from 'i18next-express-middleware';
import csurf from 'csurf';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false },
}));

// Passport.js
app.use(passport.initialize());
app.use(passport.session());

// i18next (placeholder, config to be added)
app.use(i18nextMiddleware.handle(i18next));

// CSRF protection
app.use(csurf());

// Basic home route
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// TODO: Add routes, auth, db, i18n, error handling

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Grumpy Tracker running on http://localhost:${PORT}`);
});

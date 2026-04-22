require('dotenv').config();
const path    = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const db      = require('./db'); // Firestore handle + seed()

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieSession({
  name:   'jjmmc.sess',
  secret: process.env.SESSION_SECRET || 'jjmmc-erp-dev-secret-change-me',
  maxAge: 1000 * 60 * 60 * 8, // 8 hours
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
}));

// ── ROUTES ────────────────────────────────────────────────────────
app.use('/api',           require('./routes/auth'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/faculty',   require('./routes/faculty'));
app.use('/api/student',   require('./routes/student'));
app.use('/api/parent',    require('./routes/parent'));
app.use('/api/principal', require('./routes/principal'));

// ── ROLE-PROTECTED PAGES ──────────────────────────────────────────
// `program` can be 'UG' or 'PG'. If a user hits the wrong programme's URL,
// redirect them to their session's programme portal.
function rolePage(role, program) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login.html');
    if (req.session.user.role !== role) {
      const userProg = (req.session.user.program || 'UG') === 'PG' ? '-pg' : '';
      return res.redirect(`/${req.session.user.role}${userProg}/`);
    }
    const sessProgram = (req.session.user.program || 'UG').toUpperCase();
    if (sessProgram !== program) {
      const target = sessProgram === 'PG' ? `/${role}-pg/` : `/${role}/`;
      return res.redirect(target);
    }
    next();
  };
}

// Undergraduate portals
app.use('/admin',     rolePage('admin',     'UG'), express.static(path.join(__dirname, 'views', 'admin')));
app.use('/principal', rolePage('principal', 'UG'), express.static(path.join(__dirname, 'views', 'principal')));
app.use('/faculty',   rolePage('faculty',   'UG'), express.static(path.join(__dirname, 'views', 'faculty')));
app.use('/student',   rolePage('student',   'UG'), express.static(path.join(__dirname, 'views', 'student')));
app.use('/parent',    rolePage('parent',    'UG'), express.static(path.join(__dirname, 'views', 'parent')));

// Postgraduate portals (parallel tree)
app.use('/admin-pg',     rolePage('admin',     'PG'), express.static(path.join(__dirname, 'views', 'admin-pg')));
app.use('/principal-pg', rolePage('principal', 'PG'), express.static(path.join(__dirname, 'views', 'principal-pg')));
app.use('/faculty-pg',   rolePage('faculty',   'PG'), express.static(path.join(__dirname, 'views', 'faculty-pg')));
app.use('/student-pg',   rolePage('student',   'PG'), express.static(path.join(__dirname, 'views', 'student-pg')));
app.use('/parent-pg',    rolePage('parent',    'PG'), express.static(path.join(__dirname, 'views', 'parent-pg')));

// ── PUBLIC ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session.user) {
    const prog = (req.session.user.program || 'UG') === 'PG' ? '-pg' : '';
    return res.redirect(`/${req.session.user.role}${prog}/`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── BOOTSTRAP ─────────────────────────────────────────────────────
// Seed default users into Firestore on first boot. We log but don't crash
// if the seed fails — the server should still come up so the operator can
// inspect the error on the login page.
const ready = db.seed()
  .then((r) => {
    if (r.seeded) console.log(`[seed] inserted ${r.seeded} default users into Firestore`);
    else          console.log(`[seed] ${r.skipped}`);
  })
  .catch((err) => {
    console.error('[seed] failed — check Firebase credentials in .env');
    console.error(err.message);
  });

// Only start an HTTP listener when run directly (local dev).
// On Vercel, this file is imported and `app` is exported to the serverless runtime.
if (require.main === module) {
  ready.finally(() => {
    app.listen(PORT, () => {
      console.log(`\n  JJMMC ERP  →  http://localhost:${PORT}\n`);
    });
  });
}

module.exports = app;

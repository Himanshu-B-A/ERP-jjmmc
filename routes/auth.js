const express = require('express');
const db      = require('../db');
const { admin } = require('../firebase');
const { logActivity } = require('./helpers');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// Public — Firebase client config (apiKey is safe to expose)
// ---------------------------------------------------------------------------
router.get('/firebase-config', (req, res) => {
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  res.json({
    apiKey:     process.env.FIREBASE_API_KEY || '',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
  });
});

// ---------------------------------------------------------------------------
// POST /api/login
// Body: { idToken: string, program: 'UG'|'PG' }
// The client signs in with Firebase Auth, gets an ID token, then sends it
// here. We verify it with the Admin SDK and create a server session.
// ---------------------------------------------------------------------------
router.post('/login', wrap(async (req, res) => {
  const { idToken, program } = req.body || {};
  if (!idToken)
    return res.status(400).json({ error: 'idToken required' });

  const prog = String(program || 'UG').toUpperCase();
  if (prog !== 'UG' && prog !== 'PG')
    return res.status(400).json({ error: 'program must be UG or PG' });

  // Verify the Firebase ID token.
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }

  // Load the user profile from Firestore.
  const user = await db.findUserByUID(decoded.uid);
  if (!user)
    return res.status(401).json({ error: 'No account found. Contact your administrator.' });
  if (user.is_active === false)
    return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });

  // Enforce UG / PG programme toggle.
  let expectedProgram = String(user.program_level || 'UG').toUpperCase();
  if (user.role === 'student') {
    const profDoc = await db.col.studentProfiles.doc(user.id).get();
    if (profDoc.exists && profDoc.data().program_level)
      expectedProgram = String(profDoc.data().program_level).toUpperCase();
  }
  if (expectedProgram !== prog) {
    return res.status(401).json({
      error: `This account belongs to the ${expectedProgram} programme. Please switch the toggle to ${expectedProgram}.`,
    });
  }

  await db.updateUser(user.id, { last_login: db.now() });

  req.session.user = {
    id:        user.id,
    email:     user.email,
    role:      user.role,
    full_name: user.full_name,
    program:   prog,
  };

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logActivity(user.id, 'LOGIN', 'users', user.id, `Login from ${ip} (${prog})`, ip);

  const suffix = prog === 'PG' ? '-pg' : '';
  res.json({ ok: true, user: req.session.user, redirect: `/${user.role}${suffix}/` });
}));

// ---------------------------------------------------------------------------
// POST /api/logout
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  const uid = req.session?.user?.id;
  req.session = null;
  if (uid) logActivity(uid, 'LOGOUT', 'users', uid, 'User logged out');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/me — current session user + unread notification count
// ---------------------------------------------------------------------------
router.get('/me', wrap(async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

  const unreadSnap = await db.col.userNotifications
    .where('user_id', '==', req.session.user.id)
    .where('is_read', '==', false)
    .count()
    .get();

  res.json({
    user: req.session.user,
    unread_notifications: unreadSnap.data().count || 0,
  });
}));

// ---------------------------------------------------------------------------
// PUT /api/me/password — change own password via Firebase Auth Admin SDK
// ---------------------------------------------------------------------------
router.put('/me/password', wrap(async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });

  await admin.auth().updateUser(req.session.user.id, { password: new_password });
  logActivity(req.session.user.id, 'CHANGE_PASSWORD', 'users', req.session.user.id, 'Password changed');
  res.json({ ok: true });
}));

module.exports = router;

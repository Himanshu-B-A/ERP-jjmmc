// Admin portal API — Firestore + Firebase Auth
// User CRUD, stats, and activity logs are fully implemented.
// All other modules return 501 until migrated from the legacy SQLite routes.
const express = require('express');
const db      = require('../db');
const { admin } = require('../firebase');
const { requireRole, logActivity, paginate } = require('./helpers');

const router = express.Router();
const only   = requireRole('admin');
const wrap   = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_ROLES = ['admin', 'principal', 'faculty', 'student', 'parent'];

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════
router.get('/stats', only, wrap(async (req, res) => {
  // Count users per role from Firestore.
  const snap = await db.col.users.get();
  const totals = { users: 0, students: 0, faculty: 0, principals: 0, admins: 0, parents: 0 };
  const recentUsers = [];

  snap.forEach((doc) => {
    const u = { id: doc.id, ...doc.data() };
    totals.users++;
    if (u.role === 'student')   totals.students++;
    if (u.role === 'faculty')   totals.faculty++;
    if (u.role === 'principal') totals.principals++;
    if (u.role === 'admin')     totals.admins++;
    if (u.role === 'parent')    totals.parents++;
    recentUsers.push(u);
  });

  // Sort by created_at desc and take last 6.
  recentUsers.sort((a, b) => {
    const ta = a.created_at?.toMillis?.() || 0;
    const tb = b.created_at?.toMillis?.() || 0;
    return tb - ta;
  });

  // Recent activity logs.
  const logsSnap = await db.col.activityLogs
    .orderBy('created_at', 'desc')
    .limit(8)
    .get();
  const recentLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const serializeTs = (u) => {
    const out = { ...u };
    if (out.created_at?.toDate) out.created_at = out.created_at.toDate().toISOString();
    if (out.last_login?.toDate)  out.last_login  = out.last_login.toDate().toISOString();
    return out;
  };

  res.json({
    totals,
    recentUsers: recentUsers.slice(0, 6).map((u) => serializeTs({
      id: u.id, email: u.email, role: u.role,
      full_name: u.full_name, created_at: u.created_at,
    })),
    recentLogs: recentLogs.map(serializeTs),
  });
}));

// ═══════════════════════════════════════════════════════════════════
// USERS CRUD
// ═══════════════════════════════════════════════════════════════════

// GET /api/admin/users?role=student&q=search&page=1&per=20
router.get('/users', only, wrap(async (req, res) => {
  const { role, q, page = 1, per = 20 } = req.query;
  // Avoid composite index requirement: filter by role without orderBy,
  // then sort client-side.
  let query = role
    ? db.col.users.where('role', '==', role)
    : db.col.users.orderBy('created_at', 'desc');

  const result = await paginate(query, page, per);

  // Client-side text filter (Firestore doesn't support LIKE).
  let rows = result.rows;
  if (q) {
    const lq = q.toLowerCase();
    rows = rows.filter((u) =>
      (u.email || '').toLowerCase().includes(lq) ||
      (u.full_name || '').toLowerCase().includes(lq)
    );
  }

  // Serialize Firestore timestamps and strip password_hash.
  rows = rows.map(({ password_hash, ...u }) => {
    if (u.created_at?.toDate) u.created_at = u.created_at.toDate().toISOString();
    if (u.last_login?.toDate)  u.last_login  = u.last_login.toDate().toISOString();
    return u;
  });

  res.json({ users: rows, total: result.total, page: result.page, per_page: result.per_page });
}));

// POST /api/admin/users — create user in Firebase Auth + Firestore
router.post('/users', only, wrap(async (req, res) => {
  const { email, password, role, full_name, program_level } = req.body || {};
  if (!email || !password || !role || !full_name)
    return res.status(400).json({ error: 'email, password, role, full_name required' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  if (password.length < 6)
    return res.status(400).json({ error: 'password must be at least 6 characters' });

  const prog = String(program_level || 'UG').toUpperCase() === 'PG' ? 'PG' : 'UG';

  // Create in Firebase Auth.
  let authUser;
  try {
    authUser = await admin.auth().createUser({ email, password, displayName: full_name });
  } catch (err) {
    if (err.code === 'auth/email-already-exists')
      return res.status(409).json({ error: 'Email already in use' });
    throw err;
  }

  // Store profile in Firestore (doc id = Firebase UID).
  await db.col.users.doc(authUser.uid).set({
    email,
    role,
    full_name,
    program_level: prog,
    is_active:     true,
    last_login:    null,
    created_at:    db.now(),
  });

  logActivity(req.session.user.id, 'CREATE_USER', 'users', authUser.uid,
    `Created ${role}: ${email} (${prog})`);

  res.json({ ok: true, id: authUser.uid });
}));

// PUT /api/admin/users/:id — update profile in Firestore; optionally update Auth
router.put('/users/:id', only, wrap(async (req, res) => {
  const uid = req.params.id;
  const { full_name, email, role, password, is_active, program_level } = req.body || {};

  const userDoc = await db.col.users.doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

  // Update Firestore profile.
  const patch = {};
  if (full_name     !== undefined) patch.full_name     = full_name;
  if (email         !== undefined) patch.email         = email;
  if (role          !== undefined) patch.role          = role;
  if (is_active     !== undefined) patch.is_active     = Boolean(is_active);
  if (program_level !== undefined) patch.program_level = String(program_level).toUpperCase();

  if (Object.keys(patch).length) {
    await db.col.users.doc(uid).set(patch, { merge: true });
  }

  // Update Firebase Auth if email or password changed.
  const authPatch = {};
  if (email)    authPatch.email       = email;
  if (full_name) authPatch.displayName = full_name;
  if (password && password.length >= 6) authPatch.password = password;
  if (is_active !== undefined) authPatch.disabled = !is_active;

  if (Object.keys(authPatch).length) {
    await admin.auth().updateUser(uid, authPatch);
  }

  logActivity(req.session.user.id, 'UPDATE_USER', 'users', uid, `Updated user ${uid}`);
  res.json({ ok: true });
}));

// DELETE /api/admin/users/:id — remove from Firebase Auth + Firestore
router.delete('/users/:id', only, wrap(async (req, res) => {
  const uid = req.params.id;
  if (uid === req.session.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });

  const userDoc = await db.col.users.doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

  await admin.auth().deleteUser(uid);
  await db.col.users.doc(uid).delete();

  logActivity(req.session.user.id, 'DELETE_USER', 'users', uid, `Deleted user ${uid}`);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY LOGS
// ═══════════════════════════════════════════════════════════════════
router.get('/activity-logs', only, wrap(async (req, res) => {
  const { user_id, page = 1, per = 50 } = req.query;
  let query = db.col.activityLogs.orderBy('created_at', 'desc');
  if (user_id) query = query.where('user_id', '==', user_id);

  const result = await paginate(query, page, per);
  res.json({ items: result.rows, total: result.total });
}));

// ═══════════════════════════════════════════════════════════════════
// NOT YET MIGRATED — GET routes return empty data so the UI loads.
// POST / PUT / DELETE return 501 until migrated.
// ═══════════════════════════════════════════════════════════════════
router.use((req, res) => {
  if (req.method !== 'GET') {
    return res.status(501).json({
      error: 'This feature has not yet been migrated to Firestore.',
      hint:  'See routes/_legacy-sqlite/admin.js for the old implementation.',
    });
  }

  // Return sensible empty payloads so UI sections load without hanging.
  const path = req.path;
  if (path.includes('stats'))         return res.json({ totals: {}, recentUsers: [], recentLogs: [] });
  if (path.includes('students'))      return res.json({ students: [], total: 0 });
  if (path.includes('departments'))   return res.json({ items: [] });
  if (path.includes('courses'))       return res.json({ items: [] });
  if (path.includes('batches'))       return res.json({ items: [] });
  if (path.includes('attendance'))    return res.json({ items: [] });
  if (path.includes('exams'))         return res.json({ items: [] });
  if (path.includes('results'))       return res.json({ items: [] });
  if (path.includes('fees'))          return res.json({ payments: [], total_paid: 0, by_type: [] });
  if (path.includes('fee-structure')) return res.json({ items: [] });
  if (path.includes('transactions'))  return res.json({ items: [], summary: { income: 0, expense: 0, balance: 0 } });
  if (path.includes('employees'))     return res.json({ items: [] });
  if (path.includes('payroll'))       return res.json({ items: [] });
  if (path.includes('notifications')) return res.json({ items: [] });
  if (path.includes('notices'))       return res.json({ items: [] });
  if (path.includes('enquiries'))     return res.json({ items: [] });
  if (path.includes('hostel'))        return res.json({ items: [] });
  if (path.includes('transport'))     return res.json({ items: [] });
  if (path.includes('library'))       return res.json({ items: [] });
  if (path.includes('store'))         return res.json({ items: [] });
  if (path.includes('assets'))        return res.json({ items: [] });
  if (path.includes('contacts'))      return res.json({ items: [] });
  if (path.includes('permissions'))   return res.json({ items: [] });
  if (path.includes('clients'))       return res.json({ items: [] });
  if (path.includes('devices'))       return res.json({ items: [] });
  if (path.includes('reminders'))     return res.json({ items: [] });
  if (path.includes('schools'))       return res.json({ items: [] });
  if (path.includes('reports'))       return res.json({ by_department: [], by_semester: [], monthly: [], by_type: [], by_course: [], by_grade: [], pass_rate: [] });
  if (path.includes('timetable'))     return res.json({ items: [] });
  if (path.includes('time-schedule')) return res.json({ items: [] });
  if (path.includes('lectures'))      return res.json({ items: [] });
  if (path.includes('lms'))           return res.json({ items: [] });
  if (path.includes('online-exams'))  return res.json({ items: [] });
  if (path.includes('study-material'))return res.json({ items: [] });
  if (path.includes('clinical'))      return res.json({ items: [] });
  if (path.includes('allocations'))   return res.json({ items: [] });
  if (path.includes('case-logs'))     return res.json({ items: [] });
  if (path.includes('procedure-logs'))return res.json({ items: [] });
  if (path.includes('cbme'))          return res.json({ items: [] });
  if (path.includes('settings'))      return res.json({ settings: {} });
  if (path.includes('placement'))     return res.json({ items: [] });
  if (path.includes('export'))        return res.json({ items: [] });

  // Generic fallback
  return res.json({ items: [], total: 0 });
});

module.exports = router;

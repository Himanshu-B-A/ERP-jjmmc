// JJMMC ERP — Firestore data layer
// ----------------------------------------------------------------------------
// Auth is handled by Firebase Authentication. Firestore stores user profile
// data (role, full_name, program_level, etc.) keyed by Firebase UID.
//
// Collections used (top-level):
//   users              { email, role, full_name, program_level, is_active,
//                        last_login, created_at }  — doc id = Firebase UID
//   student_profiles   (doc id = Firebase UID)
//   employees          (doc id = Firebase UID)
//   parents            { user_id, student_user_id, relation, phone, occupation }
//   fee_payments
//   activity_logs
//   user_notifications

const bcrypt = require('bcryptjs'); // kept for any legacy password ops
const { firestore, admin } = require('./firebase');

// ---------------------------------------------------------------------------
// Collection references
// ---------------------------------------------------------------------------
const col = {
  users:               firestore.collection('users'),
  studentProfiles:     firestore.collection('student_profiles'),
  employees:           firestore.collection('employees'),
  parents:             firestore.collection('parents'),
  feePayments:         firestore.collection('fee_payments'),
  activityLogs:        firestore.collection('activity_logs'),
  userNotifications:   firestore.collection('user_notifications'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Get user profile by Firebase UID (doc id in Firestore).
async function findUserByUID(uid) {
  const doc = await col.users.doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// Get user profile by email (for lookups before we have the UID).
async function findUserByEmail(email) {
  const snap = await col.users
    .where('email', '==', email)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getUser(id) {
  const doc = await col.users.doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function updateUser(id, patch) {
  await col.users.doc(id).set(patch, { merge: true });
}

const now = () => admin.firestore.FieldValue.serverTimestamp();

// ---------------------------------------------------------------------------
// Seed — disabled. Database starts empty; add users via admin panel.
// ---------------------------------------------------------------------------
async function seed() {
  return { seeded: 0, skipped: 'seeding disabled — add users via admin panel' };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  firestore,
  admin,
  col,
  bcrypt,
  // query helpers
  findUserByUID,
  findUserByEmail,
  getUser,
  updateUser,
  now,
  // lifecycle
  seed,

  // Legacy guard — any code that still calls db.prepare() will get a clear error.
  prepare() {
    throw new Error(
      '[db.js] SQLite API (db.prepare/exec/transaction) is gone — ' +
        'this project now uses Firestore. Migrate the calling route.'
    );
  },
  exec() { this.prepare(); },
  transaction() { this.prepare(); },
};

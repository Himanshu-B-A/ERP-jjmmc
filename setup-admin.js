// One-time script: creates the first admin user in Firebase Auth + Firestore.
// Run with:  node setup-admin.js
// Safe to re-run — skips creation if the email already exists.
require('dotenv').config();

const { admin, firestore } = require('./firebase');

const ADMIN_EMAIL    = 'himubullapur@gmail.com';
const ADMIN_PASSWORD = 'Himu*1bca';
const ADMIN_NAME     = 'System Administrator';

async function main() {
  console.log('\n  JJMMC ERP — Admin Setup\n');

  // Check if user already exists in Firebase Auth.
  let authUser;
  try {
    authUser = await admin.auth().getUserByEmail(ADMIN_EMAIL);
    console.log(`  Firebase Auth: user already exists (uid: ${authUser.uid})`);
  } catch {
    // Does not exist — create it.
    authUser = await admin.auth().createUser({
      email:       ADMIN_EMAIL,
      password:    ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
    });
    console.log(`  Firebase Auth: created user (uid: ${authUser.uid})`);
  }

  // Check if Firestore profile exists.
  const profileRef = firestore.collection('users').doc(authUser.uid);
  const profileDoc = await profileRef.get();

  if (profileDoc.exists) {
    console.log('  Firestore: profile already exists — no changes made.');
  } else {
    await profileRef.set({
      email:         ADMIN_EMAIL,
      role:          'admin',
      full_name:     ADMIN_NAME,
      program_level: 'UG',
      is_active:     true,
      last_login:    null,
      created_at:    admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('  Firestore: profile created.');
  }

  console.log('\n  Done! Login with:');
  console.log(`    Email:    ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log('\n  Go to: http://localhost:3000/login.html\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});

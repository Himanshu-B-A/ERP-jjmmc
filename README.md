# JJMMC ERP

A role-based ERP for JJMMC — Admin, Principal, Faculty, Student and Parent portals across UG and PG programmes.

## Tech stack

- Node.js + Express
- **Firebase Firestore** (via `firebase-admin`) for all persistent data
- Session auth with `express-session`
- Passwords hashed with `bcryptjs`
- Vanilla HTML/CSS/JS front-end (dark, modern UI)

> **Migration note.** This project originally used SQLite (`better-sqlite3`).
> It now uses Firestore. The old SQLite route handlers are preserved in
> `routes/_legacy-sqlite/` for reference while each portal is migrated one
> at a time. The `auth` routes (`/api/login`, `/api/logout`, `/api/me`,
> `/api/me/password`) already run on Firestore. The admin / faculty /
> student / parent / principal API routes currently return **501** until
> they are migrated.

## Firebase setup (do this first)

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Give it a name (e.g. `jjmmc-erp`). Disable Google Analytics if you
   don't need it.
3. Once the project is ready, open **Build → Firestore Database → Create
   database**. Pick **Start in production mode** and choose a region
   close to you (e.g. `asia-south1` — Mumbai).

### 2. Create a service account (server credentials)

The backend talks to Firestore as an admin using a service account.

1. In the Firebase console, click the gear icon → **Project settings**.
2. Open the **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**. A JSON file
   downloads — this is your credential. Keep it safe and **never commit
   it to git**.

### 3. Wire the credentials into the project

Copy `.env.example` to `.env` and choose **one** of the three options.

```powershell
Copy-Item .env.example .env
notepad .env
```

**Option A — path to the JSON file (easiest for local dev).**

Save the JSON you just downloaded somewhere outside the repo, e.g.
`C:\secrets\jjmmc-erp-firebase-admin.json`, then in `.env`:

```
GOOGLE_APPLICATION_CREDENTIALS=C:\secrets\jjmmc-erp-firebase-admin.json
```

**Option B — paste the whole JSON into one env var.**

```
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"jjmmc-erp",...}'
```

**Option C — three discrete values (use this on Vercel / CI).**

Copy the three fields out of the JSON file:

```
FIREBASE_PROJECT_ID=jjmmc-erp
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@jjmmc-erp.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...==\n-----END PRIVATE KEY-----\n"
```

> On Vercel, paste the `FIREBASE_PRIVATE_KEY` value with the literal
> `\n` sequences — the code converts them back to real newlines.

### 4. Install & run

```powershell
npm install
npm start
```

Open <http://localhost:3000>. On first boot the server seeds a set of
demo accounts into the `users` collection in Firestore. You should see:

```
[seed] inserted 13 default users into Firestore
JJMMC ERP  ->  http://localhost:3000
```

### Default logins

| Role      | Username      | Password         | Programme |
|-----------|---------------|------------------|-----------|
| Admin     | `admin`       | `admin123`       | UG        |
| Principal | `principal`   | `principal123`   | UG        |
| Faculty   | `faculty`     | `faculty123`     | UG        |
| Student   | `student`     | `student123`     | UG        |
| Parent    | `parent`      | `parent123`      | UG        |
| Admin     | `adminpg`     | `adminpg123`     | PG        |
| Principal | `principalpg` | `principalpg123` | PG        |
| Faculty   | `facultypg`   | `facultypg123`   | PG        |
| Student   | `studentpg`   | `studentpg123`   | PG        |
| Parent    | `parentpg`    | `parentpg123`    | PG        |

### Resetting the data

Either delete the `users` collection in the Firebase console, or click
**Delete database** → re-enable. The next boot will re-seed.

## Project layout

```
ERP JJMMC/
├── server.js              Express app + boot (awaits seed)
├── firebase.js            Firebase Admin SDK initialization
├── db.js                  Firestore data layer + seed()
├── .env.example           Template for Firebase credentials
├── routes/
│   ├── auth.js            Login / logout / me / change-password  (Firestore)
│   ├── helpers.js         requireAuth / requireRole / logActivity / paginate
│   ├── _stub.js           501 placeholder for un-migrated portals
│   ├── admin.js           → stub (see _legacy-sqlite/admin.js)
│   ├── faculty.js         → stub
│   ├── student.js         → stub
│   ├── parent.js          → stub
│   ├── principal.js       → stub
│   └── _legacy-sqlite/    Original SQLite implementations (reference only)
├── public/                Public static files (landing, login)
└── views/                 Role-protected static portals (admin, faculty, …)
```

## Firestore collections

| Collection            | Doc id        | Notes                               |
|-----------------------|---------------|-------------------------------------|
| `users`               | auto          | `username`, `password_hash`, `role`, `program_level`, … |
| `student_profiles`    | = user id     | One per student                     |
| `employees`           | = user id     | One per faculty                     |
| `parents`             | auto          | Link table: parent ↔ student        |
| `fee_payments`        | auto          |                                     |
| `activity_logs`       | auto          | Audit trail                         |
| `user_notifications`  | auto          | `user_id`, `is_read`, …             |

Additional collections will be created lazily as each portal is migrated.

## What still needs to be migrated

The five portal route files have been replaced with 501 stubs. The
originals live in `routes/_legacy-sqlite/` — use them as the spec when
re-implementing each against Firestore:

- `routes/_legacy-sqlite/admin.js`     (~2 900 lines)
- `routes/_legacy-sqlite/faculty.js`   (~  700 lines)
- `routes/_legacy-sqlite/student.js`   (~  750 lines)
- `routes/_legacy-sqlite/parent.js`    (~  140 lines)
- `routes/_legacy-sqlite/principal.js` (~  300 lines)

Ask the assistant: *"migrate the parent portal next"* (or any other) to
do them one at a time.

## Security notes

- Change `SESSION_SECRET` in `.env` before production.
- Put Express behind HTTPS and set `cookie.secure = true`.
- Add rate limiting on `/api/login`.
- Lock down Firestore with security rules — the Admin SDK bypasses
  rules, but any client-side SDK usage must be restricted.
- **Never** commit the service-account JSON. `.gitignore` already blocks
  `*firebase-adminsdk*.json` and `.env`.

const { col, now } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    if (req.accepts('html')) return res.redirect('/login.html');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.session.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Fire-and-forget audit log — never block or throw into the request path.
function logActivity(userId, action, entity, entityId, details, ip) {
  col.activityLogs
    .add({
      user_id:    userId || null,
      action,
      entity:     entity || null,
      entity_id:  entityId || null,
      details:    details || null,
      ip_address: ip || null,
      created_at: now(),
    })
    .catch(() => { /* non-critical */ });
}

// Simple async paginator for a Firestore Query.
// Usage: await paginate(col.users.where('role','==','student').orderBy('created_at','desc'), page, perPage)
async function paginate(query, page, perPage) {
  page    = Math.max(1, parseInt(page,    10) || 1);
  perPage = Math.max(1, parseInt(perPage, 10) || 20);

  const totalSnap = await query.count().get();
  const total = totalSnap.data().count;

  const pageSnap = await query.offset((page - 1) * perPage).limit(perPage).get();
  const rows = pageSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { rows, total, page, per_page: perPage, pages: Math.ceil(total / perPage) };
}

module.exports = { requireAuth, requireRole, logActivity, paginate };

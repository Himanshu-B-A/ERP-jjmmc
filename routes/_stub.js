// Temporary portal stub. The original SQLite-backed routes live in
// routes/_legacy-sqlite/<portal>.js for reference. Each portal will be
// migrated to Firestore one at a time.
const express = require('express');

module.exports = function createStub(portalName) {
  const router = express.Router();
  router.use((req, res) => {
    res.status(501).json({
      error: `The ${portalName} portal API has not been migrated to Firestore yet.`,
      hint:
        'See routes/_legacy-sqlite/' +
        portalName +
        '.js for the old implementation. Ask the assistant to migrate this portal next.',
    });
  });
  return router;
};

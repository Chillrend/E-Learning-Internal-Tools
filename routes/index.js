const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth_controller');
const exportController = require('../controllers/export_controller');
const checkSession = require('../middleware/session_check');

router.get('/', authController.index);
router.get('/login/redirect', authController.loginRedirect);
router.get('/login/callback', authController.loginCallback);

router.get('/export', checkSession, exportController.renderExportPage);
router.post('/export', checkSession, exportController.exportData);

router.get('/export/createcat', checkSession, exportController.createCategory)
router.post('/export/dryrun', checkSession, exportController.renderDryRunPage)

module.exports = router;

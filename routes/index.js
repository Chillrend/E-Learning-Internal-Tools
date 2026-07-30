const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth_controller');
const exportController = require('../controllers/export_controller');
const courseController = require('../controllers/course_controller');
const healthController = require('../controllers/health_controller');
const checkSession = require('../middleware/session_check');
const upload = require('../middleware/upload');

const handleRpsUpload = (req, res, next) => {
    upload.single('rps_file')(req, res, (err) => {
        if (err) {
            return res.status(400).send(`Upload Error: ${err.message}`);
        }
        next();
    });
};

router.get('/', authController.index);
router.get('/login/redirect', authController.loginRedirect);
router.get('/login/callback', authController.loginCallback);
router.get('/forbidden', authController.forbidden);

// Legacy export routes
router.get('/export', checkSession, exportController.renderExportPage);
router.post('/export', checkSession, exportController.exportData);
router.get('/export/createcat', checkSession, exportController.createCategory);
router.post('/export/dryrun', checkSession, exportController.renderDryRunPage);
router.post('/export/run', checkSession, exportController.createCourses);

// Health check routes
router.get('/health', checkSession, healthController.renderHealthPage);
router.get('/health/test', checkSession, healthController.runTests);

// Course management routes
router.get('/courses', checkSession, courseController.dashboard);
router.get('/courses/:categoryId', checkSession, courseController.showCategory);
router.get('/courses/:categoryId/add', checkSession, courseController.renderAddForm);
router.post('/courses/:categoryId/add', checkSession, handleRpsUpload, courseController.addCourses);

router.post('/courses/:categoryId/delete/:id', checkSession, courseController.deleteStagedCourse);
router.get('/courses/:categoryId/deploy', checkSession, courseController.renderDeployPage);
router.post('/courses/:categoryId/deploy', checkSession, courseController.deployCourses);
router.post('/courses/:categoryId/edit', checkSession, courseController.editCategory);
router.post('/courses/:categoryId/create-semester', checkSession, courseController.createSemesterCategory);
router.get('/courses/:categoryId/history', checkSession, courseController.deploymentHistory);
router.get('/courses/:categoryId/history/:deploymentId', checkSession, courseController.deploymentDetail);
router.get('/courses/:categoryId/history/:deploymentId/export/:format', checkSession, courseController.exportDeployment);
router.get('/courses/:categoryId/history/:deploymentId/status', checkSession, courseController.deploymentStatus);
router.post('/courses/:categoryId/history/:deploymentId/reuse', checkSession, courseController.reuseDeployment);
router.post('/courses/:categoryId/delete-batch', checkSession, courseController.deleteBatchStagedCourses);
router.post('/courses/:categoryId/delete-all', checkSession, courseController.deleteAllStagedCourses);

module.exports = router;

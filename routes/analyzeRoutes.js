const express = require('express');
const analyzeController = require('../controllers/analyzeController');

const router = express.Router();

router.post('/', analyzeController.runAnalyze);
router.get('/:batchId/summary', analyzeController.getSummary);
router.get('/:batchId/export', analyzeController.exportExcel);
router.get('/:batchId', analyzeController.getResults);

module.exports = router;

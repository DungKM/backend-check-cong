const express = require('express');
const batchController = require('../controllers/batchController');

const router = express.Router();

router.get('/:batchId/claim-files', batchController.getClaimFiles);
router.get('/:batchId/claim-files/:fileName/xml-types', batchController.getClaimFileXmlTypes);
router.get('/:batchId/claim-files/:fileName/xml/:xmlType', batchController.getClaimFileXmlRows);
router.get('/:batchId/claim-files/:fileName/errors/export', batchController.exportClaimFileErrors);

module.exports = router;

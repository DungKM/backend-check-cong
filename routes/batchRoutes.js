const express = require('express');
const batchController = require('../controllers/batchController');

const router = express.Router();

router.get('/', batchController.listBatches);
router.get('/:batchId/claim-files', batchController.getClaimFiles);
router.get('/:batchId/claim-files/:fileName/xml-types', batchController.getClaimFileXmlTypes);
router.get('/:batchId/claim-files/:fileName/xml/:xmlType', batchController.getClaimFileXmlRows);

module.exports = router;

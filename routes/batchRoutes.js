const express = require('express');
const batchController = require('../controllers/batchController');

const router = express.Router();

router.get('/', batchController.listBatches);

module.exports = router;

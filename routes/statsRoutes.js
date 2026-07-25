const express = require('express');
const statsController = require('../controllers/statsController');

const router = express.Router();

router.get('/overview', statsController.getOverview);

module.exports = router;

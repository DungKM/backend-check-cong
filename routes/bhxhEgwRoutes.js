const express = require('express');
const bhxhEgwController = require('../controllers/bhxhEgwController');

const router = express.Router();

router.post('/check-the', bhxhEgwController.checkThe);

module.exports = router;

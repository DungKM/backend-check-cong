const express = require('express');
const uploadController = require('../controllers/uploadController');
const { uploadXml } = require('../middleware/upload');

const router = express.Router();

router.post('/claim-xml', uploadXml.array('files', 50), uploadController.uploadClaimXml);

module.exports = router;

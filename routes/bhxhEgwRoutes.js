const express = require('express');
const rateLimit = require('express-rate-limit');
const bhxhEgwController = require('../controllers/bhxhEgwController');
const { requireRole } = require('../middleware/auth');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

// Endpoint thủ công/test (xem bhxhEgwController.js) — chưa có UI nào gọi tới. Giới
// hạn admin + rate-limit vì mỗi lần gọi tốn quota cổng BHXH của viện và có thể bị
// dùng để dò xác nhận số thẻ+họ tên+ngày sinh của người khác (thông tin nhạy cảm).
const checkTheLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Gọi cổng BHXH quá nhiều lần, vui lòng thử lại sau' },
});

router.post('/check-the', requireRole(USER_ROLES.ADMIN), checkTheLimiter, bhxhEgwController.checkThe);

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { verifyJwt } = require('../middleware/auth');

// Chặn dò mật khẩu bằng brute-force: tối đa 20 lần thử/15 phút cho mỗi IP. Đủ rộng
// cho người dùng thật gõ nhầm vài lần, nhưng chặn được vòng lặp thử tự động.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Thử đăng nhập quá nhiều lần, vui lòng thử lại sau ít phút' },
});

const publicRouter = express.Router();
publicRouter.post('/login', loginLimiter, authController.login);

const protectedRouter = express.Router();
protectedRouter.get('/me', verifyJwt, authController.me);

module.exports = { publicRouter, protectedRouter };

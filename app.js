const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const { verifyJwt } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { parseBooleanEnv, normalizeEnvText } = require('./utils/env');
const { logger } = require('./utils/logger');
const { publicRouter: authPublicRoutes, protectedRouter: authProtectedRoutes } = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const analyzeRoutes = require('./routes/analyzeRoutes');
const batchRoutes = require('./routes/batchRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const userRoutes = require('./routes/userRoutes');
const statsRoutes = require('./routes/statsRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bhxhEgwRoutes = require('./routes/bhxhEgwRoutes');

// Bỏ qua fallback SPA cho /api — request tới 1 API path không tồn tại phải rơi
// xuống notFoundHandler (404 JSON) như bình thường, không được trả về index.html.
function shouldSkipFrontendFallback(req) {
  return req.path.startsWith('/api');
}

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());
  // Chặn NoSQL operator injection (ví dụ body {"batchId": {"$ne": null}} khiến Mongo
  // hiểu batchId là toán tử truy vấn thay vì giá trị) — lọc bỏ key bắt đầu bằng "$"
  // hoặc chứa "." trong req.body/req.query/req.params trước khi vào bất kỳ route nào.
  app.use(mongoSanitize());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Unprotected: only login.
  app.use('/api/auth', authPublicRoutes);

  // Everything else under /api requires a valid JWT.
  app.use('/api', verifyJwt);

  app.use('/api/auth', authProtectedRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/analyze', analyzeRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/catalogs', catalogRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/bhxh-egw', bhxhEgwRoutes);

  // Serve FE build khi bật FRONTEND_STATIC_ENABLED — dùng lúc deploy backend+frontend
  // build tĩnh chung 1 server/port; không ảnh hưởng dev local (frontend chạy Vite
  // riêng ở cổng 5180). Đường dẫn build lấy từ FRONTEND_DIST_PATH — khác nhau giữa
  // máy dev và server thật nên đọc từ env, không hard-code trong code.
  const frontendStaticEnabled = parseBooleanEnv(process.env.FRONTEND_STATIC_ENABLED, false);
  const frontendDistPath = normalizeEnvText(process.env.FRONTEND_DIST_PATH);

  if (frontendStaticEnabled) {
    if (!frontendDistPath) {
      logger.warn('[Frontend] FRONTEND_STATIC_ENABLED=true nhưng chưa cấu hình FRONTEND_DIST_PATH');
    } else if (!fs.existsSync(frontendDistPath)) {
      logger.warn(`[Frontend] Không tìm thấy FRONTEND_DIST_PATH: ${frontendDistPath}`);
    } else {
      app.use(express.static(frontendDistPath));
      // Fallback cho React Router (SPA) — bỏ qua /api (giữ nguyên 404 JSON) và bỏ qua
      // request không nhận html (ví dụ asset lỗi 404, XHR không phải điều hướng trang).
      app.get('*', (req, res, next) => {
        if (shouldSkipFrontendFallback(req) || !req.accepts('html')) return next();
        return res.sendFile(path.join(frontendDistPath, 'index.html'));
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

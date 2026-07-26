const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { verifyJwt } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { publicRouter: authPublicRoutes, protectedRouter: authProtectedRoutes } = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const analyzeRoutes = require('./routes/analyzeRoutes');
const batchRoutes = require('./routes/batchRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const userRoutes = require('./routes/userRoutes');
const statsRoutes = require('./routes/statsRoutes');
const chatRoutes = require('./routes/chatRoutes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());

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

  // Serve FE build nếu đã build (không ảnh hưởng dev local chạy Vite riêng).
  const frontendDistPath = path.join(__dirname, '../frontend-check-cong/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    // Fallback cho React Router (SPA), trừ các route /api để giữ nguyên 404 JSON.
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

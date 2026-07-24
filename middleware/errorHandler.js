const { logger } = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ message: `Không tìm thấy route: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi hệ thống' });
}

module.exports = { notFoundHandler, errorHandler };

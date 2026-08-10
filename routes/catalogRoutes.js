const express = require('express');
const catalogController = require('../controllers/catalogController');
const { upload } = require('../middleware/upload');
const { requireRole } = require('../middleware/auth');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

const adminOnly = requireRole(USER_ROLES.ADMIN);

// Đọc/liệt kê danh mục (GET /:type) dùng chung cho mọi user đã đăng nhập — ví dụ
// dropdown mã lỗi ở trang kết quả đối chiếu (useAnalysisResults.js) cần gọi được kể
// cả với tài khoản "staff". Mọi thao tác quản lý/ghi (import, tạo/sửa/xoá, xem lịch
// sử import, tải template) chỉ dành cho admin — khớp với việc frontend ẩn hẳn các
// trang "Danh mục" khỏi staff (xem navConfig.jsx/App.jsx RequireRole).
router.get('/:type', catalogController.listCatalog);

router.get('/:type/template', adminOnly, catalogController.downloadTemplate);
router.get('/:type/imports', adminOnly, catalogController.listImports);
router.get('/:type/imports/:importId', adminOnly, catalogController.getImport);
router.post('/:type/import', adminOnly, upload.single('file'), catalogController.importCatalog);
router.post('/:type', adminOnly, catalogController.createItem);
router.patch('/:type/:id', adminOnly, catalogController.updateItem);
router.delete('/:type/:id', adminOnly, catalogController.deleteItem);

module.exports = router;

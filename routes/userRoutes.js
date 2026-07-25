const express = require('express');
const userController = require('../controllers/userController');
const { requireRole } = require('../middleware/auth');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

// Quản lý tài khoản chỉ dành cho admin.
router.use(requireRole(USER_ROLES.ADMIN));

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;

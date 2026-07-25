const bcrypt = require('bcrypt');
const User = require('../models/User');
const { USER_ROLES } = require('../config/constants');

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function toSafeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  const { passwordHash, ...safe } = obj;
  return safe;
}

async function listUsers({ page = 1, pageSize = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * pageSize;
  const [items, total] = await Promise.all([
    User.find().select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(),
  ]);
  return { items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function createUser({ username, password, role }) {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername) throw new BadRequestError('Vui lòng nhập tên đăng nhập');
  if (!password || String(password).length < 6) {
    throw new BadRequestError('Mật khẩu phải có ít nhất 6 ký tự');
  }
  if (role && !Object.values(USER_ROLES).includes(role)) {
    throw new BadRequestError('Vai trò không hợp lệ');
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  try {
    const user = await User.create({ username: cleanUsername, passwordHash, role: role || USER_ROLES.STAFF });
    return toSafeUser(user);
  } catch (err) {
    if (err.code === 11000) throw new BadRequestError('Tên đăng nhập đã tồn tại');
    throw err;
  }
}

// Guards against locking the system out of admin access entirely.
async function countOtherActiveAdmins(excludeId) {
  return User.countDocuments({ role: USER_ROLES.ADMIN, active: true, _id: { $ne: excludeId } });
}

async function updateUser(id, { role, active, password }) {
  const user = await User.findById(id);
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');

  if (role !== undefined && role !== user.role) {
    if (!Object.values(USER_ROLES).includes(role)) throw new BadRequestError('Vai trò không hợp lệ');
    if (user.role === USER_ROLES.ADMIN && role !== USER_ROLES.ADMIN) {
      const remaining = await countOtherActiveAdmins(user._id);
      if (remaining === 0) throw new BadRequestError('Không thể hạ quyền admin cuối cùng trong hệ thống');
    }
    user.role = role;
  }

  if (active !== undefined && active !== user.active) {
    if (user.role === USER_ROLES.ADMIN && active === false) {
      const remaining = await countOtherActiveAdmins(user._id);
      if (remaining === 0) throw new BadRequestError('Không thể vô hiệu hoá admin cuối cùng trong hệ thống');
    }
    user.active = active;
  }

  if (password) {
    if (String(password).length < 6) throw new BadRequestError('Mật khẩu phải có ít nhất 6 ký tự');
    user.passwordHash = await bcrypt.hash(String(password), 10);
  }

  await user.save();
  return toSafeUser(user);
}

async function deleteUser(id, requestingUserId) {
  const user = await User.findById(id);
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');
  if (String(user._id) === String(requestingUserId)) {
    throw new BadRequestError('Không thể tự xoá tài khoản đang đăng nhập');
  }
  if (user.role === USER_ROLES.ADMIN) {
    const remaining = await countOtherActiveAdmins(user._id);
    if (remaining === 0) throw new BadRequestError('Không thể xoá admin cuối cùng trong hệ thống');
  }
  await User.findByIdAndDelete(id);
}

module.exports = { listUsers, createUser, updateUser, deleteUser, NotFoundError, BadRequestError };

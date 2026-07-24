const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

async function login(username, password) {
  const user = await User.findOne({ username: String(username || '').trim() });
  if (!user) {
    throw new AuthError('Sai tên đăng nhập hoặc mật khẩu');
  }

  const isMatch = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!isMatch) {
    throw new AuthError('Sai tên đăng nhập hoặc mật khẩu');
  }

  const token = jwt.sign(
    { sub: user._id.toString(), username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return { token, user: { id: user._id, username: user.username, role: user.role } };
}

async function getUserById(userId) {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    throw new AuthError('Không tìm thấy người dùng', 404);
  }
  return user;
}

module.exports = { login, getUserById, AuthError };

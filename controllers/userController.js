const { asyncHandler } = require('../utils/asyncHandler');
const userService = require('../services/userService');

const listUsers = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await userService.listUsers({ page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  res.json(result);
});

const createUser = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;
  const user = await userService.createUser({ username, password, role });
  res.status(201).json(user);
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, active, password } = req.body;
  const user = await userService.updateUser(id, { role, active, password });
  res.json(user);
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await userService.deleteUser(id, req.user.id);
  res.json({ ok: true });
});

module.exports = { listUsers, createUser, updateUser, deleteUser };

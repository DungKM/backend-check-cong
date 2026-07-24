const express = require('express');
const authController = require('../controllers/authController');
const { verifyJwt } = require('../middleware/auth');

const publicRouter = express.Router();
publicRouter.post('/login', authController.login);

const protectedRouter = express.Router();
protectedRouter.get('/me', verifyJwt, authController.me);

module.exports = { publicRouter, protectedRouter };

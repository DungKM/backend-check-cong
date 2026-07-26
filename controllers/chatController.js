const { asyncHandler } = require('../utils/asyncHandler');
const chatService = require('../services/chatService');

const sendMessage = asyncHandler(async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập nội dung câu hỏi' });
  }
  const reply = await chatService.sendMessage(message.trim(), Array.isArray(history) ? history : []);
  res.json({ reply });
});

module.exports = { sendMessage };

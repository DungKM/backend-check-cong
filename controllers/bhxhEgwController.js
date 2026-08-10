const { asyncHandler } = require('../utils/asyncHandler');
const bhxhEgwService = require('../services/bhxhEgwService');

// Endpoint thủ công để test/tra cứu 1 thẻ BHYT qua cổng BHXH — trả nguyên response
// thô, cộng với kết quả diễn giải khớp/sai (interpretCheckTheResponse) để dễ kiểm
// tra khi test tay. hotenCb/cccdCb (người tra cứu) lấy từ env trong bhxhEgwService,
// không nhận qua request.
const checkThe = asyncHandler(async (req, res) => {
  const { maThe, ngaySinh, hoTen } = req.body;
  if (!maThe || !ngaySinh || !hoTen) {
    return res.status(400).json({ message: 'Thiếu maThe/ngaySinh/hoTen' });
  }
  const raw = await bhxhEgwService.checkThe({ maThe, ngaySinh, hoTen });
  res.json({ raw, interpreted: bhxhEgwService.interpretCheckTheResponse(raw) });
});

module.exports = { checkThe };

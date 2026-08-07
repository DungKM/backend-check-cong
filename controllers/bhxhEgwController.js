const { asyncHandler } = require('../utils/asyncHandler');
const bhxhEgwService = require('../services/bhxhEgwService');

// Endpoint thủ công để test/tra cứu 1 thẻ BHYT qua cổng BHXH — trả nguyên response
// thô (chưa diễn giải khớp/sai) vì đang chờ response mẫu thật để viết logic diễn
// giải, xem TODO trong bhxhEgwService.checkThe.
const checkThe = asyncHandler(async (req, res) => {
  const { maThe, ngaySinh, hoTen, hotenCb, cccdCb } = req.body;
  if (!maThe || !ngaySinh || !hoTen || !hotenCb || !cccdCb) {
    return res.status(400).json({ message: 'Thiếu maThe/ngaySinh/hoTen/hotenCb/cccdCb' });
  }
  const raw = await bhxhEgwService.checkThe({ maThe, ngaySinh, hoTen, hotenCb, cccdCb });
  res.json({ raw });
});

module.exports = { checkThe };

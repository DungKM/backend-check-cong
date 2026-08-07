const bhxhEgwService = require('./bhxhEgwService');
const { logger } = require('../utils/logger');

// Giới hạn số lần gọi cổng BHXH chạy song song — đây là API của cơ quan nhà nước,
// không rõ giới hạn rate/quota thật sự nên chọn số nhỏ, thận trọng thay vì tối đa
// tốc độ.
const CONCURRENCY = 4;

function formatNgaySinh(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

async function runWithConcurrency(items, worker, concurrency) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

/**
 * Đối chiếu họ tên/ngày sinh của mỗi mã thẻ DUY NHẤT trong batch với CSDL thẻ BHYT
 * thật của BHXH (ML011/ML019) qua bhxhEgwService — 1 lần gọi/mã thẻ (dedupe theo
 * MA_THE_BHYT), không gọi lại theo từng dòng chi phí để đỡ tốn quota tài khoản cổng.
 *
 * - Chưa cấu hình BHXH_EGW_USERNAME/PASSWORD -> bỏ qua hoàn toàn (Map rỗng), không
 *   log lỗi lặp lại cho từng mã thẻ.
 * - Lỗi khi gọi 1 mã thẻ cụ thể (mạng, cổng BHXH lỗi, thiếu dữ liệu...) chỉ bỏ qua
 *   mã thẻ đó — KHÔNG làm hỏng phân tích cả batch, không tự suy đoán đúng/sai.
 *
 * Trả về Map<maThe, { ngaySinhMismatch, hoTenMismatch, message }> — chỉ chứa các mã
 * thẻ mà BHXH báo lệch (message diễn giải qua bhxhEgwService.interpretCheckTheResponse,
 * còn TẠM THỜI/best-effort — xem ghi chú ở đó).
 */
async function checkTheBhxhForBatch(claimRows) {
  const mismatches = new Map();

  if (!bhxhEgwService.hasCredentials()) return mismatches;

  const byMaThe = new Map();
  for (const row of claimRows || []) {
    if (!row.maThe || byMaThe.has(row.maThe)) continue;
    byMaThe.set(row.maThe, row);
  }

  await runWithConcurrency(
    [...byMaThe.entries()],
    async ([maThe, row]) => {
      const ngaySinh = formatNgaySinh(row.ngaySinh);
      if (!ngaySinh || !row.hoTen || !row.soCCCD) return;

      try {
        const raw = await bhxhEgwService.checkThe({
          maThe,
          ngaySinh,
          hoTen: row.hoTen,
          hotenCb: row.hoTen,
          cccdCb: row.soCCCD,
        });
        const interpreted = bhxhEgwService.interpretCheckTheResponse(raw);
        if (interpreted.ngaySinhMismatch || interpreted.hoTenMismatch) {
          mismatches.set(maThe, interpreted);
        }
      } catch (err) {
        logger.error(`Kiểm tra thẻ BHYT qua cổng BHXH thất bại (mã thẻ ${maThe}): ${err.message}`);
      }
    },
    CONCURRENCY
  );

  return mismatches;
}

module.exports = { checkTheBhxhForBatch };

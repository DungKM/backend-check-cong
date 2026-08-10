const bhxhEgwService = require('./bhxhEgwService');
const { logger } = require('../utils/logger');

// Giới hạn số lần gọi cổng BHXH chạy song song — đây là API của cơ quan nhà nước,
// không rõ giới hạn rate/quota thật sự nên chọn số nhỏ, thận trọng thay vì tối đa
// tốc độ. Hạ từ 4 xuống 2 sau khi thấy fetch failed/ECONNRESET lặp lại liên tục
// (xem retry trong bhxhEgwService.js) — nghi nhiều kết nối đồng thời góp phần làm
// cổng phía BHXH reset connection.
const CONCURRENCY = 2;

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
 * Đối chiếu họ tên/ngày sinh/giới tính của mỗi mã thẻ DUY NHẤT trong batch với CSDL
 * thẻ BHYT thật của BHXH (ML011/ML019/ML020) qua bhxhEgwService — 1 lần gọi/mã thẻ
 * (dedupe theo MA_THE_BHYT), không gọi lại theo từng dòng chi phí để đỡ tốn quota tài
 * khoản cổng.
 *
 * - Chưa cấu hình đủ BHXH_EGW_USERNAME/PASSWORD/HOTENCB/CCCDCB -> bỏ qua hoàn toàn
 *   (Map rỗng), không log lỗi lặp lại cho từng mã thẻ.
 * - Lỗi khi gọi 1 mã thẻ cụ thể (mạng, cổng BHXH lỗi, thiếu dữ liệu...) chỉ bỏ qua
 *   mã thẻ đó — KHÔNG làm hỏng phân tích cả batch, không tự suy đoán đúng/sai.
 *
 * Trả về Map<maThe, { ngaySinhMismatch, hoTenMismatch, gioiTinhMismatch, message }> —
 * chỉ chứa các mã thẻ mà BHXH báo lệch (diễn giải qua
 * bhxhEgwService.interpretCheckTheResponse, còn TẠM THỜI/best-effort cho hoTenMismatch
 * ngoài mã maKetQua đã xác nhận — xem ghi chú ở đó).
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
      if (!ngaySinh || !row.hoTen) return;

      try {
        const raw = await bhxhEgwService.checkThe({ maThe, ngaySinh, hoTen: row.hoTen });
        const interpreted = bhxhEgwService.interpretCheckTheResponse(raw, row.gioiTinh);
        if (interpreted.ngaySinhMismatch || interpreted.hoTenMismatch || interpreted.gioiTinhMismatch) {
          mismatches.set(maThe, interpreted);
        }
      } catch (err) {
        const cause = err.cause ? ` | cause: ${err.cause.code || err.cause.message || err.cause}` : '';
        logger.error(`Kiểm tra thẻ BHYT qua cổng BHXH thất bại (mã thẻ ${maThe}): ${err.message}${cause}`);
      }
    },
    CONCURRENCY
  );

  return mismatches;
}

module.exports = { checkTheBhxhForBatch };

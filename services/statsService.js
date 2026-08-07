const Batch = require('../models/Batch');
const claimMemoryStore = require('./claimMemoryStore');
const { KET_LUAN } = require('../config/constants');

// Lightweight cross-batch rollup for the "Tổng quan" landing page — just the 4
// headline numbers (tổng đợt, tổng dòng, dòng cảnh báo, tiền cảnh báo) plus a
// short recent-batches list. Deliberately skips the heavier per-month/per-mã-lỗi
// breakdowns (see reconciliationService.getSummary for the per-batch version
// that still has those) to keep this endpoint cheap since it loads on every
// login.
//
// tongSoDong/soDongCanhBao/tongTienCanhBao chỉ cộng dồn từ các batch ĐANG CÒN trong
// bộ nhớ tiến trình (claimMemoryStore) — nội dung hồ sơ không còn lưu Mongo nên không
// thể cộng dồn "mọi thời gian" nữa; số liệu này reset khi server restart hoặc khi 1
// batch bị đẩy khỏi bộ nhớ (xem MAX_BATCHES_IN_MEMORY). totalBatches/recentBatches vẫn
// lấy từ Batch (Mongo, không PII) nên không bị ảnh hưởng.
async function getOverview() {
  const [totalBatches, recentBatches] = await Promise.all([
    Batch.countDocuments(),
    Batch.find().sort({ createdAt: -1 }).limit(5).select('batchId status createdAt analyzedAt rowCounts').lean(),
  ]);

  let tongSoDong = 0;
  let soDongCanhBao = 0;
  let tongTienCanhBao = 0;

  for (const batchId of claimMemoryStore.getAllBatchIds()) {
    for (const r of claimMemoryStore.getAnalysisResults(batchId)) {
      tongSoDong += 1;
      if (r.ketLuan !== KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC) {
        soDongCanhBao += 1;
        tongTienCanhBao += Number(r.errorRow?.deNghi) || 0;
      }
    }
  }

  return { totalBatches, tongSoDong, soDongCanhBao, tongTienCanhBao, recentBatches };
}

module.exports = { getOverview };

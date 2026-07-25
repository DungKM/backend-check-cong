const Batch = require('../models/Batch');
const AnalysisResult = require('../models/AnalysisResult');
const { KET_LUAN } = require('../config/constants');

// Lightweight cross-batch rollup for the "Tổng quan" landing page — just the 4
// headline numbers (tổng đợt, tổng dòng, dòng cảnh báo, tiền cảnh báo) plus a
// short recent-batches list. Deliberately skips the heavier per-month/per-mã-lỗi
// breakdowns (see reconciliationService.getSummary for the per-batch version
// that still has those) to keep this endpoint cheap since it loads on every
// login.
async function getOverview() {
  const [totalBatches, totals, recentBatches] = await Promise.all([
    Batch.countDocuments(),
    AnalysisResult.aggregate([
      {
        $lookup: {
          from: 'claimitems',
          localField: 'errorRowId',
          foreignField: '_id',
          as: 'errorRow',
        },
      },
      { $unwind: '$errorRow' },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          soDongCanhBao: { $sum: { $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, 1] } },
          tongTienCanhBao: {
            $sum: {
              $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, { $ifNull: ['$errorRow.deNghi', 0] }],
            },
          },
        },
      },
    ]),
    Batch.find().sort({ createdAt: -1 }).limit(5).select('batchId status createdAt analyzedAt rowCounts').lean(),
  ]);

  return {
    totalBatches,
    tongSoDong: totals[0]?.count || 0,
    soDongCanhBao: totals[0]?.soDongCanhBao || 0,
    tongTienCanhBao: totals[0]?.tongTienCanhBao || 0,
    recentBatches,
  };
}

module.exports = { getOverview };

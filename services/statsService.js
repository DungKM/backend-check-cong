const Batch = require('../models/Batch');
const AnalysisResult = require('../models/AnalysisResult');
const { KET_LUAN } = require('../config/constants');

// Global (cross-batch) counterpart to reconciliationService.getSummary — same
// aggregation shapes, just without the { batchId } $match, plus batch-level and
// top-mã-lỗi rollups for the "Tổng quan" landing page.
async function getOverview() {
  const [totalBatches, batchesByStatusRaw, totals, byKetLuan, byMonth, topMaLoiRaw, recentBatches] =
    await Promise.all([
      Batch.countDocuments(),
      Batch.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      AnalysisResult.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            soDongCanhBao: { $sum: { $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, 1] } },
          },
        },
      ]),
      AnalysisResult.aggregate([{ $group: { _id: '$ketLuan', count: { $sum: 1 } } }]),
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
            _id: { $dateToString: { format: '%Y-%m', date: '$errorRow.ngayYLenh' } },
            count: { $sum: 1 },
            tongTienCanhBao: {
              $sum: {
                $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, { $ifNull: ['$errorRow.deNghi', 0] }],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AnalysisResult.aggregate([
        { $unwind: '$duDoanMaLoi' },
        {
          $group: {
            _id: '$duDoanMaLoi.maLoi',
            tenLoi: { $first: '$duDoanMaLoi.tenLoi' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Batch.find().sort({ createdAt: -1 }).limit(5).select('batchId status createdAt analyzedAt rowCounts').lean(),
    ]);

  const batchesByStatus = {};
  for (const row of batchesByStatusRaw) batchesByStatus[row._id] = row.count;

  return {
    totalBatches,
    batchesByStatus,
    tongSoDong: totals[0]?.count || 0,
    soDongCanhBao: totals[0]?.soDongCanhBao || 0,
    theoKetLuan: byKetLuan.map((r) => ({ ketLuan: r._id, count: r.count })),
    theoThang: byMonth.map((r) => ({ thang: r._id || '(không rõ)', count: r.count, tongTienCanhBao: r.tongTienCanhBao })),
    topMaLoi: topMaLoiRaw.map((r) => ({ maLoi: r._id, tenLoi: r.tenLoi, count: r.count })),
    recentBatches,
  };
}

module.exports = { getOverview };

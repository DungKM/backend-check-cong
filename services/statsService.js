const Batch = require('../models/Batch');
const catalogService = require('./catalogService');

// Lightweight cross-batch rollup for the "Tổng quan" landing page — headline
// counts by trạng thái đợt đối chiếu (persisted trên Batch, luôn đúng dù server có
// restart) plus a short recent-batches list. Deliberately skips the heavier
// per-month/per-mã-lỗi breakdowns (see reconciliationService.getSummary for the
// per-batch version that still has those) to keep this endpoint cheap since it
// loads on every login.
//
// KHÔNG dùng claimMemoryStore ở đây nữa (đã bỏ tongSoDong/soDongCanhBao/
// tongTienCanhBao) — số liệu đó chỉ cộng dồn được từ các batch ĐANG CÒN trong bộ
// nhớ tiến trình nên reset về 0 mỗi khi server restart, gây hiểu lầm là "chưa đối
// chiếu gì" dù Batch vẫn ghi status 'analyzed'. Toàn bộ số liệu dưới đây lấy từ
// Batch (Mongo, không PII) nên ổn định lâu dài.
async function getOverview() {
  const [totalBatches, statusCounts, analyzedTotals, recentBatches, catalogCounts] = await Promise.all([
    Batch.countDocuments(),
    Batch.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Batch.aggregate([
      { $match: { status: 'analyzed' } },
      {
        $group: {
          _id: null,
          totalRows: {
            $sum: {
              $ifNull: ['$analysisSummary.totalRows', { $ifNull: ['$rowCounts.claimRows', 0] }],
            },
          },
          trackedRows: { $sum: { $ifNull: ['$analysisSummary.totalRows', 0] } },
          warningRows: { $sum: { $ifNull: ['$analysisSummary.warningRows', 0] } },
          savedAmount: { $sum: { $ifNull: ['$analysisSummary.savedAmount', 0] } },
          batchesWithSummary: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$analysisSummary.totalRows', 0] }, 0] }, 1, 0],
            },
          },
        },
      },
    ]),
    Batch.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('batchId status createdAt analyzedAt rowCounts analysisSummary')
      .lean(),
    catalogService.getCatalogCounts(),
  ]);

  const byStatus = { uploaded: 0, analyzing: 0, analyzed: 0, failed: 0 };
  for (const { _id, count } of statusCounts) {
    if (_id in byStatus) byStatus[_id] = count;
  }

  const totals = analyzedTotals[0] || {
    totalRows: 0,
    trackedRows: 0,
    warningRows: 0,
    savedAmount: 0,
    batchesWithSummary: 0,
  };
  const completionRate = totalBatches > 0 ? byStatus.analyzed / totalBatches : 0;
  const warningRate = totals.trackedRows > 0 ? totals.warningRows / totals.trackedRows : 0;
  const averageSavedAmount = totals.batchesWithSummary > 0 ? totals.savedAmount / totals.batchesWithSummary : 0;
  const missingSummaryCount = Math.max(byStatus.analyzed - totals.batchesWithSummary, 0);

  return {
    totalBatches,
    daDoiChieu: byStatus.analyzed,
    dangXuLy: byStatus.uploaded + byStatus.analyzing,
    thatBai: byStatus.failed,
    tongSoDongDaCheck: totals.totalRows,
    tongSoDongCoDuLieuChiPhi: totals.trackedRows,
    tongDongCanhBao: totals.warningRows,
    tongTienTietKiem: totals.savedAmount,
    tyLeHoanTat: completionRate,
    tyLeCanhBao: warningRate,
    tietKiemTrungBinhMoiDot: averageSavedAmount,
    soDotCoDuLieuChiPhi: totals.batchesWithSummary,
    soDotThieuDuLieuChiPhi: missingSummaryCount,
    recentBatches,
    catalogCounts,
  };
}

module.exports = { getOverview };

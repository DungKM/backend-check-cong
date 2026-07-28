const Batch = require('../models/Batch');
const ClaimItem = require('../models/ClaimItem');
const ClaimXmlDetail = require('../models/ClaimXmlDetail');
const AnalysisResult = require('../models/AnalysisResult');

// Severity (Cao/Trung bình/Thấp) is by count of distinct mã lỗi predicted for a row, not
// by any single mã lỗi's own mucDo — a row hit by more mã lỗi at once is more likely a
// real, serious mismatch than one hit by just one.
const SEVERITY_THRESHOLDS = { cao: 3, trungBinh: 2, thap: 1 };

async function listBatches({ page = 1, pageSize = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * pageSize;
  const [items, total] = await Promise.all([
    Batch.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Batch.countDocuments(),
  ]);
  return { items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getBatch(batchId) {
  return Batch.findOne({ batchId }).lean();
}

// Per-file breakdown for the "bảng tổng hợp theo file" view. tongCanhBao/mucCao only
// carry real numbers once đối chiếu has run (batch.status === 'analyzed') — before that
// they're 0, since there's no AnalysisResult yet to count.
async function getClaimFiles(batchId) {
  const batch = await Batch.findOne({ batchId }).lean();
  if (!batch) return null;
  const claimFiles = batch.claimFiles || [];

  if (batch.status !== 'analyzed' || claimFiles.length === 0) {
    return claimFiles.map((f) => ({ ...f, tongCanhBao: 0, mucCao: 0 }));
  }

  const warningCounts = await AnalysisResult.aggregate([
    { $match: { batchId } },
    { $lookup: { from: 'claimitems', localField: 'errorRowId', foreignField: '_id', as: 'errorRow' } },
    { $unwind: '$errorRow' },
    {
      $group: {
        _id: '$errorRow.sourceSheet',
        tongCanhBao: { $sum: 1 },
        mucCao: { $sum: { $cond: [{ $gte: [{ $size: '$duDoanMaLoi' }, SEVERITY_THRESHOLDS.cao] }, 1, 0] } },
      },
    },
  ]);
  const byFileName = new Map(warningCounts.map((w) => [w._id, w]));

  return claimFiles.map((f) => ({
    ...f,
    tongCanhBao: byFileName.get(f.fileName)?.tongCanhBao || 0,
    mucCao: byFileName.get(f.fileName)?.mucCao || 0,
  }));
}

// Buckets each flagged ClaimItem row into 4 display severities by how many distinct mã
// lỗi were predicted for it (SEVERITY_THRESHOLDS) — "Thông tin" is a row that was flagged
// (has an AnalysisResult) but matched no specific mã lỗi at all.
function bucketBySeverity(results) {
  const summary = { cao: 0, trungBinh: 0, thap: 0, thongTin: 0 };
  for (const r of results) {
    const count = (r.duDoanMaLoi || []).length;
    if (count >= SEVERITY_THRESHOLDS.cao) summary.cao += 1;
    else if (count >= SEVERITY_THRESHOLDS.trungBinh) summary.trungBinh += 1;
    else if (count >= SEVERITY_THRESHOLDS.thap) summary.thap += 1;
    else summary.thongTin += 1;
  }
  return summary;
}

// Which XML-type tabs to show for one file's detail view, with the row count for each
// tab's badge, plus the "Danh sách lỗi" count/severity breakdown (AnalysisResult rows
// tied to this file).
async function getClaimFileXmlTypes(batchId, fileName) {
  const [typeCounts, claimItems] = await Promise.all([
    ClaimXmlDetail.aggregate([
      { $match: { batchId, fileName } },
      { $group: { _id: '$xmlType', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    ClaimItem.find({ batchId, sourceSheet: fileName }, { _id: 1 }).lean(),
  ]);

  const results = claimItems.length
    ? await AnalysisResult.find(
        { batchId, errorRowId: { $in: claimItems.map((c) => c._id) } },
        { duDoanMaLoi: 1 }
      ).lean()
    : [];

  return {
    xmlTypes: typeCounts.map((t) => ({ xmlType: t._id, count: t.count })),
    errorCount: results.length,
    warningSummary: { tongCanhBao: results.length, ...bucketBySeverity(results) },
  };
}

// Rows for one tab of a file's detail view. xmlType 'ERRORS' returns the AnalysisResult
// list for this file (same shape as reconciliationService.getResults). Any other xmlType
// returns raw ClaimXmlDetail records; for XML2/XML3 (the reconciled cost types) each row
// also gets `_hasWarning`, joined back to AnalysisResult via the (maLK, sttXML) key that
// both ClaimItem and ClaimXmlDetail carry.
async function getClaimFileXmlRows(batchId, fileName, xmlType) {
  if (xmlType === 'ERRORS') {
    // Same result shape as reconciliationService.getResults, so the frontend can reuse
    // the existing ResultsTable component for this tab.
    const claimItemIds = await ClaimItem.find({ batchId, sourceSheet: fileName }, { _id: 1 }).lean();
    const results = await AnalysisResult.find({ batchId, errorRowId: { $in: claimItemIds.map((c) => c._id) } })
      .populate('errorRowId')
      .lean();
    return results
      .filter((r) => r.errorRowId)
      .map((r) => ({
        _id: r._id,
        ketLuan: r.ketLuan,
        chiTietLech: r.chiTietLech,
        rejectReasonCategory: r.rejectReasonCategory,
        duDoanMaLoi: r.duDoanMaLoi,
        ghiChu: r.ghiChu,
        errorRow: r.errorRowId,
      }));
  }

  const details = await ClaimXmlDetail.find({ batchId, fileName, xmlType }).lean();

  if (['XML2', 'XML3'].includes(xmlType)) {
    const flagged = await ClaimItem.aggregate([
      { $match: { batchId, sourceSheet: fileName, xmlType } },
      { $lookup: { from: 'analysisresults', localField: '_id', foreignField: 'errorRowId', as: 'flags' } },
      { $match: { 'flags.0': { $exists: true } } },
      { $project: { maLK: 1, sttXML: 1 } },
    ]);
    const flaggedKeys = new Set(flagged.map((f) => `${f.maLK}|${f.sttXML}`));
    return details.map((d) => ({ ...d.data, _hasWarning: flaggedKeys.has(`${d.maLK}|${d.sttXML}`) }));
  }

  return details.map((d) => d.data);
}

module.exports = { listBatches, getBatch, getClaimFiles, getClaimFileXmlTypes, getClaimFileXmlRows };

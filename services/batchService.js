const Batch = require('../models/Batch');
const claimMemoryStore = require('./claimMemoryStore');

// Severity (Cao/Trung bình/Thấp) is by count of distinct mã lỗi predicted for a row, not
// by any single mã lỗi's own mucDo — a row hit by more mã lỗi at once is more likely a
// real, serious mismatch than one hit by just one.
const SEVERITY_THRESHOLDS = { cao: 3, trungBinh: 2, thap: 1 };

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

  // hoTen KHÔNG có trong claimFiles (Mongo, PII) — chỉ đọc tạm từ claimMemoryStore (RAM),
  // nên chỉ hiện được trong CÙNG session vừa tải lên; mất khi server restart hoặc batch
  // bị đẩy khỏi RAM (xem claimMemoryStore.setClaimFileHoTen).
  const withHoTen = (f) => ({ ...f, hoTen: claimMemoryStore.getClaimFileHoTen(batchId, f.fileName) });

  if (batch.status !== 'analyzed' || claimFiles.length === 0) {
    return claimFiles.map((f) => ({ ...withHoTen(f), tongCanhBao: 0, mucCao: 0 }));
  }

  const byFileName = new Map();
  for (const r of claimMemoryStore.getAnalysisResults(batchId)) {
    const fileName = r.errorRow?.sourceSheet;
    if (!fileName) continue;
    const entry = byFileName.get(fileName) || { tongCanhBao: 0, mucCao: 0 };
    entry.tongCanhBao += 1;
    if ((r.duDoanMaLoi || []).length >= SEVERITY_THRESHOLDS.cao) entry.mucCao += 1;
    byFileName.set(fileName, entry);
  }

  return claimFiles.map((f) => ({
    ...withHoTen(f),
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
  const typeCounts = new Map();
  for (const d of claimMemoryStore.getClaimXmlDetails(batchId)) {
    if (d.fileName !== fileName) continue;
    typeCounts.set(d.xmlType, (typeCounts.get(d.xmlType) || 0) + 1);
  }
  const xmlTypes = [...typeCounts.entries()]
    .map(([xmlType, count]) => ({ xmlType, count }))
    .sort((a, b) => (a.xmlType > b.xmlType ? 1 : a.xmlType < b.xmlType ? -1 : 0));

  const results = claimMemoryStore
    .getAnalysisResults(batchId)
    .filter((r) => r.errorRow?.sourceSheet === fileName);

  return {
    xmlTypes,
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
    return claimMemoryStore
      .getAnalysisResults(batchId)
      .filter((r) => r.errorRow?.sourceSheet === fileName)
      .map((r) => ({
        _id: r._id,
        ketLuan: r.ketLuan,
        chiTietLech: r.chiTietLech,
        rejectReasonCategory: r.rejectReasonCategory,
        duDoanMaLoi: r.duDoanMaLoi,
        ghiChu: r.ghiChu,
        errorRow: r.errorRow,
      }));
  }

  const details = claimMemoryStore
    .getClaimXmlDetails(batchId)
    .filter((d) => d.fileName === fileName && d.xmlType === xmlType);

  if (['XML2', 'XML3'].includes(xmlType)) {
    const flaggedKeys = new Set(
      claimMemoryStore
        .getAnalysisResults(batchId)
        .filter((r) => r.errorRow?.sourceSheet === fileName && r.errorRow?.xmlType === xmlType)
        .map((r) => `${r.errorRow.maLK}|${r.errorRow.sttXML}`)
    );
    return details.map((d) => ({ ...d.data, _hasWarning: flaggedKeys.has(`${d.maLK}|${d.sttXML}`) }));
  }

  return details.map((d) => d.data);
}

module.exports = { getBatch, getClaimFiles, getClaimFileXmlTypes, getClaimFileXmlRows };

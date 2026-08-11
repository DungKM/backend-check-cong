const crypto = require('crypto');
const Batch = require('../models/Batch');
const claimMemoryStore = require('./claimMemoryStore');
const { parseClaimXmlBuffer } = require('../parsers/xml/xmlClaimParser');
const reconciliationService = require('./reconciliationService');
const { logger } = require('../utils/logger');

async function getOrCreateBatch(batchId, userId) {
  if (batchId) {
    const existing = await Batch.findOne({ batchId });
    if (existing) return existing;
  }
  const newBatchId = batchId || crypto.randomUUID();
  return Batch.create({ batchId: newBatchId, createdBy: userId });
}

async function ingestClaimXml({ batchId, userId, files }) {
  const batch = await getOrCreateBatch(batchId, userId);

  const allRows = [];
  const allXmlDetails = [];
  const allWarnings = [];
  const fileNames = [];
  const claimFiles = [];
  const hoTenByFileName = {};

  for (const file of files) {
    fileNames.push(file.originalname);

    let parsed;
    try {
      parsed = await parseClaimXmlBuffer(file.buffer, file.originalname);
    } catch (err) {
      // Isolate the failure to this one file — the rest of a multi-file upload still
      // gets processed instead of failing the whole batch.
      allWarnings.push(`[${file.originalname}] Lỗi phân tích XML: ${err.message}`);
      claimFiles.push({
        fileName: file.originalname,
        status: 'error',
        errorMessage: err.message,
      });
      continue;
    }

    const { rows, warnings, xmlDetails, hosoSummaries } = parsed;
    allRows.push(...rows.map((row) => ({ ...row, sourceSheet: file.originalname })));
    allXmlDetails.push(...xmlDetails.map((d) => ({ ...d, fileName: file.originalname })));
    allWarnings.push(...warnings.map((w) => `[${file.originalname}] ${w}`));

    // A file normally wraps one hồ sơ (one MA_LK) — take the first successfully parsed
    // one to represent the file in the per-file summary table.
    // KHÔNG lưu hoTen vào claimFiles (PII) — Batch (Mongo) chỉ giữ số liệu tổng hợp
    // không định danh. hoTen chỉ lưu riêng ở claimMemoryStore (RAM) để bảng tổng hợp
    // hiện tạm được trong CÙNG session vừa tải lên — xem claimMemoryStore.setClaimFileHoTen.
    const representativeHoso = hosoSummaries.find((h) => h.ok);
    claimFiles.push({
      fileName: file.originalname,
      status: representativeHoso ? 'success' : 'error',
      maLK: representativeHoso?.maLK || '',
      rowCount: rows.length,
      parseWarningCount: warnings.length,
      errorMessage: representativeHoso ? undefined : 'Không đọc được thông tin hồ sơ (thiếu MA_LK ở XML1)',
    });
    if (representativeHoso?.hoTen) {
      hoTenByFileName[file.originalname] = representativeHoso.hoTen;
    }
  }

  // Nội dung hồ sơ (tên/ngày sinh/mã thẻ/chi phí...) chỉ giữ trong bộ nhớ tiến trình,
  // KHÔNG ghi MongoDB — xem claimMemoryStore.js.
  claimMemoryStore.setClaimItems(batch.batchId, allRows.map((row) => ({ ...row, batchId: batch.batchId })));
  claimMemoryStore.setClaimXmlDetails(batch.batchId, allXmlDetails.map((d) => ({ ...d, batchId: batch.batchId })));
  claimMemoryStore.setClaimFileHoTen(batch.batchId, hoTenByFileName);

  batch.claimFileNames = fileNames;
  batch.claimFiles = claimFiles;
  batch.rowCounts.claimRows = allRows.length;
  batch.analysisSummary = { totalRows: 0, warningRows: 0, savedAmount: 0 };
  batch.status = 'uploaded';
  await batch.save();

  // Đối chiếu runs automatically right after upload so the per-file cảnh báo/mức cao
  // numbers are ready as soon as the upload response comes back — no separate "Chạy đối
  // chiếu" click needed. If it fails (e.g. transient DB issue), the upload itself still
  // succeeded; the user can retry via the "Chạy đối chiếu" button.
  try {
    await reconciliationService.runAnalysis(batch.batchId);
  } catch (err) {
    logger.error(`Tự động chạy đối chiếu thất bại cho batch ${batch.batchId}: ${err.message}`);
  }

  return { batchId: batch.batchId, rowCount: allRows.length, warnings: allWarnings };
}

module.exports = { getOrCreateBatch, ingestClaimXml };

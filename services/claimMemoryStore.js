const crypto = require('crypto');

// Nội dung hồ sơ XML (họ tên, ngày sinh, mã thẻ, CCCD, chi tiết chi phí...) và kết quả
// đối chiếu từng dòng KHÔNG được ghi vào MongoDB — dữ liệu nhạy cảm, chỉ "check tại
// thời điểm" theo yêu cầu. Toàn bộ sống trong bộ nhớ của tiến trình Node (Map dưới
// đây), mất hẳn khi restart server — không cần dọn/xoá gì thêm. Batch model (Mongo)
// chỉ còn giữ số liệu tổng hợp không định danh (đếm dòng, trạng thái, tên file...),
// xem uploadService.ingestClaimXml.
//
// Giới hạn số batch giữ đồng thời trong RAM để tránh phình bộ nhớ nếu server chạy lâu
// ngày không restart — Map giữ thứ tự chèn nên batch cũ nhất bị đẩy ra trước khi vượt
// ngưỡng (đủ dùng cho luồng "upload rồi xem kết quả ngay", không phải kho lưu trữ).
const MAX_BATCHES_IN_MEMORY = 30;

const store = new Map(); // batchId -> { claimItems, claimXmlDetails, analysisResults, claimFileHoTen }

function getOrInit(batchId) {
  if (!store.has(batchId)) {
    store.set(batchId, { claimItems: [], claimXmlDetails: [], analysisResults: [], claimFileHoTen: {} });
  }
  return store.get(batchId);
}

function touchAndEvict(batchId) {
  // Re-insert để đưa batchId vừa dùng lên "mới nhất" theo thứ tự Map, rồi đẩy bớt
  // batch cũ nhất nếu vượt ngưỡng.
  const entry = store.get(batchId);
  store.delete(batchId);
  store.set(batchId, entry);
  while (store.size > MAX_BATCHES_IN_MEMORY) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }
}

function withId(row) {
  return { _id: crypto.randomUUID(), ...row };
}

function setClaimItems(batchId, rows) {
  const entry = getOrInit(batchId);
  entry.claimItems = (rows || []).map(withId);
  touchAndEvict(batchId);
  return entry.claimItems;
}

function getClaimItems(batchId) {
  return store.get(batchId)?.claimItems || [];
}

function setClaimXmlDetails(batchId, details) {
  const entry = getOrInit(batchId);
  entry.claimXmlDetails = (details || []).map(withId);
  return entry.claimXmlDetails;
}

function getClaimXmlDetails(batchId) {
  return store.get(batchId)?.claimXmlDetails || [];
}

function setAnalysisResults(batchId, results) {
  const entry = getOrInit(batchId);
  entry.analysisResults = (results || []).map(withId);
  return entry.analysisResults;
}

function getAnalysisResults(batchId) {
  return store.get(batchId)?.analysisResults || [];
}

// Tên bệnh nhân theo fileName — chỉ để hiện tạm ở bảng tổng hợp file trong CÙNG session
// (RAM), không bao giờ ghi xuống Mongo (xem uploadService.ingestClaimXml/Batch.claimFiles).
// Mất khi server restart hoặc batch bị đẩy khỏi RAM (touchAndEvict) — đúng ý định PII.
function setClaimFileHoTen(batchId, hoTenByFileName) {
  const entry = getOrInit(batchId);
  entry.claimFileHoTen = hoTenByFileName || {};
}

function getClaimFileHoTen(batchId, fileName) {
  return store.get(batchId)?.claimFileHoTen?.[fileName] || '';
}

function deleteBatch(batchId) {
  store.delete(batchId);
}

function getAllBatchIds() {
  return [...store.keys()];
}

module.exports = {
  setClaimItems,
  getClaimItems,
  setClaimXmlDetails,
  getClaimXmlDetails,
  setAnalysisResults,
  getAnalysisResults,
  setClaimFileHoTen,
  getClaimFileHoTen,
  deleteBatch,
  getAllBatchIds,
};

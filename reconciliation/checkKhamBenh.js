const { normalizeText } = require('../utils/normalizeText');

// BHYT dịch vụ khám bệnh tên luôn bắt đầu bằng "Khám ..." (VD "Khám Ngoại tổng hợp",
// "Khám Nội tiêu hóa") — không cần danh mục "mã nhóm" tham chiếu ngoài như ML004.
function isKhamBenhRow(row) {
  return normalizeText(row.tenChiPhi || '').startsWith('kham');
}

/**
 * Returns a Map<`${maLK}|${maChiPhi}`, ghi chú> for mỗi mã dịch vụ khám bệnh cụ thể
 * được dùng nhiều hơn 1 lần trong cùng hồ sơ. Hai mã dịch vụ khám KHÁC NHAU trong cùng
 * hồ sơ (ví dụ khám 2 chuyên khoa) không thuộc phạm vi check này — đó là chuyện của
 * "Đề nghị tiền khám trên 1 chuyên khoa sai quy định" (ML001), không phải ML007.
 */
function checkKhamBenhBatch(errorRows) {
  const counts = new Map();
  for (const row of errorRows) {
    if (!row.maLK || !row.maChiPhi || !isKhamBenhRow(row)) continue;
    const key = `${row.maLK}|${row.maChiPhi}`;
    if (!counts.has(key)) counts.set(key, { tenChiPhi: row.tenChiPhi, count: 0 });
    counts.get(key).count += 1;
  }

  const notes = new Map();
  for (const [key, { tenChiPhi, count }] of counts) {
    if (count <= 1) continue;
    notes.set(key, `Dịch vụ khám bệnh "${tenChiPhi}" được sử dụng ${count} lần trong cùng hồ sơ`);
  }
  return notes;
}

module.exports = { isKhamBenhRow, checkKhamBenhBatch };

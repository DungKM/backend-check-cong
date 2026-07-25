const { normalizeText } = require('../utils/normalizeText');

/**
 * Builds a lookup map of mã DVKT -> mã nhóm chuẩn (MANHOM_5937) from
 * ServiceGroupCatalog rows, keyed by `ma` (mã dịch vụ/thủ thuật chi tiết,
 * có thể có đuôi phân loại, VD "_GT" — cùng dạng với MA_DICH_VU trên XML).
 */
function buildServiceGroupMap(serviceGroupRows) {
  const map = new Map();
  for (const row of serviceGroupRows || []) {
    if (row.ma) map.set(row.ma, row.maNhom || '');
  }
  return map;
}

/**
 * Returns a ghi chú string when errorRow.maNhom (MA_NHOM, mã nhóm chi phí cơ sở
 * khai báo khi thanh toán DVKT) không khớp mã nhóm chuẩn theo errorRow.maChiPhi
 * trong ServiceGroupCatalog. Returns null when there's nothing to flag (no
 * catalog loaded, DVKT không có trong danh mục nhóm, dòng không khai mã nhóm,
 * hoặc mã nhóm khớp).
 */
function checkNhomDvkt(errorRow, serviceGroupMap) {
  if (!serviceGroupMap || serviceGroupMap.size === 0) return null;
  const maNhom = (errorRow.maNhom || '').trim();
  if (!maNhom) return null;
  if (!serviceGroupMap.has(errorRow.maChiPhi)) return null;

  const maNhomChuan = serviceGroupMap.get(errorRow.maChiPhi);
  if (!maNhomChuan) return null;
  if (normalizeText(maNhom) === normalizeText(maNhomChuan)) return null;

  return `DVKT "${errorRow.maChiPhi}" khai mã nhóm "${maNhom}" không khớp mã nhóm chuẩn "${maNhomChuan}" theo danh mục được thực hiện`;
}

module.exports = { buildServiceGroupMap, checkNhomDvkt };

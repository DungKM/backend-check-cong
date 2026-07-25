const { normalizeText } = require('../utils/normalizeText');
const { MUC_HUONG_THE_MAP } = require('../config/constants');

/**
 * Reads the mức hưởng group digit (3rd character) off a mã thẻ BHYT (VD
 * "TC3363621769845" -> "3") and maps it to the % mức hưởng chuẩn. Returns null
 * when the card number is missing/too short or the digit isn't 1-5.
 */
function extractMucHuongFromThe(maThe) {
  const trimmed = String(maThe || '').trim();
  if (trimmed.length < 3) return null;
  const digit = Number(trimmed.charAt(2));
  return MUC_HUONG_THE_MAP[digit] ?? null;
}

/**
 * Trái tuyến = nơi đăng ký KCB ban đầu (MA_DKBD) khác nơi khám thực tế
 * (MA_CSKCB) và không có giấy chuyển tuyến hợp lệ. Returns null (không xác
 * định được) when maDkbd/maCSKCB is missing — not enough data to judge.
 */
function isTraiTuyen(errorRow) {
  if (!errorRow.maDkbd || !errorRow.maCSKCB) return null;
  if (errorRow.giayChuyenTuyen) return false;
  return normalizeText(errorRow.maDkbd) !== normalizeText(errorRow.maCSKCB);
}

/**
 * Returns a ghi chú string for one of two data-verifiable signals, or null
 * when nothing to flag:
 *  1) Mức hưởng khai trên dòng chi phí (MUC_HUONG) không khớp mã mức hưởng
 *     ghi trên chính mã thẻ BHYT của bệnh nhân — a self-consistency check,
 *     independent of trái tuyến.
 *  2) Hồ sơ trái tuyến nhưng tỷ lệ thanh toán BHYT đề nghị (TYLE_TT_BH) vẫn
 *     100% — flags for human review rather than asserting a specific correct
 *     %, since the actual trái-tuyến reduction rate depends on cấp/tuyến của
 *     cơ sở KCB (không có danh mục phân loại tuyến trong hệ thống) và quy
 *     định hiện hành có thể đã thay đổi theo Luật BHYT sửa đổi 2024.
 */
function checkMucHuong(errorRow) {
  const expectedMucHuong = extractMucHuongFromThe(errorRow.maThe);
  if (
    expectedMucHuong !== null &&
    errorRow.mucHuong !== null &&
    errorRow.mucHuong !== undefined &&
    Number(errorRow.mucHuong) !== expectedMucHuong
  ) {
    return `Mức hưởng khai báo "${errorRow.mucHuong}%" không khớp mức hưởng theo mã thẻ BHYT "${errorRow.maThe}" (mã mức hưởng chuẩn "${expectedMucHuong}%")`;
  }

  const traiTuyen = isTraiTuyen(errorRow);
  if (
    traiTuyen === true &&
    errorRow.tyLeTtBh !== null &&
    errorRow.tyLeTtBh !== undefined &&
    Number(errorRow.tyLeTtBh) >= 100
  ) {
    return `Hồ sơ trái tuyến (nơi đăng ký ban đầu "${errorRow.maDkbd}" khác nơi khám "${errorRow.maCSKCB}", không có giấy chuyển tuyến) nhưng tỷ lệ thanh toán BHYT đề nghị vẫn "${errorRow.tyLeTtBh}%" — cần rà soát lại mức giảm trừ trái tuyến theo quy định hiện hành`;
  }

  return null;
}

module.exports = { extractMucHuongFromThe, isTraiTuyen, checkMucHuong };

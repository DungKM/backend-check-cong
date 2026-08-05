const { normalizeText } = require('../utils/normalizeText');
const {
  MUC_HUONG_THE_MAP,
  MUC_LUONG_CO_SO_LICH_SU,
  LY_DO_VV_CAP_CUU_KEYWORDS,
  LY_DO_VV_TU_DEN_KEYWORDS,
  LY_DO_VV_DUNG_TUYEN_KEYWORDS,
} = require('../config/constants');
const { isDateInRange } = require('../utils/dateUtils');

const NGUONG_TY_LE_15_LCS = 0.15;

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
 * 2 ký tự đầu của mã thẻ BHYT (VD "TC3010124582880" -> "TC") — mã đối tượng tham gia,
 * dùng làm 1 nửa khóa tra BenefitRateCatalog (xem buildBenefitRateMap bên dưới). Trả về
 * null khi mã thẻ thiếu/quá ngắn thay vì đoán.
 */
function extractDoiTuongFromThe(maThe) {
  const trimmed = String(maThe || '').trim();
  if (trimmed.length < 2) return null;
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * LY_DO_VV/LY_DO_VNT là text tự do, mỗi bệnh viện ghi một kiểu khác nhau — chỉ
 * match theo từ khóa đã chuẩn hóa (bỏ dấu, viết thường), danh sách chưa đầy đủ.
 */
function matchesLyDoVv(errorRow, keywords) {
  const norm = normalizeText(errorRow.lyDoVv || '');
  return norm.length > 0 && keywords.some((keyword) => norm.includes(keyword));
}

function isCapCuu(errorRow) {
  return matchesLyDoVv(errorRow, LY_DO_VV_CAP_CUU_KEYWORDS);
}

function isTuDen(errorRow) {
  return matchesLyDoVv(errorRow, LY_DO_VV_TU_DEN_KEYWORDS);
}

/**
 * Mã đối tượng KCB dạng "X.Y" — nhóm "1" (1.1/1.2/1.3/...) là mã do bệnh viện tự
 * khai báo với cơ quan BHXH, luôn là đúng tuyến kể cả khi MA_DKBD khác MA_CSKCB
 * (VD 1.3 = tái khám theo giấy hẹn tại nơi đã được chuyển đến trước đó) — đáng tin
 * hơn suy luận từ so sánh MA_DKBD/MA_CSKCB nên được ưu tiên xét trước.
 */
function isDoiTuongDungTuyen(errorRow) {
  const nhom = String(errorRow.maDoiTuongKCB || '').trim().split('.')[0];
  return nhom === '1';
}

/**
 * Trái tuyến = nơi đăng ký KCB ban đầu (MA_DKBD) khác nơi khám thực tế
 * (MA_CSKCB) và không có giấy chuyển tuyến hợp lệ. Mã đối tượng KCB nhóm "1" hoặc
 * cấp cứu/tái khám theo LY_DO_VV luôn được coi là đúng tuyến bất kể MA_DKBD/
 * MA_CSKCB. Khi thiếu MA_DKBD/MA_CSKCB, dùng LY_DO_VV="tự đến" làm căn cứ phụ;
 * nếu vẫn không đủ dữ liệu, trả về null (không xác định được) thay vì đoán.
 */
function isTraiTuyen(errorRow) {
  if (isDoiTuongDungTuyen(errorRow)) return false;
  if (errorRow.giayChuyenTuyen) return false;
  if (isCapCuu(errorRow)) return false;
  if (matchesLyDoVv(errorRow, LY_DO_VV_DUNG_TUYEN_KEYWORDS)) return false;
  if (errorRow.maDkbd && errorRow.maCSKCB) {
    return normalizeText(errorRow.maDkbd) !== normalizeText(errorRow.maCSKCB);
  }
  if (isTuDen(errorRow)) return true;
  return null;
}

/**
 * Đúng tuyến theo ML018 — so sánh trực tiếp MA_DKBD với MA_CSKCB, KHÔNG xét giấy
 * chuyển tuyến/cấp cứu/mã đối tượng nhóm "1" như isTraiTuyen() ở trên (khác biệt
 * có chủ đích theo yêu cầu nghiệp vụ cho ngưỡng 15% LCS, xem checkMucHuongDungTuyen15Lcs).
 * Trả về null khi thiếu MA_DKBD/MA_CSKCB thay vì đoán.
 */
function isDungTuyenTheoMaDkbd(errorRow) {
  if (!errorRow.maDkbd || !errorRow.maCSKCB) return null;
  return normalizeText(errorRow.maDkbd) === normalizeText(errorRow.maCSKCB);
}

/**
 * Tra mức lương cơ sở (LCS) hiệu lực tại một ngày, theo MUC_LUONG_CO_SO_LICH_SU
 * (config/constants.js). Trả về null khi ngày thiếu hoặc không rơi vào giai đoạn
 * nào trong bảng (VD ngày quá cũ, trước mốc đầu tiên đã khai báo).
 */
function getMucLuongCoSo(ngay) {
  if (!ngay) return null;
  const moc = MUC_LUONG_CO_SO_LICH_SU.find((m) =>
    isDateInRange(ngay, new Date(m.tuNgay), m.denNgay ? new Date(m.denNgay) : null)
  );
  return moc ? moc.gia : null;
}

/**
 * Cộng dồn chi phí đề nghị BHYT thanh toán (THANH_TIEN_BH/deNghi) theo từng MA_LK
 * (một hồ sơ/lần khám có thể có nhiều dòng chi phí thuốc + DVKT/VTYT) — dùng làm
 * "chi phí cho một lần khám bệnh, chữa bệnh" để so ngưỡng 15% LCS (ML018). Đây là
 * xấp xỉ theo dữ liệu sẵn có (không có sẵn trường tổng chi phí cấp hồ sơ kiểu
 * T_TONGCHI trong dữ liệu đã parse) — nếu có nguồn chính xác hơn thì thay ở đây.
 */
function tinhTongChiPhiTheoLK(errorRows) {
  const map = new Map();
  for (const row of errorRows || []) {
    if (!row.maLK) continue;
    const deNghi = Number(row.deNghi) || 0;
    map.set(row.maLK, (map.get(row.maLK) || 0) + deNghi);
  }
  return map;
}

/**
 * ML018 — "Vào viện đúng tuyến, Chi phí >=15% TLCS, Bệnh viện đề nghị sai Mức
 * hưởng": khi đúng tuyến (MA_DKBD == MA_CSKCB) và tổng chi phí đợt KCB (cộng dồn
 * theo MA_LK, xem tinhTongChiPhiTheoLK) đạt từ 15% mức lương cơ sở tại NGAY_VAO
 * trở lên, dòng chi phí phải áp dụng đúng % mức hưởng chuẩn theo danh mục (không
 * được mặc định 100% — mặc định 100% chỉ đúng khi chi phí DƯỚI ngưỡng). Trả về
 * null khi trái tuyến, dưới ngưỡng, hoặc thiếu dữ liệu cần thiết (không đoán).
 */
function checkMucHuongDungTuyen15Lcs(errorRow, benefitRateMap, tongChiPhiByLK) {
  if (isDungTuyenTheoMaDkbd(errorRow) !== true) return null;

  const tongChiPhi = tongChiPhiByLK ? tongChiPhiByLK.get(errorRow.maLK) : null;
  if (tongChiPhi === null || tongChiPhi === undefined) return null;

  const mucLuongCoSo = getMucLuongCoSo(errorRow.ngayVao);
  if (mucLuongCoSo === null) return null;

  const nguong = NGUONG_TY_LE_15_LCS * mucLuongCoSo;
  if (tongChiPhi < nguong) return null;

  const benefitRow = lookupBenefitRate(errorRow, benefitRateMap);
  if (!benefitRow || benefitRow.chiTraDungTuyen === null || benefitRow.chiTraDungTuyen === undefined) {
    return null;
  }
  if (errorRow.mucHuong === null || errorRow.mucHuong === undefined) return null;

  const pctChuan = benefitRow.chiTraDungTuyen;
  if (Number(errorRow.mucHuong) === pctChuan) return null;

  const doiTuong = extractDoiTuongFromThe(errorRow.maThe);
  return `Hồ sơ đúng tuyến (MA_LK "${errorRow.maLK}"), tổng chi phí đợt KCB "${tongChiPhi}đ" đã đạt ngưỡng 15% mức lương cơ sở ("${Math.round(nguong)}đ"), nhưng mức hưởng đề nghị "${errorRow.mucHuong}%" không khớp mức hưởng chuẩn theo danh mục (mã đối tượng "${doiTuong}", đúng tuyến: chuẩn "${pctChuan}%")`;
}

/**
 * Builds a lookup map "mã đối tượng|MA_LOAI_KCB" -> BenefitRateCatalog row từ danh mục mức
 * hưởng theo đối tượng. Ghép khóa theo cả 2 cột (MA, NHOM) vì cùng 1 mã đối tượng có % chi
 * trả khác nhau tùy MA_LOAI_KCB (VD "HT" ứng với nhiều NHOM, mỗi NHOM 1 cặp % khác nhau).
 */
function buildBenefitRateMap(benefitRateRows) {
  const map = new Map();
  for (const row of benefitRateRows || []) {
    if (!row.ma || !row.nhom) continue;
    map.set(`${String(row.ma).trim().toUpperCase()}|${String(row.nhom).trim()}`, row);
  }
  return map;
}

/**
 * Tra % chi trả chuẩn theo BenefitRateCatalog bằng khóa (2 ký tự đầu MA_THE_BHYT, MA_LOAI_KCB
 * của dòng chi phí). Trả về null khi thiếu danh mục/dữ liệu cần thiết hoặc không khớp dòng nào
 * — checkMucHuong tự rơi về check tự-nhất-quán theo mã thẻ (extractMucHuongFromThe) khi đó.
 */
function lookupBenefitRate(errorRow, benefitRateMap) {
  if (!benefitRateMap || benefitRateMap.size === 0) return null;
  const doiTuong = extractDoiTuongFromThe(errorRow.maThe);
  const loaiKCB = String(errorRow.loaiKCB || '').trim();
  if (!doiTuong || !loaiKCB) return null;
  return benefitRateMap.get(`${doiTuong}|${loaiKCB}`) || null;
}

/**
 * Returns a ghi chú string for one of three data-verifiable signals, or null
 * when nothing to flag:
 *  1) Mức hưởng khai trên dòng chi phí (MUC_HUONG) không khớp % chuẩn tra theo
 *     BenefitRateCatalog (mã đối tượng + MA_LOAI_KCB), chọn cột đúng/trái tuyến
 *     theo isTraiTuyen — chỉ áp dụng khi có danh mục và xác định được tuyến.
 *  2) Mức hưởng khai trên dòng chi phí không khớp mã mức hưởng ghi trên chính
 *     mã thẻ BHYT của bệnh nhân — a self-consistency check, độc lập trái tuyến,
 *     dùng khi không tra được (1) ở trên.
 *  3) Hồ sơ trái tuyến nhưng tỷ lệ thanh toán BHYT đề nghị (TYLE_TT_BH) vẫn
 *     100% — flags for human review rather than asserting a specific correct
 *     %, since the actual trái-tuyến reduction rate depends on cấp/tuyến của
 *     cơ sở KCB (không có danh mục phân loại tuyến trong hệ thống) và quy
 *     định hiện hành có thể đã thay đổi theo Luật BHYT sửa đổi 2024.
 */
function checkMucHuong(errorRow, benefitRateMap) {
  const traiTuyen = isTraiTuyen(errorRow);
  const benefitRow = lookupBenefitRate(errorRow, benefitRateMap);
  const coMucHuongKhaiBao = errorRow.mucHuong !== null && errorRow.mucHuong !== undefined;

  // Khi tra được danh mục và xác định được tuyến, danh mục là nguồn đáng tin cậy hơn
  // check tự-nhất-quán theo mã thẻ bên dưới (mã thẻ chỉ cho 1 mức chung, không phân biệt
  // đúng/trái tuyến) — nên KHÔNG chạy tiếp check theo mã thẻ khi đã dùng được danh mục, để
  // tránh 2 check mâu thuẫn nhau trên cùng 1 dòng.
  if (benefitRow && traiTuyen !== null && coMucHuongKhaiBao) {
    const expected = traiTuyen ? benefitRow.chiTraTraiTuyen : benefitRow.chiTraDungTuyen;
    if (expected !== null && expected !== undefined && Number(errorRow.mucHuong) !== expected) {
      const doiTuong = extractDoiTuongFromThe(errorRow.maThe);
      return `Mức hưởng khai báo "${errorRow.mucHuong}%" không khớp mức hưởng chuẩn theo danh mục (mã đối tượng "${doiTuong}", MA_LOAI_KCB "${errorRow.loaiKCB}", ${traiTuyen ? 'trái tuyến' : 'đúng tuyến'}: chuẩn "${expected}%")`;
    }
  } else {
    const expectedMucHuong = extractMucHuongFromThe(errorRow.maThe);
    if (expectedMucHuong !== null && coMucHuongKhaiBao && Number(errorRow.mucHuong) !== expectedMucHuong) {
      return `Mức hưởng khai báo "${errorRow.mucHuong}%" không khớp mức hưởng theo mã thẻ BHYT "${errorRow.maThe}" (mã mức hưởng chuẩn "${expectedMucHuong}%")`;
    }
  }

  if (
    traiTuyen === true &&
    errorRow.tyLeTtBh !== null &&
    errorRow.tyLeTtBh !== undefined &&
    Number(errorRow.tyLeTtBh) >= 100
  ) {
    const canCu =
      errorRow.maDkbd && errorRow.maCSKCB
        ? `nơi đăng ký ban đầu "${errorRow.maDkbd}" khác nơi khám "${errorRow.maCSKCB}"`
        : `lý do vào viện "${errorRow.lyDoVv}"`;
    return `Hồ sơ trái tuyến (${canCu}, không có giấy chuyển tuyến) nhưng tỷ lệ thanh toán BHYT đề nghị vẫn "${errorRow.tyLeTtBh}%" — cần rà soát lại mức giảm trừ trái tuyến theo quy định hiện hành`;
  }

  return null;
}

module.exports = {
  extractMucHuongFromThe,
  extractDoiTuongFromThe,
  isCapCuu,
  isTuDen,
  isDoiTuongDungTuyen,
  isTraiTuyen,
  isDungTuyenTheoMaDkbd,
  getMucLuongCoSo,
  tinhTongChiPhiTheoLK,
  buildBenefitRateMap,
  lookupBenefitRate,
  checkMucHuong,
  checkMucHuongDungTuyen15Lcs,
};

const {
  KET_LUAN,
  LOAI_CHI_PHI,
  REJECT_REASON_CATEGORY,
  MA_LOI_AP_DUNG_TRUONG,
  BAC_SI_KEYWORDS,
  NGAY_SINH_KEYWORDS,
  HO_TEN_KEYWORDS,
  GIOI_TINH_KEYWORDS,
  NGAY_GIUONG_KEYWORDS,
  KHAM_TRUNG_LAP_KEYWORDS,
  NHOM_DVKT_KEYWORDS,
  MUC_HUONG_KEYWORDS,
  MUC_HUONG_DUNG_TUYEN_KEYWORDS,
} = require('../config/constants');
const { isDateInRange } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/normalizeText');

// Maps a reconciliation conclusion to the "nhómLỗi" category used as the broad/fallback
// bucket when a mã lỗi isn't pinned to a specific field via apDungTruong.
function ketLuanToNhomLoi(ketLuan) {
  if (ketLuan === KET_LUAN.KHONG_TIM_THAY || ketLuan === KET_LUAN.LECH_DU_LIEU) {
    return REJECT_REASON_CATEGORY.SAI_DANH_MUC;
  }
  return null;
}

// Builds two indexes: `byField` for mã lỗi pinned to one exact mismatch kind
// (a chiTietLech "truong" label, or KHONG_TIM_THAY), and `byNhomLoi` for untagged
// mã lỗi that still apply broadly to every row in that nhómLỗi (kept only as a
// fallback so legacy/untagged data still predicts something).
function buildErrorCodeIndex(errorCodeRows) {
  const byField = new Map();
  const byNhomLoi = new Map();
  const active = [];

  for (const row of errorCodeRows) {
    if (!row.active) continue;
    active.push(row);

    if (row.apDungTruong) {
      if (!byField.has(row.apDungTruong)) byField.set(row.apDungTruong, []);
      byField.get(row.apDungTruong).push(row);
    } else {
      if (!byNhomLoi.has(row.nhomLoi)) byNhomLoi.set(row.nhomLoi, []);
      byNhomLoi.get(row.nhomLoi).push(row);
    }
  }

  return { byField, byNhomLoi, active };
}

function toWarning(row) {
  return { maLoi: row.maLoi, tenLoi: row.tenLoi, dienGiai: row.dienGiai, mucDo: row.mucDo };
}

function activeOn(rows, ngayYLenh) {
  return rows.filter((row) => !ngayYLenh || isDateInRange(ngayYLenh, row.tuNgay, row.denNgay));
}

/**
 * result: { ketLuan, chiTietLech, loai } from reconcileRow. For LECH_DU_LIEU, each
 * chiTietLech entry is matched against mã lỗi tagged with its `apDungTruongTag` when
 * present (donGia diffs — see priceDiffTag in compareFields.js, scoped to loại chi
 * phí + chiều lệch), else its plain `truong` label (e.g. "Hàm lượng"), so a price
 * mismatch and a hàm lượng mismatch surface distinct codes instead of one blanket
 * "sai danh mục" warning.
 * KHONG_TIM_THAY is matched against a tag scoped to `loai` — KHONG_TIM_THAY_VAT_TU,
 * KHONG_TIM_THAY_THUOC, or KHONG_TIM_THAY_DVKT — instead of the generic
 * KHONG_TIM_THAY tag, and does NOT fall back to it, so e.g. a thuốc-not-found row
 * predicts only thuốc-specific mã lỗi (ML012) rather than every KHONG_TIM_THAY-tagged
 * code regardless of loại chi phí (which used to also pull in ML003, DVKT's code).
 * Untagged mã lỗi in the row's nhómLỗi are only used when nothing more specific matched.
 */
function predictErrorCode({ ketLuan, chiTietLech, loai }, errorCodeIndex, ngayYLenh) {
  const nhomLoi = ketLuanToNhomLoi(ketLuan);
  if (!nhomLoi) return [];

  const matched = new Map(); // maLoi -> warning, de-duplicated

  function addAll(rows) {
    for (const row of activeOn(rows, ngayYLenh)) {
      matched.set(row.maLoi, toWarning(row));
    }
  }

  const KHONG_TIM_THAY_TAG_BY_LOAI = {
    [LOAI_CHI_PHI.VAT_TU]: MA_LOI_AP_DUNG_TRUONG.KHONG_TIM_THAY_VAT_TU,
    [LOAI_CHI_PHI.THUOC]: MA_LOI_AP_DUNG_TRUONG.KHONG_TIM_THAY_THUOC,
    [LOAI_CHI_PHI.DICH_VU]: MA_LOI_AP_DUNG_TRUONG.KHONG_TIM_THAY_DVKT,
  };

  if (ketLuan === KET_LUAN.KHONG_TIM_THAY) {
    const tag = KHONG_TIM_THAY_TAG_BY_LOAI[loai] || MA_LOI_AP_DUNG_TRUONG.KHONG_TIM_THAY;
    addAll(errorCodeIndex.byField.get(tag) || []);
    if (matched.size === 0) addAll(errorCodeIndex.byNhomLoi.get(nhomLoi) || []);
    return [...matched.values()];
  }

  // LECH_DU_LIEU: try to match each mismatched field specifically first. A diff can
  // carry a more granular apDungTruongTag (e.g. donGia's DON_GIA_THUOC_CAO_HON — see
  // compareFields.js/priceDiffTag) instead of its plain display `truong` label, so a
  // mã lỗi scoped to loại chi phí + chiều lệch doesn't get pulled in for every kind of
  // "Đơn giá" mismatch regardless of loại/chiều.
  const tagList = [...new Set((chiTietLech || []).map((d) => d.apDungTruongTag || d.truong))];
  for (const tag of tagList) {
    const specific = errorCodeIndex.byField.get(tag) || [];
    addAll(specific);
  }

  if (matched.size === 0) addAll(errorCodeIndex.byNhomLoi.get(nhomLoi) || []);

  return [...matched.values()];
}

function matchesKeyword(row, keywords) {
  const norm = normalizeText(`${row.tenLoi} ${row.dienGiai || ''}`);
  return keywords.some((keyword) => norm.includes(keyword));
}

// Shared by predictBacSiErrorCode and friends below: these checks (checkBacSi.js,
// checkNhomDvkt.js, ...) are orthogonal to chi phí catalog matching — they can fire
// on any ketLuan, including KHONG_LIEN_QUAN_DANH_MUC — so they're predicted
// separately rather than folded into predictErrorCode above. Matches
// mã lỗi either explicitly tagged apDungTruong = fieldTag, or whose tên/diễn giải
// text mentions one of `keywords` — so existing, untagged mã lỗi catalogs link up
// without the admin having to manually tag them first. No nhómLỗi-wide fallback:
// an untagged "sai danh mục" code unrelated to this check would be a misleading guess.
function predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, fieldTag, keywords) {
  const tagged = errorCodeIndex.byField.get(fieldTag) || [];
  const byKeyword = (errorCodeIndex.active || []).filter((row) => matchesKeyword(row, keywords));

  const matched = new Map();
  for (const row of activeOn([...tagged, ...byKeyword], ngayYLenh)) {
    matched.set(row.maLoi, toWarning(row));
  }
  return [...matched.values()];
}

function predictBacSiErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.MA_BAC_SI, BAC_SI_KEYWORDS);
}

function predictNgaySinhErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.NGAY_SINH, NGAY_SINH_KEYWORDS);
}

function predictHoTenErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.HO_TEN, HO_TEN_KEYWORDS);
}

function predictGioiTinhErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.GIOI_TINH, GIOI_TINH_KEYWORDS);
}

function predictNgayGiuongErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.NGAY_GIUONG, NGAY_GIUONG_KEYWORDS);
}

function predictKhamTrungLapErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(
    errorCodeIndex,
    ngayYLenh,
    MA_LOI_AP_DUNG_TRUONG.KHAM_TRUNG_LAP,
    KHAM_TRUNG_LAP_KEYWORDS
  );
}

function predictNhomDvktErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.NHOM_DVKT, NHOM_DVKT_KEYWORDS);
}

function predictMucHuongErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(errorCodeIndex, ngayYLenh, MA_LOI_AP_DUNG_TRUONG.MUC_HUONG, MUC_HUONG_KEYWORDS);
}

function predictMucHuongDungTuyenErrorCode(errorCodeIndex, ngayYLenh) {
  return predictByFieldOrKeyword(
    errorCodeIndex,
    ngayYLenh,
    MA_LOI_AP_DUNG_TRUONG.MUC_HUONG_DUNG_TUYEN,
    MUC_HUONG_DUNG_TUYEN_KEYWORDS
  );
}

module.exports = {
  buildErrorCodeIndex,
  predictErrorCode,
  predictBacSiErrorCode,
  predictNgaySinhErrorCode,
  predictHoTenErrorCode,
  predictGioiTinhErrorCode,
  predictNgayGiuongErrorCode,
  predictKhamTrungLapErrorCode,
  predictNhomDvktErrorCode,
  predictMucHuongErrorCode,
  predictMucHuongDungTuyenErrorCode,
};

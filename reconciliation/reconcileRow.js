const { classifyChiPhi } = require('./classifyChiPhi');
const { findValidCatalogRow } = require('./matchCatalogRow');
const { compareDrugFields, compareServiceFields, compareVatTuFields } = require('./compareFields');
const { classifyRejectReason } = require('./classifyRejectReason');
const { checkBacSi } = require('./checkBacSi');
const { checkNhomDvkt } = require('./checkNhomDvkt');
const { checkMucHuong } = require('./checkMucHuong');
const { KET_LUAN, LOAI_CHI_PHI, REJECT_REASON_CATEGORY } = require('../config/constants');

function pickCandidateSetForRow(errorRow, catalogIndex) {
  const loai = classifyChiPhi(errorRow.loaiChiPhi);
  const byLoai = {
    [LOAI_CHI_PHI.THUOC]: {
      candidates: catalogIndex.drugByCode.get(errorRow.maChiPhi) || [],
      compareFn: compareDrugFields,
    },
    [LOAI_CHI_PHI.DICH_VU]: {
      candidates: catalogIndex.serviceByCode.get(errorRow.maChiPhi) || [],
      compareFn: compareServiceFields,
    },
    [LOAI_CHI_PHI.VAT_TU]: {
      candidates: (catalogIndex.vatTuByCode || new Map()).get(errorRow.maChiPhi) || [],
      compareFn: compareVatTuFields,
    },
  };

  if (byLoai[loai]) {
    return { ...byLoai[loai], ghiChu: [], loai };
  }

  // "Loại chi phí" text didn't match a known keyword — fall back to whichever
  // catalog(s) actually have the code, so the row can still be reconciled.
  // Priority (thuốc > dịch vụ > vật tư) only matters when the code collides
  // across more than one catalog.
  const ghiChu = ['Không xác định được loại chi phí (thuốc/dịch vụ/vật tư) từ "Loại chi phí"'];
  const priority = [LOAI_CHI_PHI.THUOC, LOAI_CHI_PHI.DICH_VU, LOAI_CHI_PHI.VAT_TU];
  const matches = priority.filter((l) => byLoai[l].candidates.length > 0);

  if (matches.length > 1) {
    ghiChu.push('Mã chi phí tồn tại ở nhiều hơn 1 danh mục (thuốc/dịch vụ/vật tư), đã ưu tiên danh mục thuốc');
  }

  const picked = matches[0];
  if (!picked) {
    return { candidates: [], compareFn: compareDrugFields, ghiChu, loai };
  }
  return { ...byLoai[picked], ghiChu, loai: picked };
}

function pickWithoutDateFilter(candidates) {
  const sorted = [...candidates].sort((a, b) => b.tuNgay.getTime() - a.tuNgay.getTime());
  return { row: sorted[0], ambiguous: candidates.length > 1 };
}

// VatTuCatalogMaster carries no tuNgay/denNgay (no bidding-date validity window
// modeled for VTYT — see VatTuCatalogMaster.js), so candidates are never date-
// filtered; ties (same mã vật tư across multiple TT_THAU/MA_CSKCB rows) break on
// most-recently-updated.
function pickVatTuCandidate(candidates) {
  if (candidates.length === 1) return { row: candidates[0], ambiguous: false };
  const sorted = [...candidates].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return { row: sorted[0], ambiguous: true };
}

function reconcileChiPhiRow(errorRow, catalogIndex) {
  const { candidates, compareFn, ghiChu, loai } = pickCandidateSetForRow(errorRow, catalogIndex);
  const { category: rejectReasonCategory } = classifyRejectReason(errorRow.lyDoTuChoi);

  if (!candidates || candidates.length === 0) {
    return {
      ketLuan: KET_LUAN.KHONG_TIM_THAY,
      chiTietLech: [],
      rejectReasonCategory,
      loai,
      ghiChu: [
        ...ghiChu,
        'Mã chi phí không có trong danh mục bệnh viện — có thể mã thầu đã hết hạn hoặc nhập sai mã',
      ],
    };
  }

  let row;
  let ambiguous = false;
  let matchedCount = candidates.length;

  if (loai === LOAI_CHI_PHI.VAT_TU) {
    ({ row, ambiguous } = pickVatTuCandidate(candidates));
  } else if (!errorRow.ngayYLenh) {
    ghiChu.push('Thiếu Ngày y lệnh, không thể lọc theo thời hạn hiệu lực của danh mục');
    ({ row, ambiguous } = pickWithoutDateFilter(candidates));
  } else {
    ({ row, ambiguous, matchedCount } = findValidCatalogRow(candidates, errorRow.ngayYLenh));
  }

  if (!row) {
    return {
      ketLuan: KET_LUAN.KHONG_TIM_THAY,
      chiTietLech: [],
      rejectReasonCategory,
      loai,
      ghiChu: [
        ...ghiChu,
        'Có mã trong danh mục nhưng không còn hiệu lực tại Ngày y lệnh (mã thầu có thể đã hết hạn)',
      ],
    };
  }

  if (ambiguous) {
    if (loai === LOAI_CHI_PHI.VAT_TU) {
      ghiChu.push(`Có ${candidates.length} dòng vật tư cùng mã, đã chọn dòng cập nhật gần nhất`);
    } else {
      ghiChu.push(
        `Có ${matchedCount} dòng danh mục cùng hiệu lực, đã chọn dòng có TU_NGAY/TT_THAU mới nhất`
      );
    }
  }

  const chiTietLech = compareFn(errorRow, row);

  if (rejectReasonCategory === REJECT_REASON_CATEGORY.VUOT_DINH_MUC) {
    ghiChu.push('Cần bổ sung dữ liệu định mức/trần thanh toán để xác nhận nguyên nhân giảm trừ');
  } else if (rejectReasonCategory === REJECT_REASON_CATEGORY.SAI_QUY_TAC_THANH_TOAN) {
    ghiChu.push(
      'Lý do giảm trừ liên quan quy tắc thanh toán BHYT, ngoài phạm vi đối chiếu danh mục'
    );
  }

  const ketLuan =
    chiTietLech.length > 0 ? KET_LUAN.LECH_DU_LIEU : KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC;

  return { ketLuan, chiTietLech, rejectReasonCategory, loai, ghiChu };
}

// Mã bác sĩ hợp lệ (theo mã CCHN), mã nhóm DVKT (vs. ServiceGroupCatalog), and mức
// hưởng/trái tuyến are independent checks from chi phí catalog matching, so they're
// layered on as extra ghi chú rather than folded into pickCandidateSetForRow/ketLuan
// above — keeps ketLuan's existing meaning (per README) untouched.
//
// Thẻ sai họ tên/ngày sinh (ML019/ML011) KHÔNG nằm ở đây nữa — check tự-nhất-quán
// theo CCCD cũ đã bị bỏ vì sai bản chất (ML011 phải so với CSDL thẻ BHYT của BHXH,
// không thể suy từ CCCD). Đang chuyển sang gọi API cổng BHXH thật (xem
// services/bhxhEgwService.js) — chưa fold vào batch reconciliation vì còn chờ xác
// nhận response mẫu + chính sách gọi (tự động dedupe theo mã thẻ hay theo yêu cầu).
function reconcileRow(errorRow, catalogIndex) {
  const result = reconcileChiPhiRow(errorRow, catalogIndex);

  const bacSiNote = checkBacSi(errorRow, catalogIndex.doctorSet);
  result.bacSiMismatch = Boolean(bacSiNote);
  if (bacSiNote) {
    result.ghiChu = [...result.ghiChu, bacSiNote];
  }

  const nhomDvktNote = checkNhomDvkt(errorRow, catalogIndex.serviceGroupByMa);
  result.nhomDvktMismatch = Boolean(nhomDvktNote);
  if (nhomDvktNote) {
    result.ghiChu = [...result.ghiChu, nhomDvktNote];
  }

  const mucHuongNote = checkMucHuong(errorRow, catalogIndex.benefitRateByMa);
  result.mucHuongMismatch = Boolean(mucHuongNote);
  if (mucHuongNote) {
    result.ghiChu = [...result.ghiChu, mucHuongNote];
  }

  return result;
}

module.exports = { reconcileRow };

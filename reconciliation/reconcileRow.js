const { classifyChiPhi } = require('./classifyChiPhi');
const { findValidCatalogRow } = require('./matchCatalogRow');
const { compareDrugFields, compareServiceFields } = require('./compareFields');
const { classifyRejectReason } = require('./classifyRejectReason');
const { checkBacSi } = require('./checkBacSi');
const { checkNgaySinh } = require('./checkNgaySinh');
const { KET_LUAN, LOAI_CHI_PHI, REJECT_REASON_CATEGORY } = require('../config/constants');

function pickCandidateSetForRow(errorRow, catalogIndex) {
  const loai = classifyChiPhi(errorRow.loaiChiPhi);
  const drugCandidates = catalogIndex.drugByCode.get(errorRow.maChiPhi) || [];
  const serviceCandidates = catalogIndex.serviceByCode.get(errorRow.maChiPhi) || [];

  if (loai === LOAI_CHI_PHI.THUOC) {
    return { candidates: drugCandidates, compareFn: compareDrugFields, ghiChu: [] };
  }
  if (loai === LOAI_CHI_PHI.DICH_VU) {
    return { candidates: serviceCandidates, compareFn: compareServiceFields, ghiChu: [] };
  }

  // "Loại chi phí" text didn't match a known keyword — fall back to whichever
  // catalog actually has the code, so the row can still be reconciled.
  const ghiChu = ['Không xác định được loại chi phí (thuốc/dịch vụ) từ "Loại chi phí"'];
  if (drugCandidates.length > 0 && serviceCandidates.length === 0) {
    return { candidates: drugCandidates, compareFn: compareDrugFields, ghiChu };
  }
  if (serviceCandidates.length > 0 && drugCandidates.length === 0) {
    return { candidates: serviceCandidates, compareFn: compareServiceFields, ghiChu };
  }
  if (drugCandidates.length > 0 && serviceCandidates.length > 0) {
    ghiChu.push('Mã chi phí tồn tại ở cả hai danh mục thuốc và dịch vụ, đã ưu tiên danh mục thuốc');
    return { candidates: drugCandidates, compareFn: compareDrugFields, ghiChu };
  }
  return { candidates: [], compareFn: compareDrugFields, ghiChu };
}

function pickWithoutDateFilter(candidates) {
  const sorted = [...candidates].sort((a, b) => b.tuNgay.getTime() - a.tuNgay.getTime());
  return { row: sorted[0], ambiguous: candidates.length > 1 };
}

function reconcileChiPhiRow(errorRow, catalogIndex) {
  const { candidates, compareFn, ghiChu } = pickCandidateSetForRow(errorRow, catalogIndex);
  const { category: rejectReasonCategory } = classifyRejectReason(errorRow.lyDoTuChoi);

  if (!candidates || candidates.length === 0) {
    return {
      ketLuan: KET_LUAN.KHONG_TIM_THAY,
      chiTietLech: [],
      rejectReasonCategory,
      ghiChu: [
        ...ghiChu,
        'Mã chi phí không có trong danh mục bệnh viện — có thể mã thầu đã hết hạn hoặc nhập sai mã',
      ],
    };
  }

  let row;
  let ambiguous = false;
  let matchedCount = candidates.length;

  if (!errorRow.ngayYLenh) {
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
      ghiChu: [
        ...ghiChu,
        'Có mã trong danh mục nhưng không còn hiệu lực tại Ngày y lệnh (mã thầu có thể đã hết hạn)',
      ],
    };
  }

  if (ambiguous) {
    ghiChu.push(
      `Có ${matchedCount} dòng danh mục cùng hiệu lực, đã chọn dòng có TU_NGAY/TT_THAU mới nhất`
    );
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

  return { ketLuan, chiTietLech, rejectReasonCategory, ghiChu };
}

// Mã bác sĩ hợp lệ (theo mã CCHN) and ngày sinh (vs. số CCCD) are independent checks
// from chi phí catalog matching, so they're layered on as extra ghi chú rather than
// folded into pickCandidateSetForRow/ketLuan above — keeps ketLuan's
// existing meaning (per README) untouched.
function reconcileRow(errorRow, catalogIndex) {
  const result = reconcileChiPhiRow(errorRow, catalogIndex);

  const bacSiNote = checkBacSi(errorRow, catalogIndex.doctorSet);
  result.bacSiMismatch = Boolean(bacSiNote);
  if (bacSiNote) {
    result.ghiChu = [...result.ghiChu, bacSiNote];
  }

  const ngaySinhNote = checkNgaySinh(errorRow);
  result.ngaySinhMismatch = Boolean(ngaySinhNote);
  if (ngaySinhNote) {
    result.ghiChu = [...result.ghiChu, ngaySinhNote];
  }

  return result;
}

module.exports = { reconcileRow };

const { reconcileRow } = require('./reconcileRow');
const { checkNgayGiuongBatch } = require('./checkNgayGiuong');
const { checkKhamBenhBatch, isKhamBenhRow } = require('./checkKhamBenh');
const { checkMucHuongDungTuyen15Lcs, tinhTongChiPhiTheoLK } = require('./checkMucHuong');
const { KET_LUAN } = require('../config/constants');

function reconcileBatch(errorRows, catalogIndex) {
  const giuongNotes = checkNgayGiuongBatch(errorRows);
  const khamNotes = checkKhamBenhBatch(errorRows);
  const tongChiPhiByLK = tinhTongChiPhiTheoLK(errorRows);

  return errorRows.map((errorRow) => {
    try {
      const result = reconcileRow(errorRow, catalogIndex);

      // Only the giường-line rows themselves carry the flag — not every row of the
      // hồ sơ — so it surfaces right next to the bed charges it's actually about.
      const giuongNote = errorRow.maGiuong ? giuongNotes.get(errorRow.maLK) : undefined;
      result.ngayGiuongMismatch = Boolean(giuongNote);
      if (giuongNote) {
        result.ghiChu = [...result.ghiChu, giuongNote];
      }

      // Same idea: only the duplicated khám bệnh rows themselves carry the flag.
      const khamNote =
        errorRow.maLK && errorRow.maChiPhi && isKhamBenhRow(errorRow)
          ? khamNotes.get(`${errorRow.maLK}|${errorRow.maChiPhi}`)
          : undefined;
      result.khamTrungLapMismatch = Boolean(khamNote);
      if (khamNote) {
        result.ghiChu = [...result.ghiChu, khamNote];
      }

      const mucHuongDungTuyenNote = checkMucHuongDungTuyen15Lcs(
        errorRow,
        catalogIndex.benefitRateByMa,
        tongChiPhiByLK
      );
      result.mucHuongDungTuyenMismatch = Boolean(mucHuongDungTuyenNote);
      if (mucHuongDungTuyenNote) {
        result.ghiChu = [...result.ghiChu, mucHuongDungTuyenNote];
      }

      return { errorRow, result, error: null };
    } catch (err) {
      return {
        errorRow,
        result: {
          ketLuan: KET_LUAN.KHONG_TIM_THAY,
          chiTietLech: [],
          rejectReasonCategory: undefined,
          ghiChu: [`Lỗi xử lý dòng: ${err.message}`],
        },
        error: err.message,
      };
    }
  });
}

module.exports = { reconcileBatch };

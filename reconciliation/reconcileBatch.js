const { reconcileRow } = require('./reconcileRow');
const { KET_LUAN } = require('../config/constants');

function reconcileBatch(errorRows, catalogIndex) {
  return errorRows.map((errorRow) => {
    try {
      return { errorRow, result: reconcileRow(errorRow, catalogIndex), error: null };
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

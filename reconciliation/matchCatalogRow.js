const { isDateInRange } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/normalizeText');

function valueEquals(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return Boolean(na) && na === nb;
}

/**
 * Thu hẹp candidates về đúng giá trị `value` (đọc qua getField) trên hồ sơ, nếu
 * tìm được ít nhất 1 dòng khớp. Nếu hồ sơ không có giá trị đó, hoặc không dòng nào
 * trong candidates khớp, giữ nguyên toàn bộ candidates — để bước sau (lọc theo ngày
 * + compareDrugFields) tự báo lệch field này như cũ (đúng thực tế: hồ sơ dùng 1 giá
 * trị không có trong danh mục cùng mã thuốc).
 */
function narrowByField(candidates, value, getField, label) {
  if (!value) return { candidates, narrowed: false, noMatchLabel: null };
  const matched = candidates.filter((row) => valueEquals(getField(row), value));
  if (matched.length === 0) return { candidates, narrowed: false, noMatchLabel: label };
  return { candidates: matched, narrowed: matched.length < candidates.length, noMatchLabel: null };
}

/**
 * Cùng 1 mã thuốc nội bộ của viện thường có nhiều dòng danh mục khác NHAU về Số
 * đăng ký và/hoặc TT_THAU (mỗi đợt thầu/lô hàng một số đăng ký + mã trúng thầu
 * riêng, có thể khác cả đơn giá) nhưng lại giống nhau ở hầu hết field khác (tên
 * thuốc, hàm lượng, đơn vị tính...), nên chỉ lọc theo mã + hiệu lực ngày
 * (findValidCatalogRow) có thể chọn nhầm dòng — hồ sơ XML đang dùng đúng 1 dòng có
 * thật trong danh mục, nhưng bị so với dòng khác (cùng mã, khác số đăng ký/TT_THAU),
 * gây báo lệch giả.
 *
 * Thu hẹp candidates dần theo Số đăng ký rồi TT_THAU (mỗi bước chỉ áp dụng khi thu
 * hẹp thành công — không tìm được thì giữ nguyên tập trước đó, xem narrowByField).
 * ghiChu tổng hợp lại các bước có tác dụng (thu hẹp được) hoặc không khớp gì cả, để
 * caller (reconcileRow.js) gắn vào kết quả đối chiếu.
 */
function narrowDrugCandidates(candidates, errorRow) {
  const ghiChu = [];
  let current = candidates;

  const soDangKyStep = narrowByField(current, errorRow.soDangKy, (row) => row.soDangKy, 'Số đăng ký');
  if (soDangKyStep.narrowed) {
    ghiChu.push(
      `Mã thuốc có ${current.length} dòng khác Số đăng ký trong danh mục, đã chọn đúng dòng theo Số đăng ký trên hồ sơ`
    );
  } else if (soDangKyStep.noMatchLabel) {
    ghiChu.push(
      `Số đăng ký trên hồ sơ ("${errorRow.soDangKy}") không khớp dòng nào trong danh mục cùng mã thuốc — đối chiếu tạm theo dòng khác cùng mã`
    );
  }
  current = soDangKyStep.candidates;

  const ttThauStep = narrowByField(current, errorRow.ttThau, (row) => row.ttThau, 'TT_THAU');
  if (ttThauStep.narrowed) {
    ghiChu.push(
      `Cùng Số đăng ký còn ${current.length} dòng khác TT_THAU (đợt thầu) trong danh mục, đã chọn đúng dòng theo TT_THAU trên hồ sơ`
    );
  } else if (ttThauStep.noMatchLabel) {
    ghiChu.push(
      `TT_THAU trên hồ sơ ("${errorRow.ttThau}") không khớp dòng nào trong danh mục cùng mã thuốc — đối chiếu tạm theo dòng khác cùng mã`
    );
  }
  current = ttThauStep.candidates;

  return { candidates: current, ghiChu };
}

/**
 * Given all catalog rows sharing a code (not yet filtered by date) and the
 * error row's "Ngày y lệnh", picks the catalog row whose validity window
 * [tuNgay, denNgay] (denNgay null = open-ended/still valid) contains that date.
 *
 * If more than one candidate is valid on that date (overlapping bidding
 * periods / duplicate data), the one with the latest tuNgay is chosen
 * deterministically, and `ambiguous: true` is set so the caller can surface
 * a warning without failing the whole reconciliation.
 */
function findValidCatalogRow(candidates, ngayYLenh) {
  if (!candidates || candidates.length === 0) {
    return { row: null, ambiguous: false, matchedCount: 0 };
  }

  const validRows = candidates.filter((row) => isDateInRange(ngayYLenh, row.tuNgay, row.denNgay));

  if (validRows.length === 0) {
    return { row: null, ambiguous: false, matchedCount: 0 };
  }

  if (validRows.length === 1) {
    return { row: validRows[0], ambiguous: false, matchedCount: 1 };
  }

  const sorted = [...validRows].sort((a, b) => b.tuNgay.getTime() - a.tuNgay.getTime());
  return { row: sorted[0], ambiguous: true, matchedCount: validRows.length };
}

module.exports = { findValidCatalogRow, narrowDrugCandidates };

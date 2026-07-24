const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// Ngày giường (bed-day) charges live across many DVKT rows of the same hồ sơ (one row
// per day, occasionally split 0.5/0.5 on a ward-transfer day) — MA_GIUONG non-empty is
// the reliable "this line is a bed charge" signal (unlike keyword-matching TEN_DICH_VU).
function sumGiuongSoLuong(rows) {
  return rows.reduce((sum, row) => {
    if (!row.maGiuong) return sum;
    const soLuong = Number(row.soLuong);
    return sum + (Number.isNaN(soLuong) ? 0 : soLuong);
  }, 0);
}

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Công thức mặc định theo Thông tư 22/2023/TT-BYT, Điều 6: số ngày điều trị = ngày ra -
// ngày vào (KHÔNG +1), trừ trường hợp nằm viện dưới 24h (tính 1 ngày nếu >4h đến <24h,
// 0 ngày nếu ≤4h). KHÔNG áp dụng ở đây phần "+1" dành cho trường hợp đặc biệt (tử vong,
// nặng xin về, chuyển tuyến trên...) hay tỷ lệ % ngày đầu theo giờ vào viện — cả hai đều
// cần đọc KET_QUA_DTRI/MA_LOAI_RV theo danh mục dùng chung mà hệ thống chưa có bảng tra
// đáng tin cậy, nên để người dùng tự đối chiếu giấy ra viện qua ghi chú thay vì đoán mã.
function computeExpectedNgayDieuTri(ngayVao, ngayRa) {
  if (!ngayVao || !ngayRa) return null;
  const hours = (ngayRa.getTime() - ngayVao.getTime()) / MS_PER_HOUR;
  if (hours <= 4) return 0;
  if (hours < 24) return 1;
  return Math.round((startOfUtcDay(ngayRa) - startOfUtcDay(ngayVao)) / MS_PER_DAY);
}

/**
 * Returns a Map<maLK, ghi chú> for hồ sơ whose tổng số ngày giường đã billing VƯỢT QUÁ
 * số ngày điều trị tính theo công thức mặc định (ngày ra - ngày vào nội trú, không +1).
 * Chỉ báo khi billing NHIỀU HƠN công thức (khả năng tính thừa "+1") — billing ÍT hơn
 * không bị flag vì có nhiều lý do hợp lệ (chuyển viện tạm thời, gián đoạn nằm viện...)
 * mà công thức đơn giản này không mô hình hoá được, nên không phải dấu hiệu sai phạm.
 * Không tự động loại trừ trường hợp đặc biệt được +1 — ghi chú kèm KET_QUA_DTRI/
 * MA_LOAI_RV thô để người dùng tự đối chiếu giấy ra viện.
 */
function checkNgayGiuongBatch(errorRows) {
  const byMaLK = new Map();
  for (const row of errorRows) {
    if (!row.maLK) continue;
    if (!byMaLK.has(row.maLK)) byMaLK.set(row.maLK, []);
    byMaLK.get(row.maLK).push(row);
  }

  const notes = new Map();
  for (const [maLK, rows] of byMaLK) {
    const tongNgayGiuong = sumGiuongSoLuong(rows);
    if (tongNgayGiuong === 0) continue;

    const header = rows.find((r) => r.ngayRa && (r.ngayVaoNoiTru || r.ngayVao));
    if (!header) continue;

    const ngayVao = header.ngayVaoNoiTru || header.ngayVao;
    const expected = computeExpectedNgayDieuTri(ngayVao, header.ngayRa);
    if (expected === null || tongNgayGiuong <= expected + 0.01) continue;

    const parts = [
      `Tổng số ngày giường đã thanh toán (${tongNgayGiuong}) vượt số ngày điều trị tính theo công thức mặc định "ngày ra - ngày vào, không +1" (${expected})`,
    ];
    if (header.soNgayDieuTri !== null && header.soNgayDieuTri !== undefined) {
      parts.push(`SO_NGAY_DTRI khai báo: ${header.soNgayDieuTri}`);
    }
    if (header.ketQuaDieuTri) parts.push(`KET_QUA_DTRI=${header.ketQuaDieuTri}`);
    if (header.maLoaiRaVien) parts.push(`MA_LOAI_RV=${header.maLoaiRaVien}`);
    parts.push('cần đối chiếu giấy ra viện xem có thuộc trường hợp đặc biệt được +1 hay không');

    notes.set(maLK, parts.join(' — '));
  }
  return notes;
}

module.exports = { sumGiuongSoLuong, computeExpectedNgayDieuTri, checkNgayGiuongBatch };

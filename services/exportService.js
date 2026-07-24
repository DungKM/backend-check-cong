const ExcelJS = require('exceljs');
const { getResults } = require('./reconciliationService');

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
}

async function exportAnalysisToExcel(batchId) {
  const results = await getResults(batchId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Kết quả đối chiếu');

  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã BN', key: 'maBN', width: 12 },
    { header: 'Họ tên', key: 'hoTen', width: 22 },
    { header: 'Mã khoa', key: 'maKhoa', width: 10 },
    { header: 'Mã bác sĩ', key: 'maBacSi', width: 10 },
    { header: 'Loại chi phí', key: 'loaiChiPhi', width: 18 },
    { header: 'Mã chi phí', key: 'maChiPhi', width: 12 },
    { header: 'Tên chi phí', key: 'tenChiPhi', width: 26 },
    { header: 'Đề nghị', key: 'deNghi', width: 12 },
    { header: 'Giảm trừ', key: 'giamTru', width: 12 },
    { header: 'Ngày y lệnh', key: 'ngayYLenh', width: 12 },
    { header: 'Lý do từ chối', key: 'lyDoTuChoi', width: 30 },
    { header: 'Loại giảm trừ', key: 'loaiGiamTru', width: 18 },
    { header: 'Kết luận đối chiếu', key: 'ketLuan', width: 22 },
    { header: 'Chi tiết lệch', key: 'chiTietLech', width: 40 },
    { header: 'Mã lỗi dự đoán', key: 'duDoanMaLoi', width: 30 },
    { header: 'Ghi chú', key: 'ghiChu', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of results) {
    const row = r.errorRow || {};
    sheet.addRow({
      stt: row.stt,
      maBN: row.maBN,
      hoTen: row.hoTen,
      maKhoa: row.maKhoa,
      maBacSi: row.maBacSi,
      loaiChiPhi: row.loaiChiPhi,
      maChiPhi: row.maChiPhi,
      tenChiPhi: row.tenChiPhi,
      deNghi: row.deNghi,
      giamTru: row.giamTru,
      ngayYLenh: formatDate(row.ngayYLenh),
      lyDoTuChoi: row.lyDoTuChoi,
      loaiGiamTru: row.loaiGiamTru,
      ketLuan: r.ketLuan,
      chiTietLech: (r.chiTietLech || [])
        .map((d) => `${d.truong}: XML="${d.giaTriXML}" vs Danh mục="${d.giaTriDanhMuc}"`)
        .join(' | '),
      duDoanMaLoi: (r.duDoanMaLoi || []).map((e) => `${e.maLoi} - ${e.tenLoi}`).join(' | '),
      ghiChu: (r.ghiChu || []).join(' | '),
    });
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { exportAnalysisToExcel };

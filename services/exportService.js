const ExcelJS = require('exceljs');
const { getResults } = require('./reconciliationService');
const { getClaimFileXmlRows } = require('./batchService');

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
}

function buildResultsWorkbook(results, sheetName) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã BN', key: 'maBN', width: 12 },
    { header: 'Họ tên', key: 'hoTen', width: 22 },
    { header: 'Mã khoa', key: 'maKhoa', width: 10 },
    { header: 'Mã bác sĩ', key: 'maBacSi', width: 10 },
    { header: 'MA_THE_BHYT', key: 'maThe', width: 18 },
    { header: 'MA_LOAI_KCB', key: 'maLoaiKCB', width: 12 },
    { header: 'MA_DOITUONG_KCB', key: 'maDoiTuongKCB', width: 16 },
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
    { header: 'Mã lỗi', key: 'maLoi', width: 10 },
    { header: 'Tên lỗi', key: 'tenLoi', width: 34 },
    { header: 'Ghi chú', key: 'ghiChu', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of results) {
    const row = r.errorRow || {};
    const base = {
      stt: row.stt,
      maBN: row.maBN,
      hoTen: row.hoTen,
      maKhoa: row.maKhoa,
      maBacSi: row.maBacSi,
      maThe: row.maThe,
      maLoaiKCB: row.loaiKCB,
      maDoiTuongKCB: row.maDoiTuongKCB,
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
      ghiChu: (r.ghiChu || []).join(' | '),
    };

    // Mỗi mã lỗi dự đoán ra 1 dòng riêng (thay vì gộp chung 1 ô) — nếu không dự đoán
    // được mã lỗi nào, vẫn giữ 1 dòng cho kết quả đó với 2 cột mã/tên lỗi để trống.
    const maLoiList = r.duDoanMaLoi && r.duDoanMaLoi.length > 0 ? r.duDoanMaLoi : [null];
    for (const maLoi of maLoiList) {
      sheet.addRow({ ...base, maLoi: maLoi?.maLoi || '', tenLoi: maLoi?.tenLoi || '' });
    }
  }

  return workbook;
}

async function exportAnalysisToExcel(batchId) {
  const results = await getResults(batchId);
  const workbook = buildResultsWorkbook(results, 'Kết quả đối chiếu');
  return workbook.xlsx.writeBuffer();
}

async function exportClaimFileErrorsToExcel(batchId, fileName) {
  const results = await getClaimFileXmlRows(batchId, fileName, 'ERRORS');
  const workbook = buildResultsWorkbook(results, 'Danh sách lỗi');
  return workbook.xlsx.writeBuffer();
}

module.exports = { exportAnalysisToExcel, exportClaimFileErrorsToExcel };

const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { DRUG_CATALOG_ALIASES } = require('./columnAliases');
const { excelValueToDate } = require('../utils/dateUtils');

function cellValue(cell) {
  if (!cell) return null;
  if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
    return cell.value.richText.map((part) => part.text).join('');
  }
  return cell.value;
}

function cellNumber(cell) {
  const value = cellValue(cell);
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function cellString(cell) {
  const value = cellValue(cell);
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function parseDrugCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    DRUG_CATALOG_ALIASES
  );

  const rows = [];
  const warnings = [];

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const maThuoc = colMap.maThuoc ? cellString(row.getCell(colMap.maThuoc)) : '';
    const tenThuoc = colMap.tenThuoc ? cellString(row.getCell(colMap.tenThuoc)) : '';
    if (!maThuoc && !tenThuoc) continue; // blank row

    if (!maThuoc) {
      warnings.push(`Dòng ${r}: thiếu MA_THUOC, đã bỏ qua`);
      continue;
    }

    // File chuẩn của danh mục thuốc không có cột TU_NGAY/DEN_NGAY — nhưng schema vẫn
    // required tuNgay (dùng để giới hạn hiệu lực khi đối chiếu, xem matchCatalogRow.js).
    // Mặc định về một ngày rất xa trong quá khứ (không phải ngày import!) để mọi
    // NGAY_YLENH trên hồ sơ XML đều rơi vào khoảng hiệu lực — nếu mặc định là "hôm nay",
    // các hồ sơ có ngày y lệnh trước ngày import sẽ bị loại khỏi đối chiếu.
    let tuNgay;
    if (colMap.tuNgay) {
      tuNgay = excelValueToDate(cellValue(row.getCell(colMap.tuNgay)));
      if (!tuNgay) {
        warnings.push(`Dòng ${r}: thiếu hoặc sai định dạng TU_NGAY, đã bỏ qua`);
        continue;
      }
    } else {
      tuNgay = new Date('2000-01-01');
    }

    rows.push({
      maThuoc,
      tenHoatChat: colMap.tenHoatChat ? cellString(row.getCell(colMap.tenHoatChat)) : '',
      tenThuoc,
      donViTinh: colMap.donViTinh ? cellString(row.getCell(colMap.donViTinh)) : '',
      hamLuong: colMap.hamLuong ? cellString(row.getCell(colMap.hamLuong)) : '',
      duongDung: colMap.duongDung ? cellString(row.getCell(colMap.duongDung)) : '',
      maDuongDung: colMap.maDuongDung ? cellString(row.getCell(colMap.maDuongDung)) : '',
      dangBaoChe: colMap.dangBaoChe ? cellString(row.getCell(colMap.dangBaoChe)) : '',
      soDangKy: colMap.soDangKy ? cellString(row.getCell(colMap.soDangKy)) : '',
      soLuong: colMap.soLuong ? cellNumber(row.getCell(colMap.soLuong)) : null,
      donGia: colMap.donGia ? cellNumber(row.getCell(colMap.donGia)) : null,
      donGiaBH: colMap.donGiaBH ? cellNumber(row.getCell(colMap.donGiaBH)) : null,
      quyCach: colMap.quyCach ? cellString(row.getCell(colMap.quyCach)) : '',
      nhaSx: colMap.nhaSx ? cellString(row.getCell(colMap.nhaSx)) : '',
      nuocSx: colMap.nuocSx ? cellString(row.getCell(colMap.nuocSx)) : '',
      nhaThau: colMap.nhaThau ? cellString(row.getCell(colMap.nhaThau)) : '',
      ttThau: colMap.ttThau ? cellString(row.getCell(colMap.ttThau)) : '',
      tuNgay,
      denNgay: colMap.denNgay ? excelValueToDate(cellValue(row.getCell(colMap.denNgay))) : null,
      maCSKCB: colMap.maCSKCB ? cellString(row.getCell(colMap.maCSKCB)) : '',
      loaiThuoc: colMap.loaiThuoc ? cellString(row.getCell(colMap.loaiThuoc)) : '',
      loaiThau: colMap.loaiThau ? cellString(row.getCell(colMap.loaiThau)) : '',
      htThau: colMap.htThau ? cellString(row.getCell(colMap.htThau)) : '',
    });
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseDrugCatalogWorkbook };

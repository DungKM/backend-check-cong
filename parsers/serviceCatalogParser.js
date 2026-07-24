const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { SERVICE_CATALOG_ALIASES } = require('./columnAliases');
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

async function parseServiceCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    SERVICE_CATALOG_ALIASES
  );

  const rows = [];
  const warnings = [];

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const maTuongDuong = colMap.maTuongDuong ? cellString(row.getCell(colMap.maTuongDuong)) : '';
    const tenDvktPheDuyet = colMap.tenDvktPheDuyet
      ? cellString(row.getCell(colMap.tenDvktPheDuyet))
      : '';
    if (!maTuongDuong && !tenDvktPheDuyet) continue;

    if (!maTuongDuong) {
      warnings.push(`Dòng ${r}: thiếu MA_TUONG_DUONG, đã bỏ qua`);
      continue;
    }

    const tuNgay = colMap.tuNgay ? excelValueToDate(cellValue(row.getCell(colMap.tuNgay))) : null;
    if (!tuNgay) {
      warnings.push(`Dòng ${r}: thiếu hoặc sai định dạng TUNGAY, đã bỏ qua`);
      continue;
    }

    rows.push({
      maTuongDuong,
      tenDvktPheDuyet,
      donGia: colMap.donGia ? cellNumber(row.getCell(colMap.donGia)) : null,
      tuNgay,
      denNgay: colMap.denNgay ? excelValueToDate(cellValue(row.getCell(colMap.denNgay))) : null,
    });
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseServiceCatalogWorkbook };

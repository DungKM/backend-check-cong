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

    const tuNgay = colMap.tuNgay ? excelValueToDate(cellValue(row.getCell(colMap.tuNgay))) : null;
    if (!tuNgay) {
      warnings.push(`Dòng ${r}: thiếu hoặc sai định dạng TU_NGAY, đã bỏ qua`);
      continue;
    }

    rows.push({
      maThuoc,
      tenThuoc,
      donViTinh: colMap.donViTinh ? cellString(row.getCell(colMap.donViTinh)) : '',
      hamLuong: colMap.hamLuong ? cellString(row.getCell(colMap.hamLuong)) : '',
      soDangKy: colMap.soDangKy ? cellString(row.getCell(colMap.soDangKy)) : '',
      donGiaBH: colMap.donGiaBH ? cellNumber(row.getCell(colMap.donGiaBH)) : null,
      ttThau: colMap.ttThau ? cellString(row.getCell(colMap.ttThau)) : '',
      tuNgay,
      denNgay: colMap.denNgay ? excelValueToDate(cellValue(row.getCell(colMap.denNgay))) : null,
      maCSKCB: colMap.maCSKCB ? cellString(row.getCell(colMap.maCSKCB)) : '',
    });
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseDrugCatalogWorkbook };

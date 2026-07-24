const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { DOCTOR_CATALOG_ALIASES } = require('./columnAliases');

function cellValue(cell) {
  if (!cell) return null;
  if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
    return cell.value.richText.map((part) => part.text).join('');
  }
  return cell.value;
}

function cellString(cell) {
  const value = cellValue(cell);
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// Only two canonical columns exist (HO_TEN, MACCHN), so the default minMatches
// of 3 used by the other catalog parsers would never be reached.
async function parseDoctorCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    DOCTOR_CATALOG_ALIASES,
    { minMatches: 2 }
  );

  const rows = [];
  const warnings = [];

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const hoTen = colMap.hoTen ? cellString(row.getCell(colMap.hoTen)) : '';
    const maCCHN = colMap.maCCHN ? cellString(row.getCell(colMap.maCCHN)) : '';
    if (!hoTen && !maCCHN) continue; // blank row

    if (!maCCHN) {
      warnings.push(`Dòng ${r}: thiếu MACCHN, đã bỏ qua`);
      continue;
    }

    rows.push({
      hoTen,
      maCCHN,
      maCSKCB: colMap.maCSKCB ? cellString(row.getCell(colMap.maCSKCB)) : '',
    });
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseDoctorCatalogWorkbook };

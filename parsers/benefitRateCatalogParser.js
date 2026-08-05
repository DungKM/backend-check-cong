const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { BENEFIT_RATE_CATALOG_ALIASES } = require('./columnAliases');

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

async function parseBenefitRateCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    BENEFIT_RATE_CATALOG_ALIASES
  );

  const rows = [];
  const warnings = [];

  // Xem giải thích ở serviceGroupCatalogParser.js: dừng sớm khi gặp nhiều dòng trống liên
  // tiếp để tránh quét hết rowCount ảo do định dạng Excel để lại.
  const MAX_CONSECUTIVE_BLANK_ROWS = 500;
  let consecutiveBlankRows = 0;

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) {
      consecutiveBlankRows += 1;
      if (consecutiveBlankRows >= MAX_CONSECUTIVE_BLANK_ROWS) break;
      continue;
    }

    const ma = colMap.ma ? cellString(row.getCell(colMap.ma)) : '';
    const nhom = colMap.nhom ? cellString(row.getCell(colMap.nhom)) : '';
    if (!ma && !nhom) {
      consecutiveBlankRows += 1;
      if (consecutiveBlankRows >= MAX_CONSECUTIVE_BLANK_ROWS) break;
      continue; // blank row
    }
    consecutiveBlankRows = 0;

    if (!ma || !nhom) {
      warnings.push(`Dòng ${r}: thiếu MA hoặc NHOM, đã bỏ qua`);
      continue;
    }

    rows.push({
      ma: ma.toUpperCase(),
      nhom,
      chiTraDungTuyen: colMap.chiTraDungTuyen ? cellNumber(row.getCell(colMap.chiTraDungTuyen)) : null,
      chiTraTraiTuyen: colMap.chiTraTraiTuyen ? cellNumber(row.getCell(colMap.chiTraTraiTuyen)) : null,
    });

    if (rows.length % 2000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseBenefitRateCatalogWorkbook };

const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { SERVICE_GROUP_CATALOG_ALIASES } = require('./columnAliases');

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

async function parseServiceGroupCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    SERVICE_GROUP_CATALOG_ALIASES
  );

  const rows = [];
  const warnings = [];

  // worksheet.rowCount reflects Excel's used range, which formatting/styles applied far
  // beyond the real data can inflate to hundreds of thousands of phantom empty rows —
  // scanning all of them blocks the event loop for hours (seen in production with a
  // "Danh mục dịch vụ kĩ thuật" file). Stop once we've run past the real data for a while.
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
    const ten = colMap.ten ? cellString(row.getCell(colMap.ten)) : '';
    if (!ma && !ten) {
      consecutiveBlankRows += 1;
      if (consecutiveBlankRows >= MAX_CONSECUTIVE_BLANK_ROWS) break;
      continue; // blank row
    }
    consecutiveBlankRows = 0;

    if (!ma) {
      warnings.push(`Dòng ${r}: thiếu MA, đã bỏ qua`);
      continue;
    }

    rows.push({
      ma,
      ten,
      loaiPTTT: colMap.loaiPTTT ? cellString(row.getCell(colMap.loaiPTTT)) : '',
      maGia: colMap.maGia ? cellString(row.getCell(colMap.maGia)) : '',
      tenGia: colMap.tenGia ? cellString(row.getCell(colMap.tenGia)) : '',
      gia: colMap.gia ? cellNumber(row.getCell(colMap.gia)) : null,
      giaSau: colMap.giaSau ? cellNumber(row.getCell(colMap.giaSau)) : null,
      ghiChu: colMap.ghiChu ? cellString(row.getCell(colMap.ghiChu)) : '',
      maNhom: colMap.maNhom ? cellString(row.getCell(colMap.maNhom)) : '',
    });

    // Yield to the event loop periodically so a large-but-legitimate file (tens of
    // thousands of rows) doesn't stall every other API request while it parses.
    if (rows.length % 2000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseServiceGroupCatalogWorkbook };

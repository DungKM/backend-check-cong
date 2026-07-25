const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { VAT_TU_CATALOG_ALIASES } = require('./columnAliases');

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

async function parseVatTuCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    VAT_TU_CATALOG_ALIASES
  );

  const rows = [];
  const warnings = [];

  // See serviceGroupCatalogParser.js — worksheet.rowCount can be inflated far beyond the
  // real data by formatting/styles alone, so stop once we've run past real data for a while.
  const MAX_CONSECUTIVE_BLANK_ROWS = 500;
  let consecutiveBlankRows = 0;

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) {
      consecutiveBlankRows += 1;
      if (consecutiveBlankRows >= MAX_CONSECUTIVE_BLANK_ROWS) break;
      continue;
    }

    const maVatTu = colMap.maVatTu ? cellString(row.getCell(colMap.maVatTu)) : '';
    const tenVatTu = colMap.tenVatTu ? cellString(row.getCell(colMap.tenVatTu)) : '';
    if (!maVatTu && !tenVatTu) {
      consecutiveBlankRows += 1;
      if (consecutiveBlankRows >= MAX_CONSECUTIVE_BLANK_ROWS) break;
      continue; // blank row
    }
    consecutiveBlankRows = 0;

    if (!maVatTu) {
      warnings.push(`Dòng ${r}: thiếu MA_VAT_TU, đã bỏ qua`);
      continue;
    }

    rows.push({
      maVatTu,
      nhomVatTu: colMap.nhomVatTu ? cellString(row.getCell(colMap.nhomVatTu)) : '',
      tenVatTu,
      maHieu: colMap.maHieu ? cellString(row.getCell(colMap.maHieu)) : '',
      hangSx: colMap.hangSx ? cellString(row.getCell(colMap.hangSx)) : '',
      donViTinh: colMap.donViTinh ? cellString(row.getCell(colMap.donViTinh)) : '',
      donGia: colMap.donGia ? cellNumber(row.getCell(colMap.donGia)) : null,
      donGiaBH: colMap.donGiaBH ? cellNumber(row.getCell(colMap.donGiaBH)) : null,
      tyLeTtBh: colMap.tyLeTtBh ? cellNumber(row.getCell(colMap.tyLeTtBh)) : null,
      soLuong: colMap.soLuong ? cellNumber(row.getCell(colMap.soLuong)) : null,
      dinhMuc: colMap.dinhMuc ? cellString(row.getCell(colMap.dinhMuc)) : '',
      nhaThau: colMap.nhaThau ? cellString(row.getCell(colMap.nhaThau)) : '',
      ttThau: colMap.ttThau ? cellString(row.getCell(colMap.ttThau)) : '',
      maCSKCB: colMap.maCSKCB ? cellString(row.getCell(colMap.maCSKCB)) : '',
      loaiThau: colMap.loaiThau ? cellString(row.getCell(colMap.loaiThau)) : '',
      htThau: colMap.htThau ? cellString(row.getCell(colMap.htThau)) : '',
    });

    // Yield to the event loop periodically so a large-but-legitimate file (tens of
    // thousands of rows) doesn't stall every other API request while it parses.
    if (rows.length % 2000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseVatTuCatalogWorkbook };

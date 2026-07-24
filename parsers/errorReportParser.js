const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { ERROR_REPORT_ALIASES } = require('./columnAliases');
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

function get(colMap, row, field, transform) {
  const col = colMap[field];
  if (!col) return transform ? transform(undefined) : '';
  const cell = row.getCell(col);
  return transform ? transform(cell) : cellString(cell);
}

function parseSheet(worksheet) {
  const rows = [];
  const warnings = [];

  let headerRow;
  let colMap;
  try {
    ({ rowNumber: headerRow, colMap } = findHeaderRow(
      (r) => worksheet.getRow(r),
      ERROR_REPORT_ALIASES
    ));
  } catch (err) {
    warnings.push(`Sheet "${worksheet.name}": ${err.message}, bỏ qua sheet này`);
    return { rows, warnings };
  }

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const maChiPhi = get(colMap, row, 'maChiPhi');
    const hoTen = get(colMap, row, 'hoTen');
    if (!maChiPhi && !hoTen) continue; // blank row

    if (!maChiPhi) {
      warnings.push(`Sheet "${worksheet.name}", dòng ${r}: thiếu Mã chi phí, đã bỏ qua`);
      continue;
    }

    rows.push({
      stt: get(colMap, row, 'stt', (cell) => cellNumber(cell)),
      maBN: get(colMap, row, 'maBN'),
      hoTen,
      ngayVao: get(colMap, row, 'ngayVao', (cell) => excelValueToDate(cellValue(cell))),
      ngayRa: get(colMap, row, 'ngayRa', (cell) => excelValueToDate(cellValue(cell))),
      loaiKCB: get(colMap, row, 'loaiKCB'),
      maKhoa: get(colMap, row, 'maKhoa'),
      maBacSi: get(colMap, row, 'maBacSi'),
      loaiChiPhi: get(colMap, row, 'loaiChiPhi'),
      maChiPhi,
      tenChiPhi: get(colMap, row, 'tenChiPhi'),
      soDangKy: get(colMap, row, 'soDangKy'),
      ttThau: get(colMap, row, 'ttThau'),
      donViTinh: get(colMap, row, 'donViTinh'),
      duongDung: get(colMap, row, 'duongDung'),
      hamLuong: get(colMap, row, 'hamLuong'),
      deNghi: get(colMap, row, 'deNghi', (cell) => cellNumber(cell)),
      giamTru: get(colMap, row, 'giamTru', (cell) => cellNumber(cell)),
      ngayYLenh: get(colMap, row, 'ngayYLenh', (cell) => excelValueToDate(cellValue(cell))),
      ngayTT: get(colMap, row, 'ngayTT', (cell) => excelValueToDate(cellValue(cell))),
      lyDoTuChoi: get(colMap, row, 'lyDoTuChoi'),
      loaiGiamTru: get(colMap, row, 'loaiGiamTru'),
      sttXML: get(colMap, row, 'sttXML'),
      sourceSheet: worksheet.name,
    });
  }

  return { rows, warnings };
}

async function parseErrorReportWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (workbook.worksheets.length === 0) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const rows = [];
  const warnings = [];
  for (const worksheet of workbook.worksheets) {
    const result = parseSheet(worksheet);
    rows.push(...result.rows);
    warnings.push(...result.warnings);
  }

  if (rows.length === 0) {
    throw new ParseError(
      'Không đọc được dòng dữ liệu hợp lệ nào từ file. ' + warnings.join('; ')
    );
  }

  return { rows, warnings, sheetsProcessed: workbook.worksheets.map((ws) => ws.name) };
}

module.exports = { parseErrorReportWorkbook };

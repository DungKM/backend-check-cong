const ExcelJS = require('exceljs');
const { findHeaderRow, ParseError } = require('./excelHeaderFinder');
const { ERROR_CODE_CATALOG_ALIASES } = require('./columnAliases');
const { excelValueToDate } = require('../utils/dateUtils');
const { normalizeText } = require('../utils/normalizeText');
const { REJECT_REASON_CATEGORY, MA_LOI_MUC_DO, MA_LOI_AP_DUNG_TRUONG } = require('../config/constants');

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

function normalizeEnum(value, allowed, fallback) {
  const upper = String(value || '').trim().toUpperCase();
  return allowed.includes(upper) ? upper : fallback;
}

// apDungTruong values are Vietnamese labels ("Đơn giá", "Hàm lượng", ...) or the
// KHONG_TIM_THAY sentinel, so matching is accent/case-insensitive via normalizeText
// rather than the plain toUpperCase used for the ASCII enum fields above.
function normalizeApDungTruong(value) {
  const norm = normalizeText(value);
  if (!norm) return '';
  for (const canonical of Object.values(MA_LOI_AP_DUNG_TRUONG)) {
    if (normalizeText(canonical) === norm) return canonical;
  }
  return '';
}

async function parseErrorCodeCatalogWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ParseError('File không có sheet dữ liệu');
  }

  const { rowNumber: headerRow, colMap } = findHeaderRow(
    (r) => worksheet.getRow(r),
    ERROR_CODE_CATALOG_ALIASES
  );

  const rows = [];
  const warnings = [];

  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const maLoi = colMap.maLoi ? cellString(row.getCell(colMap.maLoi)) : '';
    const tenLoi = colMap.tenLoi ? cellString(row.getCell(colMap.tenLoi)) : '';
    if (!maLoi && !tenLoi) continue; // blank row

    if (!maLoi) {
      warnings.push(`Dòng ${r}: thiếu MA_LOI, đã bỏ qua`);
      continue;
    }

    const tuNgay = colMap.tuNgay ? excelValueToDate(cellValue(row.getCell(colMap.tuNgay))) : null;
    if (!tuNgay) {
      warnings.push(`Dòng ${r}: thiếu hoặc sai định dạng TU_NGAY, đã bỏ qua`);
      continue;
    }

    rows.push({
      maLoi,
      tenLoi,
      dienGiai: colMap.dienGiai ? cellString(row.getCell(colMap.dienGiai)) : '',
      nhomLoi: colMap.nhomLoi
        ? normalizeEnum(
            cellString(row.getCell(colMap.nhomLoi)),
            Object.values(REJECT_REASON_CATEGORY),
            REJECT_REASON_CATEGORY.KHONG_XAC_DINH
          )
        : REJECT_REASON_CATEGORY.KHONG_XAC_DINH,
      apDungTruong: colMap.apDungTruong ? normalizeApDungTruong(cellString(row.getCell(colMap.apDungTruong))) : '',
      mucDo: colMap.mucDo
        ? normalizeEnum(cellString(row.getCell(colMap.mucDo)), Object.values(MA_LOI_MUC_DO), MA_LOI_MUC_DO.CANH_BAO)
        : MA_LOI_MUC_DO.CANH_BAO,
      ghiChu: colMap.ghiChu ? cellString(row.getCell(colMap.ghiChu)) : '',
      tuNgay,
      denNgay: colMap.denNgay ? excelValueToDate(cellValue(row.getCell(colMap.denNgay))) : null,
    });
  }

  return { rows, warnings, headerRow, sheetName: worksheet.name };
}

module.exports = { parseErrorCodeCatalogWorkbook };

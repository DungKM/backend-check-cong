const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

function excelSerialToDate(serial) {
  const ms = serial * 24 * 60 * 60 * 1000;
  return new Date(EXCEL_EPOCH.getTime() + ms);
}

function parseVietnameseDateString(text) {
  const trimmed = text.trim();
  let match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  match = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  return null;
}

function excelValueToDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const date = excelSerialToDate(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value.result !== undefined) {
    return excelValueToDate(value.result);
  }
  if (typeof value === 'string') {
    const parsed = parseVietnameseDateString(value);
    if (parsed) return parsed;
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return null;
}

function isDateInRange(date, from, to) {
  if (!date) return false;
  if (from && date.getTime() < from.getTime()) return false;
  if (to && date.getTime() > to.getTime()) return false;
  return true;
}

// BHYT XML datetime fields (NGAY_YL, NGAY_VAO, ...) use yyyyMMdd or yyyyMMddHHmm,
// unlike the Excel-based dd/mm/yyyy strings handled by parseVietnameseDateString above.
function bhytDateToDate(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?$/);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) || 0, Number(min) || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = { excelValueToDate, isDateInRange, excelSerialToDate, bhytDateToDate };

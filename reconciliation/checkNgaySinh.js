// Vietnamese CCCD (12-digit) encodes birth info in fixed positions: digit 4 is a
// century+gender code, digits 5-6 are the last two digits of the birth year. This lets
// ngày sinh be cross-checked against số CCCD without any external "thẻ BHYT" reference
// catalog — a self-contained consistency check, not a guarantee of matching BHXH's
// authoritative card database.
const CENTURY_BASE_YEAR = {
  0: 1900,
  1: 1900,
  2: 2000,
  3: 2000,
  4: 2100,
  5: 2100,
  6: 2200,
  7: 2200,
  8: 2300,
  9: 2300,
};

function decodeBirthYearFromCCCD(soCCCD) {
  const digits = String(soCCCD || '').trim();
  if (!/^\d{12}$/.test(digits)) return null;
  const baseYear = CENTURY_BASE_YEAR[digits[3]];
  const yearSuffix = digits.slice(4, 6);
  return baseYear + Number(yearSuffix);
}

/**
 * Returns a ghi chú string when errorRow.ngaySinh's year doesn't match the birth year
 * decoded from errorRow.soCCCD. Returns null when there's nothing to flag (missing
 * ngày sinh/CCCD, CCCD not 12 digits, or the years agree).
 */
function checkNgaySinh(errorRow) {
  const soCCCD = String(errorRow.soCCCD || '').trim();
  if (!soCCCD || !errorRow.ngaySinh) return null;

  const decodedYear = decodeBirthYearFromCCCD(soCCCD);
  if (decodedYear === null) return null;

  const khaiBaoYear = errorRow.ngaySinh.getUTCFullYear();
  if (decodedYear === khaiBaoYear) return null;

  return `Năm sinh khai báo (${khaiBaoYear}) không khớp năm sinh suy ra từ số CCCD "${soCCCD}" (${decodedYear})`;
}

module.exports = { decodeBirthYearFromCCCD, checkNgaySinh };

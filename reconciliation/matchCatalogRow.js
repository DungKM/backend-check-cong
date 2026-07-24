const { isDateInRange } = require('../utils/dateUtils');

/**
 * Given all catalog rows sharing a code (not yet filtered by date) and the
 * error row's "Ngày y lệnh", picks the catalog row whose validity window
 * [tuNgay, denNgay] (denNgay null = open-ended/still valid) contains that date.
 *
 * If more than one candidate is valid on that date (overlapping bidding
 * periods / duplicate data), the one with the latest tuNgay is chosen
 * deterministically, and `ambiguous: true` is set so the caller can surface
 * a warning without failing the whole reconciliation.
 */
function findValidCatalogRow(candidates, ngayYLenh) {
  if (!candidates || candidates.length === 0) {
    return { row: null, ambiguous: false, matchedCount: 0 };
  }

  const validRows = candidates.filter((row) => isDateInRange(ngayYLenh, row.tuNgay, row.denNgay));

  if (validRows.length === 0) {
    return { row: null, ambiguous: false, matchedCount: 0 };
  }

  if (validRows.length === 1) {
    return { row: validRows[0], ambiguous: false, matchedCount: 1 };
  }

  const sorted = [...validRows].sort((a, b) => b.tuNgay.getTime() - a.tuNgay.getTime());
  return { row: sorted[0], ambiguous: true, matchedCount: validRows.length };
}

module.exports = { findValidCatalogRow };

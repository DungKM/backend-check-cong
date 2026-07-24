const { normalizeText } = require('../utils/normalizeText');

class ParseError extends Error {}

function buildAliasLookup(aliasMap) {
  const lookup = new Map();
  for (const [field, variants] of Object.entries(aliasMap)) {
    for (const variant of variants) {
      lookup.set(normalizeText(variant), field);
    }
  }
  return lookup;
}

/**
 * Scans the first `maxScanRows` rows of a worksheet-like row iterator, scoring each
 * row by how many of its cells match a known header alias. Returns the best-scoring
 * row (as a 1-based row number) plus a colMap { canonicalField -> 1-based column index }.
 *
 * `getRow(rowNumber)` must return an object with `.eachCell((cell, colNumber) => {})`
 * (matches the ExcelJS Row API), so this works for both the regular and streaming readers.
 */
function findHeaderRow(getRow, aliasMap, { maxScanRows = 15, minMatches = 3 } = {}) {
  const lookup = buildAliasLookup(aliasMap);
  let best = { rowNumber: null, score: -1, colMap: {} };

  for (let r = 1; r <= maxScanRows; r++) {
    const row = getRow(r);
    if (!row) continue;
    const colMap = {};
    let score = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cell && cell.text !== undefined ? cell.text : cell && cell.value;
      const norm = normalizeText(text);
      if (!norm) return;
      const field = lookup.get(norm);
      if (field && !colMap[field]) {
        colMap[field] = colNumber;
        score++;
      }
    });
    if (score > best.score) {
      best = { rowNumber: r, score, colMap };
    }
  }

  if (best.score < minMatches) {
    throw new ParseError(
      `Không tìm thấy dòng tiêu đề hợp lệ trong ${maxScanRows} dòng đầu (điểm khớp cao nhất: ${best.score})`
    );
  }

  return best;
}

module.exports = { findHeaderRow, buildAliasLookup, ParseError };

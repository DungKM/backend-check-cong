const { normalizeText } = require('../utils/normalizeText');

/**
 * Builds a lookup set of approved doctor codes from DoctorCatalogMaster rows,
 * keyed by normalized MACCHN (accent/case/whitespace-insensitive).
 */
function buildDoctorSet(doctorRows) {
  const set = new Set();
  for (const row of doctorRows || []) {
    const norm = normalizeText(row.maCCHN);
    if (norm) set.add(norm);
  }
  return set;
}

/**
 * Returns a ghi chú string when errorRow.maBacSi (MA_BAC_SI, expected to carry
 * the doctor's CCHN number per XML4210) doesn't match any approved doctor in
 * doctorSet. Returns null when there's nothing to flag (no catalog loaded, no
 * mã bác sĩ on the row, or a match found) so callers can append conditionally.
 */
function checkBacSi(errorRow, doctorSet) {
  if (!doctorSet || doctorSet.size === 0) return null;
  const maBacSi = (errorRow.maBacSi || '').trim();
  if (!maBacSi) return null;
  if (doctorSet.has(normalizeText(maBacSi))) return null;
  return `Mã bác sĩ "${maBacSi}" không khớp mã CCHN nào trong danh mục bác sĩ được duyệt`;
}

module.exports = { buildDoctorSet, checkBacSi };

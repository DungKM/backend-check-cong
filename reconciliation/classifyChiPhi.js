const { normalizeText } = require('../utils/normalizeText');
const { LOAI_CHI_PHI, CHI_PHI_KEYWORDS } = require('../config/constants');

// Claim rows parsed straight from XML already carry the canonical enum value
// itself (e.g. "DICH_VU", "VAT_TU" — see xmlClaimParser.js's buildCostRow), not
// free Vietnamese text. normalizeText doesn't turn "_" into a space, so e.g.
// "DICH_VU" -> "dich_vu" never matches the space-separated keyword "dich vu"
// below — matching on exact enum equality first (before any accent-stripping)
// avoids that mismatch instead of relying on keyword-guessing for a value that
// is already unambiguous.
function classifyChiPhi(loaiChiPhiText) {
  const raw = String(loaiChiPhiText || '').trim().toUpperCase();
  if (Object.values(LOAI_CHI_PHI).includes(raw)) return raw;

  const norm = normalizeText(loaiChiPhiText);
  if (!norm) return LOAI_CHI_PHI.KHONG_XAC_DINH;

  for (const keyword of CHI_PHI_KEYWORDS[LOAI_CHI_PHI.THUOC]) {
    if (norm.includes(keyword)) return LOAI_CHI_PHI.THUOC;
  }
  for (const keyword of CHI_PHI_KEYWORDS[LOAI_CHI_PHI.VAT_TU]) {
    if (norm.includes(keyword)) return LOAI_CHI_PHI.VAT_TU;
  }
  for (const keyword of CHI_PHI_KEYWORDS[LOAI_CHI_PHI.DICH_VU]) {
    if (norm.includes(keyword)) return LOAI_CHI_PHI.DICH_VU;
  }
  return LOAI_CHI_PHI.KHONG_XAC_DINH;
}

module.exports = { classifyChiPhi };

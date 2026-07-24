const { normalizeText } = require('../utils/normalizeText');
const { LOAI_CHI_PHI, CHI_PHI_KEYWORDS } = require('../config/constants');

function classifyChiPhi(loaiChiPhiText) {
  const norm = normalizeText(loaiChiPhiText);
  if (!norm) return LOAI_CHI_PHI.KHONG_XAC_DINH;

  for (const keyword of CHI_PHI_KEYWORDS[LOAI_CHI_PHI.THUOC]) {
    if (norm.includes(keyword)) return LOAI_CHI_PHI.THUOC;
  }
  for (const keyword of CHI_PHI_KEYWORDS[LOAI_CHI_PHI.DICH_VU]) {
    if (norm.includes(keyword)) return LOAI_CHI_PHI.DICH_VU;
  }
  return LOAI_CHI_PHI.KHONG_XAC_DINH;
}

module.exports = { classifyChiPhi };

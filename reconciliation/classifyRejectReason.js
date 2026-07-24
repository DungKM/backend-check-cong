const { normalizeText } = require('../utils/normalizeText');
const { REJECT_REASON_CATEGORY, REJECT_REASON_KEYWORDS } = require('../config/constants');

// Categories are checked in the order defined by REJECT_REASON_KEYWORDS; the first
// category with a matching keyword wins (documented tie-break for texts that could
// match more than one group).
function classifyRejectReason(lyDoTuChoiText) {
  const norm = normalizeText(lyDoTuChoiText);
  if (!norm) {
    return { category: REJECT_REASON_CATEGORY.KHONG_XAC_DINH, matchedKeywords: [] };
  }

  for (const [category, keywords] of Object.entries(REJECT_REASON_KEYWORDS)) {
    const matchedKeywords = keywords.filter((keyword) => norm.includes(keyword));
    if (matchedKeywords.length > 0) {
      return { category, matchedKeywords };
    }
  }

  return { category: REJECT_REASON_CATEGORY.KHONG_XAC_DINH, matchedKeywords: [] };
}

module.exports = { classifyRejectReason };

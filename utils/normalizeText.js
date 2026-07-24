const ACCENT_MAP = [
  [/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a'],
  [/[èéẹẻẽêềếệểễ]/g, 'e'],
  [/[ìíịỉĩ]/g, 'i'],
  [/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o'],
  [/[ùúụủũưừứựửữ]/g, 'u'],
  [/[ỳýỵỷỹ]/g, 'y'],
  [/đ/g, 'd'],
  [/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/g, 'A'],
  [/[ÈÉẸẺẼÊỀẾỆỂỄ]/g, 'E'],
  [/[ÌÍỊỈĨ]/g, 'I'],
  [/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/g, 'O'],
  [/[ÙÚỤỦŨƯỪỨỰỬỮ]/g, 'U'],
  [/[ỲÝỴỶỸ]/g, 'Y'],
  [/Đ/g, 'D'],
];

function stripAccents(text) {
  let result = String(text);
  for (const [pattern, replacement] of ACCENT_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  const stripped = stripAccents(String(value));
  return stripped
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeText, stripAccents };

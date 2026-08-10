const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return TRUTHY.has(String(value).trim().toLowerCase());
}

function normalizeEnvText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

module.exports = { parseBooleanEnv, normalizeEnvText };

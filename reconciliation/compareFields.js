const { normalizeText } = require('../utils/normalizeText');
const { CHI_TIET_LECH_TRUONG } = require('../config/constants');

function valuesDiffer(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return false;
  return na !== nb;
}

function diffEntry(truong, giaTriXML, giaTriDanhMuc) {
  return {
    truong,
    giaTriXML: giaTriXML === null || giaTriXML === undefined ? '' : String(giaTriXML),
    giaTriDanhMuc: giaTriDanhMuc === null || giaTriDanhMuc === undefined ? '' : String(giaTriDanhMuc),
  };
}

const DRUG_FIELD_LABELS = {
  donViTinh: CHI_TIET_LECH_TRUONG.DON_VI_TINH,
  hamLuong: CHI_TIET_LECH_TRUONG.HAM_LUONG,
  soDangKy: CHI_TIET_LECH_TRUONG.SO_DANG_KY,
};

function compareDrugFields(errorRow, catalogRow) {
  const diffs = [];
  for (const [field, label] of Object.entries(DRUG_FIELD_LABELS)) {
    const xmlValue = errorRow[field];
    const catalogValue = catalogRow[field];
    if (valuesDiffer(xmlValue, catalogValue)) {
      diffs.push(diffEntry(label, xmlValue, catalogValue));
    }
  }
  if (errorRow.donGia !== null && errorRow.donGia !== undefined && valuesDiffer(errorRow.donGia, catalogRow.donGiaBH)) {
    diffs.push(diffEntry(CHI_TIET_LECH_TRUONG.DON_GIA, errorRow.donGia, catalogRow.donGiaBH));
  }
  return diffs;
}

const SERVICE_FIELD_LABELS = {
  tenChiPhi: CHI_TIET_LECH_TRUONG.TEN_DICH_VU,
};

function compareServiceFields(errorRow, catalogRow) {
  const diffs = [];
  if (valuesDiffer(errorRow.tenChiPhi, catalogRow.tenDvktPheDuyet)) {
    diffs.push(diffEntry(SERVICE_FIELD_LABELS.tenChiPhi, errorRow.tenChiPhi, catalogRow.tenDvktPheDuyet));
  }
  // errorRow.donGia is only populated when the source is a parsed BHYT claim XML
  // (xmlClaimParser); the legacy Excel error-report never carried a per-unit price.
  if (errorRow.donGia !== null && errorRow.donGia !== undefined && valuesDiffer(errorRow.donGia, catalogRow.donGia)) {
    diffs.push(diffEntry(CHI_TIET_LECH_TRUONG.DON_GIA, errorRow.donGia, catalogRow.donGia));
  }
  return diffs;
}

const VAT_TU_FIELD_LABELS = {
  tenChiPhi: CHI_TIET_LECH_TRUONG.TEN_VAT_TU,
};

function compareVatTuFields(errorRow, catalogRow) {
  const diffs = [];
  if (valuesDiffer(errorRow.tenChiPhi, catalogRow.tenVatTu)) {
    diffs.push(diffEntry(VAT_TU_FIELD_LABELS.tenChiPhi, errorRow.tenChiPhi, catalogRow.tenVatTu));
  }
  if (errorRow.donGia !== null && errorRow.donGia !== undefined && valuesDiffer(errorRow.donGia, catalogRow.donGiaBH)) {
    diffs.push(diffEntry(CHI_TIET_LECH_TRUONG.DON_GIA, errorRow.donGia, catalogRow.donGiaBH));
  }
  return diffs;
}

module.exports = { compareDrugFields, compareServiceFields, compareVatTuFields, valuesDiffer };

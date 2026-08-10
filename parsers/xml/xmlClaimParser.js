const { XMLParser } = require('fast-xml-parser');
const AdmZip = require('adm-zip');
const { XML1_ALIASES, COST_XML_TYPES, XML_DETAIL_CONFIG } = require('./xmlTagAliases');
const { bhytDateToDate } = require('../../utils/dateUtils');
const { LOAI_CHI_PHI } = require('../../config/constants');

// Zip-bomb guard: a hồ sơ .zip is a handful of XML files, never gigabytes uncompressed.
// Caps protect the server from a small malicious/corrupt .zip expanding into a memory
// exhaustion DoS when decompressed.
const MAX_ZIP_ENTRIES = 200;
const MAX_UNCOMPRESSED_BYTES = 300 * 1024 * 1024;

const DETAIL_ARRAY_TAGS = [
  'HOSO',
  'FILEHOSO',
  ...Object.values(COST_XML_TYPES).map((c) => c.detailTag),
  ...Object.values(XML_DETAIL_CONFIG).map((c) => c.detailTag).filter(Boolean),
];

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => DETAIL_ARRAY_TAGS.includes(name),
});

function pick(obj, names) {
  if (!obj) return '';
  for (const name of names) {
    const value = obj[name];
    if (value !== undefined && value !== null && typeof value !== 'object') return String(value).trim();
  }
  return '';
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

// Searches the parsed doc for the first array found under `key`, at any depth —
// avoids hardcoding the exact wrapper tag (DSACH_CHI_TIET_THUOC vs DSACH_CHI_TIET_DVKT).
function findArrayByKey(node, key, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node[key])) return node[key];
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = findArrayByKey(value, key, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// MA_THE_BHYT can carry multiple ";"-separated card numbers when the patient's
// card was renewed mid-treatment (see real sample) — only the first is kept;
// picking the card valid on a specific service date would need per-line date
// matching against GT_THE_TU/GT_THE_DEN, not done here.
function firstSegment(value) {
  return String(value || '').split(';')[0].trim();
}

function parseXml1Header(doc) {
  const root = doc.TONG_HOP || {};
  return {
    maLK: pick(root, XML1_ALIASES.maLK),
    maBN: pick(root, XML1_ALIASES.maBN),
    hoTen: pick(root, XML1_ALIASES.hoTen),
    maCSKCB: pick(root, XML1_ALIASES.maCSKCB),
    ngaySinh: bhytDateToDate(pick(root, XML1_ALIASES.ngaySinh)),
    gioiTinh: pick(root, XML1_ALIASES.gioiTinh),
    soCCCD: pick(root, XML1_ALIASES.soCCCD),
    soNgayDieuTri: toNumber(pick(root, XML1_ALIASES.soNgayDieuTri)),
    ngayVao: bhytDateToDate(pick(root, XML1_ALIASES.ngayVao)),
    ngayRa: bhytDateToDate(pick(root, XML1_ALIASES.ngayRa)),
    ngayVaoNoiTru: bhytDateToDate(pick(root, XML1_ALIASES.ngayVaoNoiTru)),
    ketQuaDieuTri: pick(root, XML1_ALIASES.ketQuaDieuTri),
    maLoaiRaVien: pick(root, XML1_ALIASES.maLoaiRaVien),
    maThe: firstSegment(pick(root, XML1_ALIASES.maThe)),
    maDkbd: firstSegment(pick(root, XML1_ALIASES.maDkbd)),
    giayChuyenTuyen: pick(root, XML1_ALIASES.giayChuyenTuyen),
    maLoaiKCB: pick(root, XML1_ALIASES.maLoaiKCB),
    maDoiTuongKCB: pick(root, XML1_ALIASES.maDoiTuongKCB),
    lyDoVv: pick(root, XML1_ALIASES.lyDoVv),
  };
}

function buildCostRow(type, detail, header, warnings) {
  const config = COST_XML_TYPES[type];
  const get = (field) => pick(detail, config.aliases[field] || []);

  const maLK = get('maLK') || header.maLK || '';
  // Real CHI_TIET_DVKT lines can carry MA_DICH_VU alongside MA_VAT_TU on a VTYT
  // line, as a "used during this service" reference rather than a second cost
  // item (TEN_DICH_VU/its own price are blank on those lines) — so MA_VAT_TU
  // must win whenever present, or the line's vật tư mã silently disappears and
  // never gets checked against VatTuCatalogMaster.
  const maVatTu = get('maVatTu');
  const maDichVu = maVatTu ? '' : get('maChiPhi');
  const isVatTu = Boolean(maVatTu);
  const maChiPhi = isVatTu ? maVatTu : maDichVu;
  if (!maChiPhi) {
    warnings.push(`Dòng ${type} (MA_LK=${maLK || '?'}): thiếu mã chi phí, đã bỏ qua`);
    return null;
  }

  return {
    maLK,
    maCSKCB: header.maCSKCB || '',
    xmlType: type,
    maBN: header.maBN || '',
    hoTen: header.hoTen || '',
    ngaySinh: header.ngaySinh || null,
    gioiTinh: header.gioiTinh || '',
    soCCCD: header.soCCCD || '',
    soNgayDieuTri: header.soNgayDieuTri ?? null,
    ngayVao: header.ngayVao || null,
    ngayRa: header.ngayRa || null,
    ngayVaoNoiTru: header.ngayVaoNoiTru || null,
    ketQuaDieuTri: header.ketQuaDieuTri || '',
    maLoaiRaVien: header.maLoaiRaVien || '',
    maThe: header.maThe || '',
    maDkbd: header.maDkbd || '',
    giayChuyenTuyen: header.giayChuyenTuyen || '',
    loaiKCB: header.maLoaiKCB || '',
    maDoiTuongKCB: header.maDoiTuongKCB || '',
    lyDoVv: header.lyDoVv || '',
    maKhoa: get('maKhoa'),
    maBacSi: get('maBacSi'),
    maGiuong: get('maGiuong'),
    maNhom: get('maNhom'),
    mucHuong: toNumber(get('mucHuong')),
    tyLeTtBh: toNumber(get('tyLeTtBh')),
    loaiChiPhi: isVatTu ? LOAI_CHI_PHI.VAT_TU : config.loaiChiPhi,
    maChiPhi,
    tenChiPhi: isVatTu ? get('tenVatTu') : get('tenChiPhi'),
    soDangKy: get('soDangKy'),
    ttThau: get('ttThau'),
    donViTinh: get('donViTinh'),
    hamLuong: get('hamLuong'),
    soLuong: toNumber(get('soLuong')),
    donGia: toNumber(get('donGia')),
    deNghi: toNumber(get('deNghi')),
    ngayYLenh: bhytDateToDate(get('ngayYLenh')),
    sttXML: get('stt'),
  };
}

function parseCostXml(type, doc, header, warnings) {
  const config = COST_XML_TYPES[type];
  const details = findArrayByKey(doc, config.detailTag) || [];
  return details
    .map((detail) => buildCostRow(type, detail, header, warnings))
    .filter((row) => row !== null);
}

// Pulls raw (un-normalized) records out of an already-parsed XML doc for the per-file
// XML1..XML13 detail viewer (see XML_DETAIL_CONFIG). Returns null for XML types with no
// known extraction config (not yet confirmed against a real sample).
function extractXmlDetailRecords(type, doc) {
  const config = XML_DETAIL_CONFIG[type];
  if (!config) return null;
  if (config.detailTag) return findArrayByKey(doc, config.detailTag) || [];
  const root = doc[config.rootTag];
  return root ? [root] : [];
}

function parseGiamDinhHsXml(xmlText, warnings) {
  const doc = parser.parse(xmlText);
  const root = doc.GIAMDINHHS;
  if (!root) {
    warnings.push('Không tìm thấy thẻ gốc GIAMDINHHS trong file XML');
    return { rows: [], xmlDetails: [], hosoSummaries: [] };
  }

  const thongTinHoSo = root.THONGTINHOSO || {};
  const hosoList = (thongTinHoSo.DANHSACHHOSO && thongTinHoSo.DANHSACHHOSO.HOSO) || [];
  const rows = [];
  const xmlDetails = [];
  const hosoSummaries = [];

  for (const hoso of hosoList) {
    const fileHosoList = hoso.FILEHOSO || [];
    let header = {};
    const costFiles = [];

    for (const fileHoso of fileHosoList) {
      const loaiHoSo = pick(fileHoso, ['LOAIHOSO']);
      const noiDungFile = fileHoso.NOIDUNGFILE;
      if (!loaiHoSo || noiDungFile === undefined || noiDungFile === null || noiDungFile === '') continue;

      let decoded;
      try {
        decoded = Buffer.from(String(noiDungFile), 'base64').toString('utf8');
      } catch (err) {
        warnings.push(`Không giải mã được NOIDUNGFILE (${loaiHoSo}): ${err.message}`);
        continue;
      }

      const fileHosoDoc = parser.parse(decoded);

      if (loaiHoSo === 'XML1') {
        header = parseXml1Header(fileHosoDoc);
      } else if (COST_XML_TYPES[loaiHoSo]) {
        costFiles.push({ type: loaiHoSo, doc: fileHosoDoc });
      }

      const records = extractXmlDetailRecords(loaiHoSo, fileHosoDoc);
      if (records) {
        for (const record of records) {
          xmlDetails.push({
            xmlType: loaiHoSo,
            maLK: pick(record, ['MA_LK']) || header.maLK || '',
            sttXML: pick(record, ['STT']),
            data: record,
          });
        }
      }
    }

    for (const { type, doc: fileHosoDoc } of costFiles) {
      rows.push(...parseCostXml(type, fileHosoDoc, header, warnings));
    }

    hosoSummaries.push({ maLK: header.maLK || '', hoTen: header.hoTen || '', ok: Boolean(header.maLK) });
  }

  return { rows, xmlDetails, hosoSummaries };
}

async function parseClaimXmlBuffer(buffer, fileName) {
  const warnings = [];
  const rows = [];
  const xmlDetails = [];
  const hosoSummaries = [];
  const isZip = /\.zip$/i.test(fileName || '') || (buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b);

  const xmlTexts = [];
  if (isZip) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`File ${fileName}: gói .zip có quá nhiều mục (${entries.length}), vượt giới hạn ${MAX_ZIP_ENTRIES}`);
    }

    let totalUncompressed = 0;
    for (const entry of entries) {
      if (entry.isDirectory || !/\.xml$/i.test(entry.entryName)) continue;
      totalUncompressed += entry.header.size;
      if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
        throw new Error(`File ${fileName}: dữ liệu giải nén từ .zip vượt giới hạn cho phép`);
      }
      xmlTexts.push(entry.getData().toString('utf8'));
    }
    if (xmlTexts.length === 0) {
      warnings.push(`File ${fileName}: không tìm thấy file .xml nào trong gói .zip`);
    }
  } else {
    xmlTexts.push(buffer.toString('utf8'));
  }

  for (const xmlText of xmlTexts) {
    try {
      const parsed = parseGiamDinhHsXml(xmlText, warnings);
      rows.push(...parsed.rows);
      xmlDetails.push(...parsed.xmlDetails);
      hosoSummaries.push(...parsed.hosoSummaries);
    } catch (err) {
      warnings.push(`Lỗi phân tích XML (${fileName}): ${err.message}`);
    }
  }

  return { rows, warnings, xmlDetails, hosoSummaries };
}

module.exports = { parseClaimXmlBuffer };

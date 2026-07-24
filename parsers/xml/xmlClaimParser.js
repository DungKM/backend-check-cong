const { XMLParser } = require('fast-xml-parser');
const AdmZip = require('adm-zip');
const { XML1_ALIASES, COST_XML_TYPES } = require('./xmlTagAliases');
const { bhytDateToDate } = require('../../utils/dateUtils');

const DETAIL_ARRAY_TAGS = ['HOSO', 'FILEHOSO', ...Object.values(COST_XML_TYPES).map((c) => c.detailTag)];

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

function parseXml1Header(decodedXml) {
  const doc = parser.parse(decodedXml);
  const root = doc.TONG_HOP || {};
  return {
    maLK: pick(root, XML1_ALIASES.maLK),
    maBN: pick(root, XML1_ALIASES.maBN),
    hoTen: pick(root, XML1_ALIASES.hoTen),
    maCSKCB: pick(root, XML1_ALIASES.maCSKCB),
    ngaySinh: bhytDateToDate(pick(root, XML1_ALIASES.ngaySinh)),
    soCCCD: pick(root, XML1_ALIASES.soCCCD),
    soNgayDieuTri: toNumber(pick(root, XML1_ALIASES.soNgayDieuTri)),
    ngayVao: bhytDateToDate(pick(root, XML1_ALIASES.ngayVao)),
    ngayRa: bhytDateToDate(pick(root, XML1_ALIASES.ngayRa)),
    ngayVaoNoiTru: bhytDateToDate(pick(root, XML1_ALIASES.ngayVaoNoiTru)),
    ketQuaDieuTri: pick(root, XML1_ALIASES.ketQuaDieuTri),
    maLoaiRaVien: pick(root, XML1_ALIASES.maLoaiRaVien),
  };
}

function buildCostRow(type, detail, header, warnings) {
  const config = COST_XML_TYPES[type];
  const get = (field) => pick(detail, config.aliases[field] || []);

  const maLK = get('maLK') || header.maLK || '';
  const maChiPhi = get('maChiPhi');
  if (!maChiPhi) {
    const maVatTu = get('maVatTu');
    if (maVatTu) {
      // Vật tư y tế line — no VTYT master catalog exists yet, so it's out of scope
      // for reconciliation rather than a parse defect. See xmlTagAliases.js note.
      return null;
    }
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
    soCCCD: header.soCCCD || '',
    soNgayDieuTri: header.soNgayDieuTri ?? null,
    ngayVao: header.ngayVao || null,
    ngayRa: header.ngayRa || null,
    ngayVaoNoiTru: header.ngayVaoNoiTru || null,
    ketQuaDieuTri: header.ketQuaDieuTri || '',
    maLoaiRaVien: header.maLoaiRaVien || '',
    maKhoa: get('maKhoa'),
    maBacSi: get('maBacSi'),
    maGiuong: get('maGiuong'),
    loaiChiPhi: config.loaiChiPhi,
    maChiPhi,
    tenChiPhi: get('tenChiPhi'),
    soDangKy: get('soDangKy'),
    ttThau: get('ttThau'),
    donViTinh: get('donViTinh'),
    hamLuong: get('hamLuong'),
    soLuong: toNumber(get('soLuong')),
    donGia: toNumber(get('donGia')),
    deNghi: toNumber(get('deNghi')),
    ngayYLenh: bhytDateToDate(get('ngayYLenh')),
  };
}

function parseCostXml(type, decodedXml, header, warnings) {
  const config = COST_XML_TYPES[type];
  const doc = parser.parse(decodedXml);
  const details = findArrayByKey(doc, config.detailTag) || [];
  return details
    .map((detail) => buildCostRow(type, detail, header, warnings))
    .filter((row) => row !== null);
}

function parseGiamDinhHsXml(xmlText, warnings) {
  const doc = parser.parse(xmlText);
  const root = doc.GIAMDINHHS;
  if (!root) {
    warnings.push('Không tìm thấy thẻ gốc GIAMDINHHS trong file XML');
    return [];
  }

  const thongTinHoSo = root.THONGTINHOSO || {};
  const hosoList = (thongTinHoSo.DANHSACHHOSO && thongTinHoSo.DANHSACHHOSO.HOSO) || [];
  const rows = [];

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

      if (loaiHoSo === 'XML1') {
        header = parseXml1Header(decoded);
      } else if (COST_XML_TYPES[loaiHoSo]) {
        costFiles.push({ type: loaiHoSo, decoded });
      }
      // XML4/5/7/8/... carry no cost fields — intentionally not parsed here.
    }

    for (const { type, decoded } of costFiles) {
      rows.push(...parseCostXml(type, decoded, header, warnings));
    }
  }

  return rows;
}

async function parseClaimXmlBuffer(buffer, fileName) {
  const warnings = [];
  const rows = [];
  const isZip = /\.zip$/i.test(fileName || '') || (buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b);

  const xmlTexts = [];
  if (isZip) {
    const zip = new AdmZip(buffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !/\.xml$/i.test(entry.entryName)) continue;
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
      rows.push(...parseGiamDinhHsXml(xmlText, warnings));
    } catch (err) {
      warnings.push(`Lỗi phân tích XML (${fileName}): ${err.message}`);
    }
  }

  return { rows, warnings };
}

module.exports = { parseClaimXmlBuffer };

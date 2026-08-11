const ExcelJS = require('exceljs');
const DrugCatalogMaster = require('../models/DrugCatalogMaster');
const ServiceCatalogMaster = require('../models/ServiceCatalogMaster');
const ErrorCodeCatalog = require('../models/ErrorCodeCatalog');
const DoctorCatalogMaster = require('../models/DoctorCatalogMaster');
const ServiceGroupCatalog = require('../models/ServiceGroupCatalog');
const VatTuCatalogMaster = require('../models/VatTuCatalogMaster');
const BenefitRateCatalog = require('../models/BenefitRateCatalog');
const CatalogImport = require('../models/CatalogImport');
const { escapeRegExp } = require('../utils/escapeRegExp');
const { parseDrugCatalogWorkbook } = require('../parsers/drugCatalogParser');
const { parseServiceCatalogWorkbook } = require('../parsers/serviceCatalogParser');
const { parseErrorCodeCatalogWorkbook } = require('../parsers/errorCodeCatalogParser');
const { parseDoctorCatalogWorkbook } = require('../parsers/doctorCatalogParser');
const { parseServiceGroupCatalogWorkbook } = require('../parsers/serviceGroupCatalogParser');
const { parseVatTuCatalogWorkbook } = require('../parsers/vatTuCatalogParser');
const { parseBenefitRateCatalogWorkbook } = require('../parsers/benefitRateCatalogParser');
const { REJECT_REASON_CATEGORY, MA_LOI_MUC_DO, MA_LOI_AP_DUNG_TRUONG } = require('../config/constants');
const { logger } = require('../utils/logger');

const IMPORT_CHUNK_SIZE = 2000;

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// `fields` doubles as the source of truth for manual create/edit validation
// and for the downloadable import template (header row + one example row).
const CATALOG_CONFIG = {
  drug: {
    model: DrugCatalogMaster,
    parse: parseDrugCatalogWorkbook,
    // Không upsert/kiểm tra trùng — mỗi dòng trong file import luôn thành 1 bản ghi mới,
    // kể cả khi trùng hết mã thuốc/từ ngày/TT thầu với dòng đã có (nhiều dòng hợp lệ có
    // thể chia sẻ các trường này nhưng khác nhà SX/nhà thầu/số lượng...).
    dedup: false,
    searchFields: ['maThuoc', 'tenThuoc'],
    // Không có TU_NGAY/DEN_NGAY — file chuẩn của danh mục thuốc không có 2 cột này.
    // tuNgay vẫn required trên schema (dùng để giới hạn hiệu lực khi đối chiếu) nên
    // createItem() tự mặc định về một ngày rất xa trong quá khứ, xem parser cho lý do.
    fields: [
      { key: 'maThuoc', header: 'MA_THUOC', type: 'string', required: true, example: 'T001' },
      { key: 'tenHoatChat', header: 'TEN_HOAT_CHAT', type: 'string', example: 'Paracetamol' },
      { key: 'tenThuoc', header: 'TEN_THUOC', type: 'string', required: true, example: 'Paracetamol 500mg' },
      { key: 'donViTinh', header: 'DON_VI_TINH', type: 'string', example: 'Viên' },
      { key: 'hamLuong', header: 'HAM_LUONG', type: 'string', example: '500mg' },
      { key: 'duongDung', header: 'DUONG_DUNG', type: 'string', example: 'Uống' },
      { key: 'maDuongDung', header: 'MA_DUONG_DUNG', type: 'string', example: '01' },
      { key: 'dangBaoChe', header: 'DANG_BAO_CHE', type: 'string', example: 'Viên nén' },
      { key: 'soDangKy', header: 'SO_DANG_KY', type: 'string', example: 'VD-12345-19' },
      { key: 'soLuong', header: 'SO_LUONG', type: 'number', example: 1000 },
      { key: 'donGia', header: 'DON_GIA', type: 'number', example: 1000 },
      { key: 'donGiaBH', header: 'DON_GIA_BH', type: 'number', example: 1000 },
      { key: 'quyCach', header: 'QUY_CACH', type: 'string', example: 'Hộp 10 vỉ x 10 viên' },
      { key: 'nhaSx', header: 'NHA_SX', type: 'string', example: '' },
      { key: 'nuocSx', header: 'NUOC_SX', type: 'string', example: 'Việt Nam' },
      { key: 'nhaThau', header: 'NHA_THAU', type: 'string', example: '' },
      { key: 'ttThau', header: 'TT_THAU', type: 'string', example: 'TT01' },
      { key: 'maCSKCB', header: 'MA_CSKCB', type: 'string', example: 'CSKCB01' },
      { key: 'loaiThuoc', header: 'LOAI_THUOC', type: 'string', example: '' },
      { key: 'loaiThau', header: 'LOAI_THAU', type: 'string', example: '' },
      { key: 'htThau', header: 'HT_THAU', type: 'string', example: '' },
    ],
  },
  service: {
    model: ServiceCatalogMaster,
    parse: parseServiceCatalogWorkbook,
    // Chỉ coi 2 dòng là trùng (update tại chỗ) khi TẤT CẢ các trường đều khớp — cùng mã
    // tương đương + từ ngày nhưng khác tên/đơn giá vẫn là bản ghi khác, phải thêm mới
    // thay vì ghi đè (xem lý do tương tự ở CATALOG_CONFIG.serviceGroup).
    uniqueKey: (row) => ({
      maTuongDuong: row.maTuongDuong,
      tenDvktPheDuyet: row.tenDvktPheDuyet,
      donGia: row.donGia,
      tuNgay: row.tuNgay,
      denNgay: row.denNgay,
    }),
    searchFields: ['maTuongDuong', 'tenDvktPheDuyet'],
    fields: [
      { key: 'maTuongDuong', header: 'MA_TUONG_DUONG', type: 'string', required: true, example: 'S001' },
      { key: 'tenDvktPheDuyet', header: 'TEN_DVKT_PHEDUYET', type: 'string', required: true, example: 'Khám nội khoa' },
      { key: 'donGia', header: 'DON_GIA', type: 'number', example: 50000 },
      { key: 'tuNgay', header: 'TUNGAY', type: 'date', required: true, example: '2024-01-01' },
      { key: 'denNgay', header: 'DENNGAY', type: 'date', example: '2024-12-31' },
    ],
  },
  errorCode: {
    model: ErrorCodeCatalog,
    parse: parseErrorCodeCatalogWorkbook,
    uniqueKey: (row) => ({ maLoi: row.maLoi, tuNgay: row.tuNgay }),
    searchFields: ['maLoi', 'tenLoi'],
    fields: [
      { key: 'maLoi', header: 'MA_LOI', type: 'string', required: true, example: 'ML001' },
      { key: 'tenLoi', header: 'TEN_LOI', type: 'string', required: true, example: 'Sai đơn giá' },
      {
        key: 'dienGiai',
        header: 'DIEN_GIAI',
        type: 'string',
        example: 'Đơn giá đề nghị khác đơn giá BH trong danh mục',
      },
      {
        key: 'nhomLoi',
        header: 'NHOM_LOI',
        type: 'enum',
        options: Object.values(REJECT_REASON_CATEGORY),
        example: REJECT_REASON_CATEGORY.SAI_DANH_MUC,
      },
      {
        key: 'apDungTruong',
        header: 'AP_DUNG_TRUONG',
        type: 'enum',
        options: ['', ...Object.values(MA_LOI_AP_DUNG_TRUONG)],
        example: MA_LOI_AP_DUNG_TRUONG.DON_GIA,
      },
      {
        key: 'mucDo',
        header: 'MUC_DO',
        type: 'enum',
        options: Object.values(MA_LOI_MUC_DO),
        example: MA_LOI_MUC_DO.CANH_BAO,
      },
      { key: 'ghiChu', header: 'GHI_CHU', type: 'string', example: '' },
      { key: 'tuNgay', header: 'TU_NGAY', type: 'date', required: true, example: '2024-01-01' },
      { key: 'denNgay', header: 'DEN_NGAY', type: 'date', example: '' },
    ],
  },
  doctor: {
    model: DoctorCatalogMaster,
    parse: parseDoctorCatalogWorkbook,
    uniqueKey: (row) => ({ maCCHN: row.maCCHN }),
    searchFields: ['hoTen', 'maCCHN'],
    fields: [
      { key: 'hoTen', header: 'HO_TEN', type: 'string', required: true, example: 'Nguyễn Văn A' },
      { key: 'maCCHN', header: 'MACCHN', type: 'string', required: true, example: '0026767/BYT-CCHN' },
      { key: 'maCSKCB', header: 'MA_CSKCB', type: 'string', example: 'CSKCB01' },
    ],
  },
  serviceGroup: {
    model: ServiceGroupCatalog,
    parse: parseServiceGroupCatalogWorkbook,
    // Không dùng riêng `ma` làm khoá trùng — file nguồn (danh mục dịch vụ kỹ thuật) có
    // nhiều dòng chia sẻ cùng MA nhưng khác GIA/LOAIPTTT/GHICHU (các biến thể phân loại/
    // giá hợp lệ); upsert theo mỗi `ma` từng làm dòng sau âm thầm ghi đè GIA của dòng
    // trước. Chỉ coi 2 dòng là trùng (update tại chỗ) khi TẤT CẢ các trường đều khớp;
    // khác bất kỳ trường nào thì được thêm thành bản ghi mới.
    uniqueKey: (row) => ({
      ma: row.ma,
      ten: row.ten,
      loaiPTTT: row.loaiPTTT,
      maGia: row.maGia,
      tenGia: row.tenGia,
      gia: row.gia,
      giaSau: row.giaSau,
      ghiChu: row.ghiChu,
      maNhom: row.maNhom,
    }),
    searchFields: ['ma', 'ten', 'maGia'],
    fields: [
      { key: 'ma', header: 'MA', type: 'string', required: true, example: '10.0811.0559_GT' },
      { key: 'ten', header: 'TEN', type: 'string', example: 'Phẫu thuật vết thương phần mềm tổn thương gân gấp tề' },
      { key: 'loaiPTTT', header: 'LOAIPTTT', type: 'string', example: '' },
      { key: 'maGia', header: 'MAGIA', type: 'string', example: '37.8D05.0559' },
      { key: 'tenGia', header: 'TENGIA', type: 'string', example: 'Phẫu thuật nối gân hoặc kéo dài gân (tính 1 gân)' },
      { key: 'gia', header: 'GIA', type: 'number', example: 0 },
      { key: 'giaSau', header: 'GIASAU', type: 'number', example: 0 },
      { key: 'ghiChu', header: 'GHICHU', type: 'string', example: '' },
      { key: 'maNhom', header: 'MANHOM_5937', type: 'string', example: '8' },
    ],
  },
  vatTu: {
    model: VatTuCatalogMaster,
    parse: parseVatTuCatalogWorkbook,
    uniqueKey: (row) => ({ maVatTu: row.maVatTu, ttThau: row.ttThau, maCSKCB: row.maCSKCB }),
    searchFields: ['maVatTu', 'tenVatTu', 'nhomVatTu'],
    fields: [
      { key: 'maVatTu', header: 'MA_VAT_TU', type: 'string', required: true, example: 'VT001' },
      { key: 'nhomVatTu', header: 'NHOM_VAT_TU', type: 'string', example: 'Vật tư tiêu hao' },
      { key: 'tenVatTu', header: 'TEN_VAT_TU', type: 'string', required: true, example: 'Kim luồn tĩnh mạch' },
      { key: 'maHieu', header: 'MA_HIEU', type: 'string', example: '' },
      { key: 'hangSx', header: 'HANG_SX', type: 'string', example: '' },
      { key: 'donViTinh', header: 'DON_VI_TINH', type: 'string', example: 'Cái' },
      { key: 'donGia', header: 'DON_GIA', type: 'number', example: 15000 },
      { key: 'donGiaBH', header: 'DON_GIA_BH', type: 'number', example: 15000 },
      { key: 'tyLeTtBh', header: 'TYLE_TT_BH', type: 'number', example: 100 },
      { key: 'soLuong', header: 'SO_LUONG', type: 'number', example: 1 },
      { key: 'dinhMuc', header: 'DINH_MUC', type: 'string', example: '' },
      { key: 'nhaThau', header: 'NHA_THAU', type: 'string', example: '' },
      { key: 'ttThau', header: 'TT_THAU', type: 'string', example: '' },
      { key: 'maCSKCB', header: 'MA_CSKCB', type: 'string', example: 'CSKCB01' },
      { key: 'loaiThau', header: 'LOAI_THAU', type: 'string', example: '' },
      { key: 'htThau', header: 'HT_THAU', type: 'string', example: '' },
    ],
  },
  benefitRate: {
    model: BenefitRateCatalog,
    parse: parseBenefitRateCatalogWorkbook,
    uniqueKey: (row) => ({ ma: row.ma, nhom: row.nhom }),
    searchFields: ['ma', 'nhom'],
    fields: [
      { key: 'ma', header: 'MA', type: 'string', required: true, example: 'HT' },
      { key: 'nhom', header: 'NHOM', type: 'string', required: true, example: '4' },
      { key: 'chiTraDungTuyen', header: 'CHITRADUNGTUYEN', type: 'number', example: 80 },
      { key: 'chiTraTraiTuyen', header: 'CHITRATRAITUYEN', type: 'number', example: 48 },
    ],
  },
};

// Số dòng hiện có của mỗi loại danh mục — dùng cho trang "Tổng quan" để nhìn nhanh
// độ đầy của toàn bộ danh mục mà không phải mở từng trang riêng.
async function getCatalogCounts() {
  const entries = await Promise.all(
    Object.entries(CATALOG_CONFIG).map(async ([type, config]) => [type, await config.model.countDocuments()])
  );
  return Object.fromEntries(entries);
}

function getConfigOrThrow(type) {
  const config = CATALOG_CONFIG[type];
  if (!config) throw new BadRequestError(`Loại danh mục không hợp lệ: ${type}`);
  return config;
}

function coerceFieldValue(field, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return field.type === 'number' ? null : field.type === 'date' ? null : '';
  }
  if (field.type === 'number') {
    const num = Number(rawValue);
    return Number.isNaN(num) ? null : num;
  }
  if (field.type === 'date') {
    const date = new Date(rawValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return String(rawValue).trim();
}

// Fields the caller didn't submit at all (e.g. hidden from a form) are left out of the
// doc entirely, so create() falls back to the schema default and update() leaves the
// existing stored value untouched instead of clobbering it with null/''.
function buildDocFromBody(config, body) {
  const doc = {};
  for (const field of config.fields) {
    if (!(field.key in body)) continue;
    doc[field.key] = coerceFieldValue(field, body[field.key]);
  }
  return doc;
}

// requireAllFields: true (create) treats a required field missing from doc entirely as
// invalid; false (update) only rejects a required field that was submitted but blanked
// out — an omitted key just means "not being changed", leaving the stored value as-is.
function validateDoc(config, doc, { requireAllFields = true } = {}) {
  for (const field of config.fields) {
    if (!field.required) continue;
    const present = field.key in doc;
    if (!present) {
      if (requireAllFields) throw new BadRequestError(`Thiếu trường bắt buộc: ${field.header}`);
      continue;
    }
    if (doc[field.key] === null || doc[field.key] === '') {
      throw new BadRequestError(`Thiếu trường bắt buộc: ${field.header}`);
    }
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Runs in the background after startImport() has already responded to the HTTP request —
// parses + bulkWrites in chunks of IMPORT_CHUNK_SIZE so a 77k-row file doesn't hold one
// giant bulkWrite payload, and saves progress after each chunk so polling getImport() sees
// rowsInserted/rowsUpdated climb instead of jumping from 0 to done at the very end.
async function runImportJob(catalogImport, config, buffer) {
  try {
    const { rows, warnings } = await config.parse(buffer);
    catalogImport.rowsParsed = rows.length;
    catalogImport.warnings = warnings;
    await catalogImport.save();

    let rowsInserted = 0;
    let rowsUpdated = 0;

    for (const chunk of chunkArray(rows, IMPORT_CHUNK_SIZE)) {
      // dedup: false (drug) — always insert a new document, never match/overwrite an
      // existing one by key. Other catalog types keep the upsert-by-uniqueKey behavior.
      const operations =
        config.dedup === false
          ? chunk.map((row) => ({
              insertOne: { document: { ...row, lastImportId: catalogImport._id, updatedAt: new Date() } },
            }))
          : chunk.map((row) => ({
              updateOne: {
                filter: config.uniqueKey(row),
                update: { $set: { ...row, lastImportId: catalogImport._id, updatedAt: new Date() } },
                upsert: true,
              },
            }));
      const result = await config.model.bulkWrite(operations);
      rowsInserted += (result.upsertedCount || 0) + (result.insertedCount || 0);
      // matchedCount, không phải modifiedCount: một dòng trùng y hệt bản ghi đã có (kể cả
      // vừa được thêm bởi dòng khác trong cùng file) khớp filter nhưng không đổi nội dung
      // gì (kể cả updatedAt, nếu cùng mili-giây) — MongoDB báo modifiedCount 0, khiến dòng
      // đó "biến mất" khỏi tổng thêm mới + cập nhật dù đã được xử lý đúng.
      rowsUpdated += result.matchedCount || 0;

      catalogImport.rowsInserted = rowsInserted;
      catalogImport.rowsUpdated = rowsUpdated;
      await catalogImport.save();
    }

    catalogImport.status = 'success';
    await catalogImport.save();
  } catch (err) {
    catalogImport.status = 'failed';
    catalogImport.warnings = [...(catalogImport.warnings || []), `Lỗi xử lý: ${err.message}`];
    await catalogImport.save().catch(() => {});
    logger.error(`Import job thất bại (importId=${catalogImport._id}):`, err);
  }
}

async function startImport({ type, buffer, fileName, userId }) {
  const config = getConfigOrThrow(type);

  const catalogImport = await CatalogImport.create({
    catalogType: type,
    fileName,
    importedBy: userId,
    status: 'processing',
  });

  // Fire-and-forget: don't await, so the HTTP response returns immediately regardless of
  // file size. runImportJob updates `catalogImport` itself as it progresses/finishes.
  runImportJob(catalogImport, config, buffer);

  return { importId: catalogImport._id, status: catalogImport.status };
}

async function getImport(type, importId) {
  getConfigOrThrow(type);
  const record = await CatalogImport.findOne({ _id: importId, catalogType: type })
    .populate('importedBy', 'username')
    .lean();
  if (!record) throw new NotFoundError('Không tìm thấy lượt nhập');
  return record;
}

async function listCatalog({ type, q, page = 1, pageSize = 20, activeOn }) {
  const config = getConfigOrThrow(type);
  const filter = {};

  if (q) {
    const regex = new RegExp(escapeRegExp(q.trim()), 'i');
    filter.$or = config.searchFields.map((field) => ({ [field]: regex }));
  }

  if (activeOn) {
    const date = new Date(activeOn);
    filter.tuNgay = { $lte: date };
    filter.$and = [{ $or: [{ denNgay: null }, { denNgay: { $gte: date } }] }];
  }

  const skip = (Math.max(1, page) - 1) * pageSize;
  const [items, total] = await Promise.all([
    config.model.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    config.model.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function listImports(type) {
  getConfigOrThrow(type);
  return CatalogImport.find({ catalogType: type })
    .sort({ createdAt: -1 })
    .populate('importedBy', 'username')
    .lean();
}

function toDuplicateKeyMessage(type) {
  if (type === 'drug') return 'Đã tồn tại dòng thuốc với cùng mã, từ ngày và TT thầu.';
  if (type === 'service') return 'Đã tồn tại dòng dịch vụ với cùng mã và từ ngày.';
  if (type === 'doctor') return 'Đã tồn tại bác sĩ với cùng mã CCHN.';
  if (type === 'serviceGroup') return 'Đã tồn tại dòng với cùng mã (MA).';
  if (type === 'vatTu') return 'Đã tồn tại dòng vật tư với cùng mã, TT thầu và mã CSKCB.';
  if (type === 'benefitRate') return 'Đã tồn tại dòng mức hưởng với cùng mã đối tượng (MA) và nhóm (NHOM).';
  return 'Đã tồn tại mã lỗi với cùng từ ngày.';
}

async function createItem({ type, body }) {
  const config = getConfigOrThrow(type);
  const doc = buildDocFromBody(config, body);
  // tuNgay is required by the errorCode schema but no longer collected in the manual
  // add/edit form (nhomLoi/apDungTruong/denNgay are hidden too) — default it to today
  // so the required-field check still passes and rows keep their schema defaults.
  if (type === 'errorCode' && doc.tuNgay === undefined) {
    doc.tuNgay = new Date();
  }
  // drug catalog rows have no TU_NGAY column in their real file format (see
  // drugCatalogParser.js) and it's not collected in the manual form either — default to
  // a far-past date so reconciliation's date-range matching never excludes the row.
  if (type === 'drug' && doc.tuNgay === undefined) {
    doc.tuNgay = new Date('2000-01-01');
  }
  validateDoc(config, doc);
  try {
    return await config.model.create(doc);
  } catch (err) {
    if (err.code === 11000) throw new BadRequestError(toDuplicateKeyMessage(type));
    throw err;
  }
}

async function updateItem({ type, id, body }) {
  const config = getConfigOrThrow(type);
  const doc = buildDocFromBody(config, body);
  validateDoc(config, doc, { requireAllFields: false });
  try {
    const updated = await config.model.findByIdAndUpdate(
      id,
      { $set: { ...doc, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!updated) throw new NotFoundError('Không tìm thấy dòng danh mục');
    return updated;
  } catch (err) {
    if (err.code === 11000) throw new BadRequestError(toDuplicateKeyMessage(type));
    throw err;
  }
}

async function deleteItem({ type, id }) {
  const config = getConfigOrThrow(type);
  const deleted = await config.model.findByIdAndDelete(id);
  if (!deleted) throw new NotFoundError('Không tìm thấy dòng danh mục');
  return deleted;
}

async function generateTemplate(type) {
  const config = getConfigOrThrow(type);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mau');
  sheet.addRow(config.fields.map((f) => f.header));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(config.fields.map((f) => f.example ?? ''));
  sheet.columns.forEach((col) => {
    col.width = 20;
  });
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  startImport,
  getImport,
  listCatalog,
  listImports,
  createItem,
  updateItem,
  deleteItem,
  generateTemplate,
  getCatalogCounts,
  NotFoundError,
  BadRequestError,
};

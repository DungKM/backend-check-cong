const ExcelJS = require('exceljs');
const DrugCatalogMaster = require('../models/DrugCatalogMaster');
const ServiceCatalogMaster = require('../models/ServiceCatalogMaster');
const ErrorCodeCatalog = require('../models/ErrorCodeCatalog');
const DoctorCatalogMaster = require('../models/DoctorCatalogMaster');
const CatalogImport = require('../models/CatalogImport');
const { parseDrugCatalogWorkbook } = require('../parsers/drugCatalogParser');
const { parseServiceCatalogWorkbook } = require('../parsers/serviceCatalogParser');
const { parseErrorCodeCatalogWorkbook } = require('../parsers/errorCodeCatalogParser');
const { parseDoctorCatalogWorkbook } = require('../parsers/doctorCatalogParser');
const { REJECT_REASON_CATEGORY, MA_LOI_MUC_DO, MA_LOI_AP_DUNG_TRUONG } = require('../config/constants');

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
    uniqueKey: (row) => ({ maThuoc: row.maThuoc, tuNgay: row.tuNgay, ttThau: row.ttThau }),
    searchFields: ['maThuoc', 'tenThuoc'],
    fields: [
      { key: 'maThuoc', header: 'MA_THUOC', type: 'string', required: true, example: 'T001' },
      { key: 'tenThuoc', header: 'TEN_THUOC', type: 'string', required: true, example: 'Paracetamol' },
      { key: 'donViTinh', header: 'DON_VI_TINH', type: 'string', example: 'Viên' },
      { key: 'hamLuong', header: 'HAM_LUONG', type: 'string', example: '500mg' },
      { key: 'soDangKy', header: 'SO_DANG_KY', type: 'string', example: 'VD-12345-19' },
      { key: 'donGiaBH', header: 'DON_GIA_BH', type: 'number', example: 1000 },
      { key: 'ttThau', header: 'TT_THAU', type: 'string', example: 'TT01' },
      { key: 'tuNgay', header: 'TU_NGAY', type: 'date', required: true, example: '2024-01-01' },
      { key: 'denNgay', header: 'DEN_NGAY', type: 'date', example: '2024-12-31' },
      { key: 'maCSKCB', header: 'MA_CSKCB', type: 'string', example: 'CSKCB01' },
    ],
  },
  service: {
    model: ServiceCatalogMaster,
    parse: parseServiceCatalogWorkbook,
    uniqueKey: (row) => ({ maTuongDuong: row.maTuongDuong, tuNgay: row.tuNgay }),
    searchFields: ['maTuongDuong', 'tenDvktPheDuyet'],
    fields: [
      { key: 'maTuongDuong', header: 'MA_TUONG_DUONG', type: 'string', required: true, example: 'S001' },
      { key: 'tenDvktPheDuyet', header: 'TEN_DVKT_PHEDUYET', type: 'string', required: true, example: 'Khám nội khoa' },
      { key: 'donGia', header: 'DON_GIA', type: 'number', example: 50000 },
      { key: 'tuNgay', header: 'TUNGAY', type: 'date', required: true, example: '2024-01-01' },
      { key: 'denNgay', header: 'DENNGAY', type: 'date', example: '2024-12-31' },
      { key: 'maCSKCB', header: 'MA_CSKCB', type: 'string', example: 'CSKCB01' },
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
};

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

async function importCatalog({ type, buffer, fileName, userId }) {
  const config = getConfigOrThrow(type);
  const { rows, warnings } = await config.parse(buffer);

  const catalogImport = await CatalogImport.create({
    catalogType: type,
    fileName,
    importedBy: userId,
    rowsParsed: rows.length,
    warnings,
    status: 'success',
  });

  let rowsInserted = 0;
  let rowsUpdated = 0;

  if (rows.length > 0) {
    const operations = rows.map((row) => ({
      updateOne: {
        filter: config.uniqueKey(row),
        update: { $set: { ...row, lastImportId: catalogImport._id, updatedAt: new Date() } },
        upsert: true,
      },
    }));
    const result = await config.model.bulkWrite(operations);
    rowsInserted = result.upsertedCount || 0;
    rowsUpdated = result.modifiedCount || 0;
  }

  catalogImport.rowsInserted = rowsInserted;
  catalogImport.rowsUpdated = rowsUpdated;
  await catalogImport.save();

  return {
    importId: catalogImport._id,
    rowsParsed: rows.length,
    rowsInserted,
    rowsUpdated,
    warnings,
  };
}

async function listCatalog({ type, q, page = 1, pageSize = 20, activeOn }) {
  const config = getConfigOrThrow(type);
  const filter = {};

  if (q) {
    const regex = new RegExp(q.trim(), 'i');
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
  importCatalog,
  listCatalog,
  listImports,
  createItem,
  updateItem,
  deleteItem,
  generateTemplate,
  NotFoundError,
  BadRequestError,
};

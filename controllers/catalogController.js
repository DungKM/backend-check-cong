const { asyncHandler } = require('../utils/asyncHandler');
const catalogService = require('../services/catalogService');

const CATALOG_UPLOAD_LABELS = {
  drug: 'danh mục thuốc',
  service: 'danh mục dịch vụ kỹ thuật',
  errorCode: 'danh mục mã lỗi',
  doctor: 'danh mục bác sĩ',
};

const importCatalog = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!req.file) {
    const label = CATALOG_UPLOAD_LABELS[type] || 'danh mục';
    return res.status(400).json({ message: `Vui lòng chọn file ${label}` });
  }
  const result = await catalogService.importCatalog({
    type,
    userId: req.user.id,
    buffer: req.file.buffer,
    fileName: req.file.originalname,
  });
  res.json(result);
});

const listCatalog = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { q, page, pageSize, activeOn } = req.query;
  const result = await catalogService.listCatalog({ type, q, page: Number(page) || 1, pageSize: Number(pageSize) || 20, activeOn });
  res.json(result);
});

const listImports = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const result = await catalogService.listImports(type);
  res.json(result);
});

const createItem = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const item = await catalogService.createItem({ type, body: req.body });
  res.status(201).json(item);
});

const updateItem = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const item = await catalogService.updateItem({ type, id, body: req.body });
  res.json(item);
});

const deleteItem = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  await catalogService.deleteItem({ type, id });
  res.json({ ok: true });
});

const downloadTemplate = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const buffer = await catalogService.generateTemplate(type);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="mau-${type}.xlsx"`);
  res.send(Buffer.from(buffer));
});

module.exports = {
  importCatalog,
  listCatalog,
  listImports,
  createItem,
  updateItem,
  deleteItem,
  downloadTemplate,
};

const { asyncHandler } = require('../utils/asyncHandler');
const batchService = require('../services/batchService');

const listBatches = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await batchService.listBatches({ page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  res.json(result);
});

const getClaimFiles = asyncHandler(async (req, res) => {
  const result = await batchService.getClaimFiles(req.params.batchId);
  if (!result) return res.status(404).json({ message: `Không tìm thấy đợt đối chiếu: ${req.params.batchId}` });
  res.json(result);
});

const getClaimFileXmlTypes = asyncHandler(async (req, res) => {
  const result = await batchService.getClaimFileXmlTypes(req.params.batchId, req.params.fileName);
  res.json(result);
});

const getClaimFileXmlRows = asyncHandler(async (req, res) => {
  const rows = await batchService.getClaimFileXmlRows(req.params.batchId, req.params.fileName, req.params.xmlType);
  res.json({ rows });
});

module.exports = { listBatches, getClaimFiles, getClaimFileXmlTypes, getClaimFileXmlRows };

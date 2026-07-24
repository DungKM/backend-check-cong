const { asyncHandler } = require('../utils/asyncHandler');
const reconciliationService = require('../services/reconciliationService');
const exportService = require('../services/exportService');

const runAnalyze = asyncHandler(async (req, res) => {
  const { batchId } = req.body;
  if (!batchId) {
    return res.status(400).json({ message: 'Thiếu batchId' });
  }
  const result = await reconciliationService.runAnalysis(batchId);
  res.json(result);
});

const getResults = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { ketLuan, maKhoa, loaiGiamTru } = req.query;
  const results = await reconciliationService.getResults(batchId, { ketLuan, maKhoa, loaiGiamTru });
  res.json({ batchId, results });
});

const getSummary = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const summary = await reconciliationService.getSummary(batchId);
  res.json(summary);
});

const exportExcel = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const buffer = await exportService.exportAnalysisToExcel(batchId);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="doi-chieu-${batchId}.xlsx"`);
  res.send(Buffer.from(buffer));
});

module.exports = { runAnalyze, getResults, getSummary, exportExcel };

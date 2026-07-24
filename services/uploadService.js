const crypto = require('crypto');
const Batch = require('../models/Batch');
const ClaimItem = require('../models/ClaimItem');
const { parseClaimXmlBuffer } = require('../parsers/xml/xmlClaimParser');

async function getOrCreateBatch(batchId, userId) {
  if (batchId) {
    const existing = await Batch.findOne({ batchId });
    if (existing) return existing;
  }
  const newBatchId = batchId || crypto.randomUUID();
  return Batch.create({ batchId: newBatchId, createdBy: userId });
}

async function ingestClaimXml({ batchId, userId, files }) {
  const batch = await getOrCreateBatch(batchId, userId);

  const allRows = [];
  const allWarnings = [];
  const fileNames = [];

  for (const file of files) {
    fileNames.push(file.originalname);
    const { rows, warnings } = await parseClaimXmlBuffer(file.buffer, file.originalname);
    allRows.push(...rows);
    allWarnings.push(...warnings.map((w) => `[${file.originalname}] ${w}`));
  }

  await ClaimItem.deleteMany({ batchId: batch.batchId });
  if (allRows.length > 0) {
    await ClaimItem.insertMany(allRows.map((row) => ({ ...row, batchId: batch.batchId })));
  }

  batch.claimFileNames = fileNames;
  batch.rowCounts.claimRows = allRows.length;
  batch.status = 'uploaded';
  await batch.save();

  return { batchId: batch.batchId, rowCount: allRows.length, warnings: allWarnings };
}

module.exports = { getOrCreateBatch, ingestClaimXml };

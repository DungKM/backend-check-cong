const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  errorReportFileNames: { type: [String], default: [] },
  drugCatalogFileName: { type: String },
  serviceCatalogFileName: { type: String },
  claimFileNames: { type: [String], default: [] },
  // Per-file breakdown of the last claim-XML upload — powers the "bảng tổng hợp theo
  // file" view (ClaimFilesPage). `status` is 'error' when the file itself failed to
  // parse (e.g. not a valid GIAMDINHHS wrapper) — other files in the same upload are
  // unaffected. Populated by uploadService.ingestClaimXml.
  claimFiles: {
    type: [
      {
        fileName: { type: String, trim: true },
        status: { type: String, enum: ['success', 'error'], default: 'success' },
        maLK: { type: String, trim: true },
        hoTen: { type: String, trim: true },
        rowCount: { type: Number, default: 0 },
        parseWarningCount: { type: Number, default: 0 },
        errorMessage: { type: String, trim: true },
        _id: false,
      },
    ],
    default: [],
  },
  rowCounts: {
    errorRows: { type: Number, default: 0 },
    drugRows: { type: Number, default: 0 },
    serviceRows: { type: Number, default: 0 },
    claimRows: { type: Number, default: 0 },
  },
  status: {
    type: String,
    enum: ['uploaded', 'analyzing', 'analyzed', 'failed'],
    default: 'uploaded',
  },
  analyzedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Batch', batchSchema);

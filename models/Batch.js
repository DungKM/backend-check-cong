const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  errorReportFileNames: { type: [String], default: [] },
  drugCatalogFileName: { type: String },
  serviceCatalogFileName: { type: String },
  claimFileNames: { type: [String], default: [] },
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

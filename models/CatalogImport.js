const mongoose = require('mongoose');

const catalogImportSchema = new mongoose.Schema({
  catalogType: { type: String, enum: ['drug', 'service', 'errorCode', 'doctor'], required: true, index: true },
  fileName: { type: String, trim: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rowsParsed: { type: Number, default: 0 },
  rowsInserted: { type: Number, default: 0 },
  rowsUpdated: { type: Number, default: 0 },
  rowsSkipped: { type: Number, default: 0 },
  warnings: { type: [String], default: [] },
  status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
  createdAt: { type: Date, default: Date.now },
});

catalogImportSchema.index({ catalogType: 1, createdAt: -1 });

module.exports = mongoose.model('CatalogImport', catalogImportSchema);

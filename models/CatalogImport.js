const mongoose = require('mongoose');

const catalogImportSchema = new mongoose.Schema({
  // Not an enum: the list of valid catalog types lives in catalogService.js's
  // CATALOG_CONFIG and is already validated there (getConfigOrThrow) — duplicating it
  // as a hardcoded enum here just means it goes stale every time a catalog type is added.
  catalogType: { type: String, required: true, index: true },
  fileName: { type: String, trim: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rowsParsed: { type: Number, default: 0 },
  rowsInserted: { type: Number, default: 0 },
  rowsUpdated: { type: Number, default: 0 },
  rowsSkipped: { type: Number, default: 0 },
  warnings: { type: [String], default: [] },
  status: { type: String, enum: ['processing', 'success', 'partial', 'failed'], default: 'processing' },
  createdAt: { type: Date, default: Date.now },
});

catalogImportSchema.index({ catalogType: 1, createdAt: -1 });

module.exports = mongoose.model('CatalogImport', catalogImportSchema);

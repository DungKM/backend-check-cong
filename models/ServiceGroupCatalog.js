const mongoose = require('mongoose');

const serviceGroupCatalogSchema = new mongoose.Schema({
  ma: { type: String, required: true, trim: true },
  ten: { type: String, trim: true },
  loaiPTTT: { type: String, trim: true },
  maGia: { type: String, trim: true },
  tenGia: { type: String, trim: true },
  gia: { type: Number },
  giaSau: { type: Number },
  ghiChu: { type: String, trim: true },
  maNhom: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

serviceGroupCatalogSchema.index({ ma: 1 }, { unique: true });

module.exports = mongoose.model('ServiceGroupCatalog', serviceGroupCatalogSchema);

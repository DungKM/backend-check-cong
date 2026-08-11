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

// Không unique: file nguồn có nhiều dòng chia sẻ cùng MA nhưng khác GIA/LOAIPTTT/GHICHU
// (biến thể phân loại/giá hợp lệ) — xem catalogService.js CATALOG_CONFIG.serviceGroup.
serviceGroupCatalogSchema.index({ ma: 1 });

module.exports = mongoose.model('ServiceGroupCatalog', serviceGroupCatalogSchema);

const mongoose = require('mongoose');

const serviceCatalogSchema = new mongoose.Schema({
  maTuongDuong: { type: String, required: true, trim: true },
  tenDvktPheDuyet: { type: String, required: true, trim: true },
  donGia: { type: Number },
  tuNgay: { type: Date, required: true },
  denNgay: { type: Date, default: null },
  batchId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
});

serviceCatalogSchema.index({ maTuongDuong: 1 });

module.exports = mongoose.model('ServiceCatalog', serviceCatalogSchema);

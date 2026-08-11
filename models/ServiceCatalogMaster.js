const mongoose = require('mongoose');

const serviceCatalogMasterSchema = new mongoose.Schema({
  maTuongDuong: { type: String, required: true, trim: true },
  tenDvktPheDuyet: { type: String, required: true, trim: true },
  donGia: { type: Number },
  tuNgay: { type: Date, required: true },
  denNgay: { type: Date, default: null },
  maCSKCB: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Không unique: cùng mã tương đương + từ ngày nhưng khác tên/đơn giá/CSKCB là bản ghi
// hợp lệ khác nhau — xem catalogService.js CATALOG_CONFIG.service.
serviceCatalogMasterSchema.index({ maTuongDuong: 1, tuNgay: 1 });
serviceCatalogMasterSchema.index({ maTuongDuong: 1, tuNgay: 1, denNgay: 1 });

module.exports = mongoose.model('ServiceCatalogMaster', serviceCatalogMasterSchema);

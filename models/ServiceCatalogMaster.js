const mongoose = require('mongoose');

const serviceCatalogMasterSchema = new mongoose.Schema({
  maTuongDuong: { type: String, required: true, trim: true },
  tenDvktPheDuyet: { type: String, required: true, trim: true },
  tenDvktGia: { type: String, trim: true },
  phanLoaiPTTT: { type: String, trim: true },
  donGia: { type: Number },
  ghiChu: { type: String, trim: true },
  quyetDinh: { type: String, trim: true },
  tuNgay: { type: Date, required: true },
  denNgay: { type: Date, default: null },
  maCSKCB: { type: String, trim: true },
  cskcbCgkt: { type: String, trim: true },
  cskcbCls: { type: String, trim: true },
  maBanGhiNguon: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Không unique: cùng mã tương đương + từ ngày nhưng khác tên/đơn giá/CSKCB là bản ghi
// hợp lệ khác nhau — xem catalogService.js CATALOG_CONFIG.service.
serviceCatalogMasterSchema.index({ maTuongDuong: 1, tuNgay: 1 });
serviceCatalogMasterSchema.index({ maTuongDuong: 1, tuNgay: 1, denNgay: 1 });

module.exports = mongoose.model('ServiceCatalogMaster', serviceCatalogMasterSchema);

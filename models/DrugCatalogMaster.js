const mongoose = require('mongoose');

const drugCatalogMasterSchema = new mongoose.Schema({
  maThuoc: { type: String, required: true, trim: true },
  tenThuoc: { type: String, required: true, trim: true },
  donViTinh: { type: String, trim: true },
  hamLuong: { type: String, trim: true },
  soDangKy: { type: String, trim: true },
  donGiaBH: { type: Number },
  ttThau: { type: String, trim: true },
  tuNgay: { type: Date, required: true },
  denNgay: { type: Date, default: null },
  maCSKCB: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

drugCatalogMasterSchema.index({ maThuoc: 1, tuNgay: 1, ttThau: 1 }, { unique: true });
drugCatalogMasterSchema.index({ maThuoc: 1, tuNgay: 1, denNgay: 1 });

module.exports = mongoose.model('DrugCatalogMaster', drugCatalogMasterSchema);

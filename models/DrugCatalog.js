const mongoose = require('mongoose');

const drugCatalogSchema = new mongoose.Schema({
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
  batchId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
});

drugCatalogSchema.index({ maThuoc: 1, tuNgay: 1, denNgay: 1 });

module.exports = mongoose.model('DrugCatalog', drugCatalogSchema);

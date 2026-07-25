const mongoose = require('mongoose');

const vatTuCatalogMasterSchema = new mongoose.Schema({
  maVatTu: { type: String, required: true, trim: true },
  nhomVatTu: { type: String, trim: true },
  tenVatTu: { type: String, required: true, trim: true },
  maHieu: { type: String, trim: true },
  hangSx: { type: String, trim: true },
  donViTinh: { type: String, trim: true },
  donGia: { type: Number },
  donGiaBH: { type: Number },
  tyLeTtBh: { type: Number },
  soLuong: { type: Number },
  dinhMuc: { type: String, trim: true },
  nhaThau: { type: String, trim: true },
  ttThau: { type: String, trim: true },
  maCSKCB: { type: String, trim: true },
  loaiThau: { type: String, trim: true },
  htThau: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

vatTuCatalogMasterSchema.index({ maVatTu: 1, ttThau: 1, maCSKCB: 1 }, { unique: true });

module.exports = mongoose.model('VatTuCatalogMaster', vatTuCatalogMasterSchema);

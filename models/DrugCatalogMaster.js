const mongoose = require('mongoose');

const drugCatalogMasterSchema = new mongoose.Schema({
  maThuoc: { type: String, required: true, trim: true },
  tenHoatChat: { type: String, trim: true },
  tenThuoc: { type: String, required: true, trim: true },
  donViTinh: { type: String, trim: true },
  hamLuong: { type: String, trim: true },
  duongDung: { type: String, trim: true },
  maDuongDung: { type: String, trim: true },
  dangBaoChe: { type: String, trim: true },
  soDangKy: { type: String, trim: true },
  soLuong: { type: Number },
  donGia: { type: Number },
  donGiaBH: { type: Number },
  quyCach: { type: String, trim: true },
  nhaSx: { type: String, trim: true },
  nuocSx: { type: String, trim: true },
  nhaThau: { type: String, trim: true },
  ttThau: { type: String, trim: true },
  tuNgay: { type: Date, required: true },
  denNgay: { type: Date, default: null },
  maCSKCB: { type: String, trim: true },
  loaiThuoc: { type: String, trim: true },
  loaiThau: { type: String, trim: true },
  htThau: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Không còn unique index theo (maThuoc, tuNgay, ttThau) — import thuốc giờ luôn thêm
// dòng mới, không upsert/kiểm tra trùng (nhiều dòng có thể cùng mã thuốc nhưng khác
// nhà sản xuất/nhà thầu/số lượng...). Giữ lại index thường (không unique) để tăng tốc
// truy vấn đối chiếu theo mã + hiệu lực ngày.
drugCatalogMasterSchema.index({ maThuoc: 1, tuNgay: 1, denNgay: 1 });

module.exports = mongoose.model('DrugCatalogMaster', drugCatalogMasterSchema);

const mongoose = require('mongoose');

// Bảng tra % chi trả BHYT theo mã đối tượng (2 ký tự đầu MA_THE_BHYT, VD "TC") + MA_LOAI_KCB
// (cột NHOM) -> % chi trả khi đúng tuyến/trái tuyến. Dùng để đối chiếu MUC_HUONG khai trên
// XML3 (checkMucHuong.js), thay cho suy đoán 1 mức chung theo ký tự thứ 3 của mã thẻ.
const benefitRateCatalogSchema = new mongoose.Schema({
  ma: { type: String, required: true, trim: true, uppercase: true },
  nhom: { type: String, required: true, trim: true },
  chiTraDungTuyen: { type: Number },
  chiTraTraiTuyen: { type: Number },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

benefitRateCatalogSchema.index({ ma: 1, nhom: 1 }, { unique: true });

module.exports = mongoose.model('BenefitRateCatalog', benefitRateCatalogSchema);

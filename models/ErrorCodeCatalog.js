const mongoose = require('mongoose');
const { REJECT_REASON_CATEGORY, MA_LOI_MUC_DO, MA_LOI_AP_DUNG_TRUONG } = require('../config/constants');

const errorCodeCatalogSchema = new mongoose.Schema({
  maLoi: { type: String, required: true, trim: true },
  tenLoi: { type: String, required: true, trim: true },
  dienGiai: { type: String, trim: true },
  nhomLoi: {
    type: String,
    enum: Object.values(REJECT_REASON_CATEGORY),
    default: REJECT_REASON_CATEGORY.KHONG_XAC_DINH,
  },
  // Pins this mã lỗi to one specific mismatch kind (a chiTietLech "truong" label, or
  // KHONG_TIM_THAY for "mã không có trong danh mục"). Left blank, it applies broadly
  // to every row in `nhomLoi` — kept as a fallback for untagged/legacy rows so existing
  // data still predicts something, but tagging is what gives distinct rows distinct codes.
  apDungTruong: { type: String, enum: [...Object.values(MA_LOI_AP_DUNG_TRUONG), ''], default: '' },
  mucDo: { type: String, enum: Object.values(MA_LOI_MUC_DO), default: MA_LOI_MUC_DO.CANH_BAO },
  ghiChu: { type: String, trim: true },
  active: { type: Boolean, default: true },
  tuNgay: { type: Date, required: true },
  denNgay: { type: Date, default: null },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

errorCodeCatalogSchema.index({ maLoi: 1, tuNgay: 1 }, { unique: true });

module.exports = mongoose.model('ErrorCodeCatalog', errorCodeCatalogSchema);

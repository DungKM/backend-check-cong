const mongoose = require('mongoose');
const { KET_LUAN, REJECT_REASON_CATEGORY, MA_LOI_MUC_DO } = require('../config/constants');

const chiTietLechSchema = new mongoose.Schema(
  {
    truong: { type: String, required: true },
    giaTriXML: { type: String, default: '' },
    giaTriDanhMuc: { type: String, default: '' },
  },
  { _id: false }
);

const duDoanMaLoiSchema = new mongoose.Schema(
  {
    maLoi: { type: String, required: true },
    tenLoi: { type: String, default: '' },
    dienGiai: { type: String, default: '' },
    mucDo: { type: String, enum: Object.values(MA_LOI_MUC_DO) },
  },
  { _id: false }
);

const analysisResultSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  errorRowId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClaimItem', required: true },
  ketLuan: { type: String, enum: Object.values(KET_LUAN), required: true },
  chiTietLech: { type: [chiTietLechSchema], default: [] },
  rejectReasonCategory: { type: String, enum: Object.values(REJECT_REASON_CATEGORY) },
  duDoanMaLoi: { type: [duDoanMaLoiSchema], default: [] },
  ghiChu: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

analysisResultSchema.index({ batchId: 1, ketLuan: 1 });
analysisResultSchema.index({ errorRowId: 1 });

module.exports = mongoose.model('AnalysisResult', analysisResultSchema);

const mongoose = require('mongoose');

const claimItemSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  maLK: { type: String, trim: true },
  maCSKCB: { type: String, trim: true },
  xmlType: { type: String, trim: true },
  maBN: { type: String, trim: true },
  hoTen: { type: String, trim: true },
  ngaySinh: { type: Date },
  soCCCD: { type: String, trim: true },
  ngayVao: { type: Date },
  ngayRa: { type: Date },
  loaiKCB: { type: String, trim: true },
  maKhoa: { type: String, trim: true },
  maBacSi: { type: String, trim: true },
  loaiChiPhi: { type: String, trim: true },
  maChiPhi: { type: String, required: true, trim: true },
  tenChiPhi: { type: String, trim: true },
  soDangKy: { type: String, trim: true },
  ttThau: { type: String, trim: true },
  donViTinh: { type: String, trim: true },
  duongDung: { type: String, trim: true },
  hamLuong: { type: String, trim: true },
  soLuong: { type: Number },
  donGia: { type: Number },
  deNghi: { type: Number },
  giamTru: { type: Number },
  ngayYLenh: { type: Date },
  ngayTT: { type: Date },
  lyDoTuChoi: { type: String, trim: true },
  loaiGiamTru: { type: String, trim: true },
  sttXML: { type: String, trim: true },
  sourceSheet: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

claimItemSchema.index({ batchId: 1, maChiPhi: 1 });

module.exports = mongoose.model('ClaimItem', claimItemSchema);

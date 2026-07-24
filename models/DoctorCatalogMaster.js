const mongoose = require('mongoose');

const doctorCatalogMasterSchema = new mongoose.Schema({
  hoTen: { type: String, required: true, trim: true },
  maCCHN: { type: String, required: true, trim: true },
  maCSKCB: { type: String, trim: true },
  lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogImport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

doctorCatalogMasterSchema.index({ maCCHN: 1 }, { unique: true });

module.exports = mongoose.model('DoctorCatalogMaster', doctorCatalogMasterSchema);

const mongoose = require('mongoose');

// Raw (un-normalized) records extracted from each uploaded XML file — one document per
// XML1..XML13 record — used only to render the per-file "xem theo tab" detail viewer.
// Field names inside `data` are kept exactly as they appear in the source XML (see
// xmlClaimParser.extractXmlDetailRecords), unlike ClaimItem which normalizes them for
// the reconciliation engine.
const claimXmlDetailSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  fileName: { type: String, trim: true },
  maLK: { type: String, trim: true },
  xmlType: { type: String, trim: true },
  sttXML: { type: String, trim: true },
  data: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

claimXmlDetailSchema.index({ batchId: 1, fileName: 1, xmlType: 1 });

module.exports = mongoose.model('ClaimXmlDetail', claimXmlDetailSchema);

const multer = require('multer');

const SPREADSHEET_EXTENSIONS = /\.(xlsx|xls|csv)$/i;
const XML_EXTENSIONS = /\.(xml|zip)$/i;

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!SPREADSHEET_EXTENSIONS.test(file.originalname)) {
      return cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls, .csv)'));
    }
    cb(null, true);
  },
});

const uploadXml = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!XML_EXTENSIONS.test(file.originalname)) {
      return cb(new Error('Chỉ chấp nhận file XML hoặc ZIP (.xml, .zip)'));
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadXml };
